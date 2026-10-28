/**
 * Hook de React para leer el estado de sesión del store (fuente única).
 * Uso: `const { isAuthenticated } = useSession();`
 */

import { useSyncExternalStore } from 'react';
import { getState, subscribe, type SessionState } from './session';

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getState, getState);
}
