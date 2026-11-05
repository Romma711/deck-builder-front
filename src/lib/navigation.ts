/**
 * Helpers de navegación client-side (redirects post-login, guard de rutas).
 *
 * Las páginas son estáticas: los query params (`?next=`) se leen en el
 * cliente, nunca en el frontmatter de Astro.
 */

const DEFAULT_AFTER_LOGIN = '/dashboard';
/** Rutas a las que no tiene sentido volver tras autenticarse. */
const AUTH_PATHS = ['/login', '/register'];

/**
 * Valida un destino de redirect para que sea una ruta del MISMO origen.
 * Rechaza `//evil.com`, `/\evil.com`, `https://…` y similares (open redirect).
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    if (AUTH_PATHS.includes(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** Destino post-login según el `?next=` de la URL actual. */
export function nextFromLocation(fallback = DEFAULT_AFTER_LOGIN): string {
  return safeRedirectPath(new URLSearchParams(window.location.search).get('next'), fallback);
}

/** URL de login que vuelve a `path` (por defecto, la página actual). */
export function loginUrl(path?: string): string {
  const target = path ?? window.location.pathname + window.location.search;
  if (!target || target === '/' || AUTH_PATHS.some((p) => target.startsWith(p))) return '/login';
  return `/login?next=${encodeURIComponent(target)}`;
}
