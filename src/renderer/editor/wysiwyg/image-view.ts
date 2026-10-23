import i18next from 'i18next';
import type { Node as PmNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import { useImageUi } from '../image-ui-store';

/** Ruta del documento activo: las imágenes locales se resuelven respecto a su carpeta (06). */
export const imageContext: { docPath: string | null } = { docPath: null };

const REMOTE_OR_DATA = /^(https?:|data:image\/)/i;

/** `dir/a/../b.png` → `dir/b.png`, con `/` como separador. */
function joinPath(dir: string, rel: string): string {
  const parts = `${dir}/${rel}`.split(/[\\/]+/);
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.') out.push(p);
  }
  return out.join('/');
}

/** URL que el renderer puede cargar para el `src` de una imagen, o null si aún no es posible. */
export function resolveImageUrl(src: string): string | null {
  if (REMOTE_OR_DATA.test(src)) return src;
  if (!imageContext.docPath) return null;
  const dir = imageContext.docPath.replace(/[\\/][^\\/]*$/, '');
  let rel = src;
  try {
    rel = decodeURI(src);
  } catch {
    /* enlace mal codificado: se usa tal cual */
  }
  return `mdteca-asset://local/${encodeURIComponent(joinPath(dir, rel))}`;
}

const MIN_WIDTH = 24;

/**
 * Imagen: se muestra (archivo local por `mdteca-asset://`, remota o data URL), se selecciona con un
 * clic y se redimensiona con el tirador; el tamaño solo se escribe si el usuario lo confirma.
 */
export class ImageView implements NodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  private handle: HTMLElement;
  private node: PmNode;

  constructor(
    node: PmNode,
    private view: EditorView,
  ) {
    this.node = node;
    this.dom = document.createElement('span');
    this.dom.className = 'image-wrap';
    this.img = document.createElement('img');
    this.img.draggable = false;
    this.img.addEventListener('load', () => {
      this.dom.classList.remove('image-broken');
      // La altura de la imagen cambia el reparto de páginas.
      window.dispatchEvent(new CustomEvent('mdteca-layout', { detail: this.dom }));
    });
    this.img.addEventListener('error', () => {
      this.dom.classList.add('image-broken');
      window.dispatchEvent(new CustomEvent('mdteca-layout', { detail: this.dom }));
    });
    this.handle = document.createElement('span');
    this.handle.className = 'image-handle';
    this.handle.contentEditable = 'false';
    this.handle.addEventListener('pointerdown', (e) => this.startResize(e));
    this.dom.append(this.img, this.handle);
    this.render();
  }

  private render(): void {
    const { src, alt, title, width } = this.node.attrs as {
      src: string;
      alt: string;
      title: string | null;
      width: number | null;
    };
    const url = resolveImageUrl(src);
    if (url) {
      if (this.img.getAttribute('src') !== url) this.img.src = url;
      this.dom.classList.remove('image-unresolved');
    } else {
      this.img.removeAttribute('src');
      this.dom.classList.add('image-unresolved');
    }
    this.img.dataset['src'] = src;
    this.img.alt = alt || '';
    this.img.title = title ?? (url ? '' : src);
    this.img.style.width = width ? `${width}px` : '';
    this.dom.dataset['label'] = alt || src.split('/').pop() || i18next.t('editor.image');
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.render();
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('image-selected');
  }

  deselectNode(): void {
    this.dom.classList.remove('image-selected');
    // El tamaño provisional se descarta si no se confirmó.
    this.img.style.width = this.node.attrs['width'] ? `${this.node.attrs['width']}px` : '';
    useImageUi.getState().set({ draftWidth: null });
  }

  /** Arrastrar el tirador cambia el ancho en vivo; confirmarlo se hace en el menú de la imagen. */
  private startResize(e: PointerEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startWidth = this.img.getBoundingClientRect().width;
    // El zoom escala los píxeles de pantalla: se convierte a px de diseño.
    const scale = startWidth / (this.img.offsetWidth || startWidth);
    const maxWidth = this.view.dom.getBoundingClientRect().width / scale;
    const move = (m: PointerEvent) => {
      const width = Math.round(
        Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth / scale + (m.clientX - startX) / scale)),
      );
      this.img.style.width = `${width}px`;
      useImageUi.getState().set({ draftWidth: width });
      window.dispatchEvent(new CustomEvent('mdteca-layout', { detail: this.dom }));
    };
    const up = () => {
      this.handle.removeEventListener('pointermove', move);
      this.handle.removeEventListener('pointerup', up);
    };
    this.handle.addEventListener('pointermove', move);
    this.handle.addEventListener('pointerup', up);
  }

  stopEvent(event: Event): boolean {
    return event.target === this.handle;
  }

  ignoreMutation(): boolean {
    return true;
  }
}
