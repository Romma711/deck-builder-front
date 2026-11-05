import { useSession } from '../../lib/session/useSession';

interface Props {
  /** Ruta actual (`Astro.url.pathname`), igual en servidor y cliente */
  currentPath: string;
}

/**
 * Barra de navegación con estado de sesión (island).
 * Muestra Login/Registro o Mi cuenta según haya sesión.
 *
 * La ruta llega por prop desde el layout en vez de leer `window.location`
 * durante el render, para que servidor y cliente rendericen lo mismo.
 */
export function SiteHeader({ currentPath }: Props) {
  const { isAuthenticated } = useSession();
  const isAuthPage = currentPath.startsWith('/login') || currentPath.startsWith('/register');
  const loginHref =
    currentPath === '/' || isAuthPage ? '/login' : `/login?next=${encodeURIComponent(currentPath)}`;

  const linkClass = (path: string) =>
    `rounded-lg px-3 py-2 text-sm transition-colors ${
      currentPath.startsWith(path)
        ? 'bg-slate-800 text-white'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;
  const current = (path: string) => (currentPath.startsWith(path) ? 'page' : undefined);

  return (
    <header className="border-b border-slate-800 bg-slate-950/95">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <a href="/" className="text-base font-bold text-white">
          🃏 Deck Builder
        </a>
        <div className="flex items-center gap-1">
          <a href="/games" className={linkClass('/games')} aria-current={current('/games')}>
            Juegos
          </a>
          <a href="/search" className={linkClass('/search')} aria-current={current('/search')}>
            Buscar mazos
          </a>
          {isAuthenticated ? (
            <>
              <a href="/dashboard" className={linkClass('/dashboard')} aria-current={current('/dashboard')}>
                Mis mazos
              </a>
              <a href="/settings" className={linkClass('/settings')} aria-current={current('/settings')}>
                Mi cuenta
              </a>
            </>
          ) : (
            <>
              <a href={loginHref} className={linkClass('/login')} aria-current={current('/login')}>
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
