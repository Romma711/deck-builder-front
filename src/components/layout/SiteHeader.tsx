import { useSession } from '../../lib/session/useSession';

/**
 * Barra de navegación con estado de sesión (island).
 * Muestra Login/Registro o Mi cuenta según haya sesión.
 */
export function SiteHeader() {
  const { isAuthenticated } = useSession();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  const next = encodeURIComponent(currentPath || '/');

  const linkClass = (path: string) =>
    `rounded-lg px-3 py-2 text-sm transition-colors ${
      currentPath.startsWith(path) && path !== '/'
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;

  return (
    <header className="border-b border-slate-800 bg-slate-950/95">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="/" className="text-base font-bold text-white">
          🃏 Deck Builder
        </a>
        <div className="flex items-center gap-1">
          <a href="/search" className={linkClass('/search')}>
            Buscar mazos
          </a>
          {isAuthenticated ? (
            <>
              <a href="/dashboard" className={linkClass('/dashboard')}>
                Mis mazos
              </a>
              <a href="/settings" className={linkClass('/settings')}>
                Mi cuenta
              </a>
            </>
          ) : (
            <>
              <a href={`/login?next=${next}`} className={linkClass('/login')}>
                Iniciar sesión
              </a>
              <a
                href="/register"
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Crear cuenta
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
