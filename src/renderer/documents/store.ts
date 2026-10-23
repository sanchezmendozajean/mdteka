import type { LucideIcon } from 'lucide-react';
import type { SettingsSection } from '../ui/SettingsDialog';
import { create } from 'zustand';
import { readConfigBlock, type ReadConfig } from '@shared/document-config';
import type { Eol } from '../editor/model/text-format';
import { emptyFormatState, type FormatState, type LinkInput } from '../editor/wysiwyg/commands';

export type Mode = 'wysiwyg' | 'source';
export type ViewKind = 'pages' | 'continuous';

/** Metadatos reactivos de un documento abierto (el texto vive en el runtime del controlador). */
export interface DocInfo {
  id: string;
  /** Documento temporal (exportación de un proyecto): no tiene pestaña ni se recuerda. */
  hidden?: boolean;
  path: string | null;
  name: string;
  dirty: boolean;
  mode: Mode;
  /** Vista de páginas o continua (07). No se escribe en el archivo salvo con «predeterminada». */
  view: ViewKind;
  /** Zoom de la vista (VW-30): 0,5–3. */
  zoom: number;
  /** Ancho de la columna en la vista continua (px). */
  columnWidth: number;
  eol: Eol;
  bom: boolean;
  /** Bloque `<!-- mdteca:config … -->` literal, apartado del cuerpo (04). */
  configRaw: string;
  /** Bloque tal como está en el archivo en disco (para saber si la configuración cambió). */
  savedConfigRaw: string;
  /** Lectura validada de `configRaw` (DOC-03). */
  config: ReadConfig;
  words: number;
  /** El archivo cambió en disco y hay cambios locales sin resolver. */
  externalChange: boolean;
}

interface DocsState {
  docs: DocInfo[];
  activeId: string | null;
  format: FormatState;
  add: (doc: DocInfo) => void;
  update: (id: string, patch: Partial<DocInfo>) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
  setFormat: (format: FormatState) => void;
}

export const useDocs = create<DocsState>((set) => ({
  docs: [],
  activeId: null,
  format: emptyFormatState,
  add: (doc) => set((s) => ({ docs: [...s.docs, doc] })),
  update: (id, patch) =>
    set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
  remove: (id) => set((s) => ({ docs: s.docs.filter((d) => d.id !== id) })),
  setActive: (activeId) => set({ activeId }),
  setFormat: (format) => set({ format }),
}));

/** Campos derivados de un bloque de configuración literal. */
export const configFields = (configRaw: string) => ({
  configRaw,
  config: readConfigBlock(configRaw),
});

export const activeDoc = (): DocInfo | undefined => {
  const { docs, activeId } = useDocs.getState();
  return docs.find((d) => d.id === activeId);
};

// ---------------------------------------------------------------------------------------------
// Diálogos modales basados en promesas
// ---------------------------------------------------------------------------------------------

export type DialogRequest =
  | { kind: 'unsaved'; name: string; resolve: (r: 'save' | 'discard' | 'cancel') => void }
  | {
      kind: 'link';
      initial: { href: string; title: string; text: string; hasSelection: boolean };
      resolve: (r: LinkInput | null) => void;
    }
  | {
      kind: 'external';
      name: string;
      resolve: (r: 'reload' | 'keep' | 'compare') => void;
    }
  | { kind: 'compare'; name: string; mine: string; theirs: string; resolve: () => void }
  | {
      kind: 'imagePaste';
      info: {
        count: number;
        preview: string | null;
        width: number | null;
        height: number | null;
        bytes: number;
        /** Nombre que recibiría el archivo, o null si el documento aún no está guardado. */
        name: string | null;
      };
      resolve: (r: ImagePasteChoice | null) => void;
    }
  | { kind: 'imageLarge'; kb: number; resolve: (r: 'file' | 'embed' | null) => void }
  | { kind: 'imageUrl'; resolve: (r: string | null) => void }
  | { kind: 'exportImages'; count: number; resolve: (r: 'embed' | 'folder' | null) => void }
  | { kind: 'error'; message: string; resolve: () => void }
  | {
      kind: 'prompt';
      title: string;
      label: string;
      initial: string;
      confirm?: string;
      resolve: (r: string | null) => void;
    }
  | {
      kind: 'choose';
      title: string;
      body?: string;
      options: ChooseOption[];
      /** Opción que se marca como destacada (la primera si no se indica). */
      resolve: (id: string | null) => void;
    }
  | { kind: 'wizard'; initial: WizardInput; resolve: (r: WizardResult | null) => void }
  | { kind: 'projectSettings'; resolve: () => void }
  | { kind: 'quickOpen'; resolve: () => void }
  | { kind: 'palette'; resolve: () => void }
  | { kind: 'settings'; section?: SettingsSection; resolve: () => void }
  | { kind: 'iconPicker'; current: string | undefined; resolve: (r: string | null) => void };

