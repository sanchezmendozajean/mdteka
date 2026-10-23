import { promises as fs } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { rewriteLinks } from '@shared/links';
import { isIgnored } from '@shared/project';
import { assertGranted, assertTreeRoot, grantableDir, isInDocDir } from './files';
import { isImageName, nextImageName } from './images';

/** Operaciones de archivos de un proyecto (05): exploración, búsqueda, mover y duplicar. */

const SKIP_DIRS = new Set(['node_modules', '.git', '.hg', '.svn']);
const MD = /\.(md|markdown|mdown)$/i;
const MAX_FILES = 5000;

/** Rutas `.md` de la carpeta (relativas, con `/`), sin carpetas ocultas ni `node_modules`. */
export async function scanMarkdown(rootRaw: string, ignore: string[] = []): Promise<string[]> {
  const root = assertTreeRoot(rootRaw);
  const out: string[] = [];
  const walk = async (dir: string) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (out.length >= MAX_FILES) return;
      if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && MD.test(e.name)) {
        const rel = relative(root, full).split(sep).join('/');
        if (!isIgnored(rel, ignore)) out.push(rel);
      }
    }
  };
  await walk(root);
  return out;
}

/**
 * Busca `.mdteca` en la carpeta del archivo y en las superiores, hasta la raíz del repositorio Git
 * o 5 niveles (PRJ-32). Devuelve los de la primera carpeta que tenga alguno.
 */
export async function findProjectFiles(docRaw: string): Promise<string[]> {
  let dir = dirname(resolve(docRaw));
  for (let level = 0; level <= 5; level++) {
    try {
      const names = (await fs.readdir(dir)).filter((n) => /\.mdteca$/i.test(n)).sort();
      if (names.length) return names.map((n) => join(dir, n));
      // Raíz del repositorio: no se sube más.
      if (
        await fs.stat(join(dir, '.git')).then(
          () => true,
          () => false,
        )
      )
        return [];
    } catch {
      return [];
    }
    const parent = dirname(dir);
    if (parent === dir) return [];
    dir = parent;
  }
  return [];
}

// ---------------------------------------------------------------------------------------------
// Mover y renombrar un documento con sus imágenes (IMG-20, PRJ-24)
// ---------------------------------------------------------------------------------------------

const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

async function moveFile(from: string, to: string): Promise<void> {
  await fs.mkdir(dirname(to), { recursive: true });
  try {
    await fs.rename(from, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
    await fs.copyFile(from, to);
    await fs.rm(from);
  }
}

export interface MoveResult {
  /** Imágenes que se movieron con el documento (rutas absolutas nuevas). */
  images: number;
  /** Enlaces relativos reescritos por el cambio de carpeta. */
  links: number;
}

/**
 * Mueve o renombra un documento. Las imágenes `<doc>.NNN.<ext>` que le pertenecen viajan con él y
 * se renombran a `<nuevo>.NNN.<ext>`; el resto de los enlaces relativos se recalculan para seguir
 * apuntando al mismo archivo.
 */
export async function moveDocument(fromRaw: string, toRaw: string): Promise<MoveResult> {
  const from = assertGranted(fromRaw);
  const to = assertGranted(toRaw);
  if (from.toLowerCase() !== to.toLowerCase() && (await exists(to)))
    throw new Error('Ya existe un archivo con ese nombre');
  const text = await fs.readFile(from, 'utf8');
  const oldDir = dirname(from);
  const newDir = dirname(to);
  const oldBase = basename(from, extname(from));
  const newBase = basename(to, extname(to));
  const owned = new RegExp(
    `^${oldBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d{3,})\\.([A-Za-z0-9]+)$`,
    'i',
  );

  const moves = new Map<string, string>();
  let links = 0;
  const rewritten = rewriteLinks(text, (target) => {
    const abs = resolve(oldDir, target);
    const name = basename(abs);
    const own = owned.exec(name);
    if (own && dirname(abs) === oldDir && isImageName(name)) {
      let dest = moves.get(abs);
      if (!dest) {
        dest = join(newDir, `${newBase}.${own[1]}.${own[2]!.toLowerCase()}`);
        moves.set(abs, dest);
      }
      return basename(dest);
    }
    if (newDir === oldDir) return null;
    links++;
    return relative(newDir, abs).split(sep).join('/');
  });

  // Destinos ya ocupados: se usa el siguiente número libre del documento nuevo.
  const fix = new Map<string, string>();
  for (const [src, dest] of moves) {
    if (dest.toLowerCase() !== src.toLowerCase() && (await exists(dest))) {
      const name = await nextImageName(to, extname(src).slice(1));
      fix.set(basename(dest), name);
      moves.set(src, join(newDir, name));
    }
  }
  const finalText = fix.size
    ? rewriteLinks(rewritten, (target) => fix.get(target) ?? null)
    : rewritten;

  await moveFile(from, to);
  let images = 0;
  for (const [src, dest] of moves) {
    if (!(await exists(src))) continue;
    await moveFile(src, dest);
    images++;
  }
  if (finalText !== text) await fs.writeFile(to, finalText, 'utf8');
  return { images, links };
}

/** Copia un documento con sus imágenes propias (`Duplicar`, PRJ-25). */
export async function duplicateDocument(fromRaw: string, toRaw: string): Promise<void> {
  const from = assertGranted(fromRaw);
  const to = assertGranted(toRaw);
  if (await exists(to)) throw new Error('Ya existe un archivo con ese nombre');
  const text = await fs.readFile(from, 'utf8');
  const oldBase = basename(from, extname(from));
  const newBase = basename(to, extname(to));
  const oldDir = dirname(from);
  const owned = new RegExp(
    `^${oldBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\d{3,})\\.([A-Za-z0-9]+)$`,
    'i',
  );
  const copies: [string, string][] = [];
  const out = rewriteLinks(text, (target) => {
    const abs = resolve(oldDir, target);
    const own = owned.exec(basename(abs));
    if (!own || dirname(abs) !== oldDir) return null;
    const name = `${newBase}.${own[1]}.${own[2]!.toLowerCase()}`;
    copies.push([abs, join(dirname(to), name)]);
    return name;
  });
  await fs.mkdir(dirname(to), { recursive: true });
  await fs.writeFile(to, out, 'utf8');
  for (const [src, dest] of copies) if (await exists(src)) await fs.copyFile(src, dest);
}

/** Crea un archivo nuevo sin pisar uno existente. */
export async function createFile(raw: string, content: string): Promise<void> {
  const path = assertGranted(raw);
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, content, { encoding: 'utf8', flag: 'wx' });
}

