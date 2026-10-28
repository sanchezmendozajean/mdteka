import i18next from 'i18next';
import { FolderOpen, Library, Trash2, X } from 'lucide-react';
import {
  addBook,
  addCollection,
  addItem,
  allIds,
  basenameOf,
  chapterFileName,
  dirnameOf,
  findBook,
  flatten,
  indexedFiles,
  joinPath,
  locate,
  makeId,
  moveItem,
  importProject,
  parseProject,
  removeBook,
  removeCollection,
  removeItem,
  renameFiles,
  serializeProject,
  slugify,
  unindexed,
  updateBook,
  updateCollection,
  updateItem,
  updateProject,
  type Book,
  type Project,
  type ProjectItem,
  type Target,
} from '@shared/project';
import {
  closeDocument,
  hooks,
  openPaths,
  resolveUnsaved,
  saveDocument,
} from '../documents/actions';
import { useUi } from '../app/store';
import { editor } from '../editor/controller';
import { useFind } from '../editor/find-store';
import { linkHooks } from '../editor/link-hooks';
import {
  askChoose,
  askText,
  askWizard,
  showError,
  useDocs,
  type WizardResult,
} from '../documents/store';
import { absolutePath, inProject, projectRelative, useProject, type SearchState } from './store';

const api = () => window.mdtor;
const t = (key: string, options?: Record<string, unknown>) => i18next.t(key, options);
const store = () => useProject.getState();

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();

export const isProjectOpen = (): boolean => store().project !== null;
export const currentProject = (): Project => {
  const p = store().project;
  if (!p) throw new Error('No hay proyecto abierto');
  return p;
};

// ---------------------------------------------------------------------------------------------
// Abrir, recargar y cerrar
// ---------------------------------------------------------------------------------------------

/** Vuelve a explorar la carpeta y a leer existencia y títulos de los archivos indexados. */
export async function refresh(): Promise<void> {
  const { project, root } = store();
  if (!project || !root) return;
  const [files, info] = await Promise.all([
    api().project.scan(root, project.ignore ?? []),
    api().project.inspect(root, indexedFiles(project)),
  ]);
  // El proyecto pudo cambiar mientras se leía: se descarta una lectura de otro.
  if (store().project?.title !== project.title && store().root !== root) return;
  store().set({ files, info });
}

/** Ids que se despliegan la primera vez que se abre un proyecto: colecciones y libros. */
const defaultExpanded = (p: Project): string[] => [
  ...p.collections.map((c) => c.id),
  ...p.collections.flatMap((c) => c.books.map((b) => b.id)),
];

export async function openProjectFile(path: string, select?: string): Promise<boolean> {
  let loaded;
  try {
    loaded = await api().project.load(path);
  } catch (error) {
    await showError(
      `${t('project.openError', { name: basenameOf(path.replace(/\\/g, '/')) })}\n${String(error)}`,
    );
    return false;
  }
  const parsed = parseProject(loaded.text);
  if (!parsed.ok) {
    await showError(
      t('project.invalid', {
        name: basenameOf(loaded.path.replace(/\\/g, '/')),
        error: parsed.error,
      }),
    );
    return false;
  }
  const previous = store().path;
  if (previous && !same(previous, loaded.path)) void api().file.unwatch(previous);
  const state = await api()
    .project.getState(loaded.path)
    .catch(() => ({ expanded: [], open: [], active: null as string | null }));
  store().set({
    project: parsed.project,
    path: loaded.path,
    root: loaded.root,
    info: {},
    files: [],
    expanded: state.expanded.length ? state.expanded : defaultExpanded(parsed.project),
    filter: '',
    panel: 'tree',
    suggestion: null,
  });
  void api().file.watch(loaded.path);
  void api().lastProject.set(loaded.path);
  await refresh();
  // Pestañas de la última sesión de este proyecto (09: estado de sesión en userData).
  const known = new Set(Object.keys(store().info).filter((f) => store().info[f]?.exists));
  const reopen = state.open.filter((f) => known.has(f));
  if (reopen.length) await openPaths(reopen.map((f) => absolutePath(f)));
  const target = select ?? state.active;
  if (target && known.has(target)) await openPaths([absolutePath(target)]);
  return true;
}

