/**
 * Búsqueda pública de mazos (`GET /decks` con filtros).
 *
 * - Los filtros viven en la URL (`/search?game=mtg&format=modern&page=2`):
 *   los resultados se pueden compartir y el botón "atrás" funciona.
 * - Paginación: el backend todavía NO pagina (devuelve todo lo que
 *   coincide), así que se pagina en el cliente. Cuando el back acepte
 *   `limit`/`offset`, solo cambia `searchDecks`: la UI ya trabaja con
 *   `{ items, total, page, pageCount }`.
 * - Visibilidad: sin sesión solo hay mazos públicos; con sesión el back
 *   agrega los privados propios y de las orgs del usuario (RLS). El front no
 *   filtra visibilidad: muestra lo que devuelve el back.
 */

import { listDecks } from '../api/decks';
import type { Deck } from '../../types/api';

export const PAGE_SIZE = 12;

export interface DeckSearchFilters {
  game: string;
  format: string;
  /** Nombre EXACTO del líder (el back compara con `=`) */
  leader: string;
  /** uuid de org (solo orgs del usuario) */
  org: string;
  /** uuid del dueño ("solo mis mazos") */
  owner: string;
}

export const EMPTY_FILTERS: DeckSearchFilters = { game: '', format: '', leader: '', org: '', owner: '' };

const FILTER_KEYS = Object.keys(EMPTY_FILTERS) as (keyof DeckSearchFilters)[];

export interface SearchState {
  filters: DeckSearchFilters;
  page: number;
}

export function parseSearchParams(search: string): SearchState {
  const params = new URLSearchParams(search);
  const filters = { ...EMPTY_FILTERS };
  for (const key of FILTER_KEYS) filters[key] = params.get(key)?.trim() ?? '';
  // Sin juego no hay formato posible.
  if (!filters.game) filters.format = '';
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return { filters, page: Number.isFinite(page) && page > 0 ? page : 1 };
}

export function toSearchParams({ filters, page }: SearchState): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key]);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function hasActiveFilters(filters: DeckSearchFilters): boolean {
  return FILTER_KEYS.some((key) => filters[key] !== '');
}

export interface DeckSearchResult {
  items: Deck[];
  total: number;
  /** Página efectiva (se corrige si la pedida no existe) */
  page: number;
  pageCount: number;
}

export async function searchDecks(
  filters: DeckSearchFilters,
  page: number,
  signal?: AbortSignal,
): Promise<DeckSearchResult> {
  const { data } = await listDecks(
    {
      game: filters.game || undefined,
      format: filters.format || undefined,
      leader: filters.leader || undefined,
      org: filters.org || undefined,
      owner: filters.owner || undefined,
    },
    signal,
  );
  const total = data.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const effectivePage = Math.min(page, pageCount);
  const start = (effectivePage - 1) * PAGE_SIZE;
  return { items: data.slice(start, start + PAGE_SIZE), total, page: effectivePage, pageCount };
}
