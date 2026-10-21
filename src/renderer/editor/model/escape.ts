/**
 * Escapado contextual y mínimo de texto literal (ED-25).
 *
 * El modelo ProseMirror guarda el texto SIN escapes; aquí se decide, carácter a carácter, qué
 * necesita `\` (o una entidad) para que `parse(serialize(s))` vuelva a dar exactamente `s`.
 */

export interface EscapeContext {
  /** Carácter justo antes del texto. '' o '\n' = inicio de línea; '*' = frontera de marca. */
  before: string;
  /** Carácter justo después del texto. '' o '\n' = fin de línea; '*' = frontera de marca. */
  after: string;
  /** Dentro de una celda de tabla: `|` se escapa y no hay construcciones de inicio de línea. */
  cell?: boolean;
  /** Dentro de un título ATX: se protege la secuencia de cierre `#`. */
  heading?: boolean;
}

const ASCII_PUNCT = /[!-/:-@[-`{-~]/;
const WS = /[ \t]/;
const ENTITY = /^&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[A-Za-z][A-Za-z0-9]{0,31});/;
const ENTITY_PREFIX_AT_END = /^&(#[0-9a-fA-FxX]*|[A-Za-z][A-Za-z0-9]*)$/;

const isBoundary = (c: string) => c === '' || c === '\n' || /\s/.test(c);
const isAlnum = (c: string) => c !== '' && /[\p{L}\p{N}]/u.test(c);

const wsEntity = (c: string) => (c === '\t' ? '&#9;' : '&#x20;');

/** Cuántos caracteres del inicio de `line` hay que proteger como sintaxis de inicio de línea. */
function lineStartEscape(line: string): 'none' | number {
  // El primer carácter nunca es espacio aquí (se convierte en entidad antes).
  if (/^#{1,6}([ \t]|$)/.test(line)) return 0;
  if (line.startsWith('>')) return 0;
  if (/^[-+*]([ \t]|$)/.test(line)) return 0;
  if (/^([-*_])([ \t]*\1){2,}[ \t]*$/.test(line)) return 0;
  if (/^-+[ \t]*$/.test(line)) return 0;
  if (/^=+[ \t]*$/.test(line)) return 0;
  const ordered = /^(\d{1,9})([.)])([ \t]|$)/.exec(line);
  if (ordered) return ordered[1]!.length;
  return 'none';
}

export function escapeText(text: string, ctx: EscapeContext): string {
  const chars = Array.from(text);
  const n = chars.length;
  let out = '';
  let lineStart = ctx.before === '' || ctx.before === '\n';
  let angleOpen = false;

  // Inicio de la secuencia de cierre `#` de un título.
  let trailingHash = -1;
  if (ctx.heading && (ctx.after === '' || ctx.after === '\n')) {
    let j = n;
    while (j > 0 && chars[j - 1] === '#') j--;
    if (j < n && (j === 0 ? lineStart : WS.test(chars[j - 1]!))) trailingHash = j;
  }

  for (let i = 0; i < n; i++) {
    const c = chars[i]!;
    const prev = i > 0 ? chars[i - 1]! : ctx.before;
    const next = i < n - 1 ? chars[i + 1]! : ctx.after;

    if (lineStart) {
      // Línea vacía de sangría o primer carácter blanco: se protege con una entidad.
      if (WS.test(c)) {
        out += wsEntity(c);
        lineStart = false;
        continue;
      }
      if (!ctx.cell) {
        let end = chars.indexOf('\n', i);
        if (end < 0) end = n;
        const line = chars.slice(i, end).join('');
        const hit = lineStartEscape(line);
        if (hit !== 'none') {
          // Se escapa el carácter en la posición `hit` de la línea (marcador o delimitador).
          const target = i + hit;
          for (let k = i; k < target; k++) out += chars[k];
          out += '\\' + chars[target];
          i = target;
          lineStart = false;
          continue;
        }
      }
    }
    lineStart = false;

    if (c === '\n') {
      out += c;
      lineStart = true;
      continue;
    }

    // Blanco al final de línea (se eliminaría al reanalizar).
    if (WS.test(c) && (next === '' || next === '\n')) {
      out += wsEntity(c);
      continue;
    }

    if (i === trailingHash && c === '#') {
      out += '\\#';
      continue;
    }

    switch (c) {
      case '\\': {
        // El siguiente carácter puede salir como entidad (`&…`) si es un blanco de fin de línea.
        const nextIsEntityWs =
          i < n - 1 &&
          WS.test(next) &&
          (i + 2 < n ? chars[i + 2] === '\n' : ctx.after === '' || ctx.after === '\n');
        out += ASCII_PUNCT.test(next) || next === '\n' || nextIsEntityWs ? '\\\\' : c;
        break;
      }
      case '*':
        out += isBoundary(prev) && isBoundary(next) ? c : '\\*';
        break;
      case '_':
        out +=
          (isAlnum(prev) && isAlnum(next)) || (isBoundary(prev) && isBoundary(next)) ? c : '\\_';
        break;
      case '`':
      case '[':
      case ']':
      case '~':
        out += '\\' + c;
        break;
      case '<':
        if (/[A-Za-z/!?]/.test(next)) {
          out += '&lt;';
          angleOpen = true;
        } else out += c;
        break;
      case '>':
        if (angleOpen) {
          out += '&gt;';
          angleOpen = false;
        } else out += c;
        break;
      case '&': {
        const rest = chars.slice(i).join('');
        const atEnd = ENTITY_PREFIX_AT_END.test(rest) && ctx.after !== '' && ctx.after !== '\n';
        out += ENTITY.test(rest) || atEnd ? '&amp;' : c;
        break;
      }
      case '|':
        out += ctx.cell ? '\\|' : c;
        break;
      default:
        out += c;
    }
  }
  return out;
}
