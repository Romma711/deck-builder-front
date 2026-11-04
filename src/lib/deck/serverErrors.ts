/**
 * Traduce un VALIDATION_ERROR del backend (GameSpec) a errores ubicables en
 * el editor: campos del mazo, líder/partner y cartas concretas.
 *
 * Claves que produce el back (ver `lib/api/details.ts`):
 * - campos del mazo: `Name`, `Description`, `Game`, `Format`, `DeckSize`,
 *   `Leader`, `Cards`;
 * - atributos de una carta: `leader.card_type`, `partner.x`, `cards[3].mana_value`
 *   (el índice es el de `cards` en el DeckInput = orden de `entries`);
 * - reglas de copias: `cards.<Nombre de la carta>` (afecta a todas sus ediciones).
 * Lo que no se pueda ubicar va a `general`, para no perder información.
 */

import { ApiError } from '../api/client';
import { attributeLabel, describeReason, normalizeDetailKey } from '../api/details';
import type { DraftEntry } from './draft';

type DeckField = 'name' | 'description' | 'leader' | 'partner' | 'format';

export interface DeckServerErrors {
  fields: Partial<Record<DeckField, string>>;
  /** cardKey → mensaje */
  cards: Record<string, string>;
  general: string[];
}

/** Clave normalizada del back → campo del editor. */
const FIELD_KEYS: Record<string, DeckField> = {
  name: 'name',
  description: 'description',
  leader: 'leader',
  partner: 'partner',
  format: 'format',
  game: 'format',
};

const CARD_INDEX = /^cards\[(\d+)\]\.(.+)$/i;
const CARD_NAME = /^cards\.(.+)$/i;
const SLOT_ATTRIBUTE = /^(leader|partner)\.(.+)$/i;

export function emptyServerErrors(): DeckServerErrors {
  return { fields: {}, cards: {}, general: [] };
}

function append(current: string | undefined, message: string): string {
  return current ? `${current} · ${message}` : message;
}

export function mapDeckServerErrors(error: unknown, entries: DraftEntry[]): DeckServerErrors {
  const result = emptyServerErrors();
  if (!(error instanceof ApiError) || !error.details) return result;

  for (const [key, reason] of Object.entries(error.details)) {
    const message = describeReason(reason);

    const field = FIELD_KEYS[normalizeDetailKey(key)];
    if (field) {
      result.fields[field] = append(result.fields[field], message);
      continue;
    }

    let match = SLOT_ATTRIBUTE.exec(key);
    if (match) {
      const slot = match[1].toLowerCase() as 'leader' | 'partner';
      result.fields[slot] = append(result.fields[slot], `${attributeLabel(match[2])}: ${message}`);
      continue;
    }

    match = CARD_INDEX.exec(key);
    const indexed = match ? entries[Number(match[1])] : undefined;
    if (match && indexed) {
      result.cards[indexed.key] = append(result.cards[indexed.key], `${attributeLabel(match[2])}: ${message}`);
      continue;
    }

    match = CARD_NAME.exec(key);
    const named = match ? entries.filter((entry) => entry.card.name.trim() === match![1].trim()) : [];
    if (named.length > 0) {
      for (const entry of named) result.cards[entry.key] = append(result.cards[entry.key], message);
      continue;
    }

    if (normalizeDetailKey(key) === 'decksize' || normalizeDetailKey(key) === 'cards') {
      result.general.push(message);
    } else {
      result.general.push(`${key}: ${message}`);
    }
  }
  return result;
}
