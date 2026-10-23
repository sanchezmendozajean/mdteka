import { z } from 'zod';
import { orderKeys } from './document-config';

/**
 * Proyecto MDteca (05): archivo índice `*.mdteca` en JSON. Todo lo de este módulo es puro (sin
 * `fs` ni `path`) para que lo usen el proceso principal y el renderer y se pruebe sin Electron.
 */

export interface ProjectItem {
  id: string;
  title?: string;
  file: string;
  children?: ProjectItem[];
  [extra: string]: unknown;
}
export interface Book {
  id: string;
  title: string;
  icon?: string;
  folder?: string;
  items: ProjectItem[];
  [extra: string]: unknown;
}
export interface Collection {
  id: string;
  title: string;
  icon?: string;
  books: Book[];
  [extra: string]: unknown;
}
export interface Project {
  $schema?: string;
  format: 'mdteca-project';
  version: 1;
  title: string;
  description?: string;
  /** Configuración de documento que heredan todos los del proyecto (04). */
  defaults?: Record<string, unknown>;
  /** Convención de nombres de los archivos nuevos (PRJ-26). */
  naming?: { numbered?: boolean };
  collections: Collection[];
  ignore?: string[];
  [extra: string]: unknown;
}

export const SCHEMA_URL = 'https://mdteca.app/schemas/project-v1.json';

// ---------------------------------------------------------------------------------------------
// Rutas (PRJ-03): relativas al `.mdteca`, con `/`, sin `./` inicial
// ---------------------------------------------------------------------------------------------

/** ¿Es una ruta de proyecto válida? Relativa, con `/`, sin `./` ni `..` ni unidades. */
export function isProjectPath(p: string): boolean {
  if (!p || p.includes('\\') || p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false;
  return p.split('/').every((s) => s !== '' && s !== '.' && s !== '..');
}

const projectPath = z.string().refine(isProjectPath, {
  message: 'La ruta debe ser relativa, con «/», sin «./» ni «..»',
});

const ItemSchema: z.ZodType<ProjectItem> = z.lazy(() =>
  z.looseObject({
    id: z.string().min(1),
    title: z.string().optional(),
    file: projectPath,
    children: z.array(ItemSchema).optional(),
  }),
) as z.ZodType<ProjectItem>;

const BookSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string(),
  icon: z.string().optional(),
  folder: projectPath.optional(),
  items: z.array(ItemSchema).default([]),
});

const CollectionSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string(),
  icon: z.string().optional(),
  books: z.array(BookSchema).default([]),
});

export const ProjectSchema = z.looseObject({
  $schema: z.string().optional(),
  format: z.literal('mdteca-project'),
  version: z.literal(1),
  title: z.string(),
  description: z.string().optional(),
  defaults: z.record(z.string(), z.unknown()).optional(),
  naming: z.looseObject({ numbered: z.boolean().optional() }).optional(),
  collections: z.array(CollectionSchema).default([]),
  ignore: z.array(z.string()).optional(),
});

export type ReadProject = { ok: true; project: Project } | { ok: false; error: string };

