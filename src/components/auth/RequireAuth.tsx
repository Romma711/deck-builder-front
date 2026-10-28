import { useEffect, useState, type ReactNode } from 'react';
import { SESSION_EXPIRED_EVENT } from '../../lib/api';
import { getState, subscribe } from '../../lib/session/session';

interface Props {
  children: ReactNode;
}

/**
 * Guard client-side de rutas protegidas.
 *
 * Astro redirige en el middleware cuando NO hay refresh token (nada de sesión).
 * Este componente cubre los casos que el servidor no puede ver:
 * - la sesión murió en caliente (refresh rechazado → SESSION_EXPIRED_EVENT),
 * - el usuario hizo logout en otra pestaña.
 *
 * Mientras resolvemos, muestra un estado de "verificando sesión".
 */
export function RequireAuth({ children }: Props) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'unauthenticated'>(
    getState().isAuthenticated ? 'authed' : 'checking',
  );

  useEffect(() => {
    // 1) Revisar al montar: si no hay token alguno, a /login.
    if (!getState().isAuthenticated) {
      window.location.assign('/login');
      return;
    }
    setStatus('authed');

    // 2) Suscribirse a cambios: logout en otra pestaña o sesión expirada.
    const unsubscribe = subscribe((session) => {
      if (!session.isAuthenticated) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/login?next=${next}`);
      }
    });

    // 3) El cliente API avisa cuando una sesión murió tras un 401 + refresh fallido.
    const onExpired = () => {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    return () => {
      unsubscribe();
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, []);

  if (status !== 'authed') {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-400" role="status">
        Verificando sesión…
      </div>
    );
  }

  return <>{children}</>;
}
