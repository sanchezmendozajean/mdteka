import { bundledFont } from '@shared/document-config';

const cache = new Map<string, boolean>();
const BASES = ['monospace', 'serif', 'sans-serif'] as const;

/**
 * ¿Existe la fuente en esta máquina? Las incluidas siempre. Para el resto se compara el ancho de
 * un texto con y sin la fuente sobre tres familias genéricas: si alguno cambia, está instalada.
 */
export function isFontAvailable(name: string): boolean {
  if (bundledFont(name)) return true;
  const hit = cache.get(name);
  if (hit !== undefined) return hit;
  const ctx = document.createElement('canvas').getContext('2d');
  let found = false;
  if (ctx) {
    const sample = 'mmmmmmmmmmlli WwQq0123456789';
    found = BASES.some((base) => {
      ctx.font = `72px ${base}`;
      const without = ctx.measureText(sample).width;
      ctx.font = `72px "${name.replace(/"/g, '')}", ${base}`;
      return ctx.measureText(sample).width !== without;
    });
  }
  cache.set(name, found);
  return found;
}
