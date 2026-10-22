import { create } from 'zustand';
import {
  applyPatch,
  effectiveConfig,
  inheritedConfig,
  isEmptyConfig,
  readConfigBlock,
  writeConfigBlock,
  type DocumentConfig,
  type Resolved,
} from '@shared/document-config';
import { editor } from '../editor/controller';
import { activeDoc, configFields, useDocs, type DocInfo } from './store';

type Json = Record<string, unknown>;

/** Ajustes de la app que heredan los documentos (09 · «Documento por defecto»). */
export const useSettings = create<{ documentDefaults: Json; set: (d: Json) => void }>((set) => ({
  documentDefaults: {},
  set: (documentDefaults) => set({ documentDefaults }),
}));

export async function loadSettings(): Promise<void> {
  const settings = await window.mdteca.settings.get();
  useSettings.getState().set(settings.documentDefaults);
}

const appDefaults = () => useSettings.getState().documentDefaults;

/** Configuración efectiva de un documento (fábrica ← app ← preset ← bloque). */
export const resolveConfig = (doc: DocInfo | undefined): Resolved =>
  effectiveConfig(doc?.config.config ?? null, appDefaults());

/** Escribe el nuevo texto del bloque y recalcula si el documento está sucio. */
function setBlock(id: string, raw: string): void {
  editor.flush();
  const info = useDocs.getState().docs.find((d) => d.id === id);
  const rt = editor.runtime(id);
  if (!info || !rt || raw === info.configRaw) return;
  useDocs.getState().update(id, {
    ...configFields(raw),
    dirty: rt.source !== rt.savedSource || raw !== info.savedConfigRaw,
  });
}

function toBlock(config: DocumentConfig, info: DocInfo): string {
  return isEmptyConfig(config) ? '' : writeConfigBlock(config, info.configRaw);
}

/**
 * Aplica un cambio de configuración al documento (un valor `undefined` vuelve al heredado).
 * Solo se escribe lo que difiere de lo heredado; un documento que no cambia nada no recibe bloque.
 */
export function updateConfig(id: string, patch: Json): void {
  const info = useDocs.getState().docs.find((d) => d.id === id);
  if (!info) return;
  const base = info.config.status === 'ok' ? info.config.config : null;
  const next = applyPatch(base, patch, (theme) => inheritedConfig(appDefaults(), theme));
  setBlock(id, toBlock(next, info));
}

export const updateActiveConfig = (patch: Json): void => {
  const doc = activeDoc();
  if (doc) updateConfig(doc.id, patch);
};

/** *Restablecer a valores heredados*: elimina el bloque (DOC-04). */
export function resetConfig(id: string): void {
  setBlock(id, '');
}

/** *Fijar todo en el documento*: escribe todas las claves para que sea autosuficiente (DOC-04). */
export function pinAll(id: string): void {
  const info = useDocs.getState().docs.find((d) => d.id === id);
  if (!info) return;
  const eff = resolveConfig(info);
  const pinned: Json = {
    version: 1,
    ...(info.config.config ?? {}),
    view: eff.view,
    typography: eff.typography,
    styles: eff.styles,
    images: eff.images,
  };
  setBlock(id, writeConfigBlock(pinned as DocumentConfig, info.configRaw));
}

/** Guarda lo que el documento define como valores por defecto de la app (origen «app»). */
export async function saveAsAppDefaults(id: string): Promise<void> {
  const info = useDocs.getState().docs.find((d) => d.id === id);
  const cfg = info?.config.config;
  if (!info || !cfg) return;
  const rest = { ...(cfg as Json) };
  delete rest['version'];
  delete rest['theme'];
  const merged = { ...appDefaults(), ...rest, ...(cfg.theme ? { theme: cfg.theme } : {}) };
  const saved = await window.mdteca.settings.setDocumentDefaults(merged);
  useSettings.getState().set(saved.documentDefaults);
}

/** *Reparar* un bloque inválido: se descarta y se vuelve a los valores heredados (DOC-03). */
export function repairConfig(id: string): void {
  const info = useDocs.getState().docs.find((d) => d.id === id);
  if (info && readConfigBlock(info.configRaw).status === 'invalid') resetConfig(id);
}

/** Vista, zoom y ancho de columna iniciales de un documento (`view.default` del bloque o heredado). */
export function viewFields(configRaw: string): Pick<DocInfo, 'view' | 'zoom' | 'columnWidth'> {
  const eff = effectiveConfig(readConfigBlock(configRaw).config, appDefaults());
  return {
    view: eff.view?.default === 'continuous' ? 'continuous' : 'pages',
    zoom: 1,
    columnWidth: eff.view?.continuousWidth ?? 760,
  };
}
