/**
 * Servicios de organizaciones (tag `orgs`).
 * Roles: owner > admin > member (fail-closed en el backend).
 */

import type {
  AddMemberInput,
  CreateOrgInput,
  ListMeta,
  Member,
  Organization,
  Role,
} from '../../types/api';
import { request } from './client';

/** GET /orgs — organizaciones del usuario con su rol */
export function listOrgs(): Promise<{ data: Organization[]; meta?: ListMeta }> {
  return request<{ data: Organization[]; meta?: ListMeta }>('/orgs');
}

/** POST /orgs — crear organización (el creador queda como owner) */
export function createOrg(input: CreateOrgInput): Promise<Organization> {
  return request<Organization>('/orgs', { method: 'POST', body: input });
}

/** GET /orgs/{orgId} — detalle (rol mínimo: member) */
export function getOrg(orgId: string): Promise<Organization> {
  return request<Organization>(`/orgs/${encodeURIComponent(orgId)}`);
}

/** PATCH /orgs/{orgId} — renombrar (rol mínimo: owner) */
export function updateOrg(orgId: string, input: Omit<CreateOrgInput, 'slug'> & { slug?: string }): Promise<Organization> {
  return request<Organization>(`/orgs/${encodeURIComponent(orgId)}`, { method: 'PATCH', body: input });
}

/** DELETE /orgs/{orgId} — eliminar (rol mínimo: owner; los mazos quedan personales) */
export function deleteOrg(orgId: string): Promise<void> {
  return request<void>(`/orgs/${encodeURIComponent(orgId)}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------------

/** GET /orgs/{orgId}/members — listar miembros (rol mínimo: member) */
export function listMembers(orgId: string): Promise<{ data: Member[]; meta?: ListMeta }> {
  return request<{ data: Member[]; meta?: ListMeta }>(`/orgs/${encodeURIComponent(orgId)}/members`);
}

/** POST /orgs/{orgId}/members — agregar miembro (rol mínimo: admin) */
export function addMember(orgId: string, input: AddMemberInput): Promise<Member> {
  return request<Member>(`/orgs/${encodeURIComponent(orgId)}/members`, { method: 'POST', body: input });
}

/** PATCH /orgs/{orgId}/members/{userId} — cambiar rol (solo owner) */
export function updateMemberRole(orgId: string, userId: string, role: Role): Promise<void> {
  return request<void>(
    `/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
    { method: 'PATCH', body: { role } },
  );
}

/** DELETE /orgs/{orgId}/members/{userId} — quitar miembro (admin+; cualquiera se auto-saca) */
export function removeMember(orgId: string, userId: string): Promise<void> {
  return request<void>(
    `/orgs/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}
