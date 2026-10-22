/**
 * Motor de paginación (07 · VW-12): función pura que reparte bloques en páginas a partir de sus
 * medidas. La pantalla y la exportación a PDF usan este mismo motor (VW-14).
 */

export interface Line {
  /** Posición de la línea respecto al borde superior del bloque. */
  top: number;
  bottom: number;
}

export interface BlockMetrics {
  /** Alto natural (caja de borde) del bloque, sin saltos de página dentro. */
  height: number;
  /** Separación natural con el bloque anterior (se descarta al inicio de página). */
  gapBefore: number;
  /** Fuerza una página nueva tras este bloque (`<!-- mdteca:pagebreak -->`). */
  breakAfter?: boolean;
  /** No se deja solo al pie de página (títulos). */
  keepWithNext?: boolean;
  /** Si se indica, el bloque puede cortarse entre líneas. */
  lines?: Line[];
}

export type PageBreak =
  | { kind: 'block'; block: number; fill: number }
  | { kind: 'line'; block: number; line: number; fill: number };

/** Trozo de un bloque colocado en una página (para dibujar la página: PDF, impresión). */
export interface Part {
  block: number;
  /** Página (desde 1). */
  page: number;
  /** Borde superior del bloque respecto al área de texto; negativo si es una continuación. */
  top: number;
  /** Primera línea que se muestra (0 si el bloque empieza aquí). */
  lineFrom: number;
  /** Alto visible de este trozo (el resto del bloque, si lo hay, continúa en otra página). */
  height: number;
}

export interface Layout {
  /** Trozos de bloque por página, en orden de documento. */
  parts: Part[];
  pages: number;
  /** Cortes en orden de documento. `fill` es el hueco entre el último contenido y el pie del área de texto. */
  breaks: PageBreak[];
  /** Página (desde 1) en la que empieza cada bloque. */
  pageOfBlock: number[];
}

export interface LayoutOptions {
  /** Alto del área de texto de una página. */
  contentHeight: number;
  /** Margen inferior + separación entre hojas + margen superior (lo que recorre un salto, además del hueco). */
  chrome: number;
  /** Líneas mínimas que quedan al pie y al inicio al cortar un párrafo. */
  minLines?: number;
  /** Fracción de página vacía que justifica cortar por líneas en vez de mover el bloque entero. */
  splitThreshold?: number;
}

const EPS = 0.5;

export function paginate(blocks: BlockMetrics[], opts: LayoutOptions): Layout {
  const C = opts.contentHeight;
  const pitch = C + opts.chrome;
  const minLines = opts.minLines ?? 2;
  const threshold = opts.splitThreshold ?? 0.4;
  const breaks: PageBreak[] = [];
  const pageOfBlock: number[] = new Array<number>(blocks.length).fill(1);
  /** Fondo del contenido tras colocar cada bloque (para recolocar títulos). */
  const endY: number[] = new Array<number>(blocks.length).fill(0);
  const parts: Part[] = [];
  const partStart: number[] = new Array<number>(blocks.length).fill(0);

  let page = 1;
  let y = 0; // fondo del último contenido de la página actual
  let fresh = true; // aún no hay contenido en la página actual
  let firstOnPage = 0; // índice del primer bloque de la página actual
  let forceNext = false;

  const newPage = (kind: PageBreak, nextFirst: number) => {
    breaks.push(kind);
    page += 1;
    y = 0;
    fresh = true;
    firstOnPage = nextFirst;
  };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    partStart[i] = parts.length;
    if (forceNext) {
      forceNext = false;
      newPage({ kind: 'block', block: i, fill: C - y }, i);
    }
    pageOfBlock[i] = page;
    let top = fresh ? 0 : y + b.gapBefore;

    if (top + b.height <= C + EPS) {
      parts.push({ block: i, page, top, lineFrom: 0, height: b.height });
      y = top + b.height;
      fresh = false;
      endY[i] = y;
      if (b.breakAfter) forceNext = true;
      continue;
    }

    const lines = b.lines;
    const canSplit = !!lines && lines.length >= minLines * 2;
    const emptyIfMoved = (C - y) / C;

    // 1) Bloque que no cabe en una página vacía (o que dejaría demasiado hueco): cortar por líneas.
    if (canSplit && (b.height > C || (!fresh && emptyIfMoved > threshold))) {
      let start = 0;
      let segTop = top;
      for (;;) {
        const avail = C - segTop;
        const base = lines![start]!.top;
        let k = start;
        while (k < lines!.length && lines![k]!.bottom - base <= avail + EPS) k++;
        if (k >= lines!.length) {
          // El resto cabe entero en esta página.
          parts.push({
            block: i,
            page,
            top: start === 0 ? segTop : -base,
            lineFrom: start,
            height: start === 0 ? b.height : b.height - base,
          });
          y = segTop + (b.height - base);
          fresh = false;
          endY[i] = y;
          break;
        }
        // Viudas y huérfanos: al menos `minLines` abajo y arriba.
        if (lines!.length - k < minLines) k = lines!.length - minLines;
        if (k - start < minLines) {
          if (start === 0 && !fresh) {
            // No caben ni dos líneas: el bloque entero pasa a la página siguiente.
            newPage({ kind: 'block', block: i, fill: C - y }, i);
            pageOfBlock[i] = page;
            segTop = 0;
            continue;
          }
          k = Math.max(k, start + 1);
        }
        const used = segTop + (lines![k - 1]!.bottom - base);
        parts.push({
          block: i,
          page,
          top: start === 0 ? segTop : -base,
          lineFrom: start,
          height: lines![k - 1]!.bottom - (start === 0 ? 0 : base),
        });
        newPage({ kind: 'line', block: i, line: k, fill: C - used }, i);
        start = k;
        segTop = 0;
      }
      if (b.breakAfter) forceNext = true;
      continue;
    }

    // 2) Mover el bloque (y los títulos que lo preceden) a la página siguiente.
    if (!fresh) {
      let p = i;
      while (p - 1 > firstOnPage && blocks[p - 1]!.keepWithNext) p--;
      if (p < i) {
        // Se deshace lo colocado de p..i-1 y se recoloca en la página nueva.
        parts.length = partStart[p]!;
        newPage({ kind: 'block', block: p, fill: C - endY[p - 1]! }, p);
        i = p - 1;
        continue;
      }
      newPage({ kind: 'block', block: i, fill: C - y }, i);
      pageOfBlock[i] = page;
      top = 0;
      if (top + b.height <= C + EPS) {
        parts.push({ block: i, page, top: 0, lineFrom: 0, height: b.height });
        y = b.height;
        fresh = false;
        endY[i] = y;
        if (b.breakAfter) forceNext = true;
        continue;
      }
    }

    // 3) Bloque indivisible más alto que una página: desborda ocupando varias.
    // Regiones de texto que recorre: la k-ésima empieza en k × paso.
    const span = Math.max(1, Math.ceil(b.height / pitch - 1e-9));
    for (let k = 0; k < span; k++) {
      parts.push({
        block: i,
        page: page + k,
        top: -k * pitch,
        lineFrom: 0,
        height: Math.min(C, b.height - k * pitch),
      });
    }
    page += span - 1;
    y = b.height - (span - 1) * pitch;
    fresh = false;
    endY[i] = y;
    if (b.breakAfter) forceNext = true;
  }
  return { pages: page, breaks, pageOfBlock, parts };
}