export async function openProjectDialog(): Promise<void> {
  const path = await api().project.openDialog();
  if (path) await openProjectFile(path);
}

/** Cierra el modo proyecto: los documentos abiertos se quedan como archivos sueltos (PRJ-32). */
export function closeProject(): void {
  const { path } = store();
  if (path) void api().file.unwatch(path);
  void api().lastProject.set(null);
  store().set({
    project: null,
    path: null,
    root: null,
    info: {},
    files: [],
    filter: '',
    panel: 'tree',
    suggestion: null,
  });
}

/** El `.mdtor` cambió fuera de MDTor: se vuelve a leer (el proyecto no tiene cambios sin guardar). */
export async function reloadProject(): Promise<void> {
  const { path } = store();
  if (!path) return;
  try {
    const loaded = await api().project.load(path);
    const parsed = parseProject(loaded.text);
    if (!parsed.ok) {
      await showError(
        t('project.invalid', { name: basenameOf(path.replace(/\\/g, '/')), error: parsed.error }),
      );
      return;
    }
    if (serializeProject(parsed.project) === serializeProject(currentProject())) return;
    store().set({ project: parsed.project });
    await refresh();
  } catch {
    /* el archivo desapareció: se conserva lo que hay en memoria */
  }
}

// ---------------------------------------------------------------------------------------------
// Guardar el índice (cada cambio se escribe al instante: el proyecto no tiene «sin guardar»)
// ---------------------------------------------------------------------------------------------

export async function commit(next: Project): Promise<boolean> {
  const { path, project } = store();
  if (!path || !project) return false;
  const text = serializeProject(next);
  if (text === serializeProject(project)) return true;
  store().set({ project: next });
  try {
    await api().project.save(path, text);
  } catch (error) {
    store().set({ project });
    await showError(`${t('project.saveError')}\n${String(error)}`);
    return false;
  }
  await refresh();
  return true;
}

// ---------------------------------------------------------------------------------------------
// Capítulos, libros y colecciones
// ---------------------------------------------------------------------------------------------

export const absoluteOf = (item: ProjectItem): string => absolutePath(item.file);

const expand = (...ids: string[]) =>
  store().set({ expanded: [...new Set([...store().expanded, ...ids])] });

/** Capítulo nuevo al final de un libro (o como subcapítulo) con su archivo (PRJ-25, PRJ-26). */
export async function newChapter(bookId: string, parentId: string | null = null): Promise<void> {
  const project = currentProject();
  const book = findBook(project, bookId);
  if (!book) return;
  const title = await askText(
    t(parentId ? 'project.newSubchapter' : 'project.newChapter'),
    t('project.chapterTitle'),
    '',
    t('project.create'),
  );
  if (!title?.trim()) return;
  const folder = book.folder ?? '';
  const taken = new Set(
    store()
      .files.filter((f) => dirnameOf(f) === folder)
      .map((f) => basenameOf(f).toLowerCase()),
  );
  const position =
    (parentId ? (locate(project, parentId)?.item.children?.length ?? 0) : book.items.length) + 1;
  const name = chapterFileName(title.trim(), taken, !!project.naming?.numbered, position);
  const file = joinPath(folder, name);
  try {
    await api().project.createFile(absolutePath(file), `# ${title.trim()}\n`);
  } catch (error) {
    await showError(`${t('project.createError')}\n${String(error)}`);
    return;
  }
  const list = parentId ? (locate(project, parentId)?.item.children ?? []) : book.items;
  const item: ProjectItem = { id: makeId(title, allIds(project)), file };
  await commit(addItem(project, item, { bookId, parentId, index: list.length }));
  expand(bookId, ...(parentId ? [parentId] : []));
  await openPaths([absolutePath(file)]);
}

