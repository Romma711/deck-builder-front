/**
 * Control de deriva: falla el type-check si los tipos de dominio (`api.ts`)
 * dejan de tener los mismos campos que los schemas del OpenAPI.
 *
 * `api.ts` sigue siendo a mano porque el spec no marca como requeridos los
 * campos de las respuestas (`id`, `name`…): usar los generados obligaría a
 * chequear `undefined` en toda la UI. Tras cambiar `openapi.yaml`: `pnpm gen:api`.
 */

import type { components } from './openapi.gen';
import type * as Api from './api';

type Schemas = components['schemas'];
type SameKeys<A, B> = [keyof A] extends [keyof B] ? ([keyof B] extends [keyof A] ? true : never) : never;

export type ApiContract = [
  SameKeys<Api.User, Schemas['User']>,
  SameKeys<Api.TokenPair, Schemas['TokenPair']>,
  SameKeys<Api.Format, Schemas['Format']>,
  SameKeys<Api.Game, Schemas['Game']>,
  SameKeys<Api.Card, Schemas['Card']>,
  SameKeys<Api.CardInput, Schemas['CardInput']>,
  SameKeys<Api.CardEntry, Schemas['CardEntry']>,
  SameKeys<Api.CardEntryInput, Schemas['CardEntryInput']>,
  SameKeys<Api.Deck, Schemas['Deck']>,
  SameKeys<Api.DeckInput, Schemas['DeckInput']>,
  SameKeys<Api.Organization, Schemas['Organization']>,
  SameKeys<Api.Member, Schemas['Member']>,
];

/** Cada posición debe ser `true`; un `never` indica el schema desalineado. */
export const apiContractHolds: ApiContract = [true, true, true, true, true, true, true, true, true, true, true, true];
