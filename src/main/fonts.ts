import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Reglas `@font-face` de las familias pedidas con los archivos incrustados en base64 (VW-42).
 * Lee las fuentes empaquetadas con la app (`renderer/assets`): el renderer no puede leer
 * `file://`, y aquí solo se leen archivos `.woff2` de esa carpeta.
 */
export function embedFontFaces(assetsDir: string, families: string[]): string {
  const wanted = new Set(families);
  let files: string[];
  try {
    files = readdirSync(assetsDir).filter((f) => f.endsWith('.css'));
  } catch {
    return ''; // modo desarrollo: no hay archivos empaquetados
  }
  const out: string[] = [];
  for (const css of files) {
    const text = readFileSync(join(assetsDir, css), 'utf8');
    for (const m of text.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const body = m[1]!;
      const prop = (name: string) =>
        new RegExp(String.raw`${name}\s*:\s*([^;]+);`).exec(body)?.[1]?.trim() ?? '';
      const family = prop('font-family').replace(/["']/g, '');
      if (!wanted.has(family)) continue;
      const range = prop('unicode-range');
      // Solo el subconjunto latino básico: el resto triplicaría el tamaño del archivo.
      if (range && !/U\+0000-00FF/i.test(range)) continue;
      const url = /url\(["']?([^"')]+\.woff2)["']?\)/.exec(prop('src'))?.[1];
      if (!url) continue;
      let data: string;
      try {
        data = readFileSync(join(assetsDir, basename(url))).toString('base64');
      } catch {
        continue;
      }
      out.push(
        `@font-face{font-family:'${family}';font-style:${prop('font-style') || 'normal'};font-weight:${prop('font-weight') || '400'};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2');${range ? `unicode-range:${range};` : ''}}`,
      );
    }
  }
  return out.join('\n');
}
