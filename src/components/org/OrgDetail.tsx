import { useCallback, useEffect, useState, type SubmitEvent } from 'react';
import { decksApi, orgsApi } from '../../lib/api';
import { describeError, fieldErrors, type ErrorDescription, type ErrorOverrides } from '../../lib/forms/errors';
import { invalidateMyOrgs } from '../../lib/org/myOrgs';
import {
  assignableRoles,
  canAddMembers,
  canChangeRoles,
  canManageOrg,
  canRemoveMember,
  ROLE_LABELS,
  ROLES,
} from '../../lib/org/roles';
import { SLUG_PATTERN } from '../../lib/org/slug';
import { getCurrentUser } from '../../lib/session/currentUser';
import type { Deck, Member, Organization, Role, User } from '../../types/api';
import { RequireAuth } from '../auth/RequireAuth';
import { DeckSummaryCard } from '../deck/DeckSummaryCard';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LocalDate } from '../ui/LocalDate';
import { Select } from '../ui/Select';
import { RoleBadge } from './RoleBadge';

/** Errores con significado propio dentro de una org. */
const ORG_ERRORS: ErrorOverrides = {
  FORBIDDEN: 'Tu rol no permite hacer esto',
  NOT_FOUND: 'La organización o el miembro ya no existen',
  CONFLICT: 'La organización no puede quedarse sin owner',
};
const LOAD_ERRORS: ErrorOverrides = {
  FORBIDDEN: 'No sos miembro de esta organización',
  NOT_FOUND: 'Esta organización no existe',
};
const ADD_ERRORS: ErrorOverrides = { CONFLICT: 'Esa persona ya es miembro', FORBIDDEN: 'Tu rol no permite otorgar ese rol' };

interface Props {
  orgId: string;
}

/** Detalle de organización (island única de /orgs/[id]). */
export function OrgDetail({ orgId }: Props) {
  return (
    <RequireAuth>
      <OrgDetailContent orgId={orgId} />
    </RequireAuth>
  );
}

interface OrgData {
  org: Organization;
  members: Member[];
  decks: Deck[];
  me: User;
}

type LoadState = { status: 'loading' } | { status: 'ready'; data: OrgData } | { status: 'error'; error: ErrorDescription };

