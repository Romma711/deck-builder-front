/**
 * Interpretación de `error.details` de un VALIDATION_ERROR del backend Go.
 *
 * Contrato real (no el que sugiere el OpenAPI):
 * - Las CLAVES son nombres de campo de Go, no los del JSON: `Username`,
 *   `DeckSize`, `Leader`, y rutas como `cards[0].mana_value`,
 *   `leader.card_type` o `cards.Lightning Bolt` (reglas de copias por nombre).
 * - Los VALORES son códigos de validación, no mensajes: `required`, `min`,
 *   `email`, `max=4_copies`, `format_range=[60,60]`, `oneof=[Leader]`…
 *
 * Este módulo es el único lugar que conoce ese formato: si el backend pasa a
 * devolver claves JSON y mensajes legibles, solo cambia esto.
 */

/** Normaliza una clave para compararla: `DeckSize`, `deck_size` y `decksize` coinciden. */
export function normalizeDetailKey(key: string): string {
  return key.replace(/_/g, '').toLowerCase();
}

/** Nombres legibles de atributos de carta frecuentes en los GameSpec. */
const ATTRIBUTE_LABELS: Record<string, string> = {
  type: 'tipo',
  card_type: 'tipo de carta',
  kind: 'clase',
  colors: 'colores',
  mana_value: 'valor de maná',
  hp: 'PS',
  energy_type: 'tipo de energía',
  life: 'vida',
  power: 'poder',
  atk: 'ATK',
  def: 'DEF',
};

export function attributeLabel(attribute: string): string {
  return ATTRIBUTE_LABELS[attribute] ?? attribute;
}

/** Traduce un código de validación del backend a un mensaje en castellano. */
export function describeReason(reason: string): string {
  const value = reason.trim();

  let match = /^max=(\d+)_copies$/.exec(value);
  if (match) return `Máximo ${match[1]} ${match[1] === '1' ? 'copia' : 'copias'} por carta`;

  match = /^mismatch_cards=(\d+)$/.exec(value);
  if (match) return `El tamaño declarado no coincide con las ${match[1]} cartas enviadas`;

  match = /^format_range=\[(\d+),(\d+)\]$/.exec(value);
  if (match) {
    const [, min, max] = match;
    if (max === '0') return `El formato exige al menos ${min} cartas`;
    return min === max ? `El formato exige ${min} cartas` : `El formato admite entre ${min} y ${max} cartas`;
  }

  match = /^range=\[([\d.]+),([\d.]+)\]$/.exec(value);
  if (match) return `Debe estar entre ${match[1]} y ${match[2]}`;

  match = /^oneof=\[([^\]]*)\]/.exec(value);
  if (match) return `Debe ser uno de: ${match[1].split(/[\s,]+/).filter(Boolean).join(', ')}`;

  match = /^min=(\d+),max=(\d+)$/.exec(value);
  if (match) return `Debe tener entre ${match[1]} y ${match[2]} caracteres`;

  match = /^(min|max)=(\d+)$/.exec(value);
  if (match) return match[1] === 'min' ? `Mínimo ${match[2]} caracteres` : `Máximo ${match[2]} caracteres`;

  if (value.startsWith('required_for_')) return 'Obligatorio en este formato';

  switch (value) {
    case 'required':
      return 'Es obligatorio';
    case 'min':
      return 'Es demasiado corto';
    case 'max':
      return 'Es demasiado largo';
    case 'email':
      return 'Ingresá un email válido';
    case 'uuid':
      return 'Identificador inválido';
    case 'lowercase_slug_1_50':
      return 'Solo minúsculas, números y guiones (máx. 50)';
    case 'unknown':
      return 'No existe';
    case 'unsupported':
      return 'No está soportado';
    case 'unsupported_for_game':
      return 'Ese formato no existe para el juego elegido';
    default:
      return value;
  }
}
