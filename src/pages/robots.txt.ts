import type { APIRoute } from 'astro';

/** Páginas de sesión fuera del rastreo; el sitemap solo existe si hay `site`. */
export const GET: APIRoute = ({ site }) => {
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /dashboard',
    'Disallow: /settings',
    'Disallow: /orgs',
    'Disallow: /decks/new',
  ];
  if (site) lines.push('', `Sitemap: ${new URL('sitemap-index.xml', site)}`);
  return new Response(`${lines.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
