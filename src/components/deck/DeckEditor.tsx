import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ApiError, decksApi } from '../../lib/api';
import { getFormat } from '../../lib/catalog/catalog';
import { useCatalog } from '../../lib/catalog/useCatalog';
import { draftFromDeck, draftReducer, draftToInput, emptyDraft, sameDraft, type DeckDraft } from '../../lib/deck/draft';
import { DESCRIPTION_MAX, NAME_MAX, validateDeck } from '../../lib/deck/rules';
import { emptyServerErrors, mapDeckServerErrors, type DeckServerErrors } from '../../lib/deck/serverErrors';
import { describeError, type ErrorDescription } from '../../lib/forms/errors';
import { getMyOrgs } from '../../lib/org/myOrgs';
import { getCurrentUser } from '../../lib/session/currentUser';
import type { Organization } from '../../types/api';
import { RequireAuth } from '../auth/RequireAuth';
import { FormatRulesSummary, GameFormatSelector } from '../catalog/GameFormatSelector';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { CardSearch } from './CardSearch';
import { DeckCardList } from './DeckCardList';
import { DeckValidationPanel } from './DeckValidationPanel';
import { LeaderSlots } from './LeaderSlots';

const PANEL_ID = 'deck-validation-panel';

/** En el editor un 404 o 403 al cargar/guardar tienen un significado concreto. */
const EDITOR_ERRORS = {
  NOT_FOUND: 'El mazo no existe o no tenés acceso',
  FORBIDDEN: 'No tenés permiso para guardar este mazo',
};

interface Props {
  /** Ausente = mazo nuevo */
  deckId?: string;
}

/** Página del editor (island única): incluye el guard de sesión. */
export function DeckEditor({ deckId }: Props) {
  return (
    <RequireAuth>
      <DeckEditorContent deckId={deckId} />
    </RequireAuth>
  );
}

type LoadState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: ErrorDescription };

