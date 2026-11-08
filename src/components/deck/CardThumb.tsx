/** Atributos que describen el tipo según el GameSpec de cada juego, en orden de preferencia. */
const TYPE_ATTRIBUTES = ['type_line', 'type', 'card_type', 'kind'];

/** Línea de tipo de la carta (MTG `type`, One Piece/Yu-Gi-Oh! `card_type`, Pokémon `kind`). */
export function cardTypeLine(card: { attributes?: Record<string, unknown> }): string | undefined {
  for (const key of TYPE_ATTRIBUTES) {
    const value = card.attributes?.[key];
    if (typeof value === 'string' && value) return value;
  }
  return undefined;
}

interface Props {
  /** Card del backend o CardInput del borrador */
  card: { name: string; image?: string };
  size?: 'sm' | 'lg';
}

const SIZES = {
  sm: 'h-10 w-7 rounded',
  lg: 'h-56 w-40 rounded-xl',
};

/** Miniatura de carta con placeholder cuando no hay imagen. */
export function CardThumb({ card, size = 'sm' }: Props) {
  if (!card.image) {
    return (
      <div
        aria-hidden="true"
        className={`${SIZES[size]} flex shrink-0 items-center justify-center bg-slate-800 text-[10px] text-slate-400`}
      >
        🃏
      </div>
    );
  }
  return (
    <img
      src={card.image}
      alt={size === 'lg' ? card.name : ''}
      loading="lazy"
      decoding="async"
      className={`${SIZES[size]} shrink-0 bg-slate-800 object-cover`}
    />
  );
}
