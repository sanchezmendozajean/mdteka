import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

/** Saltos de página dibujados como decoraciones: el documento no cambia (VW-10). */
export const pageKey = new PluginKey<DecorationSet>('mdtor-pages');

export const pagePlugin = (): Plugin<DecorationSet> =>
  new Plugin<DecorationSet>({
    key: pageKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, set) {
        const next = tr.getMeta(pageKey) as DecorationSet | undefined;
        if (next) return next;
        return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
      },
    },
    props: {
      decorations: (state) => pageKey.getState(state),
    },
  });

export interface GapSpec {
  /** Posición del documento donde se inserta el hueco. */
  pos: number;
  /** Alto total del hueco en px de layout (hueco + margen inferior + separación + margen superior). */
  height: number;
  /** Dentro de un bloque (corte por línea) o entre bloques. */
  inline: boolean;
  /** Compensación de márgenes colapsados de los vecinos (solo entre bloques). */
  marginTop?: number;
  marginBottom?: number;
  /** Alturas de las franjas de un hueco dentro de un bloque con fondo (código). */
  bands?: { fill: number; bottom: number; gap: number; top: number };
  /** Hay fondo propio (bloque de código) que el hueco debe tapar. */
  covers?: boolean;
  /** Hueco entre filas de una tabla: se dibuja como una fila con esta cantidad de columnas. */
  row?: number;
  /** Hueco dentro de una celda: sin el margen negativo de los huecos de párrafo. */
  inCell?: boolean;
  /** Franjas (hoja, lienzo, hoja) sobre una celda, para tapar sus bordes en el salto de página. */
  cellBand?: { offset: number; fill: number; bottom: number; gap: number; top: number };
}

const px = (n: number) => `${Math.round(n * 64) / 64}px`;

function gapDom(spec: GapSpec): HTMLElement {
  if (spec.row) {
    const tr = document.createElement('tr');
    tr.className = 'page-gap page-gap-inline page-gap-row';
    tr.contentEditable = 'false';
    tr.dataset['gapHeight'] = String(spec.height);
    const td = document.createElement('td');
    td.colSpan = spec.row;
    td.className = 'page-gap-cell';
    td.style.height = px(spec.height);
    tr.append(td);
    return tr;
  }
  if (spec.cellBand) {
    const { offset, fill, bottom, gap, top } = spec.cellBand;
    const band = document.createElement('div');
    band.className = 'page-gap-band';
    band.contentEditable = 'false';
    // Como en Word, la fila se cierra al pie del área de texto (borde inferior) y se reabre al
    // inicio de la hoja siguiente (borde superior); entre ambos, margen, lienzo y margen. El hueco
    // reproduce la sombra de las hojas para que no se note el parche.
    const a = fill + bottom;
    const total = a + gap + top;
    const piece = (at: number, height: number, css: Partial<CSSStyleDeclaration>) => {
      const el = document.createElement('div');
      Object.assign(el.style, { position: 'absolute', left: '0', right: '0' }, css);
      el.style.top = px(at);
      el.style.height = px(height);
      return el;
    };
    // En los márgenes solo se tapan los bordes de la celda: el encabezado y el pie siguen visibles.
    const edges =
      'linear-gradient(to right, var(--paper) 4px, transparent 4px, transparent calc(100% - 4px), var(--paper) calc(100% - 4px))';
    band.style.top = px(offset);
    band.style.height = px(total);
    const canvas = piece(a, gap, { background: 'var(--canvas)', overflow: 'hidden' });
    // Dos «hojas» fuera del recorte proyectan su sombra sobre el hueco, como las reales.
    for (const at of [-60, gap]) {
      canvas.append(
        piece(at, 60, {
          left: '-40px',
          right: '-40px',
          background: 'var(--paper)',
          boxShadow: 'var(--sheet-shadow)',
          borderRadius: '2px',
        }),
      );
    }
    band.append(
      piece(fill, 1, { background: 'var(--ink-rule)' }),
      piece(fill + 1, Math.max(0, bottom - 1), { background: edges }),
      canvas,
      piece(a + gap, Math.max(0, top - 1), { background: edges }),
      piece(total - 1, 1, { background: 'var(--ink-rule)' }),
    );
    return band;
  }
  const el = document.createElement('div');
  el.className = spec.inline ? 'page-gap page-gap-inline' : 'page-gap';
  el.contentEditable = 'false';
  el.dataset['gapHeight'] = String(spec.height);
  el.style.height = px(spec.height);
  if (spec.inCell) el.style.margin = '0';
  if (!spec.inline) {
    el.style.marginTop = px(-(spec.marginTop ?? 0));
    el.style.marginBottom = px(-(spec.marginBottom ?? 0));
  } else if (spec.covers && spec.bands) {
    // Franjas: hoja (hueco + margen inferior), fondo del lienzo (separación) y hoja (margen superior).
    const { fill, bottom, gap, top } = spec.bands;
    const a = fill + bottom;
    el.style.background = `linear-gradient(to bottom, var(--paper) ${px(a)}, var(--canvas) ${px(a)}, var(--canvas) ${px(a + gap)}, var(--paper) ${px(a + gap)})`;
    el.style.height = px(a + gap + top);
    el.classList.add('page-gap-covers');
  }
  return el;
}

/** Construye las decoraciones; la clave evita recrear el DOM de un hueco que no cambió. */
export function gapDecorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  gaps: GapSpec[],
): DecorationSet {
  return DecorationSet.create(
    doc,
    gaps.map((g) =>
      Decoration.widget(g.pos, () => gapDom(g), {
        side: -1,
        key: `${g.inline ? 'i' : 'b'}${g.pos}:${px(g.height)}:${px(g.marginTop ?? 0)}:${px(g.marginBottom ?? 0)}:${g.covers ? 1 : 0}:${g.row ?? 0}:${g.inCell ? 1 : 0}:${g.cellBand ? `${px(g.cellBand.offset)}/${px(g.cellBand.fill)}` : ''}`,
        ignoreSelection: true,
        stopEvent: () => true,
      }),
    ),
  );
}

export function applyGaps(view: EditorView, set: DecorationSet): void {
  view.dispatch(view.state.tr.setMeta(pageKey, set).setMeta('addToHistory', false));
}
