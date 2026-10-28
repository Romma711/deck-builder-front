/**
 * Validación de formularios en cliente (feedback inmediato antes de llamar al back).
 * Reglas espejo de las del OpenAPI: username 3-30, email, password 8-72.
 */

export interface LoginValues {
  username: string;
  password: string;
}

export interface RegisterValues extends LoginValues {
  email: string;
}

export function validateLogin(values: LoginValues): Partial<Record<keyof LoginValues, string>> {
  const errors: Partial<Record<keyof LoginValues, string>> = {};
  if (!values.username.trim()) errors.username = 'Ingresá tu usuario';
  if (!values.password) errors.password = 'Ingresá tu contraseña';
  return errors;
}

export function validateRegister(values: RegisterValues): Partial<Record<keyof RegisterValues, string>> {
  const errors: Partial<Record<keyof RegisterValues, string>> = {};
  const username = values.username.trim();
  if (username.length < 3) errors.username = 'El usuario debe tener al menos 3 caracteres';
  else if (username.length > 30) errors.username = 'El usuario no puede superar los 30 caracteres';
  if (!values.email.trim()) errors.email = 'Ingresá tu email';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = 'Ingresá un email válido';
  if (values.password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres';
  else if (values.password.length > 72) errors.password = 'La contraseña no puede superar los 72 caracteres';
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
