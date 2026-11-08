import { useId, useState } from 'react';
import { QUANTITY_MAX, QUANTITY_MIN, type DraftEntry } from '../../lib/deck/draft';
import { issuesForCard, type DeckValidation } from '../../lib/deck/rules';
import { CardThumb, cardTypeLine } from './CardThumb';

/** A partir de cuántas cartas distintas se muestra el filtro. */
const FILTER_THRESHOLD = 8;

interface Props {
  entries: DraftEntry[];
  validation: DeckValidation;
  /** cardKey → mensaje del backend */
  serverErrors: Record<string, string>;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
}

/** Lista cantidad/nombre del mazo con ajuste de copias y filtro interno. */
export function DeckCardList({ entries, validation, serverErrors, onQuantityChange, onRemove }: Props) {
  const filterId = useId();
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const visible = needle ? entries.filter((entry) => entry.card.name.toLowerCase().includes(needle)) : entries;

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
        El mazo está vacío. Buscá cartas y agregalas acá.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.length >= FILTER_THRESHOLD && (
        <div>
          <label htmlFor={filterId} className="sr-only">
            Filtrar cartas del mazo
          </label>
          <input
            id={filterId}
            type="search"
            value={filter}
            placeholder="Filtrar en el mazo…"
            onChange={(event) => setFilter(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder-slate-400 focus-visible:outline-2 focus-visible:outline-indigo-500"
          />
        </div>
      )}

      <ul className="flex flex-col divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
        {visible.map((entry) => {
          const issues = issuesForCard(validation, entry.key);
          const serverError = serverErrors[entry.key];
          const messages = [...issues.map((issue) => issue.message), ...(serverError ? [serverError] : [])];
          const errorId = `${filterId}-${entry.key}-error`;
          return (
            <li key={entry.key} className={`flex flex-col gap-1 p-2 ${messages.length ? 'bg-red-950/30' : ''}`}>
              <div className="flex items-center gap-3">
                <QuantityStepper
                  name={entry.card.name}
                  value={entry.quantity}
                  invalid={messages.length > 0}
                  describedBy={messages.length ? errorId : undefined}
                  onChange={(quantity) => onQuantityChange(entry.key, quantity)}
                />
                <CardThumb card={entry.card} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{entry.card.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {[entry.card.serial_set, cardTypeLine(entry.card)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(entry.key)}
                  aria-label={`Quitar ${entry.card.name} del mazo`}
                  className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  ✕
                </button>
              </div>
              {messages.length > 0 && (
                <p id={errorId} className="pl-1 text-xs text-red-300">
                  {messages.join(' · ')}
                </p>
              )}
            </li>
          );
        })}
        {visible.length === 0 && <li className="p-3 text-sm text-slate-400">Ninguna carta coincide con el filtro.</li>}
      </ul>
    </div>
  );
}

interface StepperProps {
  name: string;
  value: number;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: number) => void;
}

function QuantityStepper({ name, value, invalid, describedBy, onChange }: StepperProps) {
  // Texto local para permitir borrar y reescribir el número sin que salte a 1.
  const [text, setText] = useState<string | null>(null);
  const stepClass =
    'flex size-7 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-indigo-500';

  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label={`Copias de ${name}`}>
      <button
        type="button"
        className={stepClass}
        disabled={value <= QUANTITY_MIN}
        aria-label={`Quitar una copia de ${name}`}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={QUANTITY_MIN}
        max={QUANTITY_MAX}
        value={text ?? String(value)}
        aria-label={`Cantidad de ${name}`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          setText(event.target.value);
          const parsed = Number.parseInt(event.target.value, 10);
          if (!Number.isNaN(parsed)) onChange(parsed);
        }}
        onBlur={() => setText(null)}
        className={`w-10 rounded-md border bg-slate-950 py-0.5 text-center text-sm text-slate-100 [appearance:textfield] focus-visible:outline-2 focus-visible:outline-indigo-500 [&::-webkit-inner-spin-button]:appearance-none ${
          invalid ? 'border-red-500' : 'border-slate-700'
        }`}
      />
      <button
        type="button"
        className={stepClass}
        disabled={value >= QUANTITY_MAX}
        aria-label={`Agregar una copia de ${name}`}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
