import { useEffect, useState } from 'react';
import { formatDate } from '../../lib/format/date';

interface Props {
  /** Fecha ISO del backend */
  value: string;
}

/**
 * Fecha en la zona horaria del NAVEGADOR. El servidor no la conoce, así que
 * el texto se completa recién después de hidratar: evita que el HTML del
 * servidor (UTC) y el cliente no coincidan, o que se muestre otro día.
 */
export function LocalDate({ value }: Props) {
  const [text, setText] = useState<string>();
  useEffect(() => setText(formatDate(value)), [value]);
  return <time dateTime={value}>{text}</time>;
}
