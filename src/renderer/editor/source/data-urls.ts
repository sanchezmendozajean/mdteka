import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

/**
 * Plegado de data URLs (06 · IMG-01): en modo texto, `![](data:image/png;base64,iVBOR…)` muestra
 * `![](data:image/png;base64,…·48 KB)`. El texto real no cambia: es solo una decoración.
 */

const DATA_URL = /(data:image\/[a-z0-9.+-]+;base64,)([A-Za-z0-9+/=]{120,})/g;

class FoldedData extends WidgetType {
  constructor(readonly kb: number) {
    super();
  }
  eq(other: FoldedData): boolean {
    return other.kb === this.kb;
  }
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.className = 'cm-data-fold';
    el.textContent = `…·${this.kb} KB`;
    el.title = 'Datos de la imagen incrustada';
    return el;
  }
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    for (const m of text.matchAll(DATA_URL)) {
      const start = from + m.index! + m[1]!.length;
      const end = start + m[2]!.length;
      // Bytes reales de la imagen: 3 de cada 4 caracteres base64.
      const kb = Math.max(1, Math.round((m[2]!.length * 3) / 4 / 1024));
      builder.add(start, end, Decoration.replace({ widget: new FoldedData(kb) }));
    }
  }
  return builder.finish();
}

export const foldDataUrls = (): Extension => {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(u: ViewUpdate): void {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view);
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (p) =>
        EditorView.atomicRanges.of((view) => view.plugin(p)?.decorations ?? Decoration.none),
    },
  );
  return plugin;
};
