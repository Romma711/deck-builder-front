import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string;
  /** Muestra un contador "n / maxLength" */
  showCount?: boolean;
}

export function Textarea({ label, error, showCount = false, className, value, maxLength, ...rest }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const length = typeof value === 'string' ? value.length : 0;
  const describedBy =
    [error ? errorId : undefined, showCount && maxLength ? countId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <textarea
        {...rest}
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-20 rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-500 ${
          error ? 'border-red-500' : 'border-slate-700'
        } ${className ?? ''}`}
      />
      <div className="flex justify-between gap-2">
        {error ? (
          <p id={errorId} className="text-xs text-red-400">
            {error}
          </p>
        ) : (
          <span />
        )}
        {showCount && maxLength && (
          <p id={countId} className="text-xs text-slate-500">
            {length} / {maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