/** Pide una colección (si hay varias) y crea un libro nuevo con carpeta propia (PRJ-10). */
export async function newBook(collectionId?: string): Promise<void> {
  let project = currentProject();
  const title = await askText(
    t('project.newBook'),
    t('project.bookTitle'),
    '',
    t('project.create'),
  );
  if (!title?.trim()) return;
  let col = project.collections.find((c) => c.id === collectionId) ?? project.collections[0];
  if (!col) {
    const created = {
      id: makeId('general', allIds(project)),
      title: t('project.defaultCollection'),
      books: [],
    };
    project = addCollection(project, created);
    col = created;
  }
  const book: Book = {
    id: makeId(title, allIds(project)),
    title: title.trim(),
    icon: 'book-open',
    folder: slugify(title) || 'libro',
    items: [],
  };
  if (await commit(addBook(project, col.id, book))) expand(col.id, book.id);
}

export async function newCollection(): Promise<void> {
  const project = currentProject();
  const title = await askText(
    t('project.newCollection'),
    t('project.collectionTitle'),
    '',
    t('project.create'),
  );
  if (!title?.trim()) return;
  const col = { id: makeId(title, allIds(project)), title: title.trim(), books: [] };
  if (await commit(addCollection(project, col))) expand(col.id);
}

export async function renameNode(kind: 'collection' | 'book' | 'item', id: string): Promise<void> {
  const project = currentProject();
  if (kind === 'collection') {
    const c = project.collections.find((x) => x.id === id);
    const title = c && (await askText(t('project.rename'), t('project.collectionTitle'), c.title));
    if (title?.trim()) await commit(updateCollection(project, id, { title: title.trim() }));
  } else if (kind === 'book') {
    const b = findBook(project, id);
    const title = b && (await askText(t('project.rename'), t('project.bookTitle'), b.title));
    if (title?.trim()) await commit(updateBook(project, id, { title: title.trim() }));
  } else {
    const at = locate(project, id);
    if (!at) return;
    const shown = at.item.title ?? store().info[at.item.file]?.h1 ?? '';
    const title = await askText(t('project.renameTitle'), t('project.chapterTitle'), shown);
    // Vacío: el título vuelve a ser el primer H1 del archivo (05).
    if (title !== null) await commit(updateItem(project, id, { title: title.trim() || undefined }));
  }
}

export async function setIcon(
  kind: 'collection' | 'book',
  id: string,
  icon: string,
): Promise<void> {
  const project = currentProject();
  await commit(
    kind === 'book' ? updateBook(project, id, { icon }) : updateCollection(project, id, { icon }),
  );
}

/** Quita del índice (los archivos quedan en disco y pasan a «Sin indexar»). */
export async function removeNode(kind: 'collection' | 'book' | 'item', id: string): Promise<void> {
  const project = currentProject();
  if (kind === 'item') return void (await commit(removeItem(project, id)));
  const count =
    kind === 'book'
      ? (findBook(project, id)?.items.length ?? 0)
      : (project.collections.find((c) => c.id === id)?.books.length ?? 0);
  if (count > 0) {
    const answer = await askChoose(
      t('project.removeFromIndex'),
      [{ id: 'yes', label: t('project.removeFromIndex'), icon: X, danger: true }],
      t(kind === 'book' ? 'project.removeBookBody' : 'project.removeCollectionBody'),
    );
    if (answer !== 'yes') return;
  }
  await commit(kind === 'book' ? removeBook(project, id) : removeCollection(project, id));
}

