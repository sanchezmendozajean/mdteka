import { create } from 'zustand';
import { readConfigBlock, type ReadConfig } from '@shared/document-config';
import type { Eol } from '../editor/model/text-format';
import { emptyFormatState, type FormatState, type LinkInput } from '../editor/wysiwyg/commands';

export type Mode = 'wysiwyg' | 'source';

/** Metadatos reactivos de un documento abierto (el texto vive en el runtime del controlador). */
export interface DocInfo {
  id: string;
  path: string | null;
  name: string;
  dirty: boolean;
  mode: Mode;
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
  | { kind: 'error'; message: string; resolve: () => void };

interface DialogsState {
  current: DialogRequest | null;
  queue: DialogRequest[];
  open: (request: DialogRequest) => void;
  close: () => void;
}

export const useDialogs = create<DialogsState>((set) => ({
  current: null,
  queue: [],
  open: (request) =>
    set((s) => (s.current ? { queue: [...s.queue, request] } : { current: request })),
  close: () => set((s) => ({ current: s.queue[0] ?? null, queue: s.queue.slice(1) })),
}));

function ask<T>(build: (resolve: (value: T) => void) => DialogRequest): Promise<T> {
  return new Promise<T>((resolve) => {
    useDialogs.getState().open(build(resolve));
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
