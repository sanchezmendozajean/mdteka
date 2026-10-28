/** Detección y normalización de BOM, EOL y bloque de configuración (ED-20, GIT-03). */

export type Eol = '\n' | '\r\n';

export interface TextFormat {
  /** Texto interno: sin BOM y con EOL normalizado a `\n`. */
  text: string;
  eol: Eol;
  bom: boolean;
}

const BOM = '﻿';

export function detectFormat(raw: string): TextFormat {
  const bom = raw.startsWith(BOM);
  const body = bom ? raw.slice(1) : raw;
  const crlf = (body.match(/\r\n/g) ?? []).length;
  const lf = (body.match(/\n/g) ?? []).length - crlf;
  const eol: Eol = crlf > lf ? '\r\n' : '\n';
  return { text: body.replace(/\r\n/g, '\n'), eol, bom };
}

/** Inverso de `detectFormat`: reconstruye el contenido del archivo. */
export function applyFormat(text: string, eol: Eol, bom: boolean): string {
  const body = eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  return bom ? BOM + body : body;
}

const CONFIG_START = '<!-- mdtor:config';

export interface SplitConfig {
  /** Markdown sin el bloque de configuración. */
  body: string;
  /** Texto literal del bloque (desde `<!-- mdtor:config` hasta el final), o ''. */
  configRaw: string;
}

/**
 * Aparta el último bloque `<!-- mdtor:config … -->` si está al final del archivo (DOC-03).
 * La lectura y validación del JSON llegan en la Fase 2; aquí solo se aparta el texto para que
 * ningún editor lo muestre y se vuelva a unir idéntico al guardar.
 */
export function splitConfigBlock(text: string): SplitConfig {
  const start = text.lastIndexOf(CONFIG_START);
  if (start < 0) return { body: text, configRaw: '' };
  const end = text.indexOf('-->', start);
  if (end < 0 || text.slice(end + 3).trim() !== '') return { body: text, configRaw: '' };
  if (start > 0 && text[start - 1] !== '\n') return { body: text, configRaw: '' };
  return { body: text.slice(0, start), configRaw: text.slice(start) };
}
