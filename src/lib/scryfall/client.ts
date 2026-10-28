/**
 * Cliente mínimo de Scryfall.
 *
 * ROL ACOTADO (decisión de arquitectura): Scryfall NO es la fuente de verdad
 * de las cartas — lo es el catálogo del backend (`/api/v3/cards`). Este
 * módulo existe solo para AYUDAR A RELLENAR un CardInput cuando el usuario
 * crea una carta que aún no está en el catálogo del back (juegos soportados
 * por Scryfall, de momento MTG).
 *
 * La carta resultante SIEMPRE se guarda pasando por el backend, que valida
 * los attributes con su GameSpec.
 *
 * Política de uso: rate limit público de Scryfall = 10 req/s; se respeta con
 * un límite de peticiones por ventana y caché para no castigar su API.
 * https://scryfall.com/docs/api — incluir identificación en User-Agent.
 */

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  mana_value?: number;
  type_line?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  rarity?: string;
  set?: string;
  collector_number?: string;
  image_uris?: { small?: string; normal?: string; large?: string };
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    power?: string;
    toughness?: string;
    image_uris?: { small?: string; normal?: string; large?: string };
  }>;
}

const SCRYFALL_BASE = 'https://api.scryfall.com';

// --- Rate limiting (10 req/s público): ventana deslizante simple -----------

const MAX_REQUESTS_PER_SECOND = 8; // margen de seguridad bajo el límite de 10
const WINDOW_MS = 1000;
let requestTimestamps: number[] = [];

async function throttle(): Promise<void> {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter((t) => now - t < WINDOW_MS);
  if (requestTimestamps.length >= MAX_REQUESTS_PER_SECOND) {
    const waitMs = WINDOW_MS - (now - requestTimestamps[0]);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  requestTimestamps.push(Date.now());
}

async function scryfallGet<T>(path: string): Promise<T> {
  await throttle();
  const response = await fetch(`${SCRYFALL_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      // Scryfall pide identificación en el User-Agent.
      'User-Agent': 'DeckBuilderFront/0.1 (contacto: https://github.com/tu-usuario/deck-builder-front)',
    },
  });
  // 404 de Scryfall = "no encontrada", no es un error de red.
  if (response.status === 404) throw new ScryfallNotFound();
  if (!response.ok) throw new Error(`Scryfall HTTP ${response.status}`);
  return (await response.json()) as T;
}

export class ScryfallNotFound extends Error {
  constructor() {
    super('Carta no encontrada en Scryfall');
    this.name = 'ScryfallNotFound';
  }
}

// --- API pública del módulo ------------------------------------------------

/** Busca una carta por nombre exacto o aproximado (p. ej. "lightning bolt"). */
export async function findCardByName(name: string): Promise<ScryfallCard | null> {
  try {
    return await scryfallGet<ScryfallCard>(`/cards/named?fuzzy=${encodeURIComponent(name)}`);
  } catch (error) {
    if (error instanceof ScryfallNotFound) return null;
    throw error;
  }
}

/** Autocompletado de nombres (para el buscador del editor). */
export async function autocompleteNames(query: string): Promise<string[]> {
  const result = await scryfallGet<{ suggestions: string[] }>(
    `/cards/autocomplete?q=${encodeURIComponent(query)}`,
  );
  return result.suggestions;
}

// --- Conversión a CardInput del backend ------------------------------------

/**
 * Convierte una carta de Scryfall al CardInput que el backend valida.
 * `attributes` usa un shape simple y genérico; si el GameSpec del backend
 * exige otros campos, ajustar aquí (el back siempre es la autoridad).
 */
export function scryfallToCardInput(card: ScryfallCard): {
  name: string;
  serial_set: string;
  image: string;
  attributes: Record<string, unknown>;
} {
  const face = card.card_faces?.[0];
  return {
    name: card.name,
    serial_set: `${(card.set ?? 'UNK').toUpperCase()}-${card.collector_number ?? '0'}`,
    image: card.image_uris?.normal ?? card.image_uris?.large ?? face?.image_uris?.normal ?? '',
    attributes: {
      mana_cost: card.mana_cost ?? face?.mana_cost,
      mana_value: card.mana_value,
      type: card.type_line ?? face?.type_line,
      oracle_text: card.oracle_text ?? face?.oracle_text,
      power: card.power ?? face?.power,
      toughness: card.toughness ?? face?.toughness,
      colors: card.colors,
      rarity: card.rarity,
    },
  };
}
