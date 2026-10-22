import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view';
import { SHEET_GAP, type PageGeometry } from '@shared/page';
import { paginate, type BlockMetrics } from '../paginator/layout';

/**
 * Vista de páginas del modo texto (07 · VW-15): las líneas de código ocupan la hoja con los mismos
 * márgenes y los saltos se dibujan como bloques entre líneas, con el mismo motor de paginación.
 */

/** Geometría vigente y receptor del resultado (los fija el controlador). */
export const sourcePageConfig: {
  geometry: PageGeometry | null;
  onLayout: (pages: number) => void;
} = { geometry: null, onLayout: () => undefined };

export const refreshPages = StateEffect.define<null>();
const setGaps = StateEffect.define<DecorationSet>();

class GapWidget extends WidgetType {
  constructor(readonly height: number) {
    super();
  }
  eq(other: GapWidget): boolean {
    return Math.abs(other.height - this.height) < 0.1;
  }
  toDOM(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'page-gap source-gap';
    el.style.height = `${this.height}px`;
    return el;
  }
  ignoreEvent(): boolean {
    return true;
  }
}

const gapField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(set, tr) {
    for (const e of tr.effects) if (e.is(setGaps)) return e.value;
    return tr.docChanged ? set.map(tr.changes) : set;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const pagePlugin = ViewPlugin.fromClass(
  class {
    private frame = 0;
    private sig = '';
    constructor(private view: EditorView) {
      this.schedule();
    }
    update(u: import('@codemirror/view').ViewUpdate): void {
      const forced = u.transactions.some((t) => t.effects.some((e) => e.is(refreshPages)));
      if (forced) this.sig = '';
      if (forced || u.docChanged || u.heightChanged || u.geometryChanged) this.schedule();
    }
    schedule(): void {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.run();
      });
    }
    run(): void {
      const g = sourcePageConfig.geometry;
      const { view } = this;
      if (!g) {
        if (this.sig !== 'off') {
          this.sig = 'off';
          view.dispatch({ effects: setGaps.of(Decoration.none) });
        }
        return;
      }
      const { doc } = view.state;
      const chrome = g.margins.bottom + SHEET_GAP + g.margins.top;
      const blocks: BlockMetrics[] = [];
      const starts: number[] = [];
      for (let n = 1; n <= doc.lines; n++) {
        const line = doc.line(n);
        starts.push(line.from);
        blocks.push({ height: view.lineBlockAt(line.from).height, gapBefore: 0 });
      }
      const layout = paginate(blocks, { contentHeight: g.contentHeight, chrome });
      const sig = `${layout.pages}|${layout.breaks.map((b) => `${b.block}:${Math.round(b.fill)}`).join(',')}`;
      sourcePageConfig.onLayout(layout.pages);
      if (sig === this.sig) return;
      this.sig = sig;
      const builder = new RangeSetBuilder<Decoration>();
      for (const b of layout.breaks) {
        builder.add(
          starts[b.block]!,
          starts[b.block]!,
          Decoration.widget({ widget: new GapWidget(b.fill + chrome), block: true, side: -1 }),
        );
      }
      view.dispatch({ effects: setGaps.of(builder.finish()) });
    }
    destroy(): void {
      if (this.frame) cancelAnimationFrame(this.frame);
    }
  },
);

export const sourcePages = (): Extension => [gapField, pagePlugin];
