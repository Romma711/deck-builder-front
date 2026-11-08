/**
 * Servicios de mazos (tag `decks`).
 *
 * Notas del backend:
 * - `GET /decks` y `GET /decks/{id}` son públicos; con token se agregan los
 *   privados propios y los de las orgs del usuario (RLS). Por eso usan
 *   `auth: 'optional'`.
 * - No hay endpoint de duplicar: se compone con GET + POST.
 * - La validación de formato la hace el backend (GameSpec) al guardar.
 */

import type { Card, CardInput, Deck, DeckInput, PagedMeta } from '../../types/api';
import { request } from './client';

export type DecksQuery = {
  game?: string;
  /** uuid del dueño */
  owner?: string;
  /** uuid de organización */
  org?: string;
  format?: string;
  /** Subcadena del nombre del líder */
  leader?: string;
  /** Subcadena del username del dueño */
  author?: string;
  /** Máximo 100; por defecto 50 */
  limit?: number;
  offset?: number;
};

/**
 * GET /decks — mazos visibles (públicos; con sesión, también los propios y de orgs).
 * Paginado. `signal` permite cancelar búsquedas viejas.
 */
export function listDecks(query: DecksQuery = {}, signal?: AbortSignal): Promise<{ data: Deck[]; meta?: PagedMeta }> {
  return request<{ data: Deck[]; meta?: PagedMeta }>('/decks', { auth: 'optional', signal }, query);
}

/** Recorre todas las páginas: para vistas sin paginación (dashboard, org). */
export async function listAllDecks(query: Omit<DecksQuery, 'limit' | 'offset'>): Promise<Deck[]> {
  const limit = 100;
  const decks: Deck[] = [];
  for (;;) {
    const { data, meta } = await listDecks({ ...query, limit, offset: decks.length });
    decks.push(...data);
    if (data.length < limit || decks.length >= (meta?.total ?? 0)) return decks;
  }
}

/** POST /decks — crear mazo (personal u org; el back valida contra el GameSpec) */
export function createDeck(input: DeckInput): Promise<Deck> {
  return request<Deck>('/decks', { method: 'POST', body: input });
}

/** GET /decks/{id} — detalle (privado ajeno → 404) */
export function getDeck(id: string, signal?: AbortSignal): Promise<Deck> {
  return request<Deck>(`/decks/${encodeURIComponent(id)}`, { auth: 'optional', signal });
}

/** PUT /decks/{id} — reemplazo completo (solo el dueño) */
export function updateDeck(id: string, input: DeckInput): Promise<Deck> {
  return request<Deck>(`/decks/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}

/** DELETE /decks/{id} — borrar (solo el dueño) */
export function deleteDeck(id: string): Promise<void> {
  return request<void>(`/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface DuplicateOptions {
  /** Nombre de la copia (por defecto "<original> (copia)") */
  name?: string;
  /** Org destino; por defecto la copia es personal */
  orgId?: string;
  /** Visibilidad de la copia; por defecto la del original */
  private?: boolean;
}

/**
 * Compone un duplicado en el cliente (el back no tiene endpoint de duplicar).
 *
 * La copia NO hereda la org del original: copiar un mazo ajeno de una org de
 * la que no sos miembro daría 403. Para crearla en una org, pasá `orgId`.
 */
export async function duplicateDeck(id: string, options: DuplicateOptions = {}): Promise<Deck> {
  const source = await getDeck(id);
  const input: DeckInput = {
    name: options.name ?? `${source.name} (copia)`.slice(0, 50),
    description: source.description,
    deck_size: source.deck_size,
    game: source.game,
    format: source.format,
    org_id: options.orgId,
    private: options.private ?? source.private,
    leader: source.leader ? cardToInput(source.leader) : undefined,
    partner: source.partner ? cardToInput(source.partner) : undefined,
    cards: (source.cards ?? []).map((entry) => ({
      card: cardToInput(entry.card),
      quantity: entry.quantity,
    })),
  };
  return createDeck(input);
}

/** Convierte una Card del backend a CardInput (para reenviarla en un DeckInput). */
export function cardToInput(card: Card): CardInput {
  return {
    name: card.name,
    serial_set: card.serial_set ?? card.name,
    image: card.image ?? '',
    attributes: card.attributes ?? {},
  };
}
