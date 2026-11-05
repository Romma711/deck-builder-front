import { useEffect, useState } from 'react';
import { decksApi } from '../../lib/api';
import { getFormat, getGameByCode } from '../../lib/catalog/catalog';
import { useCatalog } from '../../lib/catalog/useCatalog';
import { draftFromDeck, draftToInput } from '../../lib/deck/draft';
import { describeError, type ErrorDescription } from '../../lib/forms/errors';
import { loginUrl } from '../../lib/navigation';
import { getCurrentUser } from '../../lib/session/currentUser';
import { useSession } from '../../lib/session/useSession';
import type { Deck, User } from '../../types/api';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { LocalDate } from '../ui/LocalDate';
import { CardThumb, cardTypeLine } from './CardThumb';

const DETAIL_ERRORS = {
  NOT_FOUND: 'Este mazo no existe o es privado',
  FORBIDDEN: 'No tenés permiso para hacer esto con este mazo',
};

interface Props {
  deckId: string;
  /**
   * Mazo ya obtenido en el servidor (solo si es público). Permite que el
   * HTML inicial traiga el contenido (SEO, sin "Cargando…"). Si falta
   * (privado, timeout), el cliente lo pide con su token.
   */
  initialDeck?: Deck | null;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; deck: Deck; me: User | null }
  | { status: 'error'; error: ErrorDescription };

/** Lista de texto estándar ("4 Lightning Bolt"), compatible con la mayoría de los builders. */
function deckToText(deck: Deck): string {
  const lines: string[] = [];
  if (deck.leader) lines.push(`1 ${deck.leader.name}`);
  if (deck.partner) lines.push(`1 ${deck.partner.name}`);
  if (lines.length) lines.push('');
  for (const entry of deck.cards ?? []) lines.push(`${entry.quantity} ${entry.card.name}`);
  return lines.join('\n');
}

/**
 * Detalle de solo lectura de un mazo (`GET /decks/{id}`, auth opcional).
 * Acciones según quién mira:
 * - dueño: editar, duplicar, cambiar visibilidad, borrar;
 * - otro usuario logueado: copiar a su dashboard;
 * - anónimo: invitación a iniciar sesión para copiarlo.
 */
