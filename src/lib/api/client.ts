/**
 * Cliente base de la API del backend Go.
 *
 * - Adjunta el access token (en memoria) como `Authorization: Bearer` según el
 *   modo de auth de cada endpoint (`required` | `optional` | `none`).
 * - Si solo queda el refresh token (p. ej. tras recargar), renueva ANTES de
 *   pedir, para no perder los datos privados en lecturas con auth opcional.
 * - Ante un 401, intenta UN refresh rotatorio y reintenta la petición.
 * - Si la sesión murió en un endpoint con auth obligatoria, la limpia y
 *   dispara un evento global para que la UI mande al usuario a /login.
 */

import type { ApiErrorBody, ErrorCode, TokenPair } from '../../types/api';
import { clearSession, ensureAccessToken, refreshSession } from '../session/session';

/** URL base del backend Go (configurar PUBLIC_API_URL en .env) */
const API_BASE = (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:8080') + '/api/v3';

/** Evento global: la sesión murió y la UI debe reaccionar (redirect a /login). */
export const SESSION_EXPIRED_EVENT = 'deckbuilder:session-expired';

/** Códigos propios del cliente, para fallos sin envelope del backend. */
export type ClientErrorCode = 'NETWORK' | 'UNKNOWN';
export type ApiErrorCode = ErrorCode | ClientErrorCode;

/** Error tipado de la API: expone el code del backend para decidir la UX. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** 0 = no hubo respuesta (error de red) */
  readonly status: number;
  readonly details?: Record<string, string>;
  /** Segundos a esperar según `Retry-After` (solo en 429/503) */
  readonly retryAfter?: number;

  constructor(
    status: number,
    body: { code: ApiErrorCode; message: string; details?: Record<string, string> },
    retryAfter?: number,
  ) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.retryAfter = retryAfter;
  }
}

/**
 * - `required`: endpoint autenticado; si la sesión murió, se notifica.
 * - `optional`: lectura pública que con token devuelve más (RLS de mazos).
 *   Si la sesión murió, se reintenta como anónimo sin expulsar al usuario.
 * - `none`: endpoint público o de auth (login, refresh…): nunca envía token
 *   ni intenta refresh.
 */
export type AuthMode = 'required' | 'optional' | 'none';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Serializado a JSON automáticamente */
  body?: unknown;
  /** Por defecto `required` */
  auth?: AuthMode;
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

/** `Retry-After` admite segundos o una fecha HTTP. */
function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/** Code de respaldo cuando la respuesta no trae el envelope (proxy, 502 HTML…). */
function codeFromStatus(status: number): ApiErrorCode {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'INTERNAL';
  return 'UNKNOWN';
}

async function parseError(response: Response): Promise<ApiError> {
  const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error?.code) return new ApiError(response.status, body.error, retryAfter);
  } catch {
    // Cuerpo vacío o no-JSON: caemos al code derivado del status.
  }
  return new ApiError(
    response.status,
    { code: codeFromStatus(response.status), message: `Error HTTP ${response.status}` },
    retryAfter,
  );
}

async function send(url: string, init: RequestOptions, body: unknown, accessToken: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  try {
    return await fetch(url, {
      ...init,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    // Abortos explícitos los decide el caller; no son errores de red.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, { code: 'NETWORK', message: 'No se pudo conectar con el servidor' });
  }
}

function expireSession(): void {
  clearSession();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

/** Token a enviar según el modo; en `optional` un fallo transitorio no bloquea la lectura. */
async function resolveToken(auth: AuthMode): Promise<string | null> {
  if (auth === 'none') return null;
  try {
    return await ensureAccessToken(rotateRefreshToken);
  } catch (error) {
    if (auth === 'optional') return null;
    throw error;
  }
}

/** Ejecuta una petición contra el backend con el modo de auth indicado. */
export async function request<T>(
  path: string,
  { body, auth = 'required', ...init }: RequestOptions = {},
  query?: Record<string, unknown>,
): Promise<T> {
  const url = buildUrl(path, query);

  const accessToken = await resolveToken(auth);
  let response = await send(url, init, body, accessToken);

  // 401 con token enviado: el access fue rechazado (revocado o expiró antes
  // de lo previsto). Un refresh y un reintento.
  if (response.status === 401 && accessToken) {
    const fresh = await refreshSession(rotateRefreshToken);
    if (fresh) {
      response = await send(url, init, body, fresh);
    } else if (auth === 'optional') {
      response = await send(url, init, body, null);
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth === 'required') expireSession();
    throw await parseError(response);
  }

  // 204 No Content
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Rotación de refresh (inyectada en el store de sesión para evitar ciclos)
// ---------------------------------------------------------------------------

async function rotateRefreshToken(refreshToken: string): Promise<TokenPair | null> {
  const response = await send(`${API_BASE}/auth/refresh`, { method: 'POST' }, { refresh_token: refreshToken }, null);
  // 400/401: token inválido, expirado o reusado → la sesión murió.
  if (response.status === 400 || response.status === 401) return null;
  // 429/5xx: transitorio, se propaga sin tirar la sesión.
  if (!response.ok) throw await parseError(response);
  return (await response.json()) as TokenPair;
}
