/**
 * Validación EN VIVO del mazo en el frontend (feedback inmediato, sin guardar).
 *
 * El backend (GameSpec) es la autoridad. Acá se adelantan sus reglas para
 * avisar antes de guardar:
 * - tamaño y líder: vienen de `/games` (datos del formato);
 * - copias por carta: espejo de `ValidateDeck` de cada GameSpec del back
 *   (internal/app/gamespec). Se cuentan por NOMBRE, sumando ediciones.
 *
 * Reglas del juego real que el backend NO valida (p. ej. singleton en
 * Commander) se muestran como AVISO: no bloquean un guardado que el back
 * aceptaría.
 *
 * Para sumar o ajustar un juego, se toca SOLO `GAME_RULES`.
 */

import type { CardInput, Format } from '../../types/api';
import type { DeckDraft } from './draft';

// ---------------------------------------------------------------------------
// Configuración por juego (claves = códigos de juego del backend)
// ---------------------------------------------------------------------------

export interface GameRules {
  /** Copias máximas por nombre que valida el backend → error */
  maxCopies?: number;
  /** Límite del reglamento que el backend no valida → aviso */
  recommendedMaxCopies?: number;
  /** Override del límite recomendado por formato (p. ej. commander = 1) */
  recommendedMaxCopiesByFormat?: Record<string, number>;
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
    recommendedMaxCopiesByFormat: { commander: 1, brawl: 1 },
    isCopyLimitExempt: (card) => MTG_BASIC_LANDS.has(card.name.trim()),
    // En Commander el comandante es parte de las 100 cartas.
    leaderCountsTowardSize: true,
  },
  pokemon: {
    maxCopies: 4,
    isCopyLimitExempt: (card) => attribute(card, 'kind') === 'energy',
  },
  // Sic: el backend usa el código "yuigoh".
  yuigoh: { maxCopies: 3 },
  onepiece: {
    // El back no limita copias en One Piece; el reglamento oficial sí (4).
    recommendedMaxCopies: 4,
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

export interface CopyLimits {
  /** Lo que valida el backend */
  enforced?: number;
  /** Lo que recomienda el reglamento (más estricto o inexistente en el back) */
  recommended?: number;
}

export function copyLimitsFor(game: string, format: string): CopyLimits {
  const rules = rulesFor(game);
  return {
    enforced: rules.maxCopies,
    recommended: rules.recommendedMaxCopiesByFormat?.[format] ?? rules.recommendedMaxCopies,
  };
}

/** Límite de copias a mostrar al usuario (el más estricto de los dos). */
export function maxCopiesFor(game: string, format: string): number | undefined {
  const { enforced, recommended } = copyLimitsFor(game, format);
  if (enforced === undefined) return recommended;
  if (recommended === undefined) return enforced;
  return Math.min(enforced, recommended);
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

export const NAME_MIN = 3;
export const NAME_MAX = 50;
export const DESCRIPTION_MAX = 300;

export type IssueSeverity = 'error' | 'warning';

export interface DeckIssue {
  severity: IssueSeverity;
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
  /** true si hay errores duros (bloquean el guardado) */
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
    issues.push({ severity: 'error', target: 'name', message: `El nombre debe tener al menos ${NAME_MIN} caracteres` });
  } else if (name.length > NAME_MAX) {
    issues.push({ severity: 'error', target: 'name', message: `El nombre no puede superar los ${NAME_MAX} caracteres` });
  }
  if (draft.description.trim().length > DESCRIPTION_MAX) {
    issues.push({
      severity: 'error',
      target: 'description',
      message: `La descripción no puede superar los ${DESCRIPTION_MAX} caracteres`,
    });
  }
  if (!format) {
    issues.push({ severity: 'error', target: 'format', message: 'Elegí un juego y un formato' });
  }

  // --- Líder ----------------------------------------------------------------
  if (format?.requires_leader && !draft.leader) {
    issues.push({ severity: 'error', target: 'leader', message: 'Este formato requiere un líder' });
  } else if (format?.requires_leader && draft.leader && rules.leaderRule && !rules.leaderRule.isValid(draft.leader)) {
    issues.push({ severity: 'error', target: 'leader', message: rules.leaderRule.message });
  }

  // --- Tamaño ---------------------------------------------------------------
  const mainCount = draft.entries.reduce((total, entry) => total + entry.quantity, 0);
  const leaderCount = rules.leaderCountsTowardSize ? (draft.leader ? 1 : 0) + (draft.partner ? 1 : 0) : 0;
  const size = mainCount + leaderCount;
  const required = sizeRequirement(format);

  if (draft.entries.length === 0) {
    issues.push({ severity: 'error', target: 'cards', message: 'Agregá al menos una carta' });
  } else if (required.min !== undefined && size < required.min) {
    issues.push({
      severity: 'error',
      target: 'size',
      message: `Faltan ${required.min - size} cartas (${describeSize(required)})`,
    });
  } else if (required.max !== undefined && size > required.max) {
    issues.push({
      severity: 'error',
      target: 'size',
      message: `Sobran ${size - required.max} cartas (${describeSize(required)})`,
    });
  }

  // --- Copias por nombre (como el GameSpec: suma todas las ediciones) -----
  const limits = copyLimitsFor(draft.game, draft.format);
  if (limits.enforced !== undefined || limits.recommended !== undefined) {
    const byName = new Map<string, { total: number; keys: string[]; exempt: boolean }>();
    for (const entry of draft.entries) {
      const name = entry.card.name.trim().toLowerCase();
      const group = byName.get(name) ?? { total: 0, keys: [], exempt: false };
      group.total += entry.quantity;
      group.keys.push(entry.key);
      group.exempt ||= rules.isCopyLimitExempt?.(entry.card) ?? false;
      byName.set(name, group);
    }
    for (const group of byName.values()) {
      if (group.exempt) continue;
      const sameNameNote = group.keys.length > 1 ? ' (sumando todas sus ediciones)' : '';
      let issue: Omit<DeckIssue, 'target'> | undefined;
      if (limits.enforced !== undefined && group.total > limits.enforced) {
        issue = { severity: 'error', message: `Máximo ${copies(limits.enforced)} por carta${sameNameNote}` };
      } else if (limits.recommended !== undefined && group.total > limits.recommended) {
        issue = {
          severity: 'warning',
          message: `El reglamento permite ${copies(limits.recommended)} por carta en este formato${sameNameNote}`,
        };
      }
      if (issue) for (const cardKey of group.keys) issues.push({ ...issue, target: { cardKey } });
    }
  }

  return {
    issues,
    hasErrors: issues.some((issue) => issue.severity === 'error'),
    size,
    required,
    maxCopies,
  };
}

/** Issues que apuntan a una carta concreta del mazo. */
export function issuesForCard(validation: DeckValidation, key: string): DeckIssue[] {
  return validation.issues.filter((issue) => typeof issue.target === 'object' && issue.target.cardKey === key);
}
