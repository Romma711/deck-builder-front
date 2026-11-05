/** Slugs de organización (URL-amigables), alineados con el backend. */

/** Formato que acepta el backend: minúsculas, dígitos y guiones simples. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Slug sugerido a partir del nombre. A diferencia de `slugify` del backend
 * (que DESCARTA lo que no sea a-z/0-9: "Ñandú" → "and"), acá se quitan los
 * acentos primero ("Ñandú" → "nandu"). El front siempre envía este slug
 * explícito, así que el resultado no depende del algoritmo del back.
 */
export function previewSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
}
