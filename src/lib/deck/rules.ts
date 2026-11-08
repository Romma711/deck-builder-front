/**
 * Validación EN VIVO del mazo en el frontend (feedback inmediato, sin guardar).
 *
 * El backend (GameSpec) es la autoridad. Acá se adelantan sus reglas para
 * avisar antes de guardar:
 * - tamaño y líder: vienen de `/games` (datos del formato);
 * - copias por carta: espejo de `ValidateDeck` de cada GameSpec del back
 *   (internal/app/gamespec).
 *
 * Para sumar o ajustar un juego, se toca SOLO `GAME_RULES`.
 */

import type { CardInput, Format } from '../../types/api';
import type { DeckDraft } from './draft';

// ---------------------------------------------------------------------------
// Configuración por juego (claves = códigos de juego del backend)
// ---------------------------------------------------------------------------

export interface GameRules {
  /** Copias máximas por carta */
  maxCopies?: number;
  /** Override de copias por código de formato (p. ej. commander = 1) */
  maxCopiesByFormat?: Record<string, number>;
  /** Qué identifica a "la misma carta" al contar copias (por defecto, el nombre) */
  copyGroup?: (card: CardInput) => string;
  /** Cartas exentas de los límites de copias (p. ej. tierras básicas) */
  isCopyLimitExempt?: (card: CardInput) => boolean;
  /** Validación del líder (además de que exista) */
  leaderRule?: { isValid: (card: CardInput) => boolean; message: string };
  /** Si el líder/partner cuenta para el tamaño del mazo */
  leaderCountsTowardSize?: boolean;
}

