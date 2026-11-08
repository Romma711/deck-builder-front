import { describeSize, type DeckValidation } from '../../lib/deck/rules';

interface Props {
  validation: DeckValidation;
  /** Errores del backend que no se pudieron ubicar en un campo o carta */
  serverErrors: string[];
  /**
   * Tras el primer intento de guardar, además de las reglas del formato
   * (siempre en vivo) se listan los errores de campos como el nombre.
   */
  showFieldErrors: boolean;
  /** id para enfocar el panel tras un guardado fallido */
  id?: string;
}

/**
 * Contador de tamaño + lista de problemas del mazo (validación en vivo).
 * Los problemas por carta se muestran junto a cada carta; acá van los
 * del mazo en general.
 */
export function DeckValidationPanel({ validation, serverErrors, showFieldErrors, id }: Props) {
  const { size, required, issues, maxCopies } = validation;
  const target = required.max ?? required.min;
  const progress = target ? Math.min(100, Math.round((size / target) * 100)) : 0;
  const sizeOk =
    (required.min === undefined || size >= required.min) && (required.max === undefined || size <= required.max);
  const deckIssues = issues.filter(
    (issue) =>
      typeof issue.target === 'string' &&
      (showFieldErrors || (issue.target !== 'name' && issue.target !== 'description')),
  );
  const cardErrorCount = issues.filter((issue) => typeof issue.target === 'object').length;
  const messages = [...deckIssues.map((issue) => issue.message), ...serverErrors];
  const sizeText = describeSize(required);

  return (
    <section
      id={id}
      tabIndex={-1}
      aria-label="Estado del mazo"
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 focus:outline-none"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-slate-300">
          <span className={`text-2xl font-bold ${sizeOk ? 'text-emerald-300' : 'text-slate-100'}`}>{size}</span>
          {target !== undefined && <span className="text-slate-400"> / {target}</span>} cartas
        </p>
        <p className="text-right text-xs text-slate-400">
          {[sizeText, maxCopies !== undefined ? `máx. ${maxCopies} por carta` : undefined]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {target !== undefined && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
          aria-label="Progreso del tamaño del mazo"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={size}
        >
          <div
            className={`h-full transition-[width] ${sizeOk ? 'bg-emerald-500' : size > target ? 'bg-red-500' : 'bg-indigo-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div aria-live="polite">
        {messages.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-red-300">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        {cardErrorCount > 0 && (
          <p className="mt-1 text-sm text-red-300">
            {cardErrorCount === 1 ? 'Hay 1 carta con problemas' : `Hay ${cardErrorCount} cartas con problemas`} (marcadas
            en la lista).
          </p>
        )}
        {!validation.hasErrors && serverErrors.length === 0 && (
          <p className="text-sm text-emerald-300">El mazo cumple las reglas del formato.</p>
        )}
      </div>
    </section>
  );
}