/** Lee y valida el texto de un `.mdteca` (PRJ-01). */
export function parseProject(text: string): ReadProject {
  // Un merge sin resolver deja marcadores de conflicto: se avisa con la línea y no se toca (10 · Merge).
  const conflict = /^(<{7}|={7}|>{7})(\s|$)/m.exec(text);
  if (conflict) {
    const line = text.slice(0, conflict.index).split('\n').length;
    return { ok: false, error: `marcadores de conflicto de Git en la línea ${line}` };
  }
  let json: unknown;
  try {
    json = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const parsed = ProjectSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue?.path.join('.') || 'raíz'}: ${issue?.message ?? ''}` };
  }
  const project = parsed.data as unknown as Project;
  const ids = new Set<string>();
  for (const id of allIds(project)) {
    if (ids.has(id)) return { ok: false, error: `id repetido: ${id}` };
    ids.add(id);
  }
  return { ok: true, project };
}

// ---------------------------------------------------------------------------------------------
// Serialización determinista (PRJ-05)
// ---------------------------------------------------------------------------------------------

const KEY_ORDER = {
  project: [
    '$schema',
    'format',
    'version',
    'title',
    'description',
    'defaults',
    'naming',
    'collections',
    'ignore',
  ],
  collection: ['id', 'title', 'icon', 'books'],
  book: ['id', 'title', 'icon', 'folder', 'items'],
  item: ['id', 'title', 'file', 'children'],
} as const;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function ordered(value: Json, known: readonly string[]): [string, unknown][] {
  const keys = Object.keys(value).filter((k) => value[k] !== undefined);
  return [...known.filter((k) => keys.includes(k)), ...keys.filter((k) => !known.includes(k))].map(
    (k) => [k, value[k]],
  );
}

const inline = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
  if (isObject(v))
    return `{ ${Object.entries(v)
      .map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`)
      .join(', ')} }`;
  return JSON.stringify(v);
};

/**
 * Escribe un nodo del árbol. Los ítems sin hijos y los libros y colecciones vacíos van en una sola
 * línea: mover un capítulo cambia solo su línea (diffs mínimos en Git, PRJ-05).
 */
function node(
  value: Json,
  kind: 'collection' | 'book' | 'item',
  ind: string,
  last: boolean,
): string {
  const children = kind === 'collection' ? 'books' : kind === 'book' ? 'items' : 'children';
  const list = value[children];
  const entries = ordered(value, KEY_ORDER[kind]);
  const comma = last ? '' : ',';
  if (!Array.isArray(list) || list.length === 0) {
    const flat = entries.filter(([k]) => k !== 'children');
    return `${ind}${inline(Object.fromEntries(flat))}${comma}`;
  }
  const childKind = kind === 'collection' ? 'book' : 'item';
  const inner = `${ind}  `;
  const lines = entries.map(([k, v], i) => {
    const sep = i === entries.length - 1 ? '' : ',';
    if (k === children) {
      const rows = (v as Json[]).map((c, j, all) =>
        node(c, childKind, `${inner}  `, j === all.length - 1),
      );
      return `${inner}${JSON.stringify(k)}: [\n${rows.join('\n')}\n${inner}]${sep}`;
    }
    return `${inner}${JSON.stringify(k)}: ${JSON.stringify(v)}${sep}`;
  });
  return `${ind}{\n${lines.join('\n')}\n${ind}}${comma}`;
}

/** Texto canónico del proyecto: 2 espacios, orden de claves fijo, `\n` y salto final. */
export function serializeProject(project: Project): string {
  const entries = ordered(project as Json, KEY_ORDER.project);
  const lines = entries.map(([k, v], i) => {
    const sep = i === entries.length - 1 ? '' : ',';
    if (k === 'collections') {
      const cols = v as Json[];
      if (cols.length === 0) return `  "collections": []${sep}`;
      const rows = cols.map((c, j) => node(c, 'collection', '    ', j === cols.length - 1));
      return `  "collections": [\n${rows.join('\n')}\n  ]${sep}`;
    }
    if (k === 'ignore') return `  "ignore": ${inline(v)}${sep}`;
    if (k === 'defaults') {
      const body = JSON.stringify(orderKeys(v, ''), null, 2).replace(/\n/g, '\n  ');
      return `  "defaults": ${body}${sep}`;
    }
    // Cualquier otro valor (naming, claves de versiones futuras) con sangría de 2 espacios.
    const body = JSON.stringify(v, null, 2).replace(/\n/g, '\n  ');
    return `  ${JSON.stringify(k)}: ${body}${sep}`;
  });
  return `{\n${lines.join('\n')}\n}\n`;
}

/** Proyecto nuevo con el esquema y el formato rellenados. */
export function newProject(title: string): Project {
  return {
    $schema: SCHEMA_URL,
    format: 'mdteca-project',
    version: 1,
    title,
    collections: [],
  };
}

/**
 * Proyecto inicial de una carpeta con `.md` ya escritos: cada carpeta con archivos es un libro y los
 * archivos de la raíz van a uno con el nombre del proyecto (asistente de importación, PRJ-32).
 */
export function importProject(title: string, files: string[], collectionTitle: string): Project {
  const project = newProject(title);
  if (files.length === 0) return project;
  const taken = new Set<string>();
  const fresh = (name: string) => {
    const id = makeId(name, taken);
    taken.add(id);
    return id;
  };
  const groups = new Map<string, string[]>();
  const sorted = [...files].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const file of sorted) {
    const dir = dirnameOf(file);
    groups.set(dir, [...(groups.get(dir) ?? []), file]);
  }
  const collection: Collection = { id: fresh('general'), title: collectionTitle, books: [] };
  for (const [dir, list] of groups) {
    const name = dir ? basenameOf(dir) : title;
    collection.books.push({
      id: fresh(name),
      title: name,
      icon: 'book-open',
      ...(dir ? { folder: dir } : {}),
      items: list.map((file) => ({ id: fresh(basenameOf(file).replace(/\.md$/i, '')), file })),
    });
  }
  project.collections.push(collection);
  return project;
}

// ---------------------------------------------------------------------------------------------
// ids estables (PRJ-05): slug corto + 4 caracteres
// ---------------------------------------------------------------------------------------------

/** `Instalación y puesta en marcha` → `instalacion-y-puesta-en-marcha`. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function allIds(project: Project): string[] {
  const ids: string[] = [];
  const walk = (items: ProjectItem[]) =>
    items.forEach((i) => {
      ids.push(i.id);
      walk(i.children ?? []);
    });
  for (const c of project.collections) {
    ids.push(c.id);
    for (const b of c.books) {
      ids.push(b.id);
      walk(b.items);
    }
  }
  return ids;
}

/** Id nuevo: slug del título (corto) y 4 caracteres aleatorios, que no esté ya en uso. */
export function makeId(
  title: string,
  taken: Iterable<string>,
  random: () => number = Math.random,
): string {
  const used = new Set(taken);
  const slug = slugify(title).slice(0, 24).replace(/-+$/, '') || 'item';
  for (;;) {
    let suffix = '';
    for (let i = 0; i < 4; i++) suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
    const id = `${slug}-${suffix}`;
    if (!used.has(id)) return id;
  }
}

// ---------------------------------------------------------------------------------------------
// Operaciones sobre el árbol (inmutables)
// ---------------------------------------------------------------------------------------------

export interface Location {
  collection: Collection;
  book: Book;
  /** Lista que contiene al ítem (los ítems del libro o los hijos de otro ítem). */
  siblings: ProjectItem[];
  parent: ProjectItem | null;
  item: ProjectItem;
  index: number;
}

export function locate(project: Project, itemId: string): Location | null {
  for (const collection of project.collections) {
    for (const book of collection.books) {
      const walk = (siblings: ProjectItem[], parent: ProjectItem | null): Location | null => {
        for (let index = 0; index < siblings.length; index++) {
          const item = siblings[index]!;
          if (item.id === itemId) return { collection, book, siblings, parent, item, index };
          const found = walk(item.children ?? [], item);
          if (found) return found;
        }
        return null;
      };
      const hit = walk(book.items, null);
      if (hit) return hit;
    }
  }
  return null;
}

export const findBook = (project: Project, bookId: string): Book | undefined =>
  project.collections.flatMap((c) => c.books).find((b) => b.id === bookId);

/** Todos los ítems en orden de lectura, con su libro y su profundidad. */
export function flatten(project: Project): { item: ProjectItem; book: Book; depth: number }[] {
  const out: { item: ProjectItem; book: Book; depth: number }[] = [];
  for (const c of project.collections)
    for (const book of c.books) {
      const walk = (items: ProjectItem[], depth: number) =>
        items.forEach((item) => {
          out.push({ item, book, depth });
          walk(item.children ?? [], depth + 1);
        });
      walk(book.items, 0);
    }
  return out;
}

/** Archivos indexados (rutas del proyecto). */
export const indexedFiles = (project: Project): string[] =>
  flatten(project).map((x) => x.item.file);

const clone = <T>(v: T): T => structuredClone(v);

/** Aplica `edit` a una copia del proyecto. */
function change(project: Project, edit: (p: Project) => void): Project {
  const next = clone(project);
  edit(next);
  return next;
}

/** Sustituye la lista de hijos de un ítem (borrando la clave si queda vacía). */
function setChildren(item: ProjectItem, children: ProjectItem[]): void {
  if (children.length) item.children = children;
  else delete item.children;
}

function listOf(p: Project, bookId: string, parentId: string | null): ProjectItem[] | null {
  const book = findBook(p, bookId);
  if (!book) return null;
  if (parentId === null) return book.items;
  const parent = locate(p, parentId)?.item;
  if (!parent) return null;
  parent.children ??= [];
  return parent.children;
}

export interface Target {
  bookId: string;
  /** Ítem bajo el que se anida, o null para la raíz del libro. */
  parentId: string | null;
  index: number;
}

/** ¿Está `maybeChild` dentro del subárbol de `ancestor`? (no se puede anidar dentro de sí mismo) */
export function isInside(project: Project, ancestorId: string, maybeChildId: string): boolean {
  const a = locate(project, ancestorId)?.item;
  if (!a) return false;
  const walk = (items: ProjectItem[]): boolean =>
    items.some((i) => i.id === maybeChildId || walk(i.children ?? []));
  return walk(a.children ?? []);
}

/** Mueve un capítulo (con sus subcapítulos) a otra posición, libro o padre (PRJ-24). */
export function moveItem(project: Project, itemId: string, target: Target): Project {
  if (itemId === target.parentId || (target.parentId && isInside(project, itemId, target.parentId)))
    return project;
  return change(project, (p) => {
    const from = locate(p, itemId);
    if (!from) return;
    const [item] = from.siblings.splice(from.index, 1);
    if (from.parent) setChildren(from.parent, from.siblings);
    const list = listOf(p, target.bookId, target.parentId);
    if (!list || !item) return;
    // `target.index` es la posición de soltado antes de quitar el ítem: en la misma lista, si el
    // ítem estaba antes del destino, el hueco que deja corre el índice.
    const shift = list === from.siblings && from.index < target.index ? 1 : 0;
    const index = Math.min(list.length, Math.max(0, target.index - shift));
    list.splice(index, 0, item);
  });
}

export function addItem(project: Project, item: ProjectItem, target: Target): Project {
  return change(project, (p) => {
    const list = listOf(p, target.bookId, target.parentId);
    list?.splice(Math.min(list.length, target.index), 0, item);
  });
}

export function removeItem(project: Project, itemId: string): Project {
  return change(project, (p) => {
    const at = locate(p, itemId);
    if (!at) return;
    at.siblings.splice(at.index, 1);
    if (at.parent) setChildren(at.parent, at.siblings);
  });
}

/** Cambia campos de un ítem (`title: undefined` lo borra). */
export function updateItem(
  project: Project,
  itemId: string,
  patch: Partial<Pick<ProjectItem, 'title' | 'file'>>,
): Project {
  return change(project, (p) => {
    const at = locate(p, itemId)?.item;
    if (!at) return;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete at[k];
      else at[k] = v;
    }
  });
}