// ---------------------------------------------------------------------------------------------
// Imágenes huérfanas (IMG-20)
// ---------------------------------------------------------------------------------------------

/** Imágenes `<doc>.NNN.<ext>` de un documento que ya no aparecen en su texto. */
export async function orphanImages(docRaw: string): Promise<string[]> {
  const doc = assertGranted(docRaw);
  const dir = dirname(doc);
  const base = basename(doc, extname(doc));
  const re = new RegExp(
    `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d{3,}\\.[A-Za-z0-9]+$`,
    'i',
  );
  const text = await fs.readFile(doc, 'utf8');
  const used = new Set<string>();
  rewriteLinks(text, (t) => {
    used.add(basename(t).toLowerCase());
    return null;
  });
  const names = (await fs.readdir(dir)).filter((n) => re.test(n) && isImageName(n));
  return names.filter((n) => !used.has(n.toLowerCase())).map((n) => join(dir, n));
}

/** Ruta que se puede mandar a la papelera: un archivo concedido o una imagen de la carpeta de un documento. */
export function assertTrashable(raw: string): string {
  const p = grantableDir(raw);
  if (isImageName(p) && isInDocDir(p)) return p;
  return assertGranted(raw);
}

export async function assertInside(rootRaw: string, rel: string): Promise<string> {
  const root = assertTreeRoot(rootRaw);
  if (isAbsolute(rel)) throw new Error('Ruta no permitida');
  const full = resolve(root, rel);
  if (!full.startsWith(root + sep)) throw new Error('Ruta no permitida');
  return full;
}

// ---------------------------------------------------------------------------------------------
// Búsqueda en el proyecto
// ---------------------------------------------------------------------------------------------

export interface SearchOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}
export interface SearchHit {
  file: string;
  /** Orden de la coincidencia dentro del archivo (0, 1, 2…). */
  n: number;
  line: number;
  text: string;
  /** Posición de la coincidencia dentro de `text`. */
  from: number;
  to: number;
}

export function buildSearch(options: SearchOptions): RegExp | null {
  if (!options.query) return null;
  let source = options.regex ? options.query : options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (options.wholeWord) source = `\\b(?:${source})\\b`;
  try {
    return new RegExp(source, options.caseSensitive ? 'g' : 'gi');
  } catch {
    return null;
  }
}

/** Busca texto en los archivos dados (rutas del proyecto). Como máximo 500 coincidencias. */
export async function searchFiles(
  rootRaw: string,
  files: string[],
  options: SearchOptions,
): Promise<SearchHit[]> {
  const root = assertTreeRoot(rootRaw);
  const re = buildSearch(options);
  if (!re) return [];
  const hits: SearchHit[] = [];
  for (const file of files) {
    if (hits.length >= 500) break;
    let text: string;
    try {
      text = await fs.readFile(join(root, ...file.split('/')), 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    let inConfig = false;
    let n = 0;
    for (let i = 0; i < lines.length && hits.length < 500; i++) {
      const line = lines[i]!;
      // El bloque de configuración no es contenido del documento.
      if (line.startsWith('<!-- mdteca:config')) inConfig = true;
      if (inConfig) {
        if (line.includes('-->')) inConfig = false;
        continue;
      }
      re.lastIndex = 0;
      for (let m = re.exec(line); m && hits.length < 500; m = re.exec(line)) {
        if (m[0] === '') {
          re.lastIndex++;
          continue;
        }
        const start = Math.max(0, m.index - 40);
        hits.push({
          file,
          n: n++,
          line: i + 1,
          text: line.slice(start, start + 200),
          from: m.index - start,
          to: m.index - start + m[0].length,
        });
      }
    }
  }
  return hits;
}
