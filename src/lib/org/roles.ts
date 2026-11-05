/**
 * Permisos de organización en la UI (espejo de internal/app/org del backend).
 *
 * Solo deciden QUÉ ACCIONES SE MUESTRAN: el backend vuelve a validar todo
 * (incluida la guardia de "último owner", que acá no se puede saber sin
 * contar owners, y se informa con su error CONFLICT).
 */

import type { Role } from '../../types/api';

const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Miembro',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Control total: roles, renombrar y eliminar la organización',
  admin: 'Agrega miembros y quita a quienes tienen rol Miembro',
  member: 'Ve y crea mazos de la organización',
};

export const ROLES: Role[] = ['owner', 'admin', 'member'];

/** Rol desconocido = sin permisos (fail-closed, igual que el back). */
function rank(role: Role | undefined): number {
  return role ? (RANK[role] ?? 0) : 0;
}

export function atLeast(role: Role | undefined, min: Role): boolean {
  return rank(role) >= RANK[min];
}

/** Agregar miembros: admin+. */
export function canAddMembers(actor: Role | undefined): boolean {
  return atLeast(actor, 'admin');
}

/** Roles que el actor puede otorgar al agregar: un admin solo puede sumar members. */
export function assignableRoles(actor: Role | undefined): Role[] {
  if (actor === 'owner') return ROLES;
  if (actor === 'admin') return ['member'];
  return [];
}

/** Cambiar roles: solo owner. */
export function canChangeRoles(actor: Role | undefined): boolean {
  return actor === 'owner';
}

/** Quitar a OTRO miembro: owner a cualquiera; admin solo a members. */
export function canRemoveMember(actor: Role | undefined, target: Role): boolean {
  if (actor === 'owner') return true;
  return actor === 'admin' && target === 'member';
}

/** Renombrar y eliminar la org: solo owner. */
export function canManageOrg(actor: Role | undefined): boolean {
  return actor === 'owner';
}
