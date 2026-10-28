import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Mensaje de error (del backend o de validación en cliente) */
  error?: string;
}

export function Input({ label, error, type = 'text', className, ...rest }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        {...rest}
        id={id}
        type={type}
        aria-invalid={error ? true : undefined}
        className={`rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-500 ${
          error ? 'border-red-500' : 'border-slate-700'
        } ${className ?? ''}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
