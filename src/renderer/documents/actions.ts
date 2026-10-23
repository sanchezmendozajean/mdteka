import i18next from 'i18next';
import { editor, type DocRuntime } from '../editor/controller';
import { emptyDoc } from '../editor/model/doc';
import { applyFormat, detectFormat, splitConfigBlock, type Eol } from '../editor/model/text-format';
import { createWysiwygState } from '../editor/wysiwyg/view';
import { joinConfig } from '@shared/document-config';
import { loadSettings, viewFields } from './config';
import { setZoom } from './view';
import {
  askExternal,
  askUnsaved,
  configFields,
  showCompare,
  showError,
  useDocs,
  type DocInfo,
} from './store';

const api = () => window.mdteca;
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;

/** Enganches que rellena el módulo de proyectos (evita la dependencia circular). */
export const hooks: {
  openProject?: (path: string) => void;
  /** Devuelve true si la ruta era el `.mdteca` abierto (el cambio ya está atendido). */
  projectFileChanged?: (path: string) => boolean;
  documentOpened?: (path: string) => void;
} = {};

let untitledCounter = 0;

function register(info: Omit<DocInfo, 'id'>, source: string, createState?: boolean): string {
  const id = crypto.randomUUID();
  const rt: DocRuntime = {
    id,
    source,
    savedSource: source,
    pmState: null,
    pmSource: null,
    cmState: null,
    cmSource: null,
    mode: info.mode,
    scrollRatio: 0,
    stale: false,
  };
  if (createState) {
    rt.pmState = createWysiwygState(emptyDoc());
    rt.pmSource = source;
  }
  editor.register(rt);
  useDocs.getState().add({ ...info, id });
  editor.activate(id);
  return id;
}

/** Documento temporal sin pestaña, solo para exportarlo (PDF de un proyecto). */
export function registerHidden(path: string, name: string, source: string): string {
  const id = crypto.randomUUID();
  editor.register({
    id,
    source,
    savedSource: source,
    pmState: null,
    pmSource: null,
    cmState: null,
    cmSource: null,
    mode: 'wysiwyg',
    scrollRatio: 0,
    stale: false,
  });
  useDocs.getState().add({
    id,
    hidden: true,
    path,
    name,
    dirty: false,
    mode: 'wysiwyg',
    ...viewFields('', path),
    eol: '\n',
    bom: false,
    ...configFields(''),
    savedConfigRaw: '',
    words: 0,
    externalChange: false,
  });
  return id;
}

export function discardHidden(id: string): void {
  editor.discard(id);
  useDocs.getState().remove(id);
}

export function newDocument(): string {
  untitledCounter += 1;
  const suffix = untitledCounter > 1 ? ` ${untitledCounter}` : '';
  return register(
    {
      path: null,
      name: `${i18next.t('doc.untitled')}${suffix}.md`,
      dirty: false,
      mode: 'wysiwyg',
      ...viewFields(''),
      eol: '\n',
      bom: false,
      ...configFields(''),
      savedConfigRaw: '',
      words: 0,
      externalChange: false,
    },
    '\n',
    true,
  );
}

function parseRaw(raw: string): { body: string; configRaw: string; eol: Eol; bom: boolean } {
  const fmt = detectFormat(raw);
  const { body, configRaw } = splitConfigBlock(fmt.text);
  return { body, configRaw, eol: fmt.eol, bom: fmt.bom };
}

export async function openPaths(paths: string[]): Promise<void> {
  for (const path of paths) {
    if (/.mdteca$/i.test(path)) {
      hooks.openProject?.(path);
      continue;
    }
    const existing = useDocs
      .getState()
      .docs.find((d) => d.path?.toLowerCase() === path.toLowerCase());
    if (existing) {
      editor.activate(existing.id);
      continue;
    }
    try {
      const raw = await api().file.read(path);
      const { body, configRaw, eol, bom } = parseRaw(raw);
      const id = register(
        {
          path,
          name: baseName(path),
          dirty: false,
          mode: 'wysiwyg',
          ...viewFields(configRaw, path),
          eol,
          bom,
          ...configFields(configRaw),
          savedConfigRaw: configRaw,
          words: 0,
          externalChange: false,
        },
        body,
      );
      void api().file.watch(path);
      // VW-31: el zoom de la última vez que se abrió este archivo.
      const { zoom } = await api()
        .state.getView(path)
        .catch(() => ({ zoom: null }));
      if (zoom) setZoom(id, zoom);
      hooks.documentOpened?.(path);
    } catch (error) {
      await showError(`${i18next.t('doc.openError', { name: baseName(path) })}\n${String(error)}`);
    }
  }
}

export async function openFileDialog(): Promise<void> {
  const paths = await api().file.openDialog();
  if (paths.length) await openPaths(paths);
}

