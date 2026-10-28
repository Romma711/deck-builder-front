import { useCallback, useEffect, useState } from 'react';
import { authApi, decksApi } from '../../lib/api';
import { errorTitle, errorMessage } from '../../lib/forms/errors';
import type { Deck } from '../../types/api';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';

/**
 * Lista de mazos del usuario autenticado (GET /decks?owner=<mi uuid>).
 * El backend aplica RLS: con token vemos los privados propios y los de orgs.
 */
export function DeckList() {
  const [decks, setDecks] = useState<Deck[] | null>(null);
  const [error, setError] = useState<{ title: string; message?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      const { data } = await decksApi.listDecks({ owner: me.id });
      setDecks(data);
      setError(null);
    } catch (err) {
      setError({ title: errorTitle(err), message: errorMessage(err) });
      setDecks([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
          Creá tu primer mazo eligiendo un juego y un formato. El backend valida que cumpla las
          reglas antes de guardarlo.
        </p>
        {/* El editor llega en la Fase 3; el botón queda listo para enlazar. */}
        <Button variant="secondary" disabled title="Disponible en la Fase 3">
          Nuevo mazo (próximamente)
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {decks.map((deck) => (
        <li key={deck.id}>
          <a
            href={`/decks/${deck.id}`}
            className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-600"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-100">{deck.name}</h3>
                {deck.private && (
                  <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300" title="Mazo privado">
                    🔒 Privado
                  </span>
                )}
            </div>
            <p className="text-sm text-slate-400">
              {deck.game} · {deck.format} · {deck.deck_size} cartas
              {deck.leader ? ` · Líder: ${deck.leader.name}` : ''}
            </p>
            {deck.updated_at && (
              <p className="text-xs text-slate-500">
                Actualizado {new Date(deck.updated_at).toLocaleDateString('es')}
              </p>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
