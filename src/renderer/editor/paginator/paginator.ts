import type { Node as PmNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { SHEET_GAP, type PageGeometry } from '@shared/page';
import { paginate, type BlockMetrics, type Layout, type Line } from './layout';
import { applyGaps, gapDecorations, type GapSpec } from './plugin';

export interface NodeMetrics {
  height: number;
  mt: number;
  mb: number;
  wasFirst: boolean;
  lines?: Line[];
}

export interface PaginatorHooks {
  /** Elemento que recibe el desplazamiento al compensar el cursor. */
  scroller: () => HTMLElement | null;
  /** Resultado de cada paginación (null si la vista de páginas no está activa). */
  onLayout: (layout: Layout | null) => void;
}

/** Medidas y reparto de todo el documento (también lo usa la exportación a PDF, VW-14). */
export interface Analysis {
  layout: Layout;
  nodes: PmNode[];
  positions: number[];
  metrics: NodeMetrics[];
  chrome: number;
  scale: number;
}

const TYPING_QUIET_MS = 150;
const TYPING_MAX_WAIT_MS = 1200;
const MIN_LINES_TO_SPLIT = 4;

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
  private lastTokens: string[] = [];
  private lastCutNodes: PmNode[] = [];
  private frame = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastEdit = 0;
  private deferredSince = 0;
  layout: Layout | null = null;

  constructor(
    private view: EditorView,
    private hooks: PaginatorHooks,
    listenFonts = true,
  ) {
    // Al terminar de cargar una fuente cambian las alturas: se vuelve a medir todo.
    if (listenFonts) document.fonts.addEventListener('loadingdone', () => this.invalidate());
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
    if (this.lastTokens.length) applyGaps(this.view, gapDecorations(this.view.state.doc, []));
    this.lastTokens = [];
    this.lastCutNodes = [];
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

  /** Mide el documento y reparte los bloques en páginas, sin tocar el DOM. */
  analyze(g: PageGeometry): Analysis | null {
    const s = this.scale(g);
    if (s === 0) return null; // el editor está oculto
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
    return { layout, nodes, positions, metrics, chrome, scale: s };
  }

  run(): void {
    const start = performance.now();
    try {
      this.runInner();
    } finally {
      // Medida visible en las pruebas y en el perfilador (VW-11).
      performance.measure('mdteca:paginate', { start, end: performance.now() });
    }
  }

  private runInner(): void {
    const g = this.geometry;
    if (!g) return;
    // Posición del cursor antes de tocar el DOM: se restituye tras aplicar los saltos (VW-13).
    const before = this.caretTop();
    const analysis = this.analyze(g);
    if (!analysis) return; // el editor está oculto (modo texto)
    const { layout, nodes, positions, metrics, chrome, scale: s } = analysis;
    this.layout = layout;

    // Firma del reparto: si no cambió (ni los bloques cortados por líneas), no se toca el DOM.
    const tokens = layout.breaks.map((b) =>
      b.kind === 'block'
        ? `b${b.block}:${Math.round(b.fill * 10)}`
        : `l${b.block}:${b.line}:${Math.round(b.fill * 10)}`,
    );
    const cutNodes = layout.breaks.filter((b) => b.kind === 'line').map((b) => nodes[b.block]!);
    const sig = tokens.join('|');
    const same =
      sig === this.lastSig &&
      cutNodes.length === this.lastCutNodes.length &&
      cutNodes.every((n, i) => n === this.lastCutNodes[i]);
    if (same) {
      this.hooks.onLayout(layout);
      return;
    }

    // VW-13: lo que mueve el bloque del cursor espera a una pausa al escribir.
    const age = performance.now() - this.lastEdit;
    if (age < TYPING_QUIET_MS && this.affectsCaret(tokens)) {
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
        const start = positions[c.block]! + 1;
        const end = positions[c.block]! + node.nodeSize - 1;
        const pos = this.lineStart(start, end, rect.top + line.top * s);
        if (pos === null) continue;
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
    this.lastSig = sig;
    this.lastCutNodes = cutNodes;
    this.lastTokens = tokens;
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

  /**
   * Posición del primer carácter de la línea cuyo borde superior está en `top` (px de pantalla).
   * Búsqueda binaria sobre `coordsAtPos`, que a diferencia de `posAtCoords` también funciona con
   * líneas fuera de la ventana visible.
   */
  private lineStart(from: number, to: number, top: number): number | null {
    const topAt = (pos: number): number | null => {
      try {
        return this.view.coordsAtPos(pos, 1).top;
      } catch {
        return null;
      }
    };
    let lo = from;
    let hi = to;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const t = topAt(mid);
      if (t === null) return null;
      if (t >= top - 2) hi = mid;
      else lo = mid + 1;
    }
    const t = topAt(lo);
    return t !== null && t >= top - 2 ? lo : null;
  }

  /** ¿Cambia algún salto situado antes del bloque del cursor, o en él? */
  private affectsCaret(next: string[]): boolean {
    const caretBlock = this.view.state.selection.$head.index(0);
    const index = (t: string) => Number(/^[bl](\d+):/.exec(t)?.[1] ?? Infinity);
    const old = new Set(this.lastTokens);
    const now = new Set(next);
    for (const t of old) if (!now.has(t) && index(t) <= caretBlock) return true;
    for (const t of now) if (!old.has(t) && index(t) <= caretBlock) return true;
    return false;
  }
}
