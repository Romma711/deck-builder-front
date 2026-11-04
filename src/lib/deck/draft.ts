/**
 * Borrador de mazo del editor: estado local, independiente del backend.
 *
 * El backend guarda `CardInput` completos (no referencias), así que el
 * borrador también trabaja con `CardInput`. La identidad de una carta dentro
 * del mazo es `cardKey()`: dos entradas con la misma clave son la misma carta.
 */

import { cardToInput } from '../api/decks';
import type { CardInput, Deck, DeckInput } from '../../types/api';

export const QUANTITY_MIN = 1;
export const QUANTITY_MAX = 99;

export interface DraftEntry {
  key: string;
  card: CardInput;
  quantity: number;
}

export interface DeckDraft {
  name: string;
  description: string;
  game: string;
  format: string;
  private: boolean;
  /** Se preserva al editar; la asignación a orgs llega en la Fase 5 */
  orgId?: string;
  leader?: CardInput;
  partner?: CardInput;
  entries: DraftEntry[];
}

export type DraftAction =
  | { type: 'reset'; draft: DeckDraft }
  | { type: 'setField'; field: 'name' | 'description'; value: string }
  | { type: 'setPrivate'; value: boolean }
  | { type: 'setGameFormat'; game: string; format: string }
  | { type: 'addCard'; card: CardInput; quantity?: number }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'removeCard'; key: string }
  | { type: 'setLeader'; card: CardInput | undefined }
  | { type: 'setPartner'; card: CardInput | undefined };

/** Identidad de una carta: edición (serial_set) + nombre, normalizados. */
export function cardKey(card: Pick<CardInput, 'name' | 'serial_set'>): string {
  return `${card.serial_set.trim().toLowerCase()}::${card.name.trim().toLowerCase()}`;
}

export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return QUANTITY_MIN;
  return Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, Math.trunc(quantity)));
}

export function emptyDraft(game = '', format = ''): DeckDraft {
  return { name: '', description: '', game, format, private: false, entries: [] };
}

export function draftReducer(draft: DeckDraft, action: DraftAction): DeckDraft {
  switch (action.type) {
    case 'reset':
      return action.draft;
    case 'setField':
      return { ...draft, [action.field]: action.value };
    case 'setPrivate':
      return { ...draft, private: action.value };
    case 'setGameFormat': {
      // Cambiar de juego invalida las cartas (son de otro catálogo).
      if (action.game !== draft.game) {
        return { ...draft, game: action.game, format: action.format, entries: [], leader: undefined, partner: undefined };
      }
      return { ...draft, format: action.format };
    }
    case 'addCard': {
      const key = cardKey(action.card);
      const amount = action.quantity ?? 1;
      const existing = draft.entries.find((entry) => entry.key === key);
      if (existing) {
        return {
          ...draft,
          entries: draft.entries.map((entry) =>
            entry.key === key ? { ...entry, quantity: clampQuantity(entry.quantity + amount) } : entry,
          ),
        };
      }
      return { ...draft, entries: [...draft.entries, { key, card: action.card, quantity: clampQuantity(amount) }] };
    }
    case 'setQuantity':
      return {
        ...draft,
        entries: draft.entries.map((entry) =>
          entry.key === action.key ? { ...entry, quantity: clampQuantity(action.quantity) } : entry,
        ),
      };
    case 'removeCard':
      return { ...draft, entries: draft.entries.filter((entry) => entry.key !== action.key) };
    case 'setLeader':
      // Sin líder no tiene sentido un partner.
      return { ...draft, leader: action.card, partner: action.card ? draft.partner : undefined };
    case 'setPartner':
      return { ...draft, partner: action.card };
  }
}

// ---------------------------------------------------------------------------
// Conversión backend ↔ borrador
// ---------------------------------------------------------------------------

export function draftFromDeck(deck: Deck): DeckDraft {
  return {
    name: deck.name,
    description: deck.description ?? '',
    game: deck.game,
    format: deck.format,
    private: deck.private ?? false,
    orgId: deck.org_id || undefined,
    leader: deck.leader ? cardToInput(deck.leader) : undefined,
    partner: deck.partner ? cardToInput(deck.partner) : undefined,
    entries: (deck.cards ?? []).map((entry) => {
      const card = cardToInput(entry.card);
      return { key: cardKey(card), card, quantity: entry.quantity };
    }),
  };
}

/**
 * Arma el DeckInput a enviar. `deckSize` lo calcula el validador (cartas que
 * cuentan para el tamaño), así el back recibe el tamaño real del mazo.
 * El orden de `cards` coincide con `entries`: los `details` del back del tipo
 * `cards[3].quantity` apuntan a `entries[3]`.
 */
export function draftToInput(draft: DeckDraft, deckSize: number): DeckInput {
  const description = draft.description.trim();
  return {
    name: draft.name.trim(),
    description: description || undefined,
    deck_size: deckSize,
    game: draft.game,
    format: draft.format,
    org_id: draft.orgId,
    private: draft.private,
    leader: draft.leader,
    partner: draft.partner,
    cards: draft.entries.map(({ card, quantity }) => ({ card, quantity })),
  };
}

/** Igualdad estructural barata para detectar cambios sin guardar. */
export function sameDraft(a: DeckDraft, b: DeckDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
