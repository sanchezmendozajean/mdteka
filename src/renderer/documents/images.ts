import i18next from 'i18next';
import { editor } from '../editor/controller';
import { imageHooks } from '../editor/image-hooks';
import type { ImageSpec } from '../editor/wysiwyg/commands';
import { appSettings } from '../app/settings';
import { resolveConfig, updateConfig, useSettings } from './config';
import { saveDocument } from './actions';
import {
  askImageLarge,
  askImagePaste,
  askImageUrl,
  showError,
  useDocs,
  type DocInfo,
} from './store';

/** Flujo de inserción de imágenes (06): pegar, soltar, *Insertar › Imagen* y edición. */

const api = () => window.mdteca;

/** Aviso al incrustar una imagen más pesada que esto (IMG-01). */
/** Umbral de aviso al pegar como base64 (Ajustes › Imágenes). */
export const warnBytes = (): number => appSettings().images.warnKb * 1024;

/** Una imagen lista para insertar. */
export interface ImageData {
  bytes: Uint8Array;
  mime: string;
  /** Nombre original (si lo hay). */
  name: string;
  /** Ruta de origen si viene de un archivo (arrastre o selector); '' si viene del portapapeles. */
  path: string;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
};
const MIME_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime]),
);
MIME_BY_EXT['jpeg'] = 'image/jpeg';

const extOf = (d: ImageData): string =>
  EXT_BY_MIME[d.mime] ?? d.name.split('.').pop()?.toLowerCase() ?? 'png';

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const dataUrl = (d: ImageData) => `data:${d.mime};base64,${toBase64(d.bytes)}`;

/** Enlace relativo, con `/` y sin caracteres que rompan la sintaxis (IMG-02). */
export const encodeRel = (rel: string): string =>
  encodeURI(rel).replace(/\(/g, '%28').replace(/\)/g, '%29');

/** Datos de una imagen a partir de un archivo del navegador (pegado o arrastrado). */
export async function fromFile(file: File): Promise<ImageData> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  let path = '';
  try {
    path = api().image.pathOf(file);
  } catch {
    /* un pegado desde el portapapeles no tiene ruta */
  }
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    mime: file.type || MIME_BY_EXT[ext] || 'image/png',
    name: file.name,
    path,
  };
}

/** Datos de un archivo de imagen del disco (selector de archivos). */
async function fromPath(path: string): Promise<ImageData> {
  const { mime, data } = await api().image.readFile(path);
  return { bytes: fromBase64(data), mime, name: path.split(/[\\/]/).pop() ?? 'imagen', path };
}