/** «Remover»: manda a la papelera todos los archivos del libro o la colección y los quita del índice. */
export async function deleteNodeFromDisk(kind: 'collection' | 'book', id: string): Promise<void> {
  const project = currentProject();
  const books =
    kind === 'book'
      ? [findBook(project, id)].filter((b): b is Book => !!b)
      : (project.collections.find((c) => c.id === id)?.books ?? []);
  const ids = new Set(books.map((b) => b.id));
  const files = [
    ...new Set(
      flatten(project)
        .filter((x) => ids.has(x.book.id))
        .map((x) => x.item.file),
    ),
  ];
  const title =
    kind === 'book'
      ? (books[0]?.title ?? '')
      : (project.collections.find((c) => c.id === id)?.title ?? '');
  const answer = await askChoose(
    t('project.removeFromDisk'),
    [{ id: 'delete', label: t('project.removeFromDisk'), icon: Trash2, danger: true }],
    t(kind === 'book' ? 'project.removeFromDiskBook' : 'project.removeFromDiskCollection', {
      name: title,
      count: files.length,
    }),
  );
  if (answer !== 'delete') return;
  for (const file of files) {
    const abs = absolutePath(file);
    const open = openDocFor(abs);
    if (open) await closeDocument(open.id, true);
    try {
      await api().project.trash(abs);
    } catch (error) {
      await showError(`${t('project.deleteError')}\n${String(error)}`);
      return;
    }
  }
  await commit(kind === 'book' ? removeBook(project, id) : removeCollection(project, id));
}

// ---------------------------------------------------------------------------------------------
// Archivos de los capítulos: mover, renombrar, duplicar, eliminar
// ---------------------------------------------------------------------------------------------

/** Documento abierto en una pestaña para una ruta absoluta. */
const openDocFor = (abs: string) => useDocs.getState().docs.find((d) => same(d.path, abs));

/**
 * Mueve un archivo del proyecto. Si está abierto con cambios, se guarda primero (se pregunta);
 * después la pestaña se reabre en la ruta nueva. Las imágenes viajan con el documento (IMG-20).
 */
export async function moveFile(fromRel: string, toRel: string): Promise<boolean> {
  const from = absolutePath(fromRel);
  const to = absolutePath(toRel);
  const open = openDocFor(from);
  if (open && !(await resolveUnsaved(open.id))) return false;
  try {
    await api().project.move(from, to);
  } catch (error) {
    await showError(`${t('project.moveError')}\n${String(error)}`);
    return false;
  }
  if (open) {
    const wasActive = useDocs.getState().activeId === open.id;
    await closeDocument(open.id, true);
    await openPaths([to]);
    if (!wasActive) void 0;
  }
  return true;
}

/** Archivos (con sus subcapítulos) de un capítulo, como pares de ruta actual → ruta en `folder`. */
function relocations(item: ProjectItem, folder: string): [string, string][] {
  const out: [string, string][] = [];
  const walk = (i: ProjectItem) => {
    out.push([i.file, joinPath(folder, basenameOf(i.file))]);
    (i.children ?? []).forEach(walk);
  };
  walk(item);
  return out;
}

/**
 * Reordena, mueve entre libros o anida un capítulo (PRJ-24). Al cambiar de libro pregunta si el
 * archivo debe ir también a la carpeta del libro destino.
 */
export async function moveChapter(itemId: string, target: Target): Promise<void> {
  let project = currentProject();
  const at = locate(project, itemId);
  const dest = findBook(project, target.bookId);
  if (!at || !dest) return;
  const next = moveItem(project, itemId, target);
  if (next === project) return;
  let moves: [string, string][] = [];
  if (at.book.id !== dest.id && dest.folder) {
    const wanted = relocations(at.item, dest.folder).filter(([a, b]) => a !== b);
    if (wanted.length) {
      const answer = await askChoose(
        t('project.moveFileTitle'),
        [
          {
            id: 'move',
            label: t('project.moveFileYes', { folder: dest.folder }),
            icon: FolderOpen,
          },
          { id: 'keep', label: t('project.moveFileNo'), icon: Library },
        ],
        t('project.moveFileBody', {
          title: at.item.title ?? store().info[at.item.file]?.h1 ?? basenameOf(at.item.file),
          book: dest.title,
        }),
      );
      if (!answer) return;
      if (answer === 'move') moves = wanted;
    }
  }
  project = next;
  for (const [from, to] of moves) {
    if (await moveFile(from, to)) project = renameFiles(project, from, to);
    else return;
  }
  await commit(project);
}

