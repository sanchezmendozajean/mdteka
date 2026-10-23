/** Enlaces y rutas de imágenes dentro de un Markdown (IMG-20): lectura y reescritura de destinos locales. */

const LINK = /(\]\()(<[^>\n]*>|[^)\s]*)((?:\s+"[^"\n]*")?\))|(\bsrc\s*=\s*")([^"\n]*)(")/g;

export const isLocal = (target: string) =>
  target !== '' &&
  !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) &&
  !target.startsWith('/') &&
  !target.startsWith('#') &&
  !target.startsWith('\\');

export const decode = (s: string) => {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
};

/** Codifica una ruta relativa como lo hace la inserción de imágenes (espacios y paréntesis). */
export const encodePath = (p: string): string =>
  encodeURI(p).replace(/\(/g, '%28').replace(/\)/g, '%29');

/**
 * Reescribe los destinos locales de enlaces e imágenes (`](…)` y `src="…"`). `fn` recibe la ruta ya
 * decodificada y devuelve la nueva (o null para dejarla como está).
 */
export function rewriteLinks(text: string, fn: (target: string) => string | null): string {
  return text.replace(LINK, (match, a, md, mdEnd, b, src, q) => {
    const raw: string = md ?? src;
    const angle = typeof raw === 'string' && raw.startsWith('<') && raw.endsWith('>');
    const target = angle ? raw.slice(1, -1) : raw;
    if (!isLocal(target)) return match;
    const hash = /[?#]/.exec(target);
    const path = hash ? target.slice(0, hash.index) : target;
    const tail = hash ? target.slice(hash.index) : '';
    const next = fn(decode(path));
    if (next === null) return match;
    const written = encodePath(next) + tail;
    if (md !== undefined) return `${a}${angle ? `<${written}>` : written}${mdEnd}`;
    return `${b}${written}${q}`;
  });
}
