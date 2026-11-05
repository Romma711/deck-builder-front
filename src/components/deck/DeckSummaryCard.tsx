import { getFormat, getGameByCode } from '../../lib/catalog/catalog';
import { useCatalog } from '../../lib/catalog/useCatalog';
import type { Deck } from '../../types/api';
import { LocalDate } from '../ui/LocalDate';
import { CardThumb } from './CardThumb';

interface Props {
  deck: Deck;
  /** Nombre de la org dueña (si se conoce) para mostrarla como etiqueta */
  orgName?: string;
}

/** Tarjeta resumen de un mazo (dashboard y buscador): enlaza a su detalle. */
export function DeckSummaryCard({ deck, orgName }: Props) {
  const catalog = useCatalog();
  const ready = catalog.status === 'ready';
  const gameName = (ready && getGameByCode(deck.game)?.name) || deck.game;
  const formatName = (ready && getFormat(deck.game, deck.format)?.name) || deck.format;

  return (
    <a
      href={`/decks/${deck.id}`}
      className="flex h-full gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      {deck.leader && <CardThumb card={deck.leader} />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold break-words text-slate-100">{deck.name}</h3>
          {deck.private && (
            <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300" title="Mazo privado">
              🔒 Privado
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          {gameName} · {formatName} · {deck.deck_size} cartas
          {deck.leader ? ` · Líder: ${deck.leader.name}` : ''}
        </p>
        {orgName && (
          <p className="w-fit rounded bg-indigo-950/60 px-2 py-0.5 text-xs text-indigo-200">🏷 {orgName}</p>
        )}
        {deck.updated_at && (
          <p className="text-xs text-slate-500">Actualizado <LocalDate value={deck.updated_at} /></p>
        )}
      </div>
    </a>
  );
}
