import { useEffect, useState, type SubmitEvent } from 'react';
import { authApi } from '../../lib/api';
import type { User } from '../../types/api';
import { errorTitle, errorMessage, fieldErrors } from '../../lib/forms/errors';
import { hasErrors } from '../../lib/forms/validate';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/**
 * Panel de cuenta: perfil (PUT /me), logout y eliminación (DELETE /me).
 * Island interactiva: todo requiere la sesión del cliente.
 */
export function AccountPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<{ title: string; message?: string } | null>(null);
  const [values, setValues] = useState({ username: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<{ title: string; message?: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    authApi
      .getMe()
      .then((me) => {
        setUser(me);
        setValues({ username: me.username, email: me.email });
      })
      .catch((error) => setLoadError({ title: errorTitle(error), message: errorMessage(error) }));
  }, []);

  async function handleSave(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);
    setSaveFeedback(null);
    setErrors({});

    const clientErrors: Record<string, string> = {};
    if (values.username.trim().length < 3) clientErrors.username = 'Mínimo 3 caracteres';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) clientErrors.email = 'Email inválido';
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors);
      return;
    }

    setSaving(true);
    try {
      const updated = await authApi.updateMe({
        username: values.username.trim(),
        email: values.email.trim(),
      });
      setUser(updated);
      setSaveFeedback('Perfil actualizado');
    } catch (error) {
      setFormError({ title: errorTitle(error), message: errorMessage(error) });
      setErrors(fieldErrors(error, ['username', 'email']));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await authApi.logout();
    window.location.assign('/login');
  }

  async function handleDelete() {
    setDeleting(true);
    setFormError(null);
    try {
      await authApi.deleteMe();
      // La cuenta ya no existe: la sesión local muere con la página.
      localStorage.clear();
      window.location.assign('/');
    } catch (error) {
      setFormError({ title: errorTitle(error), message: errorMessage(error) });
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  if (loadError) {
    return <Alert title={loadError.title} message={loadError.message} />;
  }

  if (!user) {
    return (
      <p className="text-sm text-slate-400" role="status">
        Cargando perfil…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Perfil */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-slate-100">Perfil</h2>
        {formError && <Alert title={formError.title} message={formError.message} />}
        {saveFeedback && <Alert title={saveFeedback} variant="success" />}
        <form onSubmit={handleSave} noValidate className="flex max-w-md flex-col gap-4">
          <Input
            label="Usuario"
            name="username"
            value={values.username}
            error={errors.username}
            onChange={(e) => {
              setValues((prev) => ({ ...prev, username: e.target.value }));
              setSaveFeedback(null);
            }}
          />
          <Input
            label="Email"
            name="email"
            type="email"
            value={values.email}
            error={errors.email}
            onChange={(e) => {
              setValues((prev) => ({ ...prev, email: e.target.value }));
              setSaveFeedback(null);
            }}
          />
          <div>
            <Button type="submit" loading={saving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </section>

      {/* Sesión */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-100">Sesión</h2>
        <div>
          <Button variant="secondary" onClick={handleLogout}>
            Cerrar sesión
          </Button>
        </div>
      </section>

      {/* Zona de peligro */}
      <section className="flex max-w-lg flex-col gap-3 rounded-lg border border-red-900 bg-red-950/30 p-4">
        <h2 className="text-lg font-semibold text-red-300">Eliminar cuenta</h2>
        <p className="text-sm text-slate-300">
          Esta acción borra tu cuenta en cascada: tokens, mazos y membresías de organizaciones.
          No se puede deshacer.
        </p>
        {!confirmingDelete ? (
          <div>
            <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
              Eliminar mi cuenta
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-red-300">
              ¿Seguro? Se eliminarán todos tus mazos y datos.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Sí, eliminar definitivamente
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
