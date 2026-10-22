import type { DocumentConfig } from './document-config';

/** Geometría de página (04, 07). Todo en px CSS (96 por pulgada) salvo que se indique mm. */
export const PX_PER_MM = 96 / 25.4;
export const mmToPx = (mm: number): number => mm * PX_PER_MM;

/** Separación vertical entre hojas en pantalla (VW-01). */
export const SHEET_GAP = 24;

export const PAPER_MM = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
  B5: { width: 176, height: 250 },
} as const;

export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface HeaderFooter {
  text: string;
  align: 'left' | 'center' | 'right';
}

export interface PageGeometry {
  widthMm: number;
  heightMm: number;
  /** Tamaño de la hoja y márgenes en px. */
  width: number;
  height: number;
  margins: Margins;
  /** Área de texto de una página. */
  contentWidth: number;
  contentHeight: number;
  header: HeaderFooter;
  footer: HeaderFooter;
  firstPageDifferent: boolean;
}

type PageCfg = NonNullable<DocumentConfig['page']>;

/** Geometría efectiva a partir de `page` (ya fusionado con lo heredado). */
export function pageGeometry(page: PageCfg | undefined): PageGeometry {
  const size = page?.size ?? 'A4';
  const paper = typeof size === 'string' ? PAPER_MM[size] : size;
  const landscape = page?.orientation === 'landscape';
  const widthMm = landscape
    ? Math.max(paper.width, paper.height)
    : Math.min(paper.width, paper.height);
  const heightMm = landscape
    ? Math.min(paper.width, paper.height)
    : Math.max(paper.width, paper.height);
  const m = page?.margins ?? { top: 25, right: 25, bottom: 25, left: 25 };
  const margins = {
    top: mmToPx(m.top),
    right: mmToPx(m.right),
    bottom: mmToPx(m.bottom),
    left: mmToPx(m.left),
  };
  const width = mmToPx(widthMm);
  const height = mmToPx(heightMm);
  return {
    widthMm,
    heightMm,
    width,
    height,
    margins,
    contentWidth: Math.max(50, width - margins.left - margins.right),
    contentHeight: Math.max(50, height - margins.top - margins.bottom),
    header: { text: page?.header?.text ?? '', align: page?.header?.align ?? 'left' },
    footer: { text: page?.footer?.text ?? '{page}', align: page?.footer?.align ?? 'center' },
    firstPageDifferent: page?.firstPageDifferent === true,
  };
}

/** Sustituye `{title}`, `{page}`, `{pages}` y `{date}` en el texto de encabezado o pie. */
export function expandTokens(
  text: string,
  values: { title: string; page: number; pages: number; date: string },
): string {
  return text
    .replace(/\{title\}/g, values.title)
    .replace(/\{pages\}/g, String(values.pages))
    .replace(/\{page\}/g, String(values.page))
    .replace(/\{date\}/g, values.date);
}
