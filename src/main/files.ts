import { createHash } from 'node:crypto';
import { promises as fs, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';

/**
 * Acceso al sistema de archivos con concesiones: el renderer solo puede leer o escribir rutas que el
 * usuario eligió en un diálogo o que llegaron por línea de comandos / asociación de archivos (02).
 */
const key = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
const grants = new Set<string>();

export function normalizePath(raw: string): string {
  if (!isAbsolute(raw)) throw new Error('Se requiere una ruta absoluta');
  return resolve(normalize(raw));
}

/**
 * Forma canónica de una ruta existente (expande nombres cortos 8.3 de Windows como `JEAN~1.SAN`,
 * con los que `fs.watch` falla). Si el archivo aún no existe se usa la ruta normalizada.
 */
function canonical(raw: string): string {
  const p = normalizePath(raw);
  try {
    return realpathSync.native(p);
  } catch {
    // El archivo aún no existe (Guardar como): se canonicaliza su carpeta para que la ruta
    // concedida coincida con la que tendrá una vez escrito (nombres cortos 8.3, etc.).
    try {
      return join(realpathSync.native(dirname(p)), basename(p));
    } catch {
      return p;
    }
  }
}

/** Carpetas de los documentos abiertos: lo único que sirve `mdteca-asset://` (02). */
const docDirs = new Set<string>();

/** Carpetas de proyectos abiertos: sus documentos (y el `.mdteca`) se pueden leer y escribir (05). */
const trees = new Set<string>();
const TREE_FILES = /\.(md|markdown|mdown|txt|mdteca)$/i;

export function grantTree(raw: string): string {
  const p = canonical(raw);
  trees.add(key(p));
  // Las imágenes de cualquier documento del proyecto se pueden mostrar (mdteca-asset://).
  docDirs.add(key(p));
  return p;
}

const inTree = (p: string): boolean => {
  const k = key(p);
  for (const t of trees) if (k.startsWith(t.endsWith(sep) ? t : t + sep)) return true;
  return false;
};

export function grant(raw: string): string {
  const p = canonical(raw);
  grants.add(key(p));
  if (/\.(md|markdown|mdown|txt)$/i.test(p)) docDirs.add(key(dirname(p)));
  return p;
}

/** ¿Está la ruta (ya canónica) dentro de la carpeta de algún documento abierto? */
export function isInDocDir(p: string): boolean {
  const k = key(p);
  for (const dir of docDirs) {
    if (k === dir || k.startsWith(dir.endsWith(sep) ? dir : dir + sep)) return true;
  }
  return false;
}

/** Ruta canónica de una carpeta (para compararla con las de los documentos abiertos). */
export const grantableDir = (raw: string): string => canonical(raw);

/** Carpeta de un proyecto abierto (o una subcarpeta suya). */
export function assertTreeRoot(raw: string): string {
  const p = canonical(raw);
  if (trees.has(key(p)) || inTree(p)) return p;
  throw new Error('Ruta no autorizada');
}

export function assertGranted(raw: string): string {
  const p = canonical(raw);
  if (grants.has(key(p))) return p;
  // Un documento dentro de la carpeta de un proyecto abierto se concede al primer uso.
  if (inTree(p) && TREE_FILES.test(p)) return grant(p);
  throw new Error('Ruta no autorizada');
}

const sha = (text: string) => createHash('sha1').update(text).digest('hex');

export async function readText(raw: string): Promise<string> {
  return fs.readFile(assertGranted(raw), 'utf8');
}

const lastWritten = new Map<string, string>();

/** Escritura atómica: archivo temporal + renombrado, con reintentos ante bloqueos de antivirus. */
export async function writeTextAtomic(raw: string, content: string): Promise<void> {
  const target = assertGranted(raw);
  const tmp = join(dirname(target), `${basename(target)}.tmp`);
  await fs.writeFile(tmp, Buffer.from(content, 'utf8'));
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rename(tmp, target);
      lastWritten.set(key(target), sha(content));
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES') break;
      await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
    }
  }
  await fs.rm(tmp, { force: true });
  throw lastError;
}

/** Escritura atómica de bytes (PDF exportado) en una ruta concedida. */
export async function writeBytesAtomic(raw: string, data: Uint8Array): Promise<void> {
  const target = assertGranted(raw);
  const tmp = join(dirname(target), `${basename(target)}.tmp`);
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, target);
}

const watchers = new Map<string, FSWatcher>();

export function watchFile(raw: string, onExternalChange: (path: string) => void): void {
  const p = assertGranted(raw);
  if (watchers.has(key(p))) return;
  const watcher = chokidar.watch(p, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  });
  const changed = async () => {
    try {
      const text = await fs.readFile(p, 'utf8');
      // Las escrituras propias no cuentan como cambio externo.
      if (lastWritten.get(key(p)) === sha(text)) return;
    } catch {
      /* el archivo desapareció: también es un cambio externo */
    }
    onExternalChange(p);
  };
  watcher.on('change', changed).on('unlink', changed).on('add', changed);
  watchers.set(key(p), watcher);
}

export async function unwatchFile(raw: string): Promise<void> {
  const k = key(normalizePath(raw));
  const watcher = watchers.get(k);
  watchers.delete(k);
  await watcher?.close();
}

export async function closeAllWatchers(): Promise<void> {
  await Promise.all([...watchers.values()].map((w) => w.close()));
  watchers.clear();
}

const OPENABLE = /\.(md|markdown|mdown|txt|mdteca)$/i;

/** Rutas de archivo útiles dentro de una lista de argumentos de línea de comandos. */
export function pathsFromArgv(argv: string[]): string[] {
  return argv.filter((a) => isAbsolute(a) && OPENABLE.test(a)).map((a) => grant(a));
}
