import { promises as fs, realpathSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { assertGranted, isInDocDir } from './files';

/** Imágenes (06): nombres `<doc>.<NNN>.<ext>`, importación y servicio por `mdtor-asset://`. */

export const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
};

const MAX_BYTES = 64 * 1024 * 1024;

export const isImageName = (name: string): boolean =>
  extname(name).slice(1).toLowerCase() in IMAGE_TYPES;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Siguiente nombre libre: `manual.001.png`, `manual.002.png`… Es el mayor número existente para
 * ese documento más uno; nunca se reutilizan huecos (IMG-02).
 */
export async function nextImageName(docPath: string, ext: string): Promise<string> {
  const dir = dirname(docPath);
  const base = basename(docPath, extname(docPath));
  const re = new RegExp(`^${escapeRe(base)}\\.(\\d{3,})\\.[A-Za-z0-9]+$`, 'i');
  let max = 0;
  for (const f of await fs.readdir(dir)) {
    const m = re.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const n = max + 1;
  const num = n > 999 ? String(n) : String(n).padStart(3, '0');
  return `${base}.${num}.${ext.toLowerCase()}`;
}

/** Escritura atómica; si falla no queda archivo a medias. */
async function writeAtomic(path: string, data: Uint8Array): Promise<void> {
  const tmp = `${path}.tmp`;
  await fs.writeFile(tmp, data);
  try {
    await fs.rename(tmp, path);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

const cleanExt = (ext: string): string => {
  const e = ext.replace(/^\./, '').toLowerCase();
  if (!(e in IMAGE_TYPES)) throw new Error('Formato de imagen no admitido');
  return e;
};

/** Guarda bytes de una imagen junto al documento. Devuelve el nombre del archivo. */
export async function saveImage(
  docPath: string,
  base64: string,
  ext: string,
  wanted?: string,
): Promise<string> {
  const doc = assertGranted(docPath);
  const data = Buffer.from(base64, 'base64');
  if (data.length === 0 || data.length > MAX_BYTES)
    throw new Error('Imagen vacía o demasiado grande');
  const clean = cleanExt(ext);
  let name = await nextImageName(doc, clean);
  // Nombre elegido por el usuario (IMG-03): sin separadores de ruta y sin pisar un archivo existente.
  const custom = wanted ? sanitizeName(wanted, clean) : null;
  if (custom && !(await exists(join(dirname(doc), custom)))) name = custom;
  await writeAtomic(join(dirname(doc), name), data);
  return name;
}

const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

/** Quita lo que no puede ir en un nombre de archivo y fuerza la extensión. */
export function sanitizeName(name: string, ext: string): string | null {
  const base = [
    ...basename(name)
      .replace(extname(name), '')
      .replace(/[<>:"/|?*]/g, ''),
  ]
    .filter((c) => c.charCodeAt(0) >= 32)
    .join('')
    .trim();
  return base ? `${base}.${ext}` : null;
}

/**
 * Importa un archivo de imagen (arrastrado o elegido): si ya está dentro de la carpeta del
 * documento solo se enlaza; si no, se copia con el nombre numerado (IMG-10).
 * Devuelve la ruta relativa al documento, con `/`.
 */
export async function importImage(docPath: string, srcPath: string): Promise<string> {
  const doc = assertGranted(docPath);
  if (!isAbsolute(srcPath) || !isImageName(srcPath)) throw new Error('Imagen no válida');
  const src = realpathSync.native(resolve(srcPath));
  const stat = await fs.stat(src);
  if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Imagen no válida');
  const dir = dirname(doc);
  const rel = relative(dir, src);
  if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel.split(sep).join('/');
  const name = await nextImageName(doc, extname(src).slice(1));
  await writeAtomic(join(dir, name), await fs.readFile(src));
  return name;
}

/** Lee una imagen de la carpeta del documento (convertir a base64, exportar). */
export async function readImage(
  docPath: string,
  rel: string,
): Promise<{ mime: string; data: string }> {
  const doc = assertGranted(docPath);
  const full = realpathSync.native(resolve(dirname(doc), rel));
  if (!isImageName(full) || !isInDocDir(full)) throw new Error('Ruta no permitida');
  const buf = await fs.readFile(full);
  return { mime: IMAGE_TYPES[extname(full).slice(1).toLowerCase()]!, data: buf.toString('base64') };
}

/** Copia imágenes a `<html>_files/` para una exportación HTML con carpeta (VW-42). */
export async function copyImagesFor(
  docPath: string,
  htmlPath: string,
  names: string[],
): Promise<string> {
  const doc = assertGranted(docPath);
  const html = assertGranted(htmlPath);
  const folder = `${basename(html, extname(html))}_files`;
  const target = join(dirname(html), folder);
  await fs.mkdir(target, { recursive: true });
  for (const rel of names) {
    const full = realpathSync.native(resolve(dirname(doc), rel));
    if (!isImageName(full) || !isInDocDir(full)) continue;
    await writeAtomic(join(target, basename(full)), await fs.readFile(full));
  }
  return folder;
}

/** Respuesta del protocolo `mdtor-asset://`: solo imágenes dentro de carpetas de documentos abiertos. */
export async function assetResponse(url: string): Promise<Response> {
  try {
    const raw = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
    const full = realpathSync.native(resolve(raw));
    if (!isImageName(full) || !isInDocDir(full)) return new Response(null, { status: 403 });
    const stat = await fs.stat(full);
    if (!stat.isFile() || stat.size > MAX_BYTES) return new Response(null, { status: 403 });
    return new Response(new Uint8Array(await fs.readFile(full)), {
      headers: {
        'content-type': IMAGE_TYPES[extname(full).slice(1).toLowerCase()]!,
        'cache-control': 'no-cache',
        // Un SVG se muestra como imagen, nunca ejecuta scripts.
        'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

/** Lee un archivo de imagen cualquiera elegido por el usuario (selector o arrastre). */
export async function readImageFile(srcPath: string): Promise<{ mime: string; data: string }> {
  if (!isAbsolute(srcPath) || !isImageName(srcPath)) throw new Error('Imagen no válida');
  const src = realpathSync.native(resolve(srcPath));
  const stat = await fs.stat(src);
  if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('Imagen no válida');
  return {
    mime: IMAGE_TYPES[extname(src).slice(1).toLowerCase()]!,
    data: (await fs.readFile(src)).toString('base64'),
  };
}

/** Descarga una imagen https y la guarda con el nombre numerado del documento. */
export async function downloadImage(
  docPath: string,
  url: string,
  fetchImage: (url: string) => Promise<Response>,
): Promise<string> {
  if (!/^https?:\/\//i.test(url)) throw new Error('Solo se descargan imágenes http(s)');
  const res = await fetchImage(url);
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
  const ext = Object.entries(IMAGE_TYPES).find(([, mime]) => mime === type)?.[0];
  if (!res.ok || !ext) throw new Error('La dirección no es una imagen');
  const buf = Buffer.from(await res.arrayBuffer());
  return saveImage(docPath, buf.toString('base64'), ext);
}
