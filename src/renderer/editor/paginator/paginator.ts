import type { Node as PmNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { SHEET_GAP, type PageGeometry } from '@shared/page';
import { paginate, type BlockMetrics, type Layout, type Line } from './layout';
import { applyGaps, gapDecorations, type GapSpec } from './plugin';

interface NodeMetrics {
  height: number;
  mt: number;
  mb: number;
  wasFirst: boolean;
  lines?: Line[];
  /** Posición horizontal (px de layout) del texto, para localizar el inicio de cada línea. */
  lineLeft?: number;
}

export interface PaginatorHooks {
  /** Elemento que recibe el desplazamiento al compensar el cursor. */
  scroller: () => HTMLElement | null;
  /** Resultado de cada paginación (null si la vista de páginas no está activa). */
  onLayout: (layout: Layout | null) => void;
}

const TYPING_QUIET_MS = 150;
const TYPING_MAX_WAIT_MS = 1200;
const MIN_LINES_TO_SPLIT = 4;

const sigOf = (g: GapSpec): string =>
  `${g.inline ? 'i' : 'b'}${g.pos}:${Math.round(g.height * 10)}`;

/**
 * Paginador incremental de la vista de páginas (07 · VW-10…VW-13). Mide los bloques de primer
 * nivel (con caché por nodo: solo se vuelve a medir lo editado), reparte con `paginate` y dibuja
 * los saltos como decoraciones. Nunca modifica el documento.
 */
export class Paginator {
  private geometry: PageGeometry | null = null;
  private styleKey = '';
  private cache = new WeakMap<PmNode, NodeMetrics>();
  private lastSig = '';
  private lastGaps: GapSpec[] = [];
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastEdit = 0;
  private deferredSince = 0;
  layout: Layout | null = null;

  constructor(
    private view: EditorView,
    private hooks: PaginatorHooks,
  ) {
    // Al terminar de cargar una fuente cambian las alturas: se vuelve a medir todo.
    document.fonts.addEventListener('loadingdone', () => this.invalidate());
  }

  /** Activa (o desactiva con null) la vista de páginas. `styleKey` cambia con la tipografía. */
  configure(geometry: PageGeometry | null, styleKey: string): void {
    const prev = this.geometry;
    const same =
      !!geometry &&
      !!prev &&
      geometry.contentWidth === prev.contentWidth &&
      geometry.contentHeight === prev.contentHeight &&
      geometry.margins.top === prev.margins.top &&
      geometry.margins.bottom === prev.margins.bottom &&
      styleKey === this.styleKey;
    this.geometry = geometry;
    if (!same) {
      this.cache = new WeakMap();
      this.lastSig = '';
      this.styleKey = styleKey;
    }
    if (!geometry) this.clear();
    else this.schedule(false);
  }

  /** Vuelve a medir todo (cambio de documento, de fuente o de tamaño). */
  invalidate(): void {
    this.cache = new WeakMap();
    this.lastSig = '';
    if (this.geometry) this.schedule(false);
  }

  /** Programa una paginación: tras editar se espera un fotograma; la entrada nunca se bloquea. */
  schedule(edited: boolean): void {
    if (edited) this.lastEdit = performance.now();
    if (!this.geometry || this.frame || this.timer) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.run();
    });
  }

  private clear(): void {
    if (this.lastGaps.length) applyGaps(this.view, gapDecorations(this.view.state.doc, []));
    this.lastGaps = [];
    this.lastSig = '';
    this.layout = null;
    this.hooks.onLayout(null);
  }

  // -------------------------------------------------------------------------------------------
  // Medición
  // -------------------------------------------------------------------------------------------

  private scale(g: PageGeometry): number {
    const w = this.view.dom.getBoundingClientRect().width;
    return w > 0 ? w / g.contentWidth : 0;
  }

  private measure(node: PmNode, dom: HTMLElement, i: number, s: number): NodeMetrics {
    const rect = dom.getBoundingClientRect();
    const cs = getComputedStyle(dom);
    let inner = 0;
    dom.querySelectorAll<HTMLElement>('.page-gap-inline').forEach((el) => {
      inner += Number(el.dataset['gapHeight'] ?? 0);
    });
    const m: NodeMetrics = {
      height: rect.height / s - inner,
      mt: parseFloat(cs.marginTop) || 0,
      mb: parseFloat(cs.marginBottom) || 0,
      wasFirst: i === 0,
    };
    const name = node.type.name;
    if (name === 'paragraph' || name === 'code_block') this.measureLines(dom, name, m, s);
    return m;
  }

  /** Líneas de un párrafo o bloque de código: las alturas son fijas (ED-10), así que se calculan. */
  private measureLines(dom: HTMLElement, name: string, m: NodeMetrics, s: number): void {
    const box = name === 'code_block' ? dom.querySelector('pre') : dom;
    if (!box) return;
    const cs = getComputedStyle(box);
    const lh = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lh) || lh <= 0) return;
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const domRect = dom.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    const offset = name === 'code_block' ? (boxRect.top - domRect.top) / s : 0;
    let inner = 0;
    box.querySelectorAll<HTMLElement>('.page-gap-inline').forEach((el) => {
      inner += Number(el.dataset['gapHeight'] ?? 0);
    });
    const text = boxRect.height / s - inner - pt - pb;
    const n = Math.round(text / lh);
    // Si alguna línea es más alta (imágenes, etc.) el cálculo no vale: el bloque no se corta.
    if (n < MIN_LINES_TO_SPLIT || Math.abs(text - n * lh) > 1.5) return;
    m.lines = Array.from({ length: n }, (_, j) => ({
      top: offset + pt + j * lh,
      bottom: offset + pt + (j + 1) * lh,
    }));
    m.lineLeft = (boxRect.left - domRect.left) / s + (parseFloat(cs.paddingLeft) || 0);
  }

  // -------------------------------------------------------------------------------------------
  // Paginación
  // -------------------------------------------------------------------------------------------

  private caretTop(): number | null {
    if (!this.view.hasFocus()) return null;
    try {
      return this.view.coordsAtPos(this.view.state.selection.head).top;
    } catch {
      return null;
    }
  }

  run(): void {
    const g = this.geometry;
    if (!g) return;
    const s = this.scale(g);
    if (s === 0) return; // el editor está oculto (modo texto)
    const { doc } = this.view.state;

    const nodes: PmNode[] = [];
    const positions: number[] = [];
    doc.forEach((node, offset) => {
      nodes.push(node);
      positions.push(offset);
    });

    const metrics: NodeMetrics[] = [];
    const blocks: BlockMetrics[] = [];
    nodes.forEach((node, i) => {
      let m = this.cache.get(node);
      if (!m || (m.wasFirst && i > 0)) {
        const dom = this.view.nodeDOM(positions[i]!) as HTMLElement | null;
        m = dom ? this.measure(node, dom, i, s) : { height: 0, mt: 0, mb: 0, wasFirst: i === 0 };
        this.cache.set(node, m);
      }
      metrics.push(m);
      const name = node.type.name;
      blocks.push({
        height: m.height,
        gapBefore: i === 0 ? 0 : Math.max(metrics[i - 1]!.mb, m.mt),
        keepWithNext: name === 'heading',
        breakAfter: name === 'page_break',
        lines: m.lines,
      });
    });

    const chrome = g.margins.bottom + SHEET_GAP + g.margins.top;
    const layout = paginate(blocks, { contentHeight: g.contentHeight, chrome });

    // Huecos entre bloques.
    const gaps: GapSpec[] = [];
    const inlineCuts: { block: number; line: number; fill: number }[] = [];
    for (const b of layout.breaks) {
      if (b.kind === 'block') {
        gaps.push({
          pos: positions[b.block]!,
          height: b.fill + chrome,
          inline: false,
          marginTop: metrics[b.block - 1]?.mb ?? 0,
          marginBottom: metrics[b.block]!.mt,
        });
      } else inlineCuts.push(b);
    }

    // Huecos dentro de un bloque: hay que localizar el inicio de cada línea en el DOM, y para eso
    // el bloque debe estar sin huecos internos (las medidas son las naturales).
    if (inlineCuts.length) {
      const dirty = inlineCuts.some((c) =>
        (this.view.nodeDOM(positions[c.block]!) as HTMLElement | null)?.querySelector(
          '.page-gap-inline',
        ),
      );
      if (dirty) applyGaps(this.view, gapDecorations(this.view.state.doc, gaps));
      for (const c of inlineCuts) {
        const node = nodes[c.block]!;
        const m = metrics[c.block]!;
        const dom = this.view.nodeDOM(positions[c.block]!) as HTMLElement | null;
        const line = m.lines?.[c.line];
        if (!dom || !line) continue;
        const rect = dom.getBoundingClientRect();
        const found = this.view.posAtCoords({
          left: rect.left + ((m.lineLeft ?? 0) + 2) * s,
          top: rect.top + ((line.top + line.bottom) / 2) * s,
        });
        if (!found) continue;
        const start = positions[c.block]! + 1;
        const pos = Math.min(Math.max(found.pos, start), positions[c.block]! + node.nodeSize - 1);
        gaps.push({
          pos,
          height: c.fill + chrome,
          inline: true,
          covers: node.type.name === 'code_block',
          bands: { fill: c.fill, bottom: g.margins.bottom, gap: SHEET_GAP, top: g.margins.top },
        });
      }
    }

    gaps.sort((a, b) => a.pos - b.pos);
    this.layout = layout;
    const sig = gaps.map(sigOf).join('|');
    if (sig === this.lastSig) {
      this.hooks.onLayout(layout);
      return;
    }

    // VW-13: lo que mueve el bloque del cursor espera a una pausa al escribir.
    const age = performance.now() - this.lastEdit;
    if (age < TYPING_QUIET_MS && this.affectsCaret(gaps)) {
      if (!this.deferredSince) this.deferredSince = performance.now();
      if (performance.now() - this.deferredSince < TYPING_MAX_WAIT_MS) {
        this.timer = setTimeout(
          () => {
            this.timer = null;
            this.run();
          },
          TYPING_QUIET_MS - age + 5,
        );
        return;
      }
    }
    this.deferredSince = 0;

    const before = this.caretTop();
    this.lastSig = sig;
    this.lastGaps = gaps;
    applyGaps(this.view, gapDecorations(this.view.state.doc, gaps));
    this.hooks.onLayout(layout);
    // El cursor conserva su posición en pantalla aunque su bloque cambie de página.
    if (before !== null) {
      const after = this.caretTop();
      const scroller = this.hooks.scroller();
      if (after !== null && scroller && Math.abs(after - before) > 0.5) {
        scroller.scrollTop += after - before;
      }
    }
  }

  /** ¿Cambia algún hueco situado antes o en el bloque del cursor? */
  private affectsCaret(next: GapSpec[]): boolean {
    const head = this.view.state.selection.head;
    const old = new Map(this.lastGaps.map((g) => [sigOf(g), g.pos]));
    const now = new Map(next.map((g) => [sigOf(g), g.pos]));
    for (const [k, pos] of old) if (!now.has(k) && pos <= head + 1) return true;
    for (const [k, pos] of now) if (!old.has(k) && pos <= head + 1) return true;
    return false;
  }
}
