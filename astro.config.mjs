// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // URL pública (canonical y sitemap): variable de entorno del build, no se lee de .env.
  site: process.env.PUBLIC_SITE_URL || undefined,
  // Todo se prerenderiza salvo las rutas que declaran `prerender = false`
  // (detalle y edición de mazos: rutas dinámicas por id).
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    react(),
    // Solo páginas públicas: las de sesión llevan noindex.
    sitemap({ filter: (page) => !/\/(dashboard|settings|login|register|orgs|decks)(\/|$)/.test(new URL(page).pathname) }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
