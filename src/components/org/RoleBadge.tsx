import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../../lib/org/roles';
import type { Role } from '../../types/api';

const TONES: Record<Role, string> = {
  owner: 'bg-amber-950/60 text-amber-200 border-amber-800',
  admin: 'bg-indigo-950/60 text-indigo-200 border-indigo-800',
  member: 'bg-slate-800 text-slate-300 border-slate-700',
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      title={ROLE_DESCRIPTIONS[role]}
      className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-xs font-medium ${TONES[role] ?? TONES.member}`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
