import { pageGeometry } from '@shared/page';
import { editor } from '../editor/controller';
import { resolveConfig, updateConfig } from './config';
import { useDocs, type ViewKind } from './store';

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

export function setView(id: string, view: ViewKind): void {
  useDocs.getState().update(id, { view });
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** El zoom se recuerda por documento en `userData` (VW-31). */
export function setZoom(id: string, zoom: number): void {
  const value = clampZoom(zoom);
  useDocs.getState().update(id, { zoom: value });
  const path = useDocs.getState().docs.find((d) => d.id === id)?.path;
  if (!path) return;
  clearTimeout(saveTimers.get(id));
  saveTimers.set(
    id,
    setTimeout(() => void window.mdteca.state.setView(path, value).catch(() => undefined), 400),
  );
}

/** Pasos de 10 % (VW-30). */
export function stepZoom(id: string, direction: 1 | -1): void {
  const doc = useDocs.getState().docs.find((d) => d.id === id);
  if (!doc) return;
  const next =
    direction > 0 ? Math.floor(doc.zoom * 10 + 1e-6) + 1 : Math.ceil(doc.zoom * 10 - 1e-6) - 1;
  setZoom(id, next / 10);
}

/** Ancho de la hoja o columna a zoom 100 %. */
function sheetWidth(id: string): number {
  const doc = useDocs.getState().docs.find((d) => d.id === id);
  if (!doc) return 794;
  const eff = resolveConfig(doc);
  return doc.view === 'pages' ? pageGeometry(eff.page).width : doc.columnWidth;
}

/** *Ajustar a ancho* y *Ajustar a página* (VW-30). */
export function fitZoom(id: string, mode: 'width' | 'page'): void {
  const scroller = editor.scrollElement();
  const doc = useDocs.getState().docs.find((d) => d.id === id);
  if (!scroller || !doc) return;
  const eff = resolveConfig(doc);
  const g = pageGeometry(eff.page);
  const byWidth = (scroller.clientWidth - 48) / sheetWidth(id);
  const byHeight = (scroller.clientHeight - 48) / g.height;
  setZoom(id, mode === 'page' && doc.view === 'pages' ? Math.min(byWidth, byHeight) : byWidth);
}

/** Escribe `view.default` y el ancho de columna como valores del documento. */
export function saveViewAsDefault(id: string): void {
  const doc = useDocs.getState().docs.find((d) => d.id === id);
  if (!doc) return;
  updateConfig(id, { view: { default: doc.view, continuousWidth: doc.columnWidth } });
}

export function setColumnWidth(id: string, width: number): void {
  useDocs.getState().update(id, { columnWidth: Math.min(2400, Math.max(320, Math.round(width))) });
}
