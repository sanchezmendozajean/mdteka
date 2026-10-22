import { describe, expect, it } from 'vitest';
import { expandTokens, pageGeometry, snap64 } from '../../src/shared/page';

describe('[VW-01] geometría de página', () => {
  it('A4 vertical: 210 × 297 mm con márgenes de 25 mm', () => {
    const g = pageGeometry(undefined);
    expect(g.widthMm).toBe(210);
    expect(g.heightMm).toBe(297);
    expect(g.width).toBeCloseTo(793.7, 0);
    expect(g.margins.left).toBeCloseTo(94.49, 1);
    expect(g.contentWidth).toBeCloseTo(g.width - 2 * g.margins.left, 5);
  });

  it('la orientación horizontal intercambia ancho y alto, y los papeles se respetan', () => {
    const g = pageGeometry({ size: 'Letter', orientation: 'landscape' });
    expect(g.widthMm).toBe(279.4);
    expect(g.heightMm).toBe(215.9);
    expect(pageGeometry({ size: { width: 100, height: 150 } }).heightMm).toBe(150);
  });

  it('hoja y márgenes son múltiplos de 1/64 px (sin deriva acumulada entre páginas)', () => {
    const g = pageGeometry({
      size: 'A5',
      margins: { top: 17.3, right: 12.7, bottom: 31.1, left: 9.9 },
    });
    for (const v of [
      g.width,
      g.height,
      g.margins.top,
      g.margins.right,
      g.margins.bottom,
      g.margins.left,
      g.contentHeight,
    ]) {
      expect(snap64(v)).toBe(v);
    }
  });
});

describe('[VW-02] encabezado y pie', () => {
  it('sustituye {title}, {page}, {pages} y {date}', () => {
    expect(
      expandTokens('{title} — {page}/{pages} ({date})', {
        title: 'Informe',
        page: 3,
        pages: 12,
        date: '1/1/2026',
      }),
    ).toBe('Informe — 3/12 (1/1/2026)');
  });

  it('el pie por defecto es {page} centrado', () => {
    const g = pageGeometry(undefined);
    expect(g.footer).toEqual({ text: '{page}', align: 'center' });
    expect(g.header.text).toBe('');
  });
});
