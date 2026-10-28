import i18next from 'i18next';
import type { Node as PmNode } from 'prosemirror-model';
import { NodeSelection } from 'prosemirror-state';
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
  return `mdtor-asset://local/${encodeURIComponent(joinPath(dir, rel))}`;
}

const MIN_WIDTH = 24;

/**
 * Imagen: se muestra (archivo local por `mdtor-asset://`, remota o data URL), se selecciona con un
 * clic y se redimensiona con el tirador; al soltarlo el ancho se escribe en el documento.
 */
export class ImageView implements NodeView {
  dom: HTMLElement;
  private img: HTMLImageElement;
  private handle: HTMLElement;
  private caption: HTMLElement;
  private node: PmNode;

  constructor(
    node: PmNode,
    private view: EditorView,
    private getPos: () => number | undefined,
  ) {
    this.node = node;
    this.dom = document.createElement('span');
    this.dom.className = 'image-wrap';
    this.img = document.createElement('img');
    this.img.draggable = false;
    this.img.addEventListener('load', () => {
      this.dom.classList.remove('image-broken');
      // La altura de la imagen cambia el reparto de páginas.
      window.dispatchEvent(new CustomEvent('mdtor-layout', { detail: this.dom }));
    });
    this.img.addEventListener('error', () => {
      this.dom.classList.add('image-broken');
      window.dispatchEvent(new CustomEvent('mdtor-layout', { detail: this.dom }));
    });
    this.handle = document.createElement('span');
    this.handle.className = 'image-handle';
    this.handle.contentEditable = 'false';
    this.handle.addEventListener('pointerdown', (e) => this.startResize(e));
    // `box` envuelve imagen y tirador para que el tirador quede en la imagen y no en el pie.
    const box = document.createElement('span');
    box.className = 'image-box';
    box.append(this.img, this.handle);
    this.caption = document.createElement('span');
    this.caption.className = 'image-caption';
    this.caption.contentEditable = 'false';
    this.dom.append(box, this.caption);
    this.render();
  }

  private render(): void {
    const { src, alt, title, width, caption } = this.node.attrs as {
      src: string;
      alt: string;
      title: string | null;
      width: number | null;
      caption: boolean;
    };
    // Pie de foto visible (solo con título): el título deja de ser un tooltip.
    const showCaption = caption && !!title;
    this.dom.classList.toggle('image-captioned', showCaption);
    this.caption.textContent = showCaption ? title : '';
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
    this.img.title = showCaption ? '' : (title ?? (url ? '' : src));
    this.img.style.width = width ? `${width}px` : '';
    this.dom.dataset['label'] = alt || src.split('/').pop() || i18next.t('editor.image');
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    const captionChanged = node.attrs['caption'] !== this.node.attrs['caption'];
    this.node = node;
    this.render();
    // El pie cambia la altura del bloque: se vuelve a medir para repaginar.
    if (captionChanged)
      window.dispatchEvent(new CustomEvent('mdtor-layout', { detail: this.dom }));
    return true;
  }

  selectNode(): void {
    this.dom.classList.add('image-selected');
  }

  deselectNode(): void {
    this.dom.classList.remove('image-selected');
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
    let current = 0;
    const move = (m: PointerEvent) => {
      const width = Math.round(
        Math.min(maxWidth, Math.max(MIN_WIDTH, startWidth / scale + (m.clientX - startX) / scale)),
      );
      current = width;
      this.img.style.width = `${width}px`;
      useImageUi.getState().set({ draftWidth: width });
      window.dispatchEvent(new CustomEvent('mdtor-layout', { detail: this.dom }));
    };
    const up = () => {
      this.handle.removeEventListener('pointermove', move);
      this.handle.removeEventListener('pointerup', up);
      useImageUi.getState().set({ draftWidth: null });
      // Soltar el tirador escribe el ancho en el documento.
      const pos = this.getPos();
      if (!current || pos === undefined || current === this.node.attrs['width']) return;
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        width: current,
      });
      this.view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
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
