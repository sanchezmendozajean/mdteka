import { describe, expect, it } from 'vitest';
import { paginate, type BlockMetrics } from '../../src/renderer/editor/paginator/layout';

const C = 100;
const opts = { contentHeight: C, chrome: 40 };
const block = (height: number, extra: Partial<BlockMetrics> = {}): BlockMetrics => ({
  height,
  gapBefore: 10,
  ...extra,
});
const lines = (n: number, h = 10) =>
  Array.from({ length: n }, (_, i) => ({ top: i * h, bottom: (i + 1) * h }));
const para = (n: number): BlockMetrics => block(n * 10, { lines: lines(n) });

describe('[VW-12] motor de paginación', () => {
  it('un documento corto cabe en una página', () => {
    const l = paginate([block(30), block(30)], opts);
    expect(l.pages).toBe(1);
    expect(l.breaks).toEqual([]);
  });

  it('se corta entre bloques y el hueco es lo que sobra en la página', () => {
    const l = paginate([block(60), block(50)], opts);
    expect(l.pages).toBe(2);
    expect(l.breaks).toEqual([{ kind: 'block', block: 1, fill: 40 }]);
    expect(l.pageOfBlock).toEqual([1, 2]);
  });

  it('descarta la separación al inicio de página', () => {
    const l = paginate([block(60), block(95), block(5)], opts);
    expect(l.pageOfBlock).toEqual([1, 2, 3]);
  });

  it('un párrafo que no cabe pasa entero si el hueco es pequeño', () => {
    const l = paginate([block(70), para(4)], opts);
    expect(l.breaks).toEqual([{ kind: 'block', block: 1, fill: 30 }]);
  });

  it('corta por líneas si dejaría más de un 40 % de la página vacía', () => {
    const l = paginate([block(20), para(10)], opts);
    // Tras 20 + 10 de separación quedan 70: caben 7 líneas, el resto (3) pasa a la siguiente.
    expect(l.breaks).toEqual([{ kind: 'line', block: 1, line: 7, fill: 0 }]);
    expect(l.pages).toBe(2);
  });

  it('respeta viudas y huérfanos de 2 líneas', () => {
    const l = paginate([block(20), para(9)], opts);
    // Caben 7 líneas, pero quedarían 2 abajo: bien. Con 8 líneas quedaría 1 → se adelanta una.
    expect(l.breaks[0]).toMatchObject({ kind: 'line', line: 7 });
    const m = paginate([block(20), para(8)], opts);
    expect(m.breaks[0]).toMatchObject({ kind: 'line', line: 6 });
  });

  it('un párrafo más alto que la página se corta en varias', () => {
    const l = paginate([para(25)], opts);
    expect(l.pages).toBe(3);
    expect(l.breaks.map((b) => (b.kind === 'line' ? b.line : -1))).toEqual([10, 20]);
  });

  it('los títulos no quedan solos al pie', () => {
    const l = paginate([block(60), block(30, { keepWithNext: true }), block(30)], opts);
    expect(l.breaks).toEqual([{ kind: 'block', block: 1, fill: 40 }]);
    expect(l.pageOfBlock).toEqual([1, 2, 2]);
  });

  it('un salto de página manual fuerza una página nueva', () => {
    const l = paginate([block(10, { breakAfter: true }), block(10)], opts);
    expect(l.pages).toBe(2);
    expect(l.breaks).toEqual([{ kind: 'block', block: 1, fill: 90 }]);
  });

  it('un bloque indivisible más alto que la página ocupa varias', () => {
    const l = paginate([block(30), block(260), block(10)], opts);
    expect(l.pageOfBlock[1]).toBe(2);
    expect(l.pages).toBe(4); // 1 + las 2 que recorre el bloque (paso de 140) + la del último
    expect(l.pageOfBlock[2]).toBe(4);
    expect(l.breaks.at(-1)).toEqual({ kind: 'block', block: 2, fill: -20 });
  });

  it('es determinista', () => {
    const doc = Array.from({ length: 200 }, (_, i) =>
      i % 7 === 0 ? block(20, { keepWithNext: true }) : para(3 + (i % 5)),
    );
    expect(paginate(doc, opts)).toEqual(paginate(doc, opts));
  });
});