export interface ChooseOption {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Texto secundario (ruta, descripción). */
  hint?: string;
  danger?: boolean;
}

/** Valores iniciales del asistente de proyecto nuevo (PRJ-32). */
export interface WizardInput {
  title: string;
  /** Carpeta raíz sugerida, o null si hay que elegirla. */
  folder: string | null;
  importExisting: boolean;
}

export interface WizardResult {
  title: string;
  folder: string;
  importExisting: boolean;
}

/** Respuesta del diálogo de pegado de imagen (IMG-03). */
export interface ImagePasteChoice {
  mode: 'file' | 'base64';
  /** Nombre elegido (sin ruta) para el archivo. */
  name?: string;
  /** Escribe `images.pasteMode` en el bloque del documento. */
  remember: boolean;
  /** Lo guarda también como predeterminado de la app. */
  asDefault: boolean;
}

interface DialogsState {
  current: DialogRequest | null;
  queue: DialogRequest[];
  /** Diálogos tapados por uno abierto desde ellos (confirmar algo desde Ajustes). */
  stack: DialogRequest[];
  open: (request: DialogRequest, nested?: boolean) => void;
  close: () => void;
}

export const useDialogs = create<DialogsState>((set) => ({
  current: null,
  queue: [],
  stack: [],
  open: (request, nested = false) =>
    set((s) => {
      if (!s.current) return { current: request };
      // Anidado: se muestra encima y, al cerrarlo, se vuelve al anterior.
      if (nested) return { current: request, stack: [...s.stack, s.current] };
      return { queue: [...s.queue, request] };
    }),
  close: () =>
    set((s) => {
      if (s.stack.length)
        return { current: s.stack[s.stack.length - 1]!, stack: s.stack.slice(0, -1) };
      return { current: s.queue[0] ?? null, queue: s.queue.slice(1) };
    }),
}));

function ask<T>(build: (resolve: (value: T) => void) => DialogRequest, nested = false): Promise<T> {
  return new Promise<T>((resolve) => {
    useDialogs.getState().open(build(resolve), nested);
  });
}

export const askUnsaved = (name: string) =>
  ask<'save' | 'discard' | 'cancel'>((resolve) => ({ kind: 'unsaved', name, resolve }));
export const askLink = (initial: Extract<DialogRequest, { kind: 'link' }>['initial']) =>
  ask<LinkInput | null>((resolve) => ({ kind: 'link', initial, resolve }));
export const askExternal = (name: string) =>
  ask<'reload' | 'keep' | 'compare'>((resolve) => ({ kind: 'external', name, resolve }));
export const showCompare = (name: string, mine: string, theirs: string) =>
  ask<void>((resolve) => ({ kind: 'compare', name, mine, theirs, resolve }));
export const showError = (message: string) =>
  ask<void>((resolve) => ({ kind: 'error', message, resolve }));

export const askText = (title: string, label: string, initial = '', confirm?: string) =>
  ask<string | null>((resolve) => ({ kind: 'prompt', title, label, initial, confirm, resolve }));
export const askChoose = (title: string, options: ChooseOption[], body?: string, nested = false) =>
  ask<string | null>((resolve) => ({ kind: 'choose', title, body, options, resolve }), nested);
export const askWizard = (initial: WizardInput) =>
  ask<WizardResult | null>((resolve) => ({ kind: 'wizard', initial, resolve }));
export const showProjectSettings = () =>
  ask<void>((resolve) => ({ kind: 'projectSettings', resolve }));
export const showQuickOpen = () => ask<void>((resolve) => ({ kind: 'quickOpen', resolve }));
export const showPalette = () => ask<void>((resolve) => ({ kind: 'palette', resolve }));
export const showSettings = (section?: SettingsSection) =>
  ask<void>((resolve) => ({ kind: 'settings', section, resolve }));
export const askIcon = (current: string | undefined) =>
  ask<string | null>((resolve) => ({ kind: 'iconPicker', current, resolve }));

export const askImagePaste = (info: Extract<DialogRequest, { kind: 'imagePaste' }>['info']) =>
  ask<ImagePasteChoice | null>((resolve) => ({ kind: 'imagePaste', info, resolve }));
export const askImageLarge = (kb: number) =>
  ask<'file' | 'embed' | null>((resolve) => ({ kind: 'imageLarge', kb, resolve }));
export const askImageUrl = () => ask<string | null>((resolve) => ({ kind: 'imageUrl', resolve }));
export const askExportImages = (count: number) =>
  ask<'embed' | 'folder' | null>((resolve) => ({ kind: 'exportImages', count, resolve }));