export function DeckDetail({ deckId, initialDeck }: Props) {
  const catalog = useCatalog();
  const { isAuthenticated } = useSession();
  const [state, setState] = useState<LoadState>(() =>
    initialDeck ? { status: 'ready', deck: initialDeck, me: null } : { status: 'loading' },
  );
  const [busy, setBusy] = useState<'duplicate' | 'visibility' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<ErrorDescription | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Con el mazo del servidor solo falta saber quién mira (acciones de dueño).
    const deckPromise = initialDeck ? Promise.resolve(initialDeck) : decksApi.getDeck(deckId);
    Promise.all([deckPromise, getCurrentUser().catch(() => null)])
      .then(([deck, me]) => {
        if (!cancelled) setState({ status: 'ready', deck, me });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', error: describeError(error, DETAIL_ERRORS) });
      });
    return () => {
      cancelled = true;
    };
  }, [deckId, initialDeck]);

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert title={state.error.title} message={state.error.message} />
        <a href="/dashboard" className="text-sm text-indigo-300 hover:underline">
          Ir a mis mazos
        </a>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <p className="text-sm text-slate-400" role="status">
        Cargando mazo…
      </p>
    );
  }

  const { deck, me } = state;
  const isOwner = me !== null && me.id === deck.owner_id;
  const ready = catalog.status === 'ready';
  const gameName = (ready && getGameByCode(deck.game)?.name) || deck.game;
  const formatName = (ready && getFormat(deck.game, deck.format)?.name) || deck.format;
  const cards = [...(deck.cards ?? [])].sort((a, b) => a.card.name.localeCompare(b.card.name));
  const total = cards.reduce((sum, entry) => sum + entry.quantity, 0);

  async function run(action: NonNullable<typeof busy>, task: () => Promise<void>) {
    setBusy(action);
    setActionError(null);
    try {
      await task();
    } catch (error) {
      setActionError(describeError(error, DETAIL_ERRORS));
    } finally {
      setBusy(null);
    }
  }

  const duplicate = () =>
    run('duplicate', async () => {
      // Copia de un mazo ajeno: privada por defecto, para no duplicar mazos públicos en el buscador.
      const copy = await decksApi.duplicateDeck(deck.id, { private: isOwner ? deck.private : true });
      window.location.assign(`/decks/${copy.id}/edit`);
    });

  const toggleVisibility = () =>
    run('visibility', async () => {
      const draft = { ...draftFromDeck(deck), private: !deck.private };
      const updated = await decksApi.updateDeck(deck.id, draftToInput(draft, deck.deck_size));
      setState({ status: 'ready', deck: updated, me });
    });

  const remove = () =>
    run('delete', async () => {
      await decksApi.deleteDeck(deck.id);
      window.location.assign('/dashboard');
    });

  async function copyList() {
    try {
      await navigator.clipboard.writeText(deckToText(deck));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError({ title: 'No se pudo copiar al portapapeles' });
    }
  }

  return (
    <article className="flex flex-col gap-8">
      {/* Encabezado */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-white">{deck.name}</h1>
            <p className="text-sm text-slate-400">
              {gameName} · {formatName} · {total} cartas
              {deck.private && (
                <span className="ml-2 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">🔒 Privado</span>
              )}
            </p>
            {deck.updated_at && (
              <p className="text-xs text-slate-500">
                Actualizado el <LocalDate value={deck.updated_at} />
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => void copyList()}>
              {copied ? '¡Lista copiada!' : 'Copiar lista'}
            </Button>
            {isOwner ? (
              <>
                <Button variant="secondary" loading={busy === 'visibility'} onClick={() => void toggleVisibility()}>
                  {deck.private ? 'Hacer público' : 'Hacer privado'}
                </Button>
                <Button variant="secondary" loading={busy === 'duplicate'} onClick={() => void duplicate()}>
                  Duplicar
                </Button>
                <a
                  href={`/decks/${deck.id}/edit`}
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  Editar
                </a>
              </>
            ) : isAuthenticated ? (
              <Button loading={busy === 'duplicate'} onClick={() => void duplicate()}>
                Copiar a mi dashboard
              </Button>
            ) : (
              <a
                href={loginUrl(`/decks/${deck.id}`)}
                className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700"
              >
                Iniciá sesión para copiarlo
              </a>
            )}
          </div>
        </div>

        {actionError && <Alert title={actionError.title} message={actionError.message} />}
        {deck.description && <p className="max-w-3xl whitespace-pre-line text-sm text-slate-300">{deck.description}</p>}
      </header>

      {/* Líder / partner */}
      {(deck.leader || deck.partner) && (
        <section aria-label="Líder" className="flex flex-wrap gap-6">
          {[
            { title: 'Líder', card: deck.leader },
            { title: 'Partner', card: deck.partner },
          ].map(({ title, card }) =>
            card ? (
              <figure key={title} className="flex flex-col gap-2">
                <CardThumb card={card} size="lg" />
                <figcaption className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-slate-500">{title}</span>
                  <span className="font-medium text-slate-100">{card.name}</span>
                </figcaption>
              </figure>
            ) : null,
          )}
        </section>
      )}

      {/* Lista de cartas */}
      <section aria-labelledby="deck-list-title" className="flex flex-col gap-3">
        <h2 id="deck-list-title" className="text-base font-semibold text-slate-100">
          Cartas ({total})
        </h2>
        <ul className="grid grid-cols-1 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900 sm:grid-cols-2 sm:divide-y-0">
          {cards.map((entry) => (
            <li key={entry.card.id} className="flex items-center gap-3 p-2 sm:border-b sm:border-slate-800">
              <span className="w-6 text-right text-sm font-semibold text-slate-300">{entry.quantity}</span>
              <CardThumb card={entry.card} />
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-100">{entry.card.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {[entry.card.serial_set, cardTypeLine(entry.card)].filter(Boolean).join(' · ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Zona de peligro (solo dueño) */}
      {isOwner && (
        <section className="flex max-w-lg flex-col gap-3 rounded-lg border border-red-900 bg-red-950/30 p-4">
          <h2 className="text-base font-semibold text-red-300">Eliminar mazo</h2>
          {!confirmingDelete ? (
            <div>
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                Eliminar este mazo
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-red-200">¿Seguro? Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <Button variant="danger" loading={busy === 'delete'} onClick={() => void remove()}>
                  Sí, eliminar
                </Button>
                <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  );
}
