import type { Node as PmNode } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';
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
  /** Tablas: dónde empieza cada tramo de `lines` (fila y altura; `inside`: a mitad de fila). */
  cuts?: { row: number; y: number; inside: boolean; rowTop: number }[];
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
/** Bloques con párrafos dentro que se pueden cortar entre sus líneas. */
const CONTAINERS = new Set(['bullet_list', 'ordered_list', 'blockquote']);

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

  /** Descarta la medida del bloque que contiene `el` (una imagen terminó de cargar, por ejemplo). */
  invalidateAt(el: Element | null): void {
    if (!this.geometry) return;
    try {
      if (el) {
        const $pos = this.view.state.doc.resolve(this.view.posAtDOM(el, 0));
        if ($pos.depth >= 1) this.cache.delete($pos.node(1));
      } else this.cache = new WeakMap();
    } catch {
      this.cache = new WeakMap();
    }
    this.schedule(false);
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
    const inner =
      node.type.name === 'table'
        ? this.tableRows(dom).reduce((n, r) => n + r.own, 0)
        : this.gapSum(dom);
    const m: NodeMetrics = {
      height: rect.height / s - inner,
      mt: parseFloat(cs.marginTop) || 0,
      mb: parseFloat(cs.marginBottom) || 0,
      wasFirst: i === 0,
    };
    const name = node.type.name;
    if (name === 'paragraph' || name === 'code_block') this.measureLines(dom, name, m, s);
    else if (CONTAINERS.has(name)) this.measureNestedLines(dom, m, s);
    else if (name === 'table') this.measureRows(dom, m, s);
    return m;
  }

  /** Altura de los huecos dibujados dentro de `el` (en serie: suman). */
  private gapSum(el: Element): number {
    let n = 0;
    el.querySelectorAll<HTMLElement>('.page-gap-inline').forEach((g) => {
      n += Number(g.dataset['gapHeight'] ?? 0);
    });
    return n;
  }

  /** Filas de una tabla en orden (con las filas-hueco) y lo que cada una creció por huecos. */
  private tableRows(dom: HTMLElement): { tr: HTMLElement; cells: HTMLElement[]; own: number }[] {
    const trs = [...dom.querySelectorAll<HTMLElement>(':scope > tbody > tr, :scope > tr')];
    return trs.map((tr) => {
      if (tr.classList.contains('page-gap-row')) {
        return { tr, cells: [], own: Number(tr.dataset['gapHeight'] ?? 0) };
      }
      const cells = [...tr.children] as HTMLElement[];
      // Los huecos de celdas distintas corren en paralelo: la fila crece lo que el mayor.
      return { tr, cells, own: Math.max(0, ...cells.map((c) => this.gapSum(c))) };
    });
  }

  /**
   * Una tabla se corta entre filas y, como en Word, también dentro de una fila: el texto de cada
   * celda se parte por donde llegue. Cada tramo (fila o parte de fila) hace de «línea».
   */
  private measureRows(dom: HTMLElement, m: NodeMetrics, s: number): void {
    const origin = dom.getBoundingClientRect().top;
    const lines: Line[] = [];
    const cuts: NonNullable<NodeMetrics['cuts']> = [];
    let extra = 0; // huecos ya dibujados por encima de la fila
    let rowIndex = 0;
    for (const { tr, cells, own } of this.tableRows(dom)) {
      if (tr.classList.contains('page-gap-row')) {
        extra += own;
        continue;
      }
      const rect = tr.getBoundingClientRect();
      const rowTop = (rect.top - origin) / s - extra;
      const rowBottom = rowTop + rect.height / s - own;
      const cuttable = this.rowCuts(cells, origin, s, extra, rowTop, rowBottom);
      const bounds = [rowTop, ...cuttable, rowBottom];
      for (let j = 0; j < bounds.length - 1; j++) {
        lines.push({ top: bounds[j]!, bottom: bounds[j + 1]! });
        cuts.push({ row: rowIndex, y: bounds[j]!, inside: j > 0, rowTop });
      }
      extra += own;
      rowIndex++;
    }
    // Tramos contiguos: el borde entre filas pertenece a la de arriba.
    for (let j = 0; j < lines.length - 1; j++) lines[j]!.bottom = lines[j + 1]!.top;
    if (lines.length) {
      m.lines = lines;
      m.cuts = cuts;
    }
  }

  /**
   * Alturas (respecto a la tabla) donde se puede cortar dentro de una fila: inicio de línea en
   * alguna celda, sin que ninguna línea de otra celda quede a caballo y con al menos dos líneas a
   * cada lado. Vacío si alguna celda tiene algo que no se mide por líneas (código, imágenes).
   */
  private rowCuts(
    cells: HTMLElement[],
    origin: number,
    s: number,
    extra: number,
    rowTop: number,
    rowBottom: number,
  ): number[] {
    const all: Line[] = [];
    let minLh = Infinity;
    for (const cell of cells) {
      if (cell.querySelector('pre, table, hr, img, figure')) return [];
      const cs = getComputedStyle(cell);
      const lh = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lh) || lh <= 0) return [];
      // El texto va directo en la celda (sin párrafos): las líneas se cuentan sobre sus nodos.
      const guess =
        cell.getBoundingClientRect().top +
        ((parseFloat(cs.borderTopWidth) || 0) / 2 + (parseFloat(cs.paddingTop) || 0)) * s;
      const gaps = [...cell.querySelectorAll<HTMLElement>('.page-gap-inline')].map((g) => ({
        bottom: g.getBoundingClientRect().bottom,
        height: Number(g.dataset['gapHeight'] ?? 0) * s,
      }));
      const seen: { cy: number; idx: number }[] = [];
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.height < 1) continue;
          const cy = r.top + r.height / 2;
          const above = gaps.reduce((n, g) => (g.bottom <= cy + 1 ? n + g.height : n), 0);
          seen.push({ cy: cy - above, idx: Math.floor((cy - above - guess) / (lh * s)) });
        }
      }
      if (!seen.length) continue;
      // La rejilla de líneas se ancla en el texto real: el centro de cada línea cae a media altura.
      const devs = seen.map((x) => x.cy - (x.idx + 0.5) * lh * s - guess).sort((x, y) => x - y);
      const topScreen = guess + devs[devs.length >> 1]!;
      const last = Math.max(...seen.map((x) => x.idx));
      const top = (topScreen - origin) / s - extra;
      minLh = Math.min(minLh, lh);
      for (let j = 0; j <= last; j++) all.push({ top: top + j * lh, bottom: top + (j + 1) * lh });
    }
    if (!all.length) return [];
    const margin = 2 * minLh - 1;
    const ys = [...new Set(all.map((l) => Math.round(l.top * 2) / 2))].sort((x, y) => x - y);
    return ys.filter(
      (y) =>
        y - rowTop >= margin &&
        rowBottom - y >= margin &&
        !all.some((l) => l.top < y - 1 && l.bottom > y + 1),
    );
  }

  /**
   * Líneas de una lista o cita: las de cada párrafo que contiene, en coordenadas del bloque (no
   * contiguas: entre elementos queda su separación). Los huecos ya dibujados se descuentan.
   */
  private measureNestedLines(dom: HTMLElement, m: NodeMetrics, s: number): void {
    // Con código, tablas o imágenes dentro el bloque no se corta.
    if (dom.querySelector('pre, table, hr, img, figure')) return;
    const origin = dom.getBoundingClientRect().top;
    const gaps = [...dom.querySelectorAll<HTMLElement>('.page-gap-inline')];
    const gapHeight = (el: HTMLElement) => Number(el.dataset['gapHeight'] ?? 0);
    const lines: Line[] = [];
    for (const box of dom.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6')) {
      const cs = getComputedStyle(box);
      const lh = parseFloat(cs.lineHeight);
      if (!Number.isFinite(lh) || lh <= 0) return;
      const pt = parseFloat(cs.paddingTop) || 0;
      const pb = parseFloat(cs.paddingBottom) || 0;
      const rect = box.getBoundingClientRect();
      let inner = 0;
      let above = 0;
      for (const g of gaps) {
        if (box.contains(g)) inner += gapHeight(g);
        else if (box.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_PRECEDING)
          above += gapHeight(g);
      }
      const text = rect.height / s - inner - pt - pb;
      const n = Math.round(text / lh);
      if (n < 1 || Math.abs(text - n * lh) > 1.5) return;
      const top = (rect.top - origin) / s - above + pt;
      for (let j = 0; j < n; j++) lines.push({ top: top + j * lh, bottom: top + (j + 1) * lh });
    }
    if (lines.length >= MIN_LINES_TO_SPLIT) m.lines = lines;
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
      performance.measure('mdtor:paginate', { start, end: performance.now() });
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
      this.alignBands(g, s);
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
        const prev = m.lines?.[c.line - 1];
        if (!dom || !line || !prev) continue;
        if (node.type.name === 'table') {
          this.tableGaps(gaps, node, positions[c.block]!, dom, m, c, line.top - prev.bottom, s, {
            chrome,
            margins: g.margins,
          });
          continue;
        }
        const rect = dom.getBoundingClientRect();
        const start = positions[c.block]! + 1;
        const end = positions[c.block]! + node.nodeSize - 1;
        const at = this.lineStart(start, end, rect.top + line.top * s);
        if (at === null) continue;
        gaps.push({
          pos: this.gapPos(at),
          // La separación natural entre las dos líneas (entre elementos de una lista) ya recorre
          // parte del salto.
          height: c.fill + chrome - (line.top - prev.bottom),
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
    this.alignBands(g, s);
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
   * Ajusta las franjas de las celdas partidas a las hojas reales: el redondeo de los bordes de las
   * tablas (sobre todo con zoom) desplaza el contenido unos píxeles respecto al reparto calculado.
   */
  private alignBands(g: PageGeometry, s: number): void {
    const bands = this.view.dom.querySelectorAll<HTMLElement>('.page-gap-band');
    const origin = document.querySelector('.sheets')?.getBoundingClientRect().top;
    if (!bands.length || origin === undefined || s <= 0) return;
    const pitch = g.height + SHEET_GAP;
    bands.forEach((band) => {
      const pieces = band.children;
      if (pieces.length !== 5) return;
      const bt = band.getBoundingClientRect().top;
      const page = Math.floor((bt - origin) / (pitch * s));
      if (page < 0) return;
      // Todo en px de layout, respecto al borde superior de la franja.
      const at = (y: number) => (origin + y * s - bt) / s;
      const textEnd = at(page * pitch + g.height - g.margins.bottom);
      const sheetEnd = at(page * pitch + g.height);
      const nextStart = at((page + 1) * pitch);
      const textStart = at((page + 1) * pitch + g.margins.top);
      const set = (el: Element, top: number, height: number) => {
        (el as HTMLElement).style.top = `${top}px`;
        (el as HTMLElement).style.height = `${Math.max(0, height)}px`;
      };
      set(pieces[0]!, textEnd, 1);
      set(pieces[1]!, textEnd + 1, sheetEnd - textEnd - 1);
      set(pieces[2]!, sheetEnd, nextStart - sheetEnd);
      const lower = pieces[2]!.lastElementChild as HTMLElement | null;
      if (lower) lower.style.top = `${nextStart - sheetEnd}px`;
      set(pieces[3]!, nextStart, textStart - nextStart - 1);
      set(pieces[4]!, textStart - 1, 1);
      band.style.height = `${textStart}px`;
    });
  }

  /** Huecos de un corte en una tabla: entre filas (una fila vacía) o dentro de una fila (por celda). */
  private tableGaps(
    gaps: GapSpec[],
    node: PmNode,
    tablePos: number,
    dom: HTMLElement,
    m: NodeMetrics,
    c: { line: number; fill: number },
    natural: number,
    s: number,
    page: { chrome: number; margins: { top: number; bottom: number } },
  ): void {
    const cut = m.cuts?.[c.line];
    if (!cut) return;
    const height = c.fill + page.chrome - natural;
    let rowPos = tablePos + 1;
    for (let j = 0; j < cut.row; j++) rowPos += node.child(j).nodeSize;
    const row = node.child(cut.row);
    if (!cut.inside) {
      let cols = 0;
      row.forEach((cell) => {
        cols += Number(cell.attrs['colspan'] ?? 1);
      });
      gaps.push({ pos: rowPos, height, inline: true, row: Math.max(1, cols) });
      return;
    }
    const top = dom.getBoundingClientRect().top + cut.y * s;
    let cellPos = rowPos + 1;
    row.forEach((cell) => {
      const start = cellPos + 1;
      const end = cellPos + cell.nodeSize - 1;
      cellPos += cell.nodeSize;
      const at = this.lineStart(start, end, top);
      // El texto de la celda que sigue al corte baja a la hoja siguiente.
      if (at !== null) gaps.push({ pos: at, height, inline: true, inCell: true });
      // Las franjas cubren los bordes de la celda en el hueco entre hojas.
      gaps.push({
        pos: start,
        height: 0,
        inline: true,
        cellBand: {
          offset: cut.y - cut.rowTop,
          fill: c.fill,
          bottom: page.margins.bottom,
          gap: SHEET_GAP,
          top: page.margins.top,
        },
      });
    });
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

  /**
   * Dónde va el hueco de un corte por línea. A mitad de párrafo, en la línea; al inicio de un
   * párrafo anidado, delante de él, y delante de su elemento de lista si es el primero: así la
   * viñeta pasa de página con su texto.
   */
  private gapPos(pos: number): number {
    let $p = this.view.state.doc.resolve(pos);
    if (!$p.parent.inlineContent) {
      const sel = TextSelection.findFrom($p, 1, true);
      if (!sel) return pos;
      $p = sel.$from;
    }
    let d = $p.depth;
    if ($p.parentOffset > 0 || d < 2) return $p.pos;
    while (d > 2 && $p.index(d - 1) === 0 && $p.node(d - 1).type.name === 'list_item') d--;
    return $p.before(d);
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
