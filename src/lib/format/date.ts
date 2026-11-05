/** Fechas legibles en castellano, en la zona horaria del navegador. */
const DATE_FORMAT = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });

export function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : DATE_FORMAT.format(date);
}
