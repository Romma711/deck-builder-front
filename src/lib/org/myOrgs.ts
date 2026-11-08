/**
 * Organizaciones del usuario (`GET /orgs`, con su rol), pedidas UNA vez por
 * carga de página y compartidas por editor, dashboard, buscador y /orgs.
 * Se invalidan al crear/eliminar/salir de una org y al cerrar sesión.
 */

import { listOrgs } from '../api/orgs';
import type { Organization } from '../../types/api';
import { getState, subscribe } from '../session/session';

let current: Promise<Organization[]> | null = null;

if (typeof window !== 'undefined') {
  subscribe((session) => {
    if (!session.isAuthenticated) current = null;
  });
}

/** Orgs del usuario actual ([] sin sesión). */
export function getMyOrgs(): Promise<Organization[]> {
  if (!getState().isAuthenticated) return Promise.resolve([]);
  if (!current) {
    current = listOrgs().then(({ data }) => data);
    // Un fallo no queda cacheado.
    current.catch(() => {
      current = null;
    });
  }
  return current;
}

/** Fuerza a releer las orgs en el próximo `getMyOrgs()`. */
export function invalidateMyOrgs(): void {
  current = null;
}
