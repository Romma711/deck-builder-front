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
 * Política de uso (https://scryfall.com/docs/api): como máximo ~10 req/s
 * (50–100 ms entre peticiones) y cachear resultados. Se respeta con un
 * espaciado mínimo entre peticiones y una caché en memoria.
 *
 * No se envían headers custom (User-Agent, etc.): desde el navegador el
 * User-Agent no se puede sobrescribir y cualquier header extra fuerza un
 * preflight CORS innecesario.
 */

export interface ScryfallCard {
  id: string;
  name: string;
  mana_cost?: string;
  /** Valor de maná convertido (en la API de Scryfall se llama `cmc`) */
  cmc?: number;
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
    colors?: string[];
    image_uris?: { small?: string; normal?: string; large?: string };
  }>;
}

const SCRYFALL_BASE = 'https://api.scryfall.com';

// --- Rate limiting: espaciado mínimo entre peticiones -----------------------

const MIN_INTERVAL_MS = 100; // ≤ 10 req/s, dentro de lo que pide Scryfall
let nextSlotAt = 0;

/**
 * Reserva el próximo turno de forma SÍNCRONA (sin carreras entre llamadas
 * concurrentes) y espera hasta que llegue.
 */
function throttle(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + MIN_INTERVAL_MS;
  const waitMs = slot - now;
  return waitMs > 0 ? new Promise((resolve) => setTimeout(resolve, waitMs)) : Promise.resolve();
}

// --- Caché en memoria (LRU simple con TTL) ----------------------------------

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    // Re-insertar para mantener el orden LRU.
    cache.delete(key);
    cache.set(key, hit);
    return hit.value as Promise<T>;
  }
  const value = load();
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  // No cachear fallos transitorios (los "no encontrada" sí: son respuestas válidas).
  value.catch((error) => {
    if (!(error instanceof ScryfallNotFound)) cache.delete(key);
  });
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return value;
}

function scryfallGet<T>(path: string): Promise<T> {
  return cached(path, async () => {
    await throttle();
    const response = await fetch(`${SCRYFALL_BASE}${path}`, { headers: { Accept: 'application/json' } });
    // 404 de Scryfall = "no encontrada", no es un error de red.
    if (response.status === 404) throw new ScryfallNotFound();
    if (!response.ok) throw new Error(`Scryfall HTTP ${response.status}`);
    return (await response.json()) as T;
  });
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
 * Tipos que acepta el GameSpec MTG del backend (`type` es oneof). Orden de
 * prioridad para líneas con varios tipos: "Artifact Creature" → Creature,
 * "Basic Land — Mountain" → Land.
 */
const MTG_MAIN_TYPES = ['Creature', 'Planeswalker', 'Land', 'Artifact', 'Enchantment', 'Instant', 'Sorcery'];

/** Colores de Scryfall (WUBRG) → nombres que acepta el GameSpec MTG. */
const MTG_COLOR_NAMES: Record<string, string> = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };

function mainType(typeLine: string | undefined): string | undefined {
  if (!typeLine) return undefined;
  // En cartas de dos caras se toma la cara frontal ("Creature — Human // Land").
  const front = typeLine.split('//')[0];
  return MTG_MAIN_TYPES.find((type) => front.includes(type));
}

function colorNames(colors: string[] | undefined): string[] {
  const names = (colors ?? []).map((color) => MTG_COLOR_NAMES[color]).filter(Boolean);
  return names.length > 0 ? names : ['Colorless'];
}

/**
 * Convierte una carta de Scryfall al CardInput que valida el GameSpec MTG del
 * backend (internal/app/gamespec/mtg.go): `type` (uno de MTG_MAIN_TYPES),
 * `colors` (nombres en inglés, no vacío) y `mana_value` [0,20]. El resto de
 * los atributos viaja como información extra (el back no los valida).
 */
export function scryfallToCardInput(card: ScryfallCard): {
  name: string;
  serial_set: string;
  image: string;
  attributes: Record<string, unknown>;
} {
  const face = card.card_faces?.[0];
  const typeLine = card.type_line ?? face?.type_line;
  return {
    name: card.name,
    serial_set: `${(card.set ?? 'UNK').toUpperCase()}-${card.collector_number ?? '0'}`,
    image: card.image_uris?.normal ?? card.image_uris?.large ?? face?.image_uris?.normal ?? '',
    attributes: {
      mana_cost: card.mana_cost ?? face?.mana_cost,
      mana_value: card.cmc ?? 0,
      type: mainType(typeLine),
      type_line: typeLine,
      oracle_text: card.oracle_text ?? face?.oracle_text,
      power: card.power ?? face?.power,
      toughness: card.toughness ?? face?.toughness,
      colors: colorNames(card.colors ?? face?.colors),
      rarity: card.rarity,
    },
  };
}
