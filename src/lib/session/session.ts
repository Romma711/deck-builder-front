/**
 * Store de sesión: gestiona el par de tokens JWT del backend.
 *
 * - access_token: SOLO en memoria (no se persiste para reducir exposición a XSS).
 * - refresh_token: en localStorage, con rotación en cada refresh.
 *
 * Flujo de refresh: el cliente API llama a `ensureAccessToken()` antes de cada
 * petición autenticada y a `refreshSession()` ante un 401. El refresh es
 * single-flight dentro de la pestaña y se serializa ENTRE pestañas con la Web
 * Locks API: todas comparten el mismo refresh token y, sin el lock, dos
 * pestañas podrían rotarlo a la vez y el backend lo tomaría como reuso
 * (revocando la familia entera).
 *
 * El snapshot es inmutable y solo cambia cuando cambia el estado, como exige
 * `useSyncExternalStore`. En el servidor (y durante la hidratación) se usa
 * `SERVER_SNAPSHOT`, porque el servidor no puede leer localStorage.
 */

import type { TokenPair } from '../../types/api';

export const REFRESH_STORAGE_KEY = 'deckbuilder.refresh_token';
const REFRESH_LOCK_NAME = 'deckbuilder.refresh';
/** Margen para renovar el access token antes de que expire de verdad. */
const EXPIRY_SKEW_MS = 30_000;

type Listener = (session: SessionState) => void;

export interface SessionState {
  /** true si hay un refresh token almacenado (sesión potencialmente válida) */
  readonly isAuthenticated: boolean;
  /** true mientras se intenta renovar el access token */
  readonly isRefreshing: boolean;
}

/** Snapshot fijo para SSR e hidratación: el servidor nunca ve la sesión. */
export const SERVER_SNAPSHOT: SessionState = Object.freeze({
  isAuthenticated: false,
  isRefreshing: false,
});

let accessToken: string | null = null;
/** Epoch ms en que expira el access token (null = desconocido). */
let accessExpiresAt: number | null = null;
let refreshInFlight: Promise<string | null> | null = null;
let snapshot: SessionState | null = null;
const listeners = new Set<Listener>();

// ---------------------------------------------------------------------------
// localStorage seguro (SSR, modo privado, storage bloqueado)
// ---------------------------------------------------------------------------

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Sin storage la sesión vive solo en memoria (se pierde al recargar).
  }
}

// ---------------------------------------------------------------------------
// Estado y suscripción
// ---------------------------------------------------------------------------

function computeState(): SessionState {
  return {
    isAuthenticated: accessToken !== null || getStoredRefreshToken() !== null,
    isRefreshing: refreshInFlight !== null,
  };
}

function notify(): void {
  const next = computeState();
  const prev = snapshot;
  if (prev && prev.isAuthenticated === next.isAuthenticated && prev.isRefreshing === next.isRefreshing) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener(next);
}

/** Snapshot actual (misma referencia mientras el estado no cambie). */
export function getState(): SessionState {
  if (typeof window === 'undefined') return SERVER_SNAPSHOT;
  snapshot ??= computeState();
  return snapshot;
}

/** Snapshot para `useSyncExternalStore` en SSR e hidratación. */
export function getServerState(): SessionState {
  return SERVER_SNAPSHOT;
}

/** Suscribe a cambios de sesión. Devuelve la función de unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Sincronización entre pestañas: login/logout/rotación en otra pestaña.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== REFRESH_STORAGE_KEY && event.key !== null) return;
    // Logout en otra pestaña (o storage limpiado): el access en memoria
    // pertenece a una sesión ya revocada.
    if (getStoredRefreshToken() === null) {
      accessToken = null;
      accessExpiresAt = null;
    }
    // Si otra pestaña rotó el token, nuestro access sigue siendo válido.
    notify();
  });
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** Access token vigente (null si no hay o está por expirar). */
export function getAccessToken(): string | null {
  if (accessToken && accessExpiresAt !== null && Date.now() >= accessExpiresAt - EXPIRY_SKEW_MS) {
    return null;
  }
  return accessToken;
}

export function getStoredRefreshToken(): string | null {
  return readStorage(REFRESH_STORAGE_KEY);
}

/** Guarda el par de tokens tras un login o un refresh exitoso. */
export function setSession(tokens: TokenPair): void {
  accessToken = tokens.access_token;
  accessExpiresAt = tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null;
  writeStorage(REFRESH_STORAGE_KEY, tokens.refresh_token);
  notify();
}

/** Limpia la sesión completa (logout o refresh rechazado). */
export function clearSession(): void {
  accessToken = null;
  accessExpiresAt = null;
  writeStorage(REFRESH_STORAGE_KEY, null);
  notify();
}

// ---------------------------------------------------------------------------
// Refresh con rotación
// ---------------------------------------------------------------------------

/**
 * Rota el refresh token contra el backend. Inyectada por el cliente API para
 * evitar un ciclo de imports.
 * - Devuelve el par nuevo si el refresh fue aceptado.
 * - Devuelve null si el backend lo rechazó (inválido, expirado o reusado).
 * - Lanza ante errores transitorios (red, 429, 5xx): la sesión se conserva.
 */
export type RefreshFn = (refreshToken: string) => Promise<TokenPair | null>;

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK_NAME, task);
  }
  return task();
}

/**
 * Renueva el access token. Devuelve el access nuevo, o null si la sesión
 * murió (en ese caso ya quedó limpia). Single-flight: varias peticiones con
 * 401 a la vez comparten el mismo refresh.
 */
export function refreshSession(doRefresh: RefreshFn): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  if (!getStoredRefreshToken()) {
    clearSession();
    return Promise.resolve(null);
  }

  const staleAccess = accessToken;
  refreshInFlight = withRefreshLock(async () => {
    // Otra petición/pestaña pudo haber renovado mientras esperábamos el lock.
    if (accessToken !== staleAccess && getAccessToken()) return accessToken;

    // Leer DENTRO del lock: otra pestaña pudo haberlo rotado.
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
      clearSession();
      return null;
    }

    const tokens = await doRefresh(refreshToken);
    if (!tokens) {
      clearSession();
      return null;
    }
    setSession(tokens);
    return tokens.access_token;
  }).finally(() => {
    refreshInFlight = null;
    notify();
  });

  notify();
  return refreshInFlight;
}

/**
 * Devuelve un access token usable, renovándolo si hace falta (p. ej. tras
 * recargar la página, cuando solo queda el refresh en localStorage).
 * Devuelve null si no hay sesión.
 */
export async function ensureAccessToken(doRefresh: RefreshFn): Promise<string | null> {
  const current = getAccessToken();
  if (current) return current;
  if (!getStoredRefreshToken()) return null;
  return refreshSession(doRefresh);
}
