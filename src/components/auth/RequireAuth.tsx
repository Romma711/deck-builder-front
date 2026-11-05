import { useEffect, type ReactNode } from 'react';
import { loginUrl } from '../../lib/navigation';
import { getState } from '../../lib/session/session';
import { useSession } from '../../lib/session/useSession';

interface Props {
  children: ReactNode;
}

/**
 * Guard client-side de rutas protegidas.
 *
 * Las páginas son estáticas y la sesión vive en localStorage, así que el
 * servidor no puede saber si hay sesión: la decisión es siempre del cliente.
 * Cubre:
 * - no hay sesión al entrar,
 * - la sesión murió en caliente (refresh rechazado → el store se limpia),
 * - logout en otra pestaña (evento `storage` → el store se limpia).
 *
 * Mientras hidrata (snapshot de servidor = sin sesión), muestra
 * "Verificando sesión…" en vez de redirigir.
 */
export function RequireAuth({ children }: Props) {
  const { isAuthenticated } = useSession();

  useEffect(() => {
    // `getState()` y no el valor del hook: en el primer commit de la
    // hidratación el hook todavía devuelve el snapshot del servidor.
    if (!getState().isAuthenticated) window.location.assign(loginUrl());
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400" role="status">
        Verificando sesión…
      </div>
    );
  }

  return <>{children}</>;
}
