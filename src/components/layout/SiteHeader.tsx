import { useEffect, useId, useState } from 'react';
import { useSession } from '../../lib/session/useSession';

interface Props {
  /** Ruta actual (`Astro.url.pathname`), igual en servidor y cliente */
  currentPath: string;
}

interface NavLink {
  href: string;
  label: string;
  /** Prefijo de ruta que marca el link como activo */
  match: string;
}

const PUBLIC_LINKS: NavLink[] = [
  { href: '/games', label: 'Juegos', match: '/games' },
  { href: '/search', label: 'Buscar mazos', match: '/search' },
];

const AUTH_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Mis mazos', match: '/dashboard' },
  { href: '/orgs', label: 'Organizaciones', match: '/orgs' },
  { href: '/settings', label: 'Mi cuenta', match: '/settings' },
];

/**
 * Barra de navegación con estado de sesión (island).
 * En pantallas chicas los links se agrupan en un menú desplegable.
 *
 * La ruta llega por prop desde el layout en vez de leer `window.location`
 * durante el render, para que servidor y cliente rendericen lo mismo.
 */
export function SiteHeader({ currentPath }: Props) {
  const { isAuthenticated } = useSession();
  const menuId = useId();
  const [open, setOpen] = useState(false);

  const isAuthPage = currentPath.startsWith('/login') || currentPath.startsWith('/register');
  const loginHref =
    currentPath === '/' || isAuthPage ? '/login' : `/login?next=${encodeURIComponent(currentPath)}`;
  const links = isAuthenticated ? [...PUBLIC_LINKS, ...AUTH_LINKS] : PUBLIC_LINKS;
  const isActive = (link: NavLink) => currentPath.startsWith(link.match);

  // Cerrar el menú móvil con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const linkClass = (link: NavLink) =>
    `rounded-lg px-3 py-2 text-sm transition-colors ${
      isActive(link) ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;

  const authActions = !isAuthenticated && (
    <>
      <a href={loginHref} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white">
        Iniciar sesión
      </a>
      <a href="/register" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
        Crear cuenta
      </a>
    </>
  );

  return (
    <header className="border-b border-slate-800 bg-slate-950/95">
      <nav aria-label="Principal" className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href="/" className="shrink-0 text-base font-bold text-white">
          🃏 Deck Builder
        </a>

        {/* Escritorio */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className={linkClass(link)} aria-current={isActive(link) ? 'page' : undefined}>
              {link.label}
            </a>
          ))}
          {authActions}
        </div>

        {/* Móvil */}
        <button
          type="button"
          className="rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-500 md:hidden"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? '✕ Cerrar' : '☰ Menú'}
        </button>
      </nav>

      {open && (
        <div id={menuId} className="border-t border-slate-800 px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {links.map((link) => (
              <a key={link.href} href={link.href} className={linkClass(link)} aria-current={isActive(link) ? 'page' : undefined}>
                {link.label}
              </a>
            ))}
            {authActions}
          </div>
        </div>
      )}
    </header>
  );
}
