/**
 * Imagen con tamaño guardado (06): se escribe como HTML en línea, `<img src="…" width="400">`, que
 * es Markdown válido. Solo se reconoce una etiqueta `<img>` con atributos conocidos: cualquier otra
 * cosa se conserva tal cual como HTML en línea.
 */

export interface ImgAttrs {
  src: string;
  alt: string;
  title: string | null;
  width: number | null;
  /** Pie de foto visible: el título se muestra bajo la imagen (marcador `CAPTION_MARK`). */
  caption: boolean;
}

/**
 * Marcador que sigue a la imagen para mostrar su título como pie de foto. Es un comentario HTML:
 * otros visores de Markdown lo ocultan y solo muestran el título como tooltip.
 */
export const CAPTION_MARK = '<!-- mdteca:caption -->';

const ATTR = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
const KNOWN = new Set(['src', 'alt', 'title', 'width']);

const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const encode = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Lee `<img src="…" alt="…" title="…" width="…">`; null si no es exactamente eso. */
export function parseImgTag(html: string): ImgAttrs | null {
  const trimmed = html.trim();
  const caption = trimmed.endsWith(CAPTION_MARK);
  const tag = caption ? trimmed.slice(0, -CAPTION_MARK.length) : trimmed;
  const m = /^<img\s+([^<>]*?)\s*\/?>$/i.exec(tag);
  if (!m) return null;
  const found: Record<string, string> = {};
  let rest = m[1]!;
  for (const a of m[1]!.matchAll(ATTR)) {
    const name = a[1]!.toLowerCase();
    if (!KNOWN.has(name) || name in found) return null;
    found[name] = decode(a[3] ?? a[4] ?? '');
    rest = rest.replace(a[0], '');
  }
  if (rest.trim() !== '' || !found['src']) return null;
  const width = found['width'] !== undefined ? Number(found['width']) : null;
  if (width !== null && !(Number.isFinite(width) && width > 0)) return null;
  return {
    src: found['src'],
    alt: found['alt'] ?? '',
    title: found['title'] ?? null,
    width,
    caption,
  };
}

/** Etiqueta `<img>` canónica: src, alt, title (si hay), width. El marcador se añade aparte. */
export function imgTag(a: Omit<ImgAttrs, 'caption'>): string {
  const parts = [`src="${encode(a.src)}"`, `alt="${encode(a.alt)}"`];
  if (a.title) parts.push(`title="${encode(a.title)}"`);
  if (a.width) parts.push(`width="${Math.round(a.width)}"`);
  return `<img ${parts.join(' ')}>`;
}
