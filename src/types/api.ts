/**
 * Tipos de dominio espejo de los schemas del backend Go (openapi.yaml v3).
 *
 * Si el backend cambia, actualizar aquí (idealmente regenerar con
 * openapi-typescript desde openapi.yaml).
 */

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_ID'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL';

/** Envelope de error de todos los endpoints: `{"error": {code, message, details?}}` */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Detalle por campo en validaciones (clave → mensaje) */
    details?: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// Paginación
// ---------------------------------------------------------------------------

/** Meta de listas sin paginación real (solo total) */
export interface ListMeta {
  total?: number;
}

/** Meta de listas paginadas (catálogo de cartas) */
export interface PagedMeta {
  total?: number;
  limit?: number;
  offset?: number;
}

export interface Paged<T> {
  data: T[];
  meta?: ListMeta | PagedMeta;
}

// ---------------------------------------------------------------------------
// Auth / usuarios
// ---------------------------------------------------------------------------

export interface User {
  id: string; // uuid
  username: string;
  email: string;
  created_at?: string; // date-time
  updated_at?: string; // date-time
}

export interface TokenPair {
  /** JWT Bearer de corto plazo */
  access_token: string;
  /** Opaco, rotatorio — el reuso revoca la familia entera */
  refresh_token: string;
  token_type?: string; // "Bearer"
  /** Segundos hasta expirar del access token */
  expires_in?: number;
}

export interface RegisterInput {
  username: string; // 3-30
  email: string;
  password: string; // 8-72
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface UpdateMeInput {
  username: string; // 3-30
  email: string;
}

// ---------------------------------------------------------------------------
// Catálogo: juegos y formatos
// ---------------------------------------------------------------------------

/**
 * Reglas de un formato. Son datos, no código: el frontend los interpreta
 * genéricamente para validar en vivo sin hardcodear reglas de un juego.
 */
export interface Format {
  code: string; // p. ej. standard
  name: string;
  deck_size?: number; // p. ej. 60
  min_size?: number;
  max_size?: number;
  requires_leader?: boolean;
}

export interface Game {
  code: string; // p. ej. mtg
  name: string; // p. ej. Magic: The Gathering
  formats?: Format[];
}

// ---------------------------------------------------------------------------
// Cartas
// ---------------------------------------------------------------------------

/**
 * Carta del catálogo del backend. Los atributos específicos del juego
 * (mana_cost, type, etc.) viven en `attributes`, validados por el GameSpec.
 */
export interface Card {
  id: string; // uuid
  game: string;
  name: string;
  serial_set?: string; // p. ej. "LEB-161"
  image?: string; // uri
  attributes?: Record<string, unknown>;
}

/** Carta a crear/actualizar desde el editor (los mazos guardan cartas completas) */
export interface CardInput {
  name: string; // 1-100
  serial_set: string; // 1-50
  image: string; // uri
  attributes: Record<string, unknown>;
}

export interface CardEntryInput {
  card: CardInput;
  quantity: number; // 1-99
}

export interface CardEntry {
  card: Card;
  quantity: number;
}

// ---------------------------------------------------------------------------
// Mazos
// ---------------------------------------------------------------------------

export interface DeckInput {
  name: string; // 3-50
  description?: string; // máx 300
  deck_size: number; // 1-400
  game: string;
  format: string;
  /** Vacío/ausente = mazo personal */
  org_id?: string | null;
  /** Solo el dueño y miembros de su org lo ven */
  private?: boolean;
  leader?: CardInput;
  partner?: CardInput;
  cards: CardEntryInput[]; // mín 1
}

export interface Deck {
  id: string; // uuid
  owner_id: string; // uuid
  org_id?: string | null; // ausente/vacío = personal
  private?: boolean;
  name: string;
  description?: string;
  deck_size: number;
  game: string;
  format: string;
  leader?: Card;
  partner?: Card;
  cards?: CardEntry[];
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Organizaciones
// ---------------------------------------------------------------------------

/** Jerarquía owner > admin > member */
export type Role = 'owner' | 'admin' | 'member';

export interface Organization {
  id: string; // uuid
  slug?: string;
  name: string;
  role?: Role;
  created_at?: string;
  updated_at?: string;
}

export interface CreateOrgInput {
  name: string; // 2-100
  slug?: string; // 2-50
}

export interface Member {
  user_id: string; // uuid
  username: string;
  email: string;
  role: Role;
  joined_at?: string;
}

export interface AddMemberInput {
  /** Username */
  user: string;
  role?: Role;
}

export interface UpdateMemberRoleInput {
  role: Role;
}