function OrgDetailContent({ orgId }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const [org, { data: members }, decks, me] = await Promise.all([
        orgsApi.getOrg(orgId),
        orgsApi.listMembers(orgId),
        decksApi.listAllDecks({ org: orgId }),
        getCurrentUser(),
      ]);
      if (!me) return; // sin sesión: RequireAuth redirige
      setState({ status: 'ready', data: { org, members, decks, me } });
    } catch (error) {
      setState({ status: 'error', error: describeError(error, LOAD_ERRORS) });
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert title={state.error.title} message={state.error.message} />
        <a href="/orgs" className="text-sm text-indigo-300 hover:underline">
          Volver a mis organizaciones
        </a>
      </div>
    );
  }
  if (state.status === 'loading') {
    return (
      <p className="text-sm text-slate-400" role="status">
        Cargando organización…
      </p>
    );
  }

  const { org, members, decks, me } = state.data;
  const myRole = org.role;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <a href="/orgs" className="text-xs text-slate-400 hover:text-slate-300">
            ← Organizaciones
          </a>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-white">
            {org.name}
            {myRole && <RoleBadge role={myRole} />}
          </h1>
          <p className="text-sm text-slate-400">{org.slug}</p>
        </div>
        <a
          href={`/decks/new?org=${org.id}`}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + Nuevo mazo de la organización
        </a>
      </header>

      <section aria-labelledby="org-decks-title" className="flex flex-col gap-3">
        <h2 id="org-decks-title" className="text-base font-semibold text-slate-100">
          Mazos ({decks.length})
        </h2>
        {decks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            Todavía no hay mazos en esta organización. Los mazos que crees acá los ven todos sus miembros.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <li key={deck.id}>
                <DeckSummaryCard deck={deck} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <MembersSection org={org} members={members} me={me} onChanged={load} />

      {canManageOrg(myRole) && <OrgSettings org={org} onSaved={load} />}

      <DangerZone org={org} me={me} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------------

interface MembersProps {
  org: Organization;
  members: Member[];
  me: User;
  onChanged: () => Promise<void>;
}

function MembersSection({ org, members, me, onChanged }: MembersProps) {
  const myRole = org.role;
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const sorted = [...members].sort(
    (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.username.localeCompare(b.username),
  );

  async function run(userId: string, task: () => Promise<void>) {
    setBusy(userId);
    setError(null);
    try {
      await task();
      await onChanged();
    } catch (err) {
      setError(describeError(err, ORG_ERRORS));
    } finally {
      setBusy(null);
      setConfirmingRemove(null);
    }
  }

  return (
    <section aria-labelledby="org-members-title" className="flex flex-col gap-3">
      <h2 id="org-members-title" className="text-base font-semibold text-slate-100">
        Miembros ({members.length})
      </h2>
      {error && <Alert title={error.title} message={error.message} />}

      <ul className="flex flex-col divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
        {sorted.map((member) => {
          const isMe = member.user_id === me.id;
          const canRemove = !isMe && canRemoveMember(myRole, member.role);
          return (
            <li key={member.user_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">
                  {member.username}
                  {isMe && <span className="ml-2 text-xs text-slate-400">(vos)</span>}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {member.email}
                  {member.joined_at && (
                    <>
                      {' · '}desde el <LocalDate value={member.joined_at} />
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canChangeRoles(myRole) ? (
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="sr-only">Rol de {member.username}</span>
                    <select
                      value={member.role}
                      disabled={busy === member.user_id}
                      onChange={(event) =>
                        void run(member.user_id, () =>
                          orgsApi.updateMemberRole(org.id, member.user_id, event.target.value as Role),
                        )
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <RoleBadge role={member.role} />
                )}

                {canRemove &&
                  (confirmingRemove === member.user_id ? (
                    <span className="flex items-center gap-1">
                      <Button
                        variant="danger"
                        className="px-2 py-1"
                        loading={busy === member.user_id}
                        onClick={() => void run(member.user_id, () => orgsApi.removeMember(org.id, member.user_id))}
                      >
                        Quitar
                      </Button>
                      <Button variant="ghost" className="px-2 py-1" onClick={() => setConfirmingRemove(null)}>
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      aria-label={`Quitar a ${member.username} de la organización`}
                      onClick={() => setConfirmingRemove(member.user_id)}
                    >
                      Quitar
                    </Button>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      {canAddMembers(myRole) && <AddMemberForm org={org} onAdded={onChanged} />}
    </section>
  );
}

function AddMemberForm({ org, onAdded }: { org: Organization; onAdded: () => Promise<void> }) {
  const roles = assignableRoles(org.role);
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<ErrorDescription | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);
    setAdded(null);
    const user = username.trim();
    if (!user) {
      setFieldError('Ingresá el usuario');
      return;
    }
    setSaving(true);
    try {
      const member = await orgsApi.addMember(org.id, { user, role });
      setUsername('');
      setAdded(member.username);
      await onAdded();
    } catch (error) {
      const errors = fieldErrors(error, ['user']);
      // `User: unknown` (usuario inexistente) se marca en el campo; el resto, arriba.
      if (errors.user) {
        setFieldError(errors.user);
      } else {
        setFormError(describeError(error, ADD_ERRORS));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label="Agregar miembro"
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <h3 className="text-sm font-semibold text-slate-200">Agregar miembro</h3>
      {formError && <Alert title={formError.title} message={formError.message} />}
      {added && <Alert title={`${added} ya es parte de ${org.name}`} variant="success" />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-end">
        <Input
          label="Usuario"
          value={username}
          autoComplete="off"
          placeholder="nombre de usuario"
          error={fieldError}
          onChange={(event) => {
            setUsername(event.target.value);
            setFieldError(undefined);
          }}
        />
        <Select
          label="Rol"
          value={role}
          disabled={roles.length <= 1}
          options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          onChange={(event) => setRole(event.target.value as Role)}
        />
        <Button type="submit" loading={saving} className={fieldError ? 'sm:mb-5' : undefined}>
          Agregar
        </Button>
      </div>
      {roles.length <= 1 && <p className="text-xs text-slate-400">Como admin solo podés sumar miembros con rol Miembro.</p>}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Ajustes (owner)
// ---------------------------------------------------------------------------

function OrgSettings({ org, onSaved }: { org: Organization; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug ?? '');
  const [errors, setErrors] = useState<Partial<Record<'name' | 'slug', string>>>({});
  const [formError, setFormError] = useState<ErrorDescription | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== org.name || slug.trim() !== (org.slug ?? '');

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);
    setSaved(false);
    const clientErrors: typeof errors = {};
    if (name.trim().length < 2 || name.trim().length > 100) clientErrors.name = 'Entre 2 y 100 caracteres';
    if (slug.trim() && (!SLUG_PATTERN.test(slug.trim()) || slug.trim().length > 50)) {
      clientErrors.slug = 'Solo minúsculas, números y guiones (máx. 50)';
    }
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      await orgsApi.updateOrg(org.id, { name: name.trim(), slug: slug.trim() || undefined });
      invalidateMyOrgs();
      setSaved(true);
      await onSaved();
    } catch (error) {
      setFormError(describeError(error, { ...ORG_ERRORS, CONFLICT: 'Ese slug ya está en uso' }));
      setErrors(fieldErrors(error, ['name', 'slug']));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="org-settings-title" className="flex max-w-lg flex-col gap-3">
      <h2 id="org-settings-title" className="text-base font-semibold text-slate-100">
        Ajustes
      </h2>
      {formError && <Alert title={formError.title} message={formError.message} />}
      {saved && <Alert title="Cambios guardados" variant="success" />}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input label="Nombre" value={name} maxLength={100} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <Input
          label="Slug"
          value={slug}
          maxLength={50}
          error={errors.slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
        />
        <div>
          <Button type="submit" loading={saving} disabled={!dirty}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Zona de peligro: salir (cualquiera) y eliminar (owner)
// ---------------------------------------------------------------------------

function DangerZone({ org, me }: { org: Organization; me: User }) {
  const [confirming, setConfirming] = useState<'leave' | 'delete' | null>(null);
  const [typedSlug, setTypedSlug] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorDescription | null>(null);
  const isOwner = canManageOrg(org.role);
  const confirmText = org.slug || org.name;

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      invalidateMyOrgs();
      window.location.assign('/orgs');
    } catch (err) {
      setError(
        describeError(err, {
          ...ORG_ERRORS,
          CONFLICT: 'Sos el último owner: pasale el rol de owner a otra persona antes de salir',
        }),
      );
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="org-danger-title"
      className="flex max-w-lg flex-col gap-4 rounded-lg border border-red-900 bg-red-950/30 p-4"
    >
      <h2 id="org-danger-title" className="text-base font-semibold text-red-300">
        Zona de peligro
      </h2>
      {error && <Alert title={error.title} message={error.message} />}

      {/* Salir */}
      <div className="flex flex-col gap-2">
        <p className="text-sm text-slate-300">Salir de la organización. Vas a perder acceso a sus mazos privados.</p>
        {confirming === 'leave' ? (
          <div className="flex gap-2">
            <Button variant="danger" loading={busy} onClick={() => void run(() => orgsApi.removeMember(org.id, me.id))}>
              Sí, salir
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => setConfirming('leave')}>
              Salir de {org.name}
            </Button>
          </div>
        )}
      </div>

      {/* Eliminar (owner) */}
      {isOwner && (
        <div className="flex flex-col gap-2 border-t border-red-900/60 pt-4">
          <p className="text-sm text-slate-300">
            Eliminar la organización. Sus mazos no se borran: pasan a ser personales de quien los creó.
          </p>
          {confirming === 'delete' ? (
            <div className="flex flex-col gap-2">
              <Input
                label={`Escribí «${confirmText}» para confirmar`}
                value={typedSlug}
                autoComplete="off"
                onChange={(event) => setTypedSlug(event.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={typedSlug.trim() !== confirmText}
                  onClick={() => void run(() => orgsApi.deleteOrg(org.id))}
                >
                  Eliminar definitivamente
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirming(null);
                    setTypedSlug('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="danger" onClick={() => setConfirming('delete')}>
                Eliminar organización
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
