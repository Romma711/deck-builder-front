import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: ReactNode;
  /** Texto de ayuda bajo el label */
  hint?: string;
}

export function Checkbox({ label, hint, className, ...rest }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={`flex items-start gap-3 ${className ?? ''}`}>
      <input
        {...rest}
        id={id}
        type="checkbox"
        aria-describedby={hint ? hintId : undefined}
        className="mt-0.5 size-4 shrink-0 accent-indigo-500"
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-sm font-medium text-slate-200">
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-xs text-slate-400">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
