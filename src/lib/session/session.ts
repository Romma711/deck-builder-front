/**
 * Store de sesión: gestiona el par de tokens JWT del backend.
 *
 * - access_token: SOLO en memoria (no se persiste para reducir exposición a XSS).
 * - refresh_token: en localStorage, con rotación en cada refresh.
 *
 * Flujo de refresh: al recibir un 401, el cliente API llama a `refreshSession()`
 * que rota el refresh token. Si el backend detecta reuso (401 en refresh),
 * se limpia toda la sesión (familia revocada).
 */

import type { TokenPair } from '../../types/api';

export const REFRESH_STORAGE_KEY = 'deckbuilder.refresh_token';

type Listener = (session: SessionState) => void;

export interface SessionState {
  /** true si hay un refresh token almacenado (sesión potencialmente válida) */
  isAuthenticated: boolean;
  /** true mientras se intenta renovar el access token */
  isRefreshing: boolean;
}

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  const state = getState();
  for (const listener of listeners) listener(state);
}

export function getState(): SessionState {
  return {
    isAuthenticated: accessToken !== null || getStoredRefreshToken() !== null,
    isRefreshing: refreshInFlight !== null,
  };
}

/** Suscribe a cambios de sesión. Devuelve la función de unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export function getAccessToken(): string | null {
  return accessToken;
}

export function getStoredRefreshToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(REFRESH_STORAGE_KEY);
}

/** Guarda el par de tokens tras un login o un refresh exitoso. */
export function setSession(tokens: TokenPair): void {
  accessToken = tokens.access_token;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(REFRESH_STORAGE_KEY, tokens.refresh_token);
  }
  notify();
}

/** Limpia la sesión completa (logout o refresh rechazado). */
export function clearSession(): void {
  accessToken = null;
  refreshInFlight = null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(REFRESH_STORAGE_KEY);
  }
  notify();
}

// ---------------------------------------------------------------------------
// Refresh con rotación (single-flight: varias peticiones 401 comparten uno)
// ---------------------------------------------------------------------------

type RefreshFn = () => Promise<TokenPair>;

/**
 * Intenta rotar el refresh token usando la función inyectada (para evitar
 * un ciclo de imports con el módulo auth). Devuelve un access token nuevo
 * o null si la sesión murió (refresh inválido/reusado).
 */
export function refreshSession(doRefresh: RefreshFn): Promise<string | null> {
  // Ya hay un refresh en curso: compartimos la promesa.
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    clearSession();
    return Promise.resolve(null);
  }

  refreshInFlight = (async () => {
    try {
      const tokens = await doRefresh();
      setSession(tokens);
      return tokens.access_token;
    } catch {
      // Refresh inválido, expirado o reusado (familia revocada): morir limpio.
      clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
