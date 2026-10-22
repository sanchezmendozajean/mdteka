import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';

/** Saltos de página dibujados como decoraciones: el documento no cambia (VW-10). */
export const pageKey = new PluginKey<DecorationSet>('mdteca-pages');

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
}

const px = (n: number) => `${Math.round(n * 64) / 64}px`;

function gapDom(spec: GapSpec): HTMLElement {
  const el = document.createElement('div');
  el.className = spec.inline ? 'page-gap page-gap-inline' : 'page-gap';
  el.contentEditable = 'false';
  el.dataset['gapHeight'] = String(spec.height);
  el.style.height = px(spec.height);
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
        key: `${g.inline ? 'i' : 'b'}${g.pos}:${px(g.height)}:${px(g.marginTop ?? 0)}:${px(g.marginBottom ?? 0)}:${g.covers ? 1 : 0}`,
        ignoreSelection: true,
        stopEvent: () => true,
      }),
    ),
  );
}

export function applyGaps(view: EditorView, set: DecorationSet): void {
  view.dispatch(view.state.tr.setMeta(pageKey, set).setMeta('addToHistory', false));
}
