import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-600/50',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 disabled:bg-slate-800/50',
  danger: 'bg-red-700 text-white hover:bg-red-600 disabled:bg-red-700/50',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 disabled:opacity-50',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Botón base. `type` es "button" por defecto para no enviar formularios por
 * accidente: los submit lo declaran explícitamente.
 */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  type = 'button',
  children,
  className,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className ?? ''}`}
    >
      {/* El label se mantiene durante la carga: sin saltos de layout y con contexto para lectores de pantalla. */}
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}
