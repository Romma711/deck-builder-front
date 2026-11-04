import { useEffect, useId, useState } from 'react';
import { catalogApi } from '../../lib/api';
import { cardToInput } from '../../lib/api/decks';
import { describeError, type ErrorDescription } from '../../lib/forms/errors';
import { findCardByName, scryfallToCardInput } from '../../lib/scryfall/client';
import type { Card, CardInput } from '../../types/api';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { CardThumb, cardTypeLine } from './CardThumb';

const MIN_QUERY = 2;
const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;
/** Juegos con ayuda de Scryfall para cartas que no están en el catálogo */
const SCRYFALL_GAMES = new Set(['mtg']);

interface Props {
  game: string;
  /** Muestra la acción "Líder" en cada resultado */
  allowLeader: boolean;
  /** Muestra la acción "Partner" (cuando ya hay líder) */
  allowPartner: boolean;
  onAdd: (card: CardInput) => void;
  onSetLeader: (card: CardInput) => void;
  onSetPartner: (card: CardInput) => void;
}

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; query: string; results: Card[]; total?: number }
  | { status: 'error'; error: ErrorDescription };

type ScryfallState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; card: CardInput }
  | { status: 'not-found' }
  | { status: 'error' };

/**
 * Buscador de cartas del editor contra el catálogo del backend
 * (`GET /cards?game=&q=`). Si no hay resultados y el juego lo soporta,
 * ofrece buscar la carta en Scryfall para agregarla igual: el backend la
 * valida con su GameSpec al guardar el mazo.
 */
export function CardSearch({ game, allowLeader, allowPartner, onAdd, onSetLeader, onSetPartner }: Props) {
  const inputId = useId();
  const resultsId = useId();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const [scryfall, setScryfall] = useState<ScryfallState>({ status: 'idle' });
  const trimmed = query.trim();

  // Búsqueda con debounce; cada búsqueda nueva cancela la anterior.
  useEffect(() => {
    setScryfall({ status: 'idle' });
    if (trimmed.length < MIN_QUERY || !game) {
      setSearch({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearch({ status: 'loading' });
      catalogApi
        .listCards({ game, q: trimmed, limit: PAGE_SIZE }, controller.signal)
        .then(({ data, meta }) => setSearch({ status: 'ready', query: trimmed, results: data, total: meta?.total }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setSearch({ status: 'error', error: describeError(error) });
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [game, trimmed]);

  async function searchScryfall() {
    setScryfall({ status: 'loading' });
    try {
      const card = await findCardByName(trimmed);
      setScryfall(card ? { status: 'found', card: scryfallToCardInput(card) } : { status: 'not-found' });
    } catch {
      setScryfall({ status: 'error' });
    }
  }

  const results = search.status === 'ready' ? search.results : [];
  // Enter solo actúa sobre resultados de la consulta ACTUAL (no de una búsqueda vieja aún en pantalla).
  const enterTarget = search.status === 'ready' && search.query === trimmed ? results[0] : undefined;

  function renderActions(card: CardInput) {
    return (
      <div className="flex shrink-0 gap-1">
        {allowLeader && (
          <Button variant="ghost" className="px-2 py-1" aria-label={`Elegir ${card.name} como líder`} onClick={() => onSetLeader(card)}>
            Líder
          </Button>
        )}
        {allowPartner && (
          <Button variant="ghost" className="px-2 py-1" aria-label={`Elegir ${card.name} como partner`} onClick={() => onSetPartner(card)}>
            Partner
          </Button>
        )}
        <Button variant="secondary" className="px-2 py-1" aria-label={`Agregar ${card.name} al mazo`} onClick={() => onAdd(card)}>
          + Agregar
        </Button>
      </div>
    );
  }
  const canUseScryfall = SCRYFALL_GAMES.has(game);

  return (
    <section aria-labelledby={`${inputId}-title`} className="flex flex-col gap-3">
      <h2 id={`${inputId}-title`} className="text-base font-semibold text-slate-100">
        Buscar cartas
      </h2>
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="sr-only">
          Nombre de la carta
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          autoComplete="off"
          placeholder="Nombre de la carta… (Enter agrega la primera)"
          aria-controls={resultsId}
          aria-describedby={`${inputId}-hint`}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && enterTarget) {
              event.preventDefault();
              onAdd(cardToInput(enterTarget));
            }
          }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-500"
        />
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">
          Escribí al menos {MIN_QUERY} letras.
        </p>
      </div>

      <div id={resultsId} aria-live="polite" className="flex flex-col gap-2">
        {search.status === 'loading' && (
          <p className="text-sm text-slate-400" role="status">
            Buscando…
          </p>
        )}

        {search.status === 'error' && <Alert title={search.error.title} message={search.error.message} />}

        {search.status === 'ready' && results.length > 0 && (
          <>
            <ul className="flex max-h-[28rem] flex-col divide-y divide-slate-800 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900">
              {results.map((card) => {
                const input = cardToInput(card);
                return (
                  <li key={card.id} className="flex items-center gap-3 p-2">
                    <CardThumb card={input} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{card.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {[card.serial_set, cardTypeLine(input)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {renderActions(input)}
                  </li>
                );
              })}
            </ul>
            {search.total !== undefined && search.total > results.length && (
              <p className="text-xs text-slate-500">
                Mostrando {results.length} de {search.total}. Refiná la búsqueda para ver más.
              </p>
            )}
          </>
        )}

        {search.status === 'ready' && results.length === 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-700 p-4">
            <p className="text-sm text-slate-300">
              No hay cartas que coincidan con «{trimmed}» en el catálogo.
            </p>
            {canUseScryfall && scryfall.status === 'idle' && (
              <div>
                <Button variant="secondary" onClick={() => void searchScryfall()}>
                  Buscar en Scryfall
                </Button>
              </div>
            )}
            {scryfall.status === 'loading' && (
              <p className="text-sm text-slate-400" role="status">
                Consultando Scryfall…
              </p>
            )}
            {scryfall.status === 'not-found' && (
              <p className="text-sm text-slate-400">Scryfall tampoco encontró esa carta.</p>
            )}
            {scryfall.status === 'error' && (
              <p className="text-sm text-red-400">No se pudo consultar Scryfall. Probá de nuevo.</p>
            )}
            {scryfall.status === 'found' && (
              <div className="flex items-center gap-3 rounded-lg bg-slate-900 p-2">
                <CardThumb card={scryfall.card} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{scryfall.card.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {scryfall.card.serial_set} · datos de Scryfall
                  </p>
                </div>
                {renderActions(scryfall.card)}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
