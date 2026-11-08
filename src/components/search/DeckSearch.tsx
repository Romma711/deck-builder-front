import { useEffect, useRef, useState } from 'react';
import { useCatalog } from '../../lib/catalog/useCatalog';
import { describeError, type ErrorDescription } from '../../lib/forms/errors';
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  hasActiveFilters,
  parseSearchParams,
  searchDecks,
  toSearchParams,
  type DeckSearchFilters,
  type DeckSearchResult,
  type SearchState,
} from '../../lib/search/deckSearch';
import { getMyOrgs } from '../../lib/org/myOrgs';
import { getCurrentUser } from '../../lib/session/currentUser';
import { useSession } from '../../lib/session/useSession';
import type { Organization, User } from '../../types/api';
import { DeckSummaryCard } from '../deck/DeckSummaryCard';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

const LEADER_DEBOUNCE_MS = 400;
const RESULTS_ID = 'deck-search-results';

type ResultState =
  | { status: 'loading' }
  | { status: 'ready'; result: DeckSearchResult }
  | { status: 'error'; error: ErrorDescription };

/**
 * Buscador público de mazos (`/search`). Los filtros se sincronizan con la
 * URL: cambiar un select o de página crea una entrada en el historial; el
 * texto del líder la reemplaza (no ensucia el "atrás" letra por letra).
 */
