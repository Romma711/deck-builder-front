/**
 * Servicios del catálogo: juegos, formatos y cartas (tag `catálogo`).
 * Públicos: no requieren token.
 */

import type { Card, Game, Paged } from '../../types/api';
import { request } from './client';

export type CardsQuery = {
  /** Código de juego (p. ej. mtg) */
  game?: string;
  /** Búsqueda por nombre (ILIKE) */
  q?: string;
  limit?: number;
  offset?: number;
};

/** GET /games — juegos activos con sus formatos */
export function listGames(): Promise<Paged<Game>> {
  return request<Paged<Game>>('/games');
}

/** GET /games/{code} — un juego por código */
export function getGame(code: string): Promise<Game> {
  return request<Game>(`/games/${encodeURIComponent(code)}`);
}

/** GET /cards — catálogo de cartas (filtros combinables, paginado) */
export function listCards(query: CardsQuery = {}): Promise<Paged<Card>> {
  return request<Paged<Card>>('/cards', {}, query);
}

/** GET /cards/{id} — una carta por ID */
export function getCard(id: string): Promise<Card> {
  return request<Card>(`/cards/${encodeURIComponent(id)}`);
}
