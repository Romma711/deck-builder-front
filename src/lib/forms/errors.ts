/**
 * Traduce errores del backend a mensajes de UI.
 *
 * Los títulos por defecto son genéricos; cada pantalla pasa `overrides` con
 * el significado que un code tiene en SU contexto (p. ej. un 401 en login es
 * "credenciales incorrectas", pero en el resto de la app es "sesión expirada").
 */

import { ApiError, type ApiErrorCode } from '../api/client';

export type ErrorOverrides = Partial<Record<ApiErrorCode, string>>;

export interface ErrorDescription {
  title: string;
  message?: string;
}

const DEFAULT_TITLES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Revisá los datos ingresados',
  CONFLICT: 'Hay un conflicto con datos existentes',
  UNAUTHORIZED: 'Tu sesión expiró. Iniciá sesión de nuevo',
  FORBIDDEN: 'No tenés permiso para hacer esto',
  NOT_FOUND: 'No encontramos lo que buscabas',
  INVALID_ID: 'El identificador no es válido',
  RATE_LIMITED: 'Demasiados intentos. Esperá un momento y volvé a intentar',
  INTERNAL: 'El servidor tuvo un problema. Probá de nuevo en un rato',
  NETWORK: 'No se pudo conectar con el servidor',
  UNKNOWN: 'Ocurrió un error',
};

/** Títulos para formularios de cuenta (registro y perfil). */
export const ACCOUNT_ERRORS: ErrorOverrides = {
  CONFLICT: 'El usuario o email ya existe',
};

/** Título corto para mostrar en un Alert. */
export function errorTitle(error: unknown, overrides: ErrorOverrides = {}): string {
  if (!(error instanceof ApiError)) return 'Error inesperado';
  if (error.code === 'RATE_LIMITED' && error.retryAfter && !overrides.RATE_LIMITED) {
    return `Demasiados intentos. Probá de nuevo en ${error.retryAfter} s`;
  }
  return overrides[error.code] ?? DEFAULT_TITLES[error.code];
}

/** Mensaje detallado del backend (si aporta algo más que el título). */
export function errorMessage(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    // Los errores generados en el cliente ya quedan explicados por el título.
    if (error.code === 'NETWORK' || error.code === 'UNKNOWN') return undefined;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return undefined;
}

/** Título + mensaje listos para un `<Alert>`. */
export function describeError(error: unknown, overrides: ErrorOverrides = {}): ErrorDescription {
  return { title: errorTitle(error, overrides), message: errorMessage(error) };
}

/**
 * Mapea `details` del backend (`{campo: mensaje}`) a errores por campo.
 * Ignora campos que no coincidan con el formulario: esa info igual llega al
 * usuario vía `describeError`.
 */
export function fieldErrors(error: unknown, allowedFields: string[]): Record<string, string> {
  if (!(error instanceof ApiError) || !error.details) return {};
  const result: Record<string, string> = {};
  for (const field of allowedFields) {
    const message = error.details[field];
    if (message) result[field] = message;
  }
  return result;
}
