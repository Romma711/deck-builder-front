/**
 * Traduce errores del backend a mensajes de UI para formularios.
 */

import { ApiError } from '../api/client';

/** Título genérico para mostrar en un Alert. */
export function errorTitle(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Error inesperado';
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 'Revisa los datos ingresados';
    case 'CONFLICT':
      return 'El usuario o email ya existe';
    case 'UNAUTHORIZED':
      return 'Usuario o contraseña incorrectos';
    case 'RATE_LIMITED':
      return 'Demasiados intentos. Esperá un momento y volvé a intentar';
    case 'NETWORK':
      return 'No se pudo conectar con el servidor';
    default:
      return 'Ocurrió un error';
  }
}

/** Mensaje detallado del backend (si hay). */
export function errorMessage(error: unknown): string | undefined {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return undefined;
}

/**
 * Mapea `details` del backend (`{campo: mensaje}`) a errores por campo.
 * Ignora campos que no coincidan con el formulario (el caller filtra).
 */
export function fieldErrors(error: unknown, allowedFields: string[]): Record<string, string> {
  if (!(error instanceof ApiError) || !error.details) return {};
  const result: Record<string, string> = {};
  for (const field of allowedFields) {
    const message = error.details[field];
    if (message) result[field] = message;
  }
  // Si el backend devolvió detalles pero ninguno coincide con el formulario,
  // no perdemos la info: la maneja el caller vía errorTitle/errorMessage.
  return result;
}
