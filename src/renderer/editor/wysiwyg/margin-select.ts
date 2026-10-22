import { AllSelection, TextSelection } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

/**
 * Barra de selección del margen izquierdo, como en Word: clic selecciona la línea, arrastrar
 * selecciona líneas completas, doble clic el párrafo y triple clic todo el documento.
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
  const at = (x: number, y: number) => view.posAtCoords({ left: x, top: y })?.pos ?? null;

  const select = (anchor: number, head: number) => {
    const { doc } = view.state;
    const sel = TextSelection.between(doc.resolve(anchor), doc.resolve(head));
    view.dispatch(view.state.tr.setSelection(sel).scrollIntoView());
  };

  const onDown = (e: MouseEvent) => {
    if (e.button !== 0 || !inBar(e)) return;
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

  const onHover = (e: MouseEvent) => sheet.classList.toggle('margin-select', inBar(e));
  const onLeave = () => sheet.classList.remove('margin-select');

  sheet.addEventListener('mousedown', onDown);
  sheet.addEventListener('mousemove', onHover);
  sheet.addEventListener('mouseleave', onLeave);
  return () => {
    sheet.removeEventListener('mousedown', onDown);
    sheet.removeEventListener('mousemove', onHover);
    sheet.removeEventListener('mouseleave', onLeave);
  };
}
