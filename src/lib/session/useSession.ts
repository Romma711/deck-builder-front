/**
 * Hook de React para leer el estado de sesión del store (fuente única).
 * Uso: `const { isAuthenticated } = useSession();`
 *
 * Durante SSR e hidratación devuelve el snapshot "sin sesión" (el servidor no
 * ve localStorage); justo después React re-renderiza con el estado real.
 */

import { useSyncExternalStore } from 'react';
import { getServerState, getState, subscribe, type SessionState } from './session';

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getState, getServerState);
}
