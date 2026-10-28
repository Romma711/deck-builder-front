import { useState, type SubmitEvent } from 'react';
import { authApi } from '../../lib/api';
import { errorTitle, errorMessage, fieldErrors } from '../../lib/forms/errors';
import { hasErrors, validateRegister } from '../../lib/forms/validate';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface Props {
  redirectTo?: string;
}

export function RegisterForm({ redirectTo = '/dashboard' }: Props) {
  const [values, setValues] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<'username' | 'email' | 'password', string>>>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<{ title: string; message?: string } | null>(null);

  function update<K extends keyof typeof values>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setFormError(null);

    const clientErrors = validateRegister(values);
    setErrors(clientErrors);
    if (hasErrors(clientErrors)) return;

    setLoading(true);
    try {
      await authApi.register({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      // Registro no devuelve tokens: login automático y al dashboard.
      await authApi.login({ username: values.username.trim(), password: values.password });
      window.location.assign(redirectTo);
    } catch (error) {
      setFormError({ title: errorTitle(error), message: errorMessage(error) });
      setErrors(fieldErrors(error, ['username', 'email', 'password']));
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
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={(e) => update('email', e.target.value)}
      />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        value={values.password}
        error={errors.password}
        onChange={(e) => update('password', e.target.value)}
      />
      <Button type="submit" loading={loading}>
        Crear cuenta
      </Button>
    </form>
  );
}
