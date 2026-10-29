/**
 * Store de catálogo: juegos y formatos (`GET /games`) cargados UNA vez
 * y compartidos por toda la app (editor, buscador, dashboard).
 *
 * Es un store con subscribe + useSyncExternalStore, igual que el de sesión:
 * - `loadCatalog()` es idempotente (si ya cargó, no vuelve a pegarle al back).
 * - Los juegos son datos prácticamente estáticos; si hace falta refrescar,
 *   hay `reload()`.
 */

import type { Format, Game } from '../../types/api';
import { listGames } from '../api/catalog';

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CatalogState {
  status: CatalogStatus;
  games: Game[];
  /** Mapa juego → formatos, para acceso rápido desde el editor/buscador */
  formatsByGame: Record<string, Format[]>;
  errorMessage?: string;
}

const initialState: CatalogState = {
  status: 'idle',
  games: [],
  formatsByGame: {},
};

let state: CatalogState = initialState;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: Partial<CatalogState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function getCatalogState(): CatalogState {
  return state;
}

export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
}

/** Carga los juegos (idempotente). Devuelve la promesa en curso o la ya resuelta. */
export function loadCatalog(): Promise<void> {
  if (state.status === 'ready') return Promise.resolve();
  if (inFlight) return inFlight;

  setState({ status: 'loading', errorMessage: undefined });
  inFlight = listGames()
    .then(({ data }) => {
      const formatsByGame: Record<string, Format[]> = {};
      for (const game of data) {
        formatsByGame[game.code] = game.formats ?? [];
      }
      state = { status: 'ready', games: data, formatsByGame };
      inFlight = null;
      for (const listener of listeners) listener();
    })
    .catch((error: unknown) => {
      state = {
        ...initialState,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'No se pudieron cargar los juegos',
      };
      inFlight = null;
      for (const listener of listeners) listener();
    });

  return inFlight;
}

/** Fuerza una recarga (p. ej. tras un error). */
export function reloadCatalog(): Promise<void> {
  state = initialState;
  return loadCatalog();
}

/** Busca un juego por código. */
export function getGameByCode(code: string): Game | undefined {
  return state.games.find((game) => game.code === code);
}

/** Devuelve los formatos de un juego (vacío si el juego no existe). */
export function getFormatsFor(gameCode: string): Format[] {
  return state.formatsByGame[gameCode] ?? [];
}

/** Busca un formato por juego + código. */
export function getFormat(gameCode: string, formatCode: string): Format | undefined {
  return getFormatsFor(gameCode).find((format) => format.code === formatCode);
}