/** Cambia las rutas de todos los ítems cuyo archivo empieza por `from` (mover o renombrar). */
export function renameFiles(project: Project, from: string, to: string): Project {
  return change(project, (p) => {
    for (const { item } of flatten(p)) {
      if (item.file === from) item.file = to;
      else if (item.file.startsWith(`${from}/`)) item.file = `${to}${item.file.slice(from.length)}`;
    }
    for (const c of p.collections)
      for (const b of c.books) {
        if (b.folder === from) b.folder = to;
        else if (b.folder?.startsWith(`${from}/`)) b.folder = `${to}${b.folder.slice(from.length)}`;
      }
  });
}

export function addBook(
  project: Project,
  collectionId: string,
  book: Book,
  index?: number,
): Project {
  return change(project, (p) => {
    const col = p.collections.find((c) => c.id === collectionId);
    col?.books.splice(index ?? col.books.length, 0, book);
  });
}

export function addCollection(project: Project, collection: Collection): Project {
  return change(project, (p) => {
    p.collections.push(collection);
  });
}

export function updateBook(
  project: Project,
  bookId: string,
  patch: Partial<Pick<Book, 'title' | 'icon' | 'folder'>>,
): Project {
  return change(project, (p) => {
    const b = findBook(p, bookId);
    if (!b) return;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete b[k];
      else b[k] = v;
    }
  });
}

