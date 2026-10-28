/**
 * Cliente base de la API del backend Go.
 *
 * - Adjunta el access token (en memoria) como `Authorization: Bearer`.
 * - Ante un 401, intenta UN refresh rotatorio y reintenta la petición.
 * - Si el refresh falla, limpia la sesión y dispara un evento global
 *   para que la UI mande al usuario a /login.
 */

import type { ApiErrorBody, ErrorCode } from '../../types/api';
import { clearSession, getAccessToken, getStoredRefreshToken, refreshSession } from '../session/session';

/** URL base del backend Go (configurar PUBLIC_API_URL en .env) */
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8080') + '/api/v3';

/** Evento global: la sesión murió y la UI debe reaccionar (redirect a /login). */
export const SESSION_EXPIRED_EVENT = 'deckbuilder:session-expired';

/** Error tipado de la API: expone el code del backend para decidir la UX. */
export class ApiError extends Error {
  readonly code: ErrorCode | 'NETWORK';
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(status: number, body: ApiErrorBody['error'] | null) {
    super(body?.message ?? `Error HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.code ?? 'NETWORK';
    this.details = body?.details;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serializado a JSON automáticamente */
  body?: unknown;
  /**
   * Adjunta Authorization si hay sesión (lecturas de mazos que mejoran
   * con token pero no lo exigen: `GET /decks`, `GET /decks/{id}`).
   */
  withAuthIfPresent?: boolean;
}

function buildUrl(path: string, query?: Record<string, unknown>): string {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiError(response.status, body.error);
  } catch {
    return new ApiError(response.status, null);
  }
}

async function rawRequest(url: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  return fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/**
 * Ejecuta una petición autenticada contra el backend.
 * Maneja refresh rotatorio ante 401 (solo si hay refresh token almacenado).
 */
export async function request<T>(
  path: string,
  { body, withAuthIfPresent, ...init }: RequestOptions = {},
  query?: Record<string, unknown>,
): Promise<T> {
  const url = buildUrl(path, query);

  // Con auth obligatoria (POST/PUT/DELETE autenticados) o con token presente.
  let accessToken = getAccessToken();
  const needsAuth = !withAuthIfPresent || accessToken !== null;

  let response = await rawRequest(url, init, needsAuth ? accessToken : null);

  // 401 → intentar refresh una vez y reintentar la petición original.
  if (response.status === 401 && getStoredRefreshToken()) {
    const newAccess = await refreshSession(rotateRefreshToken);
    if (newAccess) {
      accessToken = newAccess;
      response = await rawRequest(url, init, accessToken);
    }
  }

  if (!response.ok) {
    // Refresh rechazado en el reintento: la sesión ya murió.
    if (response.status === 401) {
      clearSession();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }
    throw await parseError(response);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Helpers para evitar ciclos de imports (session ←→ auth)
// ---------------------------------------------------------------------------

async function rotateRefreshToken() {
  const refresh_token = getStoredRefreshToken();
  if (!refresh_token) throw new Error('No refresh token');

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ refresh_token }),
  });

  if (!response.ok) throw new Error('Refresh rechazado');
  return (await response.json()) as import('../../types/api').TokenPair;
}