function attribute(card: CardInput, key: string): string | undefined {
  const value = card.attributes?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** Básicas exentas del límite en el GameSpec MTG (por nombre exacto). */
const MTG_BASIC_LANDS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']);

export const GAME_RULES: Record<string, GameRules> = {
  mtg: {
    maxCopies: 4,
    maxCopiesByFormat: { commander: 1, brawl: 1 },
    isCopyLimitExempt: (card) => MTG_BASIC_LANDS.has(card.name.trim()),
    // En Commander el comandante es parte de las 100 cartas.
    leaderCountsTowardSize: true,
  },
  pokemon: {
    maxCopies: 4,
    isCopyLimitExempt: (card) => attribute(card, 'kind') === 'energy',
  },
  yugioh: { maxCopies: 3 },
  onepiece: {
    maxCopies: 4,
    // Se cuenta por número de carta: hay cartas distintas con el mismo nombre.
    copyGroup: (card) => card.serial_set.trim().toLowerCase(),
    leaderRule: {
      isValid: (card) => attribute(card, 'card_type') === 'Leader',
      message: 'El líder debe ser una carta de tipo Leader',
    },
    // En One Piece el líder va aparte de las 50 cartas.
    leaderCountsTowardSize: false,
  },
};

export function rulesFor(game: string): GameRules {
  return GAME_RULES[game] ?? {};
}

export function maxCopiesFor(game: string, format: string): number | undefined {
  const rules = rulesFor(game);
  return rules.maxCopiesByFormat?.[format] ?? rules.maxCopies;
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

export const NAME_MIN = 3;
export const NAME_MAX = 50;
export const DESCRIPTION_MAX = 300;

export interface DeckIssue {
  /** A qué parte del editor apunta (para mostrarlo junto al elemento) */
  target: 'name' | 'description' | 'format' | 'size' | 'leader' | 'partner' | 'cards' | { cardKey: string };
  message: string;
}

export interface SizeRequirement {
  min?: number;
  max?: number;
}

export interface DeckValidation {
  issues: DeckIssue[];
  /** true si hay errores (bloquean el guardado) */
  hasErrors: boolean;
  /** Cartas que cuentan para el tamaño del mazo */
  size: number;
  /** Tamaño exigido por el formato (exacto si min === max) */
  required: SizeRequirement;
  maxCopies?: number;
}

/** Rango de tamaño del formato: min/max si existen, si no deck_size exacto. */
export function sizeRequirement(format: Format | undefined): SizeRequirement {
  if (!format) return {};
  if (format.min_size !== undefined || format.max_size !== undefined) {
    return { min: format.min_size, max: format.max_size };
  }
  if (format.deck_size !== undefined) return { min: format.deck_size, max: format.deck_size };
  return {};
}

export function describeSize({ min, max }: SizeRequirement): string | undefined {
  if (min !== undefined && min === max) return `${min} cartas`;
  if (min !== undefined && max !== undefined) return `entre ${min} y ${max} cartas`;
  if (min !== undefined) return `al menos ${min} cartas`;
  if (max !== undefined) return `como máximo ${max} cartas`;
  return undefined;
}

export function validateDeck(draft: DeckDraft, format: Format | undefined): DeckValidation {
  const issues: DeckIssue[] = [];
  const rules = rulesFor(draft.game);
  const maxCopies = maxCopiesFor(draft.game, draft.format);
  const copies = (n: number) => `${n} ${n === 1 ? 'copia' : 'copias'}`;

  // --- Metadatos ------------------------------------------------------------
  const name = draft.name.trim();
  if (name.length < NAME_MIN) {
    issues.push({ target: 'name', message: `El nombre debe tener al menos ${NAME_MIN} caracteres` });
  } else if (name.length > NAME_MAX) {
    issues.push({ target: 'name', message: `El nombre no puede superar los ${NAME_MAX} caracteres` });
  }
  if (draft.description.trim().length > DESCRIPTION_MAX) {
    issues.push({
      target: 'description',
      message: `La descripción no puede superar los ${DESCRIPTION_MAX} caracteres`,
    });
  }
  if (!format) {
    issues.push({ target: 'format', message: 'Elegí un juego y un formato' });
  }

  // --- Líder ----------------------------------------------------------------
  if (format?.requires_leader && !draft.leader) {
    issues.push({ target: 'leader', message: 'Este formato requiere un líder' });
  } else if (format?.requires_leader && draft.leader && rules.leaderRule && !rules.leaderRule.isValid(draft.leader)) {
    issues.push({ target: 'leader', message: rules.leaderRule.message });
  }

  // --- Tamaño ---------------------------------------------------------------
  const mainCount = draft.entries.reduce((total, entry) => total + entry.quantity, 0);
  const leaderCount = rules.leaderCountsTowardSize ? (draft.leader ? 1 : 0) + (draft.partner ? 1 : 0) : 0;
  const size = mainCount + leaderCount;
  const required = sizeRequirement(format);

  if (draft.entries.length === 0) {
    issues.push({ target: 'cards', message: 'Agregá al menos una carta' });
  } else if (required.min !== undefined && size < required.min) {
    issues.push({
      target: 'size',
      message: `Faltan ${required.min - size} cartas (${describeSize(required)})`,
    });
  } else if (required.max !== undefined && size > required.max) {
    issues.push({
      target: 'size',
      message: `Sobran ${size - required.max} cartas (${describeSize(required)})`,
    });
  }

  // --- Copias por carta (espejo del GameSpec) ------------------------------
  if (maxCopies !== undefined) {
    const groups = new Map<string, { total: number; keys: string[]; exempt: boolean }>();
    for (const entry of draft.entries) {
      const id = rules.copyGroup?.(entry.card) ?? entry.card.name.trim().toLowerCase();
      const group = groups.get(id) ?? { total: 0, keys: [], exempt: false };
      group.total += entry.quantity;
      group.keys.push(entry.key);
      group.exempt ||= rules.isCopyLimitExempt?.(entry.card) ?? false;
      groups.set(id, group);
    }
    for (const group of groups.values()) {
      if (group.exempt || group.total <= maxCopies) continue;
      const note = group.keys.length > 1 ? ' (sumando todas sus ediciones)' : '';
      const message = `Máximo ${copies(maxCopies)} por carta en este formato${note}`;
      for (const cardKey of group.keys) issues.push({ target: { cardKey }, message });
    }
  }

  return {
    issues,
    hasErrors: issues.length > 0,
    size,
    required,
    maxCopies,
  };
}

/** Issues que apuntan a una carta concreta del mazo. */
export function issuesForCard(validation: DeckValidation, key: string): DeckIssue[] {
  return validation.issues.filter((issue) => typeof issue.target === 'object' && issue.target.cardKey === key);
}
