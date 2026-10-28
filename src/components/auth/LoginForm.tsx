import { useState, type SubmitEvent } from 'react';
import { authApi } from '../../lib/api';
import { errorTitle, errorMessage, fieldErrors } from '../../lib/forms/errors';
import { hasErrors, validateLogin } from '../../lib/forms/validate';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  /** A dónde ir tras login exitoso */
  redirectTo?: string;
}

export function LoginForm({ redirectTo = '/dashboard' }: Props) {
  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<'username' | 'password', string>>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<{ title: string; message?: string } | null>(null);

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Limpiar el error del campo mientras se escribe.
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateLogin(values);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    setLoading(true);
    try {
      await authApi.login({ username: values.username.trim(), password: values.password });
      // Full reload: el middleware de Astro y el store de sesión arrancan limpios.
      window.location.assign(redirectTo);
    } catch (error) {
      // 401 de login = credenciales inválidas (no dispara el refresh: no hay sesión).
      setFormError({ title: errorTitle(error), message: errorMessage(error) });
      setErrors(fieldErrors(error, ['username', 'password']));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {formError && <Alert title={formError.title} message={formError.message} />}
      <Input
        label="Usuario"
        name="username"
        autoComplete="username"
        value={values.username}
        error={errors.username}
        onChange={(e) => update('username', e.target.value)}
      />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        error={errors.password}
        onChange={(e) => update('password', e.target.value)}
      />
      <Button type="submit" loading={loading}>
        Iniciar sesión
      </Button>
    </form>
  );
}