/** Guarda el documento. Un archivo sin cambios no se toca (GIT-01). Devuelve false si se cancela o falla. */
export async function saveDocument(id: string, saveAs = false): Promise<boolean> {
  const info = useDocs.getState().docs.find((d) => d.id === id);
  const rt = editor.runtime(id);
  if (!info || !rt) return false;
  const source = editor.sourceOf(id);
  const configChanged = info.configRaw !== info.savedConfigRaw;
  if (!saveAs && info.path && source === rt.savedSource && !configChanged) return true;

  let path = info.path;
  if (!path || saveAs) {
    path = await api().file.saveDialog(info.name);
    if (!path) return false;
  }
  try {
    const content = applyFormat(
      joinConfig(source, info.configRaw, info.savedConfigRaw !== ''),
      info.eol,
      info.bom,
    );
    await api().file.write(path, content);
  } catch (error) {
    await showError(`${i18next.t('doc.saveError', { name: info.name })}\n${String(error)}`);
    return false;
  }
  rt.savedSource = source;
  if (path !== info.path) {
    if (info.path) void api().file.unwatch(info.path);
    void api().file.watch(path);
  }
  useDocs.getState().update(id, {
    path,
    name: baseName(path),
    dirty: false,
    savedConfigRaw: info.configRaw,
    externalChange: false,
  });
  return true;
}

/** Pide confirmación si hay cambios. Devuelve true si el documento puede cerrarse. */
export async function resolveUnsaved(id: string): Promise<boolean> {
  editor.flush();
  const info = useDocs.getState().docs.find((d) => d.id === id);
  if (!info || !info.dirty) return true;
  const answer = await askUnsaved(info.name);
  if (answer === 'cancel') return false;
  if (answer === 'save') return saveDocument(id);
  return true;
}

/** Cierra una pestaña. Con `force` no pregunta por cambios (la acción ya los resolvió o los descarta). */
export async function closeDocument(id: string, force = false): Promise<boolean> {
  if (!force && !(await resolveUnsaved(id))) return false;
  const { docs, activeId } = useDocs.getState();
  const index = docs.findIndex((d) => d.id === id);
  const info = docs[index];
  if (info?.path) void api().file.unwatch(info.path);
  editor.discard(id);
  useDocs.getState().remove(id);
  if (activeId === id) {
    const rest = useDocs.getState().docs;
    editor.activate(rest[Math.min(index, rest.length - 1)]?.id ?? null);
  }
  return true;
}

/** Cierre de la ventana: recorre los documentos con cambios y pregunta por cada uno. */
export async function closeWindow(): Promise<void> {
  editor.flush();
  for (const doc of useDocs.getState().docs.filter((d) => d.dirty)) {
    if (!(await resolveUnsaved(doc.id))) return;
  }
  await api().app.closeNow();
}

// ---------------------------------------------------------------------------------------------
// Cambios externos (02 · Guardado)
// ---------------------------------------------------------------------------------------------

function applyExternal(id: string, raw: string): void {
  const rt = editor.runtime(id);
  if (!rt) return;
  const { body, configRaw, eol, bom } = parseRaw(raw);
  rt.source = body;
  rt.savedSource = body;
  useDocs.getState().update(id, {
    dirty: false,
    ...configFields(configRaw),
    savedConfigRaw: configRaw,
    eol,
    bom,
    externalChange: false,
  });
  editor.invalidate(id);
}

export async function handleExternalChange(path: string): Promise<void> {
  if (hooks.projectFileChanged?.(path)) return;
  const info = useDocs.getState().docs.find((d) => d.path?.toLowerCase() === path.toLowerCase());
  const rt = info && editor.runtime(info.id);
  if (!info || !rt) return;
  let raw: string;
  try {
    raw = await api().file.read(path);
  } catch {
    return; // eliminado o ilegible: se conserva lo que hay en memoria
  }
  const { body, configRaw } = parseRaw(raw);
  editor.flush();
  if (body === rt.savedSource && configRaw === info.savedConfigRaw) return;
  if (!info.dirty) {
    applyExternal(info.id, raw);
    return;
  }
  for (;;) {
    const answer = await askExternal(info.name);
    if (answer === 'reload') {
      applyExternal(info.id, raw);
      return;
    }
    if (answer === 'keep') {
      useDocs.getState().update(info.id, { externalChange: true });
      return;
    }
    await showCompare(info.name, editor.sourceOf(info.id), body);
  }
}

export function wireApp(): () => void {
  const off = [
    api().on('file:changed', (p) => void handleExternalChange((p as { path: string }).path)),
    api().on('app:openPaths', (p) => void openPaths(p as string[])),
    api().on('app:beforeClose', () => void closeWindow()),
  ];
  // Los ajustes se cargan antes de abrir nada para que el primer pintado ya lleve la tipografía final.
  void loadSettings()
    .catch(() => undefined)
    .then(() => api().app.launchPaths())
    .then((paths) => openPaths(paths));
  return () => off.forEach((f) => f());
}
