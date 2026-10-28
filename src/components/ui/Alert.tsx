interface Props {
  /** Título del mensaje */
  title: string;
  /** Detalle opcional */
  message?: string;
  variant?: 'error' | 'success';
}

/** Banner de feedback para errores del backend (o éxitos puntuales). */
export function Alert({ title, message, variant = 'error' }: Props) {
  const classes =
    variant === 'error'
      ? 'border-red-700 bg-red-950/60 text-red-200'
      : 'border-emerald-700 bg-emerald-950/60 text-emerald-200';
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${classes}`}>
      <p className="font-medium">{title}</p>
      {message && <p className="mt-1 text-slate-300">{message}</p>}
    </div>
  );
}