/** Miniatura y dimensiones para el diálogo; si el formato no se puede decodificar, sin ellas. */
async function describe(d: ImageData) {
  try {
    const bitmap = await createImageBitmap(new Blob([d.bytes as BlobPart], { type: d.mime }));
    const scale = Math.min(1, 220 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const out = {
      preview: canvas.toDataURL('image/png'),
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close();
    return out;
  } catch {
    return { preview: d.bytes.length < 400_000 ? dataUrl(d) : null, width: null, height: null };
  }
}

/** Guarda la imagen como archivo junto al documento (lo guarda antes si hace falta). */
async function saveAsFile(id: string, d: ImageData, name?: string): Promise<string | null> {
  let info = useDocs.getState().docs.find((x) => x.id === id);
  if (!info) return null;
  if (!info.path) {
    // El archivo necesita una carpeta: se guarda primero el documento.
    if (!(await saveDocument(id))) return null;
    info = useDocs.getState().docs.find((x) => x.id === id);
    editor.syncDocPath();
  }
  if (!info?.path) return null;
  try {
    if (d.path && !name) return (await api().image.importFile(info.path, d.path)).rel;
    return (await api().image.save(info.path, toBase64(d.bytes), extOf(d), name)).name;
  } catch (error) {
    await showError(`${i18next.t('images.saveError')}\n${String(error)}`);
    return null;
  }
}

/**
 * Convierte imágenes en `src` válidos según el modo de pegado del documento (IMG-01…03):
 * incrusta (con aviso de tamaño), guarda como archivo o pregunta. Null si el usuario cancela.
 */
export async function resolveSources(
  doc: DocInfo,
  items: ImageData[],
): Promise<ImageSpec[] | null> {
  let mode = resolveConfig(doc).images?.pasteMode ?? 'ask';
  let wantedName: string | undefined;
  if (mode === 'ask') {
    const first = items[0]!;
    const meta = await describe(first);
    let name: string | null = null;
    if (doc.path) {
      name =
        (
          await api()
            .image.nextName(doc.path, extOf(first))
            .catch(() => null)
        )?.name ?? null;
    }
    const choice = await askImagePaste({
      count: items.length,
      preview: meta.preview,
      width: meta.width,
      height: meta.height,
      bytes: first.bytes.length,
      name,
    });
    if (!choice) return null;
    mode = choice.mode;
    wantedName = choice.name;
    if (choice.remember) updateConfig(doc.id, { images: { pasteMode: mode } });
    if (choice.asDefault) {
      const defaults = useSettings.getState().documentDefaults;
      const next = { ...defaults, images: { ...(defaults['images'] as object), pasteMode: mode } };
      const saved = await api().settings.setDocumentDefaults(next);
      useSettings.getState().set(saved.documentDefaults);
    }
  }
  const out: ImageSpec[] = [];
  for (const [i, item] of items.entries()) {
    let how = mode;
    if (how === 'base64' && item.bytes.length > warnBytes()) {
      const answer = await askImageLarge(Math.round(item.bytes.length / 1024));
      if (answer === null) return null;
      if (answer === 'file') how = 'file';
    }
    if (how === 'file') {
      const rel = await saveAsFile(doc.id, item, i === 0 ? wantedName : undefined);
      if (!rel) return null;
      out.push({ src: encodeRel(rel), alt: '' });
    } else out.push({ src: dataUrl(item), alt: '' });
  }
  return out;
}

/** Inserta imágenes (pegadas, arrastradas o elegidas) aplicando el modo del documento. */
export async function insertImageData(items: ImageData[], pos?: number): Promise<void> {
  const doc = activeDocInfo();
  if (!doc || items.length === 0) return;
  const specs = await resolveSources(doc, items);
  if (specs) editor.insertImages(specs, pos);
}

const activeDocInfo = (): DocInfo | undefined =>
  useDocs.getState().docs.find((d) => d.id === useDocs.getState().activeId);

/** Pegado o arrastre de archivos de imagen sobre cualquiera de los editores. */
export async function insertImageFiles(files: File[], pos: number | null): Promise<void> {
  try {
    await insertImageData(await Promise.all(files.map(fromFile)), pos ?? undefined);
  } catch (error) {
    await showError(`${i18next.t('images.saveError')}\n${String(error)}`);
  }
}

imageHooks.onFiles = (files, pos) => void insertImageFiles(files, pos);

// ---------------------------------------------------------------------------------------------
// Insertar › Imagen (IMG-11)
// ---------------------------------------------------------------------------------------------

export async function insertImageFromDisk(): Promise<void> {
  try {
    const paths = await api().image.pick();
    if (paths.length) await insertImageData(await Promise.all(paths.map(fromPath)));
  } catch (error) {
    await showError(`${i18next.t('images.saveError')}\n${String(error)}`);
  }
}

export async function insertImageFromClipboard(): Promise<void> {
  const { data, ext } = await api().image.clipboard();
  if (!data) {
    await showError(i18next.t('images.noClipboardImage'));
    return;
  }
  await insertImageData([
    {
      bytes: fromBase64(data),
      mime: MIME_BY_EXT[ext] ?? 'image/png',
      name: `portapapeles.${ext}`,
      path: '',
    },
  ]);
}

/** Imagen remota: se enlaza tal cual, sin descargarla (IMG-12). */
export async function insertImageFromUrl(): Promise<void> {
  const url = await askImageUrl();
  if (!url) return;
  editor.insertImages([{ src: url, alt: '' }]);
}

// ---------------------------------------------------------------------------------------------
// Edición de una imagen seleccionada
// ---------------------------------------------------------------------------------------------

const isData = (src: string) => /^data:image\//i.test(src);
const isRemote = (src: string) => /^https?:\/\//i.test(src);
export const imageKind = (src: string): 'data' | 'remote' | 'file' =>
  isData(src) ? 'data' : isRemote(src) ? 'remote' : 'file';

/** Convierte la imagen en `pos` a archivo junto al documento (desde base64 o desde una URL). */
export async function convertToFile(pos: number, src: string): Promise<void> {
  const doc = activeDocInfo();
  if (!doc) return;
  try {
    let info = doc;
    if (!info.path) {
      if (!(await saveDocument(doc.id))) return;
      info = activeDocInfo()!;
      editor.syncDocPath();
    }
    if (!info.path) return;
    let name: string;
    if (isData(src)) {
      const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/is.exec(src);
      if (!m) return;
      name = (await api().image.save(info.path, m[2]!, EXT_BY_MIME[m[1]!.toLowerCase()] ?? 'png'))
        .name;
    } else {
      name = (await api().image.download(info.path, src)).name;
    }
    editor.updateImage(pos, { src: encodeRel(name) });
  } catch (error) {
    await showError(`${i18next.t('images.saveError')}\n${String(error)}`);
  }
}

/** Incrusta como base64 una imagen-archivo. */
export async function convertToBase64(pos: number, src: string): Promise<void> {
  const doc = activeDocInfo();
  if (!doc?.path || imageKind(src) !== 'file') return;
  try {
    const { mime, data } = await api().image.read(doc.path, decodeURI(src));
    if (fromBase64(data).length > warnBytes()) {
      const answer = await askImageLarge(Math.round((data.length * 3) / 4 / 1024));
      if (answer !== 'embed') return;
    }
    editor.updateImage(pos, { src: `data:${mime};base64,${data}` });
  } catch (error) {
    await showError(`${i18next.t('images.saveError')}\n${String(error)}`);
  }
}

/** Sustituye la imagen en `pos` por otra elegida en disco, con las reglas del modo de pegado. */
export async function replaceImage(pos: number): Promise<void> {
  const doc = activeDocInfo();
  if (!doc) return;
  try {
    const paths = await api().image.pick();
    if (!paths.length) return;
    const specs = await resolveSources(doc, [await fromPath(paths[0]!)]);
    if (specs?.[0]) editor.updateImage(pos, { src: specs[0].src, width: null });
  } catch (error) {
    await showError(`${i18next.t('images.saveError')}\n${String(error)}`);
  }
}

export function showImageInFolder(src: string): void {
  const doc = activeDocInfo();
  if (doc?.path && imageKind(src) === 'file') {
    void api().image.showInFolder(doc.path, decodeURI(src));
  }
}
