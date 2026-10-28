/**
 * Servicios de autenticación y perfil (tag `auth` del backend).
 */

import type { LoginInput, RegisterInput, TokenPair, UpdateMeInput, User } from '../../types/api';
import { request } from './client';
import { clearSession, setSession } from '../session/session';

/** POST /auth/register — 201 User */
export function register(input: RegisterInput): Promise<User> {
  return request<User>('/auth/register', { method: 'POST', body: input });
}

/** POST /auth/login — 200 TokenPair (persiste la sesión) */
export async function login(input: LoginInput): Promise<TokenPair> {
  const tokens = await request<TokenPair>('/auth/login', { method: 'POST', body: input });
  setSession(tokens);
  return tokens;
}

/** POST /auth/logout — 204. Revoca el refresh token (idempotente) y limpia la sesión local. */
export async function logout(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    const refresh_token = localStorage.getItem('deckbuilder.refresh_token');
    try {
      await request<void>('/auth/logout', { method: 'POST', body: refresh_token ? { refresh_token } : {} });
    } catch {
      // Logout idempotente: aunque falle la revocación remota, la sesión local muere.
    }
  }
  clearSession();
}

/** GET /me — 200 User */
export function getMe(): Promise<User> {
  return request<User>('/me');
}

/** PUT /me — 200 User (username, email) */
export function updateMe(input: UpdateMeInput): Promise<User> {
  return request<User>('/me', { method: 'PUT', body: input });
}

/** DELETE /me — 204 (cascada en el back: tokens, mazos, membresías) */
export function deleteMe(): Promise<void> {
  return request<void>('/me', { method: 'DELETE' });
}
