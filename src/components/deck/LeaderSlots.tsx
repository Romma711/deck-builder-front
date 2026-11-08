import type { CardInput } from '../../types/api';
import { CardThumb, cardTypeLine } from './CardThumb';

interface Props {
  leader?: CardInput;
  partner?: CardInput;
  /** Errores de validación (en vivo o del backend) */
  leaderError?: string;
  partnerError?: string;
  onClearLeader: () => void;
  onClearPartner: () => void;
}

/**
 * Slots de líder y partner (formatos con `requires_leader`).
 * Se eligen desde el buscador con las acciones "Líder" y "Partner"; el
 * partner es opcional y solo aparece una vez elegido el líder.
 */
export function LeaderSlots({
  leader,
  partner,
  leaderError,
  partnerError,
  onClearLeader,
  onClearPartner,
}: Props) {
  return (
    <section aria-label="Líder" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <Slot
        title="Líder"
        card={leader}
        error={leaderError}
        emptyText="Elegí un líder desde el buscador con «Líder»."
        onClear={onClearLeader}
      />
      {leader && (
        <Slot
          title="Partner (opcional)"
          card={partner}
          error={partnerError}
          emptyText="Si el formato lo permite, elegilo desde el buscador con «Partner»."
          onClear={onClearPartner}
        />
      )}
    </section>
  );
}

interface SlotProps {
  title: string;
  card?: CardInput;
  error?: string;
  emptyText: string;
  onClear: () => void;
}

function Slot({ title, card, error, emptyText, onClear }: SlotProps) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border p-3 ${
        error ? 'border-red-700 bg-red-950/30' : card ? 'border-indigo-800 bg-indigo-950/30' : 'border-dashed border-slate-700'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {card ? (
        <div className="flex items-center gap-3">
          <CardThumb card={card} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">{card.name}</p>
            <p className="truncate text-xs text-slate-400">
              {[card.serial_set, cardTypeLine(card)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label={`Quitar ${card.name} como ${title.toLowerCase()}`}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-indigo-500"
          >
            ✕
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-400">{emptyText}</p>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
