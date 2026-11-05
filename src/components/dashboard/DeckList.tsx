import { useEffect, useState } from 'react';
import { decksApi } from '../../lib/api';
import { describeError, type ErrorDescription } from '../../lib/forms/errors';
import { getCurrentUser } from '../../lib/session/currentUser';
import type { Deck } from '../../types/api';
import { RequireAuth } from '../auth/RequireAuth';
import { DeckSummaryCard } from '../deck/DeckSummaryCard';
import { Alert } from '../ui/Alert';

/**
 * Lista de mazos del usuario autenticado (GET /decks?owner=<mi uuid>).
 * El backend aplica RLS: con token vemos los privados propios y los de orgs.
 * Island única de la página: incluye el guard de sesión.
 */
export function DeckList() {
  return (
    <RequireAuth>
      <DeckListContent />
    </RequireAuth>
  );
}

function DeckListContent() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((me) => (me ? decksApi.listDecks({ owner: me.id }) : { data: [] }))
      .then(({ data }) => {
        if (!cancelled) setDecks(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <Alert title={error.title} message={error.message} />;
  }

  if (decks === null) {
    return (
      <p className="text-sm text-slate-400" role="status">
        Cargando tus mazos…
      </p>
    );
  }

  if (decks.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-700 p-8">
        <h2 className="text-base font-semibold text-slate-200">Todavía no tenés mazos</h2>
        <p className="text-sm text-slate-400">
          Creá tu primer mazo eligiendo un juego y un formato. Te avisamos en vivo si algo no cumple las reglas.
        </p>
        <a
          href="/decks/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Crear mi primer mazo
        </a>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {decks.map((deck) => (
        <li key={deck.id}>
          <DeckSummaryCard deck={deck} />
        </li>
      ))}
    </ul>
  );
}
