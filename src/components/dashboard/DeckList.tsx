import { useEffect, useState } from 'react';
import { decksApi } from '../../lib/api';
import { describeError, type ErrorDescription } from '../../lib/forms/errors';
import { getMyOrgs } from '../../lib/org/myOrgs';
import { getCurrentUser } from '../../lib/session/currentUser';
import type { Deck, Organization } from '../../types/api';
import { RequireAuth } from '../auth/RequireAuth';
import { DeckSummaryCard } from '../deck/DeckSummaryCard';
import { Alert } from '../ui/Alert';

/**
 * Dashboard del usuario (island única de la página, con guard de sesión):
 * - "Mis mazos": los que creó (`GET /decks?owner=<yo>`), personales o de org;
 * - "De mis organizaciones": los que crearon OTROS miembros de sus orgs
 *   (`GET /decks?org=<id>` por org), agrupados por organización.
 */
export function DeckList() {
  return (
    <RequireAuth>
      <DeckListContent />
    </RequireAuth>
  );
}

interface OrgDecks {
  org: Organization;
  decks: Deck[];
}

interface DashboardData {
  mine: Deck[];
  byOrg: OrgDecks[];
  orgNames: Record<string, string>;
}

async function loadDashboard(): Promise<DashboardData> {
  const [me, orgs] = await Promise.all([getCurrentUser(), getMyOrgs().catch(() => [])]);
  if (!me) return { mine: [], byOrg: [], orgNames: {} };

  const [mine, ...perOrg] = await Promise.all([
    decksApi.listDecks({ owner: me.id }).then(({ data }) => data),
    ...orgs.map((org) =>
      decksApi
        .listDecks({ org: org.id })
        .then(({ data }) => data)
        // Una org que falla no debe tirar abajo todo el dashboard.
        .catch(() => [] as Deck[]),
    ),
  ]);

  return {
    mine,
    byOrg: orgs
      .map((org, i) => ({ org, decks: perOrg[i].filter((deck) => deck.owner_id !== me.id) }))
      .filter(({ decks }) => decks.length > 0),
    orgNames: Object.fromEntries(orgs.map((org) => [org.id, org.name])),
  };
}

function DeckListContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadDashboard()
      .then((result) => {
        if (!cancelled) setData(result);
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

  if (data === null) {
    return (
      <p className="text-sm text-slate-400" role="status">
        Cargando tus mazos…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {data.mine.length === 0 ? (
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
      ) : (
        <DeckGrid decks={data.mine} orgNames={data.orgNames} />
      )}

      {data.byOrg.length > 0 && (
        <section aria-labelledby="org-decks-title" className="flex flex-col gap-6">
          <h2 id="org-decks-title" className="text-lg font-semibold text-white">
            De mis organizaciones
          </h2>
          {data.byOrg.map(({ org, decks }) => (
            <div key={org.id} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-300">
                <a href={`/orgs/${org.id}`} className="hover:underline">
                  {org.name}
                </a>{' '}
                <span className="font-normal text-slate-500">({decks.length})</span>
              </h3>
              <DeckGrid decks={decks} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function DeckGrid({ decks, orgNames }: { decks: Deck[]; orgNames?: Record<string, string> }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {decks.map((deck) => (
        <li key={deck.id}>
          <DeckSummaryCard deck={deck} orgName={deck.org_id ? orgNames?.[deck.org_id] : undefined} />
        </li>
      ))}
    </ul>
  );
}
