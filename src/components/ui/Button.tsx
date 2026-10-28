import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-600/50 cursor-disabled',
  secondary:
    'bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:bg-slate-800/50 cursor-disabled',
  danger: 'bg-red-700 text-white hover:bg-red-600 disabled:bg-red-700/50 cursor-disabled',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 disabled:opacity-50 cursor-disabled',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', loading = false, disabled, children, className, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
    >
      {loading ? 'Cargando…' : children}
    </button>
  );
}