export function updateCollection(
  project: Project,
  collectionId: string,
  patch: Partial<Pick<Collection, 'title' | 'icon'>>,
): Project {
  return change(project, (p) => {
    const c = p.collections.find((x) => x.id === collectionId);
    if (!c) return;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete c[k];
      else c[k] = v;
    }
  });
}

export function removeBook(project: Project, bookId: string): Project {
  return change(project, (p) => {
    for (const c of p.collections) c.books = c.books.filter((b) => b.id !== bookId);
  });
}

export function removeCollection(project: Project, collectionId: string): Project {
  return change(project, (p) => {
    p.collections = p.collections.filter((c) => c.id !== collectionId);
  });
}

/** Cambia un campo suelto del proyecto (`undefined` lo borra). */
export function updateProject(project: Project, patch: Partial<Project>): Project {
  return change(project, (p) => {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete p[k];
      else p[k] = v;
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Archivos: nombres, rutas y patrones `ignore`
// ---------------------------------------------------------------------------------------------

/** `a/b/../c` → `a/c`; las rutas de proyecto no suben por encima de la raíz. */
export function joinPath(...parts: string[]): string {
  const out: string[] = [];
  for (const part of parts.join('/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

export const dirnameOf = (p: string): string =>
  p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
export const basenameOf = (p: string): string => p.slice(p.lastIndexOf('/') + 1);

/** Ruta de `to` relativa a la carpeta `fromDir` (ambas del proyecto, con `/`). */
export function relativeTo(fromDir: string, to: string): string {
  const a = fromDir ? fromDir.split('/') : [];
  const b = to.split('/');
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return [...Array<string>(a.length - i).fill('..'), ...b.slice(i)].join('/');
}

/** Nombre de archivo de un capítulo nuevo: slug del título y prefijo numérico opcional (PRJ-26). */
export function chapterFileName(
  title: string,
  taken: Set<string>,
  numbered: boolean,
  position: number,
): string {
  const slug = slugify(title) || 'capitulo';
  const prefix = numbered ? `${String(position).padStart(2, '0')}-` : '';
  let name = `${prefix}${slug}.md`;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${prefix}${slug}-${n}.md`;
  return name;
}

/** Expresión regular de un patrón tipo glob: `**` cruza carpetas, `*` y `?` no. */
export function globToRegExp(pattern: string): RegExp {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        i++;
        if (pattern[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

export function isIgnored(path: string, patterns: string[] | undefined): boolean {
  return (patterns ?? []).some((p) => globToRegExp(p).test(path));
}

/** Archivos `.md` de la carpeta que no están en el índice ni en `ignore` (PRJ-27). */
export function unindexed(project: Project, files: string[]): string[] {
  const known = new Set(indexedFiles(project).map((f) => f.toLowerCase()));
  return files.filter((f) => !known.has(f.toLowerCase()) && !isIgnored(f, project.ignore));
}

/** Título que se muestra de un ítem: el suyo, el primer H1 o el nombre del archivo (05). */
export function itemTitle(item: ProjectItem, h1: string | undefined): string {
  return item.title ?? h1 ?? basenameOf(item.file);
}

/** Primer título de nivel 1 de un Markdown (ignora bloques de código y el bloque de configuración). */
export function firstH1(markdown: string): string | undefined {
  let fenced = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\s{0,3}(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) return m[1]!.trim();
  }
  return undefined;
}
