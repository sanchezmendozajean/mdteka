import { AllSelection, Selection, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * Barra de selección del margen izquierdo, como en Word: clic selecciona la línea, arrastrar
 * selecciona líneas completas, doble clic el párrafo y triple clic todo el documento.
 * En el margen derecho un clic pone el cursor al final de la línea (también tras una imagen que
 * ocupa todo el ancho) y bajo la última línea lo pone al final del documento.
 * Se engancha a la hoja (`.doc-column`), cuyo relleno izquierdo queda fuera del editor.
 */
export function installMarginSelect(view: EditorView, sheet: HTMLElement): () => void {
  /** Separación entre la barra y el texto, para que la flecha no pise las letras. */
  const GUTTER = 5;
  const bounds = () => {
    const r = view.dom.getBoundingClientRect();
    return { left: r.left + 1, right: r.right - 1 };
  };
  /** ¿Está el puntero en el margen izquierdo, a la altura del contenido? */
  const inBar = (e: MouseEvent) => {
    if (e.target !== sheet || view.dom.offsetParent === null) return false;
    const first = view.dom.firstElementChild?.getBoundingClientRect();
    const last = view.dom.lastElementChild?.getBoundingClientRect();
    if (!first || !last) return false;
    return e.clientX < bounds().left - GUTTER && e.clientY >= first.top && e.clientY <= last.bottom;
  };
  /**
   * Zona donde un clic solo coloca el cursor: el margen derecho a la altura del contenido
   * (final de esa línea) o el espacio bajo la última línea (final del documento).
   */
  const caretTarget = (e: MouseEvent): 'line-end' | 'doc-end' | null => {
    // El espacio bajo la última línea es parte del editor; los márgenes son de la hoja.
    if ((e.target !== sheet && e.target !== view.dom) || view.dom.offsetParent === null)
      return null;
    const first = view.dom.firstElementChild?.getBoundingClientRect();
    const last = view.dom.lastElementChild?.getBoundingClientRect();
    if (!first || !last) return null;
    if (e.clientY > last.bottom) return 'doc-end';
    if (e.target !== sheet) return null;
    if (e.clientX > bounds().right && e.clientY >= first.top) return 'line-end';
    return null;
  };
  const placeCaret = (e: MouseEvent, target: 'line-end' | 'doc-end') => {
    const { doc } = view.state;
    let sel: Selection;
    if (target === 'doc-end') {
      sel = Selection.atEnd(doc);
    } else {
      const hit = view.posAtCoords({ left: bounds().right - 1, top: e.clientY });
      if (!hit) return;
      // Una imagen que llena la línea: el cursor va tras ella.
      const image = hit.inside >= 0 ? doc.nodeAt(hit.inside) : null;
      const pos = image?.type.name === 'image' ? hit.inside + image.nodeSize : hit.pos;
      sel = Selection.near(doc.resolve(pos), -1);
    }
    view.focus();
    view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
  };
  const at = (x: number, y: number) => view.posAtCoords({ left: x, top: y })?.pos ?? null;

  const select = (anchor: number, head: number) => {
    const { doc } = view.state;
    const sel = TextSelection.between(doc.resolve(anchor), doc.resolve(head));
    view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
  };

  const onDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const caret = caretTarget(e);
    if (caret) {
      e.preventDefault();
      placeCaret(e, caret);
      return;
    }
    if (!inBar(e)) return;
    const { left, right } = bounds();
    const y = e.clientY;
    const start = at(left, y);
    if (start === null) return;
    e.preventDefault();
    view.focus();

    if (e.detail >= 3) {
      view.dispatch(view.state.tr.setSelection(new AllSelection(view.state.doc)));
      return;
    }
    if (e.detail === 2) {
      const $p = view.state.doc.resolve(start);
      if ($p.parent.isTextblock) select($p.start(), $p.end());
      return;
    }

    const lineFrom = start;
    const lineTo = at(right, y) ?? start;
    select(lineFrom, lineTo);

    const onMove = (m: MouseEvent) => {
      const { left: l, right: r } = bounds();
      if (m.clientY >= y) {
        const head = at(r, m.clientY);
        if (head !== null) select(lineFrom, head);
      } else {
        const head = at(l, m.clientY);
        if (head !== null) select(lineTo, head);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onHover = (e: MouseEvent) => {
    sheet.classList.toggle('margin-select', inBar(e));
    sheet.classList.toggle('margin-caret', caretTarget(e) !== null);
  };
  const onLeave = () => sheet.classList.remove('margin-select', 'margin-caret');

  sheet.addEventListener('mousedown', onDown);
  sheet.addEventListener('mousemove', onHover);
  sheet.addEventListener('mouseleave', onLeave);
  return () => {
    sheet.removeEventListener('mousedown', onDown);
    sheet.removeEventListener('mousemove', onHover);
    sheet.removeEventListener('mouseleave', onLeave);
  };
}