function DeckEditorContent({ deckId }: Props) {
  const isNew = !deckId;
  const catalog = useCatalog();
  const [draft, dispatch] = useReducer(draftReducer, undefined, () => emptyDraft());
  const [baseline, setBaseline] = useState<DeckDraft | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ErrorDescription | null>(null);
  const [serverErrors, setServerErrors] = useState<DeckServerErrors>(emptyServerErrors);
  const [pendingGame, setPendingGame] = useState<{ game: string; format: string } | null>(null);
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const leaving = useRef(false);

  // Orgs del usuario: destino posible del mazo (sin orgs, el selector no aparece).
  useEffect(() => {
    getMyOrgs()
      .then(setOrgs)
      .catch(() => setOrgs([]));
  }, []);

  // --- Carga inicial: mazo nuevo (espera al catálogo y a las orgs) ------------
  useEffect(() => {
    if (deckId || catalog.status !== 'ready' || orgs === null || baseline) return;
    // Preselección por URL (?game=&format=&org=) o el primer juego/formato del catálogo.
    const params = new URLSearchParams(window.location.search);
    const game = catalog.games.find((g) => g.code === params.get('game')) ?? catalog.games[0];
    const format = game?.formats?.find((f) => f.code === params.get('format')) ?? game?.formats?.[0];
    const org = orgs.find((o) => o.id === params.get('org'));
    const initial = { ...emptyDraft(game?.code ?? '', format?.code ?? ''), orgId: org?.id };
    dispatch({ type: 'reset', draft: initial });
    setBaseline(initial);
    setLoad({ status: 'ready' });
  }, [deckId, catalog.status, catalog.games, orgs, baseline]);

  // --- Carga inicial: edición (solo el dueño) --------------------------------
  useEffect(() => {
    if (!deckId) return;
    let cancelled = false;
    Promise.all([decksApi.getDeck(deckId), getCurrentUser()])
      .then(([deck, me]) => {
        if (cancelled) return;
        if (!me || deck.owner_id !== me.id) {
          setLoad({
            status: 'error',
            error: { title: 'Solo el dueño puede editar este mazo', message: 'Podés copiarlo a tu dashboard desde su página.' },
          });
          return;
        }
        const loaded = draftFromDeck(deck);
        dispatch({ type: 'reset', draft: loaded });
        setBaseline(loaded);
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', error: describeError(error, EDITOR_ERRORS) });
      });
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  // --- Derivados -------------------------------------------------------------
  const format = catalog.status === 'ready' ? getFormat(draft.game, draft.format) : undefined;
  const validation = useMemo(() => validateDeck(draft, format), [draft, format]);
  const dirty = baseline !== null && !sameDraft(draft, baseline);
  const requiresLeader = format?.requires_leader ?? false;
  const fieldIssue = (target: 'name' | 'description') =>
    attempted ? validation.issues.find((issue) => issue.target === target)?.message : undefined;

  // Aviso del navegador al salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // Un cambio en el mazo invalida los errores que devolvió el backend.
  useEffect(() => {
    setServerErrors(emptyServerErrors());
  }, [draft]);

  // --- Acciones --------------------------------------------------------------
  function changeGameFormat(next: { game: string; format: string }) {
    const hasCards = draft.entries.length > 0 || draft.leader !== undefined;
    if (next.game !== draft.game && hasCards) {
      setPendingGame(next);
      return;
    }
    dispatch({ type: 'setGameFormat', ...next });
  }

  /** Lleva el foco al primer problema: el nombre si es lo único, si no el panel de estado. */
  function focusFirstProblem() {
    const nameIssue = validation.issues.some((issue) => issue.target === 'name');
    const target = nameIssue ? document.querySelector<HTMLElement>('[name="deck-name"]') : document.getElementById(PANEL_ID);
    target?.focus();
  }

  async function save() {
    setAttempted(true);
    setSaveError(null);
    if (validation.hasErrors) {
      focusFirstProblem();
      return;
    }

    setSaving(true);
    try {
      const input = draftToInput(draft, validation.size);
      const saved = deckId ? await decksApi.updateDeck(deckId, input) : await decksApi.createDeck(input);
      leaving.current = true;
      window.location.assign(`/decks/${saved.id}`);
    } catch (error) {
      setSaving(false);
      setSaveError(describeError(error, EDITOR_ERRORS));
      if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        setServerErrors(mapDeckServerErrors(error, draft.entries));
      }
      document.getElementById(PANEL_ID)?.focus();
    }
  }

  // --- Render ----------------------------------------------------------------
  if (load.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert title={load.error.title} message={load.error.message} />
        <a href={deckId ? `/decks/${deckId}` : '/dashboard'} className="text-sm text-indigo-300 hover:underline">
          Volver
        </a>
      </div>
    );
  }

  if (catalog.status === 'error') {
    return <Alert title="No se pudieron cargar los juegos" message={catalog.errorMessage} />;
  }

  if (load.status === 'loading' || catalog.status !== 'ready') {
    return (
      <p className="text-sm text-slate-400" role="status">
        {isNew ? 'Preparando el editor…' : 'Cargando mazo…'}
      </p>
    );
  }

  const cancelHref = isNew ? '/dashboard' : `/decks/${deckId}`;

  return (
    <div className="flex flex-col gap-8 pb-24 lg:pb-0">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">{isNew ? 'Nuevo mazo' : 'Editar mazo'}</h1>
        <div className="hidden items-center gap-2 lg:flex">
          <a href={cancelHref} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            Cancelar
          </a>
          <Button onClick={() => void save()} loading={saving}>
            {isNew ? 'Crear mazo' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {saveError && <Alert title={saveError.title} message={saveError.message} />}

      {/* Datos del mazo */}
      <section aria-label="Datos del mazo" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Input
            label="Nombre"
            name="deck-name"
            value={draft.name}
            maxLength={NAME_MAX}
            placeholder="Mi mazo"
            error={fieldIssue('name') ?? serverErrors.fields.name}
            onChange={(event) => dispatch({ type: 'setField', field: 'name', value: event.target.value })}
          />
          <div className="flex flex-col gap-2">
            <GameFormatSelector
              selection={{ game: draft.game, format: draft.format }}
              onChange={changeGameFormat}
              lockGame={!isNew}
              formatError={serverErrors.fields.format}
            />
            <FormatRulesSummary game={draft.game} format={draft.format} />
          </div>
          {pendingGame && (
            <div role="alertdialog" aria-label="Cambiar de juego" className="flex flex-col gap-2 rounded-lg border border-amber-700 bg-amber-950/40 p-3">
              <p className="text-sm text-amber-100">
                Cambiar de juego vacía el mazo: las cartas son de otro catálogo.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    dispatch({ type: 'setGameFormat', ...pendingGame });
                    setPendingGame(null);
                  }}
                >
                  Cambiar y vaciar
                </Button>
                <Button variant="ghost" onClick={() => setPendingGame(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Textarea
            label="Descripción (opcional)"
            value={draft.description}
            maxLength={DESCRIPTION_MAX}
            showCount
            rows={3}
            error={fieldIssue('description') ?? serverErrors.fields.description}
            onChange={(event) => dispatch({ type: 'setField', field: 'description', value: event.target.value })}
          />
          {orgs && (orgs.length > 0 || draft.orgId) && (
            <Select
              label="Pertenece a"
              value={draft.orgId ?? ''}
              options={[
                { value: '', label: 'Mis mazos (personal)' },
                ...orgs.map((org) => ({ value: org.id, label: org.name })),
                // Org a la que ya no pertenecés: se conserva hasta que elijas otra.
                ...(draft.orgId && !orgs.some((org) => org.id === draft.orgId)
                  ? [{ value: draft.orgId, label: 'Organización actual' }]
                  : []),
              ]}
              onChange={(event) => dispatch({ type: 'setOrg', orgId: event.target.value })}
            />
          )}
          <Checkbox
            label="Mazo privado"
            hint={
              draft.orgId
                ? `Solo vos y los miembros de ${orgs?.find((org) => org.id === draft.orgId)?.name ?? 'la organización'} pueden verlo.`
                : 'Solo vos podés verlo.'
            }
            checked={draft.private}
            onChange={(event) => dispatch({ type: 'setPrivate', value: event.target.checked })}
          />
        </div>
      </section>

      {/* Buscador + mazo */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <CardSearch
          game={draft.game}
          allowLeader={requiresLeader}
          allowPartner={requiresLeader && draft.leader !== undefined}
          onAdd={(card) => dispatch({ type: 'addCard', card })}
          onSetLeader={(card) => dispatch({ type: 'setLeader', card })}
          onSetPartner={(card) => dispatch({ type: 'setPartner', card })}
        />

        <section aria-labelledby="deck-cards-title" className="flex flex-col gap-3">
          <h2 id="deck-cards-title" className="text-base font-semibold text-slate-100">
            Tu mazo
          </h2>
          <DeckValidationPanel
            id={PANEL_ID}
            validation={validation}
            serverErrors={serverErrors.general}
            showFieldErrors={attempted}
          />
          {(requiresLeader || draft.leader) && (
            <LeaderSlots
              leader={draft.leader}
              partner={draft.partner}
              leaderError={serverErrors.fields.leader}
              partnerError={serverErrors.fields.partner}
              onClearLeader={() => dispatch({ type: 'setLeader', card: undefined })}
              onClearPartner={() => dispatch({ type: 'setPartner', card: undefined })}
            />
          )}
          <DeckCardList
            entries={draft.entries}
            validation={validation}
            serverErrors={serverErrors.cards}
            onQuantityChange={(key, quantity) => dispatch({ type: 'setQuantity', key, quantity })}
            onRemove={(key) => dispatch({ type: 'removeCard', key })}
          />
        </section>
      </div>

      {/* Barra fija en móvil: el guardado siempre a mano */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-slate-100">{validation.size}</span>
            {validation.required.max !== undefined && ` / ${validation.required.max}`} cartas
            {validation.hasErrors && <span className="ml-2 text-red-300">· con problemas</span>}
          </p>
          <div className="flex items-center gap-2">
            <a href={cancelHref} className="rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
              Cancelar
            </a>
            <Button onClick={() => void save()} loading={saving}>
              {isNew ? 'Crear' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
