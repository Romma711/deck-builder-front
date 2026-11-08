import { useEffect, useState, type SubmitEvent } from 'react';
import { orgsApi } from '../../lib/api';
import { describeError, fieldErrors, type ErrorDescription } from '../../lib/forms/errors';
import { getMyOrgs, invalidateMyOrgs } from '../../lib/org/myOrgs';
import { previewSlug, SLUG_PATTERN } from '../../lib/org/slug';
import type { Organization } from '../../types/api';
import { RequireAuth } from '../auth/RequireAuth';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { LocalDate } from '../ui/LocalDate';
import { RoleBadge } from './RoleBadge';

const CREATE_ERRORS = { CONFLICT: 'Ese slug ya está en uso' };

/** Listado de las orgs del usuario + creación (island única de /orgs). */
export function OrgList() {
  return (
    <RequireAuth>
      <OrgListContent />
    </RequireAuth>
  );
}

function OrgListContent() {
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [loadError, setLoadError] = useState<ErrorDescription | null>(null);

  useEffect(() => {
    getMyOrgs()
      .then(setOrgs)
      .catch((error: unknown) => setLoadError(describeError(error)));
  }, []);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="my-orgs-title" className="flex flex-col gap-3">
        <h2 id="my-orgs-title" className="text-base font-semibold text-slate-100">
          Tus organizaciones
        </h2>
        {loadError && <Alert title={loadError.title} message={loadError.message} />}
        {!loadError && orgs === null && (
          <p className="text-sm text-slate-400" role="status">
            Cargando organizaciones…
          </p>
        )}
        {orgs?.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 p-6 text-sm text-slate-400">
            Todavía no sos parte de ninguna organización. Creá una para compartir mazos con tu equipo o tu
            tienda; para sumarte a una existente, pedile a un admin que te agregue por tu usuario.
          </div>
        )}
        {orgs && orgs.length > 0 && (
          <ul className="flex flex-col gap-2">
            {orgs.map((org) => (
              <li key={org.id}>
                <a
                  href={`/orgs/${org.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-600 focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{org.name}</p>
                    <p className="truncate text-xs text-slate-400">
                      {org.slug}
                      {org.created_at && (
                        <>
                          {' · '}creada el <LocalDate value={org.created_at} />
                        </>
                      )}
                    </p>
                  </div>
                  {org.role && <RoleBadge role={org.role} />}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CreateOrgForm />
    </div>
  );
}

function CreateOrgForm() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'name' | 'slug', string>>>({});
  const [formError, setFormError] = useState<ErrorDescription | null>(null);
  const [saving, setSaving] = useState(false);
  const suggested = previewSlug(name);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);

    const clientErrors: typeof errors = {};
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 100) clientErrors.name = 'Entre 2 y 100 caracteres';
    const finalSlug = slug.trim() || suggested;
    if (!SLUG_PATTERN.test(finalSlug) || finalSlug.length > 50) {
      clientErrors.slug = slug.trim()
        ? 'Solo minúsculas, números y guiones (máx. 50)'
        : 'El nombre no genera un slug válido: escribí uno';
    }
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSaving(true);
    try {
      const org = await orgsApi.createOrg({ name: trimmed, slug: finalSlug });
      invalidateMyOrgs();
      window.location.assign(`/orgs/${org.id}`);
    } catch (error) {
      setSaving(false);
      setFormError(describeError(error, CREATE_ERRORS));
      setErrors(fieldErrors(error, ['name', 'slug']));
    }
  }

  return (
    <section
      aria-labelledby="create-org-title"
      className="flex h-fit flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div>
        <h2 id="create-org-title" className="text-base font-semibold text-slate-100">
          Nueva organización
        </h2>
        <p className="text-xs text-slate-400">Vas a quedar como owner.</p>
      </div>
      {formError && <Alert title={formError.title} message={formError.message} />}
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Nombre"
          value={name}
          maxLength={100}
          placeholder="Tienda El Dragón"
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value);
            setErrors((prev) => ({ ...prev, name: undefined }));
          }}
        />
        <Input
          label="Slug (opcional)"
          value={slug}
          maxLength={50}
          placeholder={suggested || 'tienda-el-dragon'}
          error={errors.slug}
          aria-describedby="slug-hint"
          onChange={(event) => {
            setSlug(event.target.value.toLowerCase());
            setErrors((prev) => ({ ...prev, slug: undefined }));
          }}
        />
        <p id="slug-hint" className="-mt-3 text-xs text-slate-400">
          Identificador único en URLs. Si lo dejás vacío se usa «{suggested || '…'}».
        </p>
        <Button type="submit" loading={saving}>
          Crear organización
        </Button>
      </form>
    </section>
  );
}