export async function renameFile(itemId: string): Promise<void> {
  const project = currentProject();
  const at = locate(project, itemId);
  if (!at) return;
  const current = basenameOf(at.item.file);
  const answer = await askText(t('project.renameFile'), t('project.fileName'), current);
  if (!answer || answer === current) return;
  let name = answer.trim().replace(/[\\/:*?"<>|]/g, '');
  if (!/\.(md|markdown|mdown)$/i.test(name)) name += '.md';
  if (!name || name === current) return;
  const to = joinPath(dirnameOf(at.item.file), name);
  if (await moveFile(at.item.file, to)) await commit(renameFiles(project, at.item.file, to));
}

export async function duplicateChapter(itemId: string): Promise<void> {
  const project = currentProject();
  const at = locate(project, itemId);
  if (!at) return;
  const folder = dirnameOf(at.item.file);
  const taken = new Set(
    store()
      .files.filter((f) => dirnameOf(f) === folder)
      .map((f) => basenameOf(f).toLowerCase()),
  );
  const base = basenameOf(at.item.file).replace(/\.[^.]+$/, '');
  let name = `${base}-${t('project.copySuffix')}.md`;
  for (let n = 2; taken.has(name.toLowerCase()); n++)
    name = `${base}-${t('project.copySuffix')}-${n}.md`;
  const file = joinPath(folder, name);
  try {
    await api().project.duplicate(absolutePath(at.item.file), absolutePath(file));
  } catch (error) {
    await showError(`${t('project.createError')}\n${String(error)}`);
    return;
  }
  const shown = at.item.title ?? store().info[at.item.file]?.h1 ?? base;
  const copy: ProjectItem = {
    id: makeId(shown, allIds(project)),
    title: `${shown} (${t('project.copySuffix')})`,
    file,
  };
  await commit(
    addItem(project, copy, {
      bookId: at.book.id,
      parentId: at.parent?.id ?? null,
      index: at.index + 1,
    }),
  );
}

/** Elimina el archivo (a la papelera del sistema) y lo quita del índice. */
export async function deleteChapterFile(itemId: string): Promise<void> {
  const project = currentProject();
  const at = locate(project, itemId);
  if (!at) return;
  const answer = await askChoose(
    t('project.deleteTitle'),
    [{ id: 'delete', label: t('project.deleteFile'), icon: Trash2, danger: true }],
    t('project.deleteBody', { name: basenameOf(at.item.file) }),
  );
  if (answer !== 'delete') return;
  const abs = absolutePath(at.item.file);
  const open = openDocFor(abs);
  if (open) await closeDocument(open.id, true);
  try {
    await api().project.trash(abs);
  } catch (error) {
    await showError(`${t('project.deleteError')}\n${String(error)}`);
    return;
  }
  await commit(removeItem(project, itemId));
}

/** Abre el explorador en el proyecto (su archivo `.mdtor`) o, en edición individual, en el documento. */
export function revealCurrent(): void {
  const path =
    store().path ?? useDocs.getState().docs.find((d) => d.id === useDocs.getState().activeId)?.path;
  if (path) void api().project.reveal(path);
}

export const revealFile = (file: string) => void api().project.reveal(absolutePath(file));
export const copyRelativePath = (file: string) => void api().clipboard.writeText(file);

/** «Localizar…» un archivo faltante: se elige uno y se actualiza la ruta del ítem (PRJ-28). */
export async function locateMissing(itemId: string): Promise<void> {
  const project = currentProject();
  const picked = await api().file.openDialog();
  const rel = picked[0] && projectRelative(picked[0]);
  if (!rel) {
    if (picked[0]) await showError(t('project.outsideRoot'));
    return;
  }
  await commit(updateItem(project, itemId, { file: rel }));
}

// ---------------------------------------------------------------------------------------------
// «Sin indexar» (PRJ-27)
// ---------------------------------------------------------------------------------------------

export const unindexedFiles = (): string[] => {
  const { project, files } = store();
  return project ? unindexed(project, files) : [];
};

export async function addToBook(file: string, bookId: string): Promise<void> {
  const project = currentProject();
  const book = findBook(project, bookId);
  if (!book) return;
  const item: ProjectItem = {
    id: makeId(basenameOf(file).replace(/\.md$/i, ''), allIds(project)),
    file,
  };
  await commit(addItem(project, item, { bookId, parentId: null, index: book.items.length }));
  expand(bookId);
}

/** Pregunta a qué libro se añade un archivo sin indexar (o lo crea si no hay ninguno). */
export async function addUnindexed(file: string): Promise<void> {
  const project = currentProject();
  const books = project.collections.flatMap((c) => c.books);
  if (books.length === 0) {
    await newBook();
    const first = currentProject().collections.flatMap((c) => c.books)[0];
    if (first) await addToBook(file, first.id);
    return;
  }
  const answer = await askChoose(
    t('project.addToBook'),
    books.map((b) => ({ id: b.id, label: b.title, hint: b.folder })),
    t('project.addToBookBody', { name: basenameOf(file) }),
  );
  if (answer) await addToBook(file, answer);
}

// ---------------------------------------------------------------------------------------------
// Buscar en el proyecto
// ---------------------------------------------------------------------------------------------

let searchSeq = 0;

export async function runSearch(patch: Partial<SearchState> = {}): Promise<void> {
  const { root } = store();
  const search = { ...store().search, ...patch };
  store().set({ search: { ...search, done: false } });
  if (!root || !search.query) {
    store().set({ search: { ...search, results: [], done: false } });
    return;
  }
  const seq = ++searchSeq;
  const results = await api().project.search({
    root,
    files: store().files,
    query: search.query,
    caseSensitive: search.caseSensitive,
    wholeWord: search.wholeWord,
    regex: search.regex,
  });
  if (seq === searchSeq) store().set({ search: { ...search, results, done: true } });
}

/** Abre el archivo de una coincidencia y deja la búsqueda del documento en esa coincidencia. */
export async function openHit(hit: SearchState['results'][number]): Promise<void> {
  const { search } = store();
  await openPaths([absolutePath(hit.file)]);
  const opts = {
    query: search.query,
    caseSensitive: search.caseSensitive,
    wholeWord: search.wholeWord,
    regex: search.regex,
  };
  useFind.getState().set({ open: true, opts });
  let info = editor.find(opts);
  for (let i = 0; i <= hit.n && info.count > 0; i++) info = editor.findStep(opts, 1);
  useFind.getState().set({ info });
}

export function showSearch(): void {
  store().set({ panel: 'search' });
  useUi.getState().set({ navigatorOpen: true });
  setTimeout(
    () => document.querySelector<HTMLInputElement>('[data-testid="project-search-input"]')?.focus(),
    30,
  );
}

// ---------------------------------------------------------------------------------------------
// Imágenes sin usar de un documento (IMG-20)
// ---------------------------------------------------------------------------------------------

export async function cleanOrphanImages(): Promise<void> {
  const doc = useDocs.getState().docs.find((d) => d.id === useDocs.getState().activeId);
  if (!doc?.path) return;
  await saveDocument(doc.id);
  const orphans = await api().project.orphans(doc.path);
  if (orphans.length === 0) {
    await showError(t('project.orphansNone'));
    return;
  }
  const names = orphans.map((p) => basenameOf(p.replace(/\\/g, '/')));
  const answer = await askChoose(
    t('project.orphansTitle'),
    [{ id: 'trash', label: t('project.orphansTrash'), icon: Trash2, danger: true }],
    `${t('project.orphansBody', { name: doc.name })}\n${names.join('\n')}`,
  );
  if (answer !== 'trash') return;
  try {
    for (const p of orphans) await api().project.trash(p);
  } catch (error) {
    await showError(`${t('project.deleteError')}\n${String(error)}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Ajustes del proyecto
// ---------------------------------------------------------------------------------------------

export async function updateSettings(patch: Partial<Project>): Promise<void> {
  await commit(updateProject(currentProject(), patch));
}

// ---------------------------------------------------------------------------------------------
// Crear un proyecto (asistente) y pasar de archivo a proyecto (PRJ-32)
// ---------------------------------------------------------------------------------------------

/** Crea el `.mdtor` en una carpeta y lo abre. Devuelve false si se cancela o falla. */
export async function createProject(result: WizardResult): Promise<boolean> {
  const name = `${slugify(result.title) || 'proyecto'}.mdtor`;
  const path = absolutePath(name, result.folder);
  let files: string[] = [];
  try {
    await api().project.grantFolder(result.folder);
    if (result.importExisting) files = await api().project.scan(result.folder, []);
    const project = importProject(result.title, files, t('project.defaultCollection'));
    await api().project.createFile(path, serializeProject(project));
  } catch (error) {
    await showError(`${t('project.createError')}\n${String(error)}`);
    return false;
  }
  return openProjectFile(path);
}

export async function newProjectWizard(docPath: string | null = null): Promise<boolean> {
  const folder = docPath ? docPath.replace(/[\\/][^\\/]*$/, '') : null;
  const answer = await askWizard({
    title: folder ? basenameOf(folder.replace(/\\/g, '/')) : '',
    folder,
    importExisting: true,
  });
  return answer ? createProject(answer) : false;
}

/**
 * «Abrir como proyecto»: busca un `.mdtor` junto al documento o en carpetas superiores y lo abre;
 * si no hay, ofrece crear uno aquí (PRJ-32).
 */
export async function openAsProject(): Promise<void> {
  const doc = useDocs.getState().docs.find((d) => d.id === useDocs.getState().activeId);
  if (!doc?.path) {
    await newProjectWizard(null);
    return;
  }
  const found = await api().project.find(doc.path);
  if (found.length === 0) {
    await newProjectWizard(doc.path);
    return;
  }
  let path = found[0]!;
  if (found.length > 1) {
    const picked = await askChoose(
      t('project.chooseTitle'),
      found.map((p) => ({ id: p, label: basenameOf(p.replace(/\\/g, '/')), hint: p })),
      t('project.chooseBody'),
    );
    if (!picked) return;
    path = picked;
  }
  await openProjectFile(path, undefined);
  const rel = projectRelative(doc.path);
  if (rel) store().set({ expanded: [...new Set([...store().expanded, ...containersOf(rel)])] });
}

/** Ids de los contenedores (colección, libro, capítulos padre) de un archivo indexado. */
function containersOf(rel: string): string[] {
  const project = store().project;
  if (!project) return [];
  const hit = flatten(project).find((x) => x.item.file.toLowerCase() === rel.toLowerCase());
  if (!hit) return [];
  const at = locate(project, hit.item.id);
  const ids: string[] = [];
  for (let p = at?.parent; p; p = locate(project, p.id)?.parent ?? null) ids.push(p.id);
  return [hit.book.id, at?.collection.id ?? '', ...ids].filter(Boolean);
}

/** Vuelve al modo archivo: el documento actual queda como archivo suelto. */
export const editOnlyThisFile = (): void => closeProject();

// ---------------------------------------------------------------------------------------------
// Aviso «Este archivo forma parte de…» (PRJ-33) y sesión
// ---------------------------------------------------------------------------------------------

/** Si el documento recién abierto pertenece a un proyecto distinto del abierto, se sugiere abrirlo. */
export async function suggestProjectFor(docPath: string): Promise<void> {
  if (inProject(docPath)) return;
  try {
    const found = await api().project.find(docPath);
    const projectPath = found[0];
    if (!projectPath || same(projectPath, store().path)) return;
    const parsed = parseProject(await api().file.read(projectPath));
    store().set({
      suggestion: {
        docPath,
        projectPath,
        title: parsed.ok ? parsed.project.title : basenameOf(projectPath.replace(/\\/g, '/')),
      },
    });
  } catch {
    /* sin proyecto o ilegible: no se sugiere nada */
  }
}

export async function acceptSuggestion(): Promise<void> {
  const s = store().suggestion;
  if (!s) return;
  store().set({ suggestion: null });
  await openProjectFile(s.projectPath);
  const rel = projectRelative(s.docPath);
  if (rel) store().set({ expanded: [...new Set([...store().expanded, ...containersOf(rel)])] });
}

export const dismissSuggestion = () => store().set({ suggestion: null });

/** Guarda en `userData` los nodos desplegados y las pestañas del proyecto (no va al `.mdtor`, PRJ-04). */
let timer: ReturnType<typeof setTimeout> | undefined;
function persistSession(): void {
  const { path, expanded } = store();
  if (!path) return;
  const { docs, activeId } = useDocs.getState();
  const open = docs
    .flatMap((d) => (d.path && !d.hidden ? [projectRelative(d.path)] : []))
    .filter((x): x is string => !!x);
  const active = docs.find((d) => d.id === activeId)?.path;
  void api().project.setState({
    path,
    expanded,
    open,
    active: (active && projectRelative(active)) || null,
  });
}

/** Enlace relativo a un `.md` de la carpeta del proyecto: se abre en una pestaña (PRJ-29). */
function openProjectLink(href: string): boolean {
  if (!store().project || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href) || href.startsWith('#'))
    return false;
  const doc = useDocs.getState().docs.find((d) => d.id === useDocs.getState().activeId);
  const rel = doc?.path ? projectRelative(doc.path) : null;
  if (rel === null) return false;
  let target = href.split(/[?#]/)[0] ?? '';
  try {
    target = decodeURI(target);
  } catch {
    /* enlace mal codificado: se usa tal cual */
  }
  if (!/\.(md|markdown|mdown)$/i.test(target)) return false;
  const file = joinPath(dirnameOf(rel), target);
  if (!file) return false;
  void openPaths([absolutePath(file)]);
  return true;
}

export function wireProject(): () => void {
  hooks.openProject = (path) => void openProjectFile(path);
  hooks.projectFileChanged = (path) => {
    if (!same(path, store().path)) return false;
    void reloadProject();
    return true;
  };
  hooks.documentOpened = (path) => void suggestProjectFor(path);
  linkHooks.open = openProjectLink;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(persistSession, 400);
  };
  const offA = useProject.subscribe((s, prev) => {
    if (s.expanded !== prev.expanded || s.path !== prev.path) schedule();
  });
  const offB = useDocs.subscribe((s, prev) => {
    if (s.activeId !== prev.activeId || s.docs.length !== prev.docs.length) schedule();
  });
  return () => {
    offA();
    offB();
    clearTimeout(timer);
  };
}

/** Libro del documento activo (o el primero): destino del «Nuevo capítulo» de la cinta. */
export function activeBookId(): string | undefined {
  const project = store().project;
  if (!project) return undefined;
  const { docs, activeId } = useDocs.getState();
  const path = docs.find((d) => d.id === activeId)?.path;
  const rel = path ? projectRelative(path) : null;
  const hit = rel
    ? flatten(project).find((x) => x.item.file.toLowerCase() === rel.toLowerCase())
    : undefined;
  return hit?.book.id ?? project.collections.flatMap((c) => c.books)[0]?.id;
}
