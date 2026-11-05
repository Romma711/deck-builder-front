/**
 * Usuario autenticado (`GET /me`), pedido UNA vez por carga de página y
 * compartido por todas las islands (dashboard, detalle de mazo, cuenta…).
 * Se invalida solo cuando la sesión se limpia.
 */

import { getMe } from '../api/auth';
import type { User } from '../../types/api';
import { getState, subscribe } from './session';

let current: Promise<User> | null = null;

if (typeof window !== 'undefined') {
  subscribe((session) => {
    if (!session.isAuthenticated) current = null;
  });
}

/** Usuario actual, o null si no hay sesión. */
export function getCurrentUser(): Promise<User | null> {
  if (!getState().isAuthenticated) return Promise.resolve(null);
  if (!current) {
    current = getMe();
    // Un fallo (red, sesión muerta) no queda cacheado.
    current.catch(() => {
      current = null;
    });
  }
  return current;
}

/** Reemplaza el usuario cacheado (p. ej. tras `PUT /me`). */
export function setCurrentUser(user: User): void {
  current = Promise.resolve(user);
}
