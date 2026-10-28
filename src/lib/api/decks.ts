/**
 * Servicios de mazos (tag `decks`).
 *
 * Notas del backend:
 * - `GET /decks` y `GET /decks/{id} son públicos; con token se agregan los
 *   privados propios y los de las orgs del usuario (RLS). Por eso usan
 *   `withAuthIfPresent`.
 * - No hay endpoint de duplicar: se compone con GET + POST.
 * - La validación de formato la hace el backend (GameSpec) al guardar.
 */

import type { Card, CardInput, Deck, DeckInput, ListMeta } from '../../types/api';
import { request } from './client';

export type DecksQuery = {
  game?: string;
  /** uuid del dueño */
  owner?: string;
  /** uuid de organización */
  org?: string;
  format?: string;
  leader?: string;
};

/** GET /decks — mazos visibles (públicos; con sesión, también los propios y de orgs) */
export function listDecks(query: DecksQuery = {}): Promise<{ data: Deck[]; meta?: ListMeta }> {
  return request<{ data: Deck[]; meta?: ListMeta }>('/decks', { withAuthIfPresent: true }, query);
}

/** POST /decks — crear mazo (personal u org; el back valida contra el GameSpec) */
export function createDeck(input: DeckInput): Promise<Deck> {
  return request<Deck>('/decks', { method: 'POST', body: input });
}

/** GET /decks/{id} — detalle (privado ajeno → 404) */
export function getDeck(id: string): Promise<Deck> {
  return request<Deck>(`/decks/${encodeURIComponent(id)}`, { withAuthIfPresent: true });
}

/** PUT /decks/{id} — reemplazo completo (solo el dueño) */
export function updateDeck(id: string, input: DeckInput): Promise<Deck> {
  return request<Deck>(`/decks/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}

/** DELETE /decks/{id} — borrar (solo el dueño) */
export function deleteDeck(id: string): Promise<void> {
  return request<void>(`/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Compone un duplicado en el cliente (el back no tiene endpoint de duplicar). */
export async function duplicateDeck(id: string, name?: string): Promise<Deck> {
  const source = await getDeck(id);
  const input: DeckInput = {
    name: name ?? `${source.name} (copia)`.slice(0, 50),
    description: source.description,
    deck_size: source.deck_size,
    game: source.game,
    format: source.format,
    org_id: source.org_id ?? undefined,
    private: source.private,
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
