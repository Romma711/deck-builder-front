/**
 * Hook de React para leer/compartir el catálogo de juegos y formatos.
 * El primer render dispara la carga si todavía no ocurrió.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { getCatalogState, loadCatalog, subscribeCatalog } from './catalog';

export function useCatalog() {
  const state = useSyncExternalStore(subscribeCatalog, getCatalogState, getCatalogState);

  useEffect(() => {
    if (state.status === 'idle') void loadCatalog();
  }, [state.status]);

  return state;
}
