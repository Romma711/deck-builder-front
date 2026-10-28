/**
 * Barrel de la capa de servicios del backend Go.
 *
 * Si el backend cambia un endpoint, los cambios se concentran aquí
 * (idealmente regenerando los tipos desde openapi.yaml).
 */

export { ApiError, SESSION_EXPIRED_EVENT, request } from './client';
export type { RequestOptions } from './client';

export * as authApi from './auth';
export * as catalogApi from './catalog';
export * as decksApi from './decks';
export * as orgsApi from './orgs';
