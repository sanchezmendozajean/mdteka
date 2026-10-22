import {
  fontKind,
  fontStack,
  type BlockStyle,
  type Resolved,
  type StyleKey,
} from '@shared/document-config';

/** 1 pt = 96/72 px CSS. */
const PX_PER_PT = 96 / 72;
const round = (n: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

/**
 * CSS de un documento (DOC-11), acotado con `[data-doc-id="…"]`: la configuración de una pestaña
 * no puede alcanzar a otra. Las alturas de línea se calculan aquí como píxeles enteros para que
 * sigan siendo fijas por tipo de bloque, sea cual sea la configuración (ED-10).
 */
export function buildDocCss(id: string, cfg: Resolved): string {
  const S = `[data-doc-id="${id}"]`;
  const t = cfg.typography;
  const base = round(t.size * PX_PER_PT, 2);
  const line = Math.round(base * t.lineHeight);
  const gap = Math.round(base * t.paragraphSpacing);
  const mono = round(base * 0.875, 1);
  const monoLine = Math.round(mono * 1.57);
  const st = (k: StyleKey) => cfg.styles[k] ?? {};
  const out: string[] = [];
  const rule = (selector: string, body: string) => {
    if (body) out.push(`${S} ${selector}{${body}}`);
  };
  const extras = (s: BlockStyle) =>
    [
      s.color && `color:${s.color}`,
      s.weight && `font-weight:${s.weight}`,
      s.italic !== undefined && `font-style:${s.italic ? 'italic' : 'normal'}`,
      s.uppercase && 'text-transform:uppercase',
      s.letterSpacing !== undefined && `letter-spacing:${s.letterSpacing}em`,
      s.background && `background:${s.background}`,
      s.borderLeft && `border-left:${s.borderLeft}`,
    ]
      .filter(Boolean)
      .join(';');

  out.push(
    `${S}{--doc-font:${fontStack(t.font, fontKind(t.font))};--doc-mono:${fontStack(t.monoFont, 'mono')}}`,
  );
  rule(
    '.ProseMirror',
    `font-size:${base}px;line-height:${line}px;text-align:${t.textAlign};hyphens:${t.hyphenate ? 'auto' : 'manual'};counter-reset:h1 h2 h3 h4 h5 h6`,
  );
  const p = st('paragraph');
  rule('.ProseMirror p', `margin:0 0 ${gap}px;line-height:${line}px;${extras(p)}`);
  rule('.ProseMirror li', `line-height:${line}px`);
  rule('.ProseMirror li > p', `margin:0 0 ${Math.round(gap / 3)}px`);
  rule(
    '.ProseMirror ul,' +
      ` ${S} .ProseMirror ol,` +
      ` ${S} .ProseMirror .code-block,` +
      ` ${S} .ProseMirror table`,
    `margin-bottom:${gap}px`,
  );
  rule('.ProseMirror blockquote', `margin:0 0 ${gap}px;${extras(st('blockquote'))}`);
  rule('.ProseMirror pre', `font-size:${mono}px;line-height:${monoLine}px;${extras(st('code'))}`);
  rule(
    '.ProseMirror th, ' + `${S} .ProseMirror td`,
    `line-height:${Math.max(line - 4, monoLine)}px`,
  );
  rule('.ProseMirror a', extras(st('link')));

  HEADINGS.forEach((k, i) => {
    const s = st(k);
    const size = round(base * (s.size ?? 1), 1);
    const lh = Math.max(Math.round(size * 1.25), line);
    const reset = HEADINGS.slice(i + 1).join(' ');
    rule(
      `.ProseMirror ${k}`,
      `font-size:${size}px;line-height:${lh}px;margin:${Math.round(base * (s.spacingBefore ?? 0))}px 0 ${Math.round(base * (s.spacingAfter ?? 0))}px;font-weight:${s.weight ?? 600};${extras({ ...s, weight: undefined })};counter-increment:${k}${reset ? `;counter-reset:${reset}` : ''}`,
    );
    if (s.numbering) {
      const number = HEADINGS.slice(0, i + 1)
        .map((h) => `counter(${h})`)
        .join(' "." ');
      rule(`.ProseMirror ${k}::before`, `content:${number} " ";font-weight:inherit;opacity:.7`);
    }
  });
  rule('.ProseMirror > :first-child', 'margin-top:0');
  return out.join('\n');
}