export function DeckSearch() {
  const catalog = useCatalog();
  const { isAuthenticated } = useSession();
  // La página es estática: la URL se lee recién en el cliente.
  const [search, setSearch] = useState<SearchState | null>(null);
  const [results, setResults] = useState<ResultState>({ status: 'loading' });
  const [leaderText, setLeaderText] = useState('');
  const [me, setMe] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [retry, setRetry] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);

  // --- URL ↔ estado ------------------------------------------------------------
  useEffect(() => {
    const fromUrl = () => {
      const parsed = parseSearchParams(window.location.search);
      setSearch(parsed);
      setLeaderText(parsed.filters.leader);
    };
    fromUrl();
    window.addEventListener('popstate', fromUrl);
    return () => window.removeEventListener('popstate', fromUrl);
  }, []);

  function commit(next: SearchState, mode: 'push' | 'replace' = 'push') {
    setSearch(next);
    const url = `${window.location.pathname}${toSearchParams(next)}`;
    if (mode === 'push') window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
  }

  function updateFilters(patch: Partial<DeckSearchFilters>, mode: 'push' | 'replace' = 'push') {
    if (!search) return;
    // Cualquier filtro nuevo vuelve a la primera página.
    commit({ filters: { ...search.filters, ...patch }, page: 1 }, mode);
  }

  // Texto del líder con debounce.
  useEffect(() => {
    if (!search || leaderText.trim() === search.filters.leader) return;
    const timer = window.setTimeout(() => updateFilters({ leader: leaderText.trim() }, 'replace'), LEADER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // Solo reacciona al texto: `search` se lee al momento de confirmar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderText]);

  // --- Datos del usuario (opcionales: mejoran los filtros) -----------------------
  useEffect(() => {
    if (!isAuthenticated) {
      setMe(null);
      setOrgs([]);
      return;
    }
    getCurrentUser()
      .then(setMe)
      .catch(() => setMe(null));
    getMyOrgs()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, [isAuthenticated]);

  // --- Búsqueda -------------------------------------------------------------------
  useEffect(() => {
    if (!search) return;
    const controller = new AbortController();
    setResults({ status: 'loading' });
    searchDecks(search.filters, search.page, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setResults({ status: 'ready', result });
        // Página fuera de rango (p. ej. URL vieja): corregir sin crear historial.
        if (result.page !== search.page) commit({ ...search, page: result.page }, 'replace');
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setResults({ status: 'error', error: describeError(error) });
      });
    return () => controller.abort();
  }, [search, retry]);

  function goToPage(page: number) {
    if (!search) return;
    commit({ ...search, page });
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    resultsRef.current?.focus({ preventScroll: true });
  }

  // --- Render ---------------------------------------------------------------------
  const filters = search?.filters ?? EMPTY_FILTERS;
  const games = catalog.status === 'ready' ? catalog.games : [];
  const formats = games.find((game) => game.code === filters.game)?.formats ?? [];
  const active = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-8">
      {/* Filtros */}
      <form
        role="search"
        aria-label="Filtros de mazos"
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Juego"
            value={filters.game}
            disabled={catalog.status !== 'ready'}
            options={[{ value: '', label: 'Todos los juegos' }, ...games.map((g) => ({ value: g.code, label: g.name }))]}
            onChange={(event) => updateFilters({ game: event.target.value, format: '' })}
          />
          <Select
            label="Formato"
            value={filters.format}
            disabled={!filters.game}
            options={[
              { value: '', label: filters.game ? 'Todos los formatos' : 'Elegí un juego primero' },
              ...formats.map((f) => ({ value: f.code, label: f.name })),
            ]}
            onChange={(event) => updateFilters({ format: event.target.value })}
          />
          <Input
            label="Líder"
            type="search"
            value={leaderText}
            placeholder="Nombre exacto"
            aria-describedby="leader-hint"
            onChange={(event) => setLeaderText(event.target.value)}
          />
          {orgs.length > 0 && (
            <Select
              label="Organización"
              value={filters.org}
              options={[{ value: '', label: 'Todas' }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]}
              onChange={(event) => updateFilters({ org: event.target.value })}
            />
          )}
        </div>
        <p id="leader-hint" className="-mt-2 text-xs text-slate-400">
          El líder se busca por nombre exacto (p. ej. «Monkey.D.Luffy»).
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {me ? (
            <Checkbox
              label="Solo mis mazos"
              checked={filters.owner === me.id}
              onChange={(event) => updateFilters({ owner: event.target.checked ? me.id : '' })}
            />
          ) : (
            <span />
          )}
          {active && (
            <Button
              variant="ghost"
              onClick={() => {
                setLeaderText('');
                commit({ filters: EMPTY_FILTERS, page: 1 });
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </form>

      {/* Resultados */}
      <section
        id={RESULTS_ID}
        ref={resultsRef}
        tabIndex={-1}
        aria-label="Resultados"
        aria-busy={results.status === 'loading'}
        className="flex scroll-mt-6 flex-col gap-4 focus:outline-none"
      >
        <p className="text-sm text-slate-400" aria-live="polite">
          {results.status === 'loading' && 'Buscando mazos…'}
          {results.status === 'ready' && resultsSummary(results.result)}
        </p>

        {results.status === 'error' && (
          <div className="flex flex-col items-start gap-3">
            <Alert title={results.error.title} message={results.error.message} />
            <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
              Reintentar
            </Button>
          </div>
        )}

        {results.status === 'loading' && <ResultsSkeleton />}

        {results.status === 'ready' && results.result.total === 0 && (
          <EmptyState
            filtered={active}
            onClear={() => {
              setLeaderText('');
              commit({ filters: EMPTY_FILTERS, page: 1 });
            }}
          />
        )}

        {results.status === 'ready' && results.result.total > 0 && (
          <>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {results.result.items.map((deck) => (
                <li key={deck.id}>
                  <DeckSummaryCard deck={deck} />
                </li>
              ))}
            </ul>
            <Pagination page={results.result.page} pageCount={results.result.pageCount} onChange={goToPage} />
          </>
        )}
      </section>
    </div>
  );
}

function resultsSummary({ total, page, items }: DeckSearchResult): string {
  if (total === 0) return 'Sin resultados';
  if (total <= items.length) return total === 1 ? '1 mazo' : `${total} mazos`;
  const start = (page - 1) * PAGE_SIZE + 1;
  return `Mostrando ${start}–${start + items.length - 1} de ${total} mazos`;
}

function ResultsSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="h-28 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
      ))}
    </ul>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-700 p-8">
      <h2 className="text-base font-semibold text-slate-200">
        {filtered ? 'Ningún mazo coincide con los filtros' : 'Todavía no hay mazos públicos'}
      </h2>
      <p className="text-sm text-slate-400">
        {filtered
          ? 'Probá con menos filtros. Recordá que el líder se busca por nombre exacto.'
          : 'Sé la primera persona en compartir uno.'}
      </p>
      {filtered ? (
        <Button variant="secondary" onClick={onClear}>
          Limpiar filtros
        </Button>
      ) : (
        <a href="/decks/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          Crear un mazo
        </a>
      )}
    </div>
  );
}

/** Paginación compacta: primera, actual ±1, última y elipsis. */
function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  const pages = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((p) => p >= 1 && p <= pageCount);
  const itemClass =
    'min-w-9 rounded-lg px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-1">
      <button type="button" className={`${itemClass} text-slate-300 hover:bg-slate-800`} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← Anterior
      </button>
      {pages.map((p, index) => (
        <span key={p} className="flex items-center gap-1">
          {index > 0 && p - pages[index - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
          <button
            type="button"
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Página ${p}`}
            className={`${itemClass} ${p === page ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        type="button"
        className={`${itemClass} text-slate-300 hover:bg-slate-800`}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Siguiente →
      </button>
    </nav>
  );
}
