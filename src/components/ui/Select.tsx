import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: SelectOption[];
  error?: string;
}

export function Select({ label, options, error, className, ...rest }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <select
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-60 ${
          error ? 'border-red-500' : 'border-slate-700'
        } ${className ?? ''}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
