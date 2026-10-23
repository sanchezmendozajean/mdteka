import { Schema, type DOMOutputSpec, type MarkSpec, type NodeSpec } from 'prosemirror-model';
import { tableNodes } from 'prosemirror-tables';

/**
 * Atributos de preservación de fuente (ED-21). Solo tienen significado en bloques de primer nivel:
 * `src` es el texto original del bloque y `gap` el texto que lo separa del bloque anterior.
 */
const keep = { src: { default: null }, gap: { default: null } };

/** NO existen input rules (ED-15): lo tecleado es siempre texto. */
const nodes: Record<string, NodeSpec> = {
  doc: {
    content: 'block+',
    attrs: { lead: { default: '' }, tail: { default: '\n' } },
  },
  paragraph: {
    attrs: { ...keep },
    content: 'inline*',
    group: 'block',
    parseDOM: [{ tag: 'p' }],
    toDOM: () => ['p', 0] as DOMOutputSpec,
  },
  heading: {
    attrs: { ...keep, level: { default: 1 } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({ tag: `h${level}`, attrs: { level } })),
    toDOM: (node) => [`h${node.attrs['level']}`, 0] as DOMOutputSpec,
  },
  blockquote: {
    attrs: { ...keep },
    content: 'block+',
    group: 'block',
    defining: true,
    parseDOM: [{ tag: 'blockquote' }],
    toDOM: () => ['blockquote', 0] as DOMOutputSpec,
  },
  bullet_list: {
    attrs: { ...keep, tight: { default: true } },
    content: 'list_item+',
    group: 'block',
    parseDOM: [{ tag: 'ul' }],
    toDOM: () => ['ul', 0] as DOMOutputSpec,
  },
  ordered_list: {
    attrs: { ...keep, order: { default: 1 }, tight: { default: true } },
    content: 'list_item+',
    group: 'block',
    parseDOM: [
      {
        tag: 'ol',
        getAttrs: (dom) => ({ order: Number((dom as HTMLElement).getAttribute('start') ?? 1) }),
      },
    ],
    toDOM: (node) =>
      (node.attrs['order'] === 1
        ? ['ol', 0]
        : ['ol', { start: node.attrs['order'] }, 0]) as DOMOutputSpec,
  },
  list_item: {
    /** `checked`: null = viñeta normal, true/false = elemento de lista de tareas. */
    attrs: { checked: { default: null } },
    content: 'block+',
    defining: true,
    parseDOM: [{ tag: 'li' }],
    toDOM: () => ['li', 0] as DOMOutputSpec,
  },
  code_block: {
    attrs: { ...keep, lang: { default: null } },
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    parseDOM: [
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (dom) => {
          const code = (dom as HTMLElement).querySelector('code');
          const cls = code?.className.match(/language-([\w+#-]+)/);
          return { lang: cls?.[1] ?? null };
        },
      },
    ],
    toDOM: () => ['pre', ['code', 0]] as DOMOutputSpec,
  },
  horizontal_rule: {
    attrs: { ...keep },
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM: () => ['hr'] as DOMOutputSpec,
  },
  page_break: {
    attrs: { ...keep },
    group: 'block',
    atom: true,
    selectable: true,
    toDOM: () => ['div', { class: 'page-break' }] as DOMOutputSpec,
  },
  html_block: {
    attrs: { ...keep, value: { default: '' } },
    group: 'block',
    atom: true,
    selectable: true,
    toDOM: () => ['div', { class: 'html-block' }] as DOMOutputSpec,
  },
  raw_block: {
    attrs: { ...keep, value: { default: '' } },
    group: 'block',
    atom: true,
    selectable: true,
    toDOM: () => ['div', { class: 'raw-block' }] as DOMOutputSpec,
  },
  text: { group: 'inline' },
  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: () => ['br'] as DOMOutputSpec,
  },
  image: {
    inline: true,
    group: 'inline',
    atom: true,
    draggable: true,
    attrs: { src: {}, alt: { default: '' }, title: { default: null }, width: { default: null } },
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            src: el.getAttribute('src'),
            alt: el.getAttribute('alt') ?? '',
            title: el.getAttribute('title'),
            width: Number(el.getAttribute('width')) || null,
          };
        },
      },
    ],
    toDOM: (node) =>
      [
        'img',
        {
          src: node.attrs['src'],
          alt: node.attrs['alt'],
          title: node.attrs['title'],
          width: node.attrs['width'],
        },
      ] as DOMOutputSpec,
  },
  /** Inline que Markdown conoce pero MDteca no edita (HTML en línea, referencias…): se conserva literal. */
  raw_inline: {
    inline: true,
    group: 'inline',
    atom: true,
    attrs: { value: { default: '' } },
    toDOM: (node) => ['span', { class: 'raw-inline' }, node.attrs['value']] as DOMOutputSpec,
  },
};

const marks: Record<string, MarkSpec> = {
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom) => ({
          href: (dom as HTMLElement).getAttribute('href'),
          title: (dom as HTMLElement).getAttribute('title'),
        }),
      },
    ],
    toDOM: (mark) =>
      ['a', { href: mark.attrs['href'], title: mark.attrs['title'] }, 0] as DOMOutputSpec,
  },
  strong: {
    parseDOM: [
      { tag: 'strong' },
      { tag: 'b', getAttrs: (dom) => (dom as HTMLElement).style.fontWeight !== 'normal' && null },
      {
        style: 'font-weight',
        getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null,
      },
    ],
    toDOM: () => ['strong', 0] as DOMOutputSpec,
  },
  em: {
    parseDOM: [{ tag: 'i' }, { tag: 'em' }, { style: 'font-style=italic' }],
    toDOM: () => ['em', 0] as DOMOutputSpec,
  },
  strike: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
    toDOM: () => ['s', 0] as DOMOutputSpec,
  },
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM: () => ['code', 0] as DOMOutputSpec,
  },
};

const table = tableNodes({
  tableGroup: 'block',
  cellContent: 'inline*',
  cellAttributes: {},
});

export const schema = new Schema({
  nodes: {
    ...nodes,
    table: { ...table['table'], attrs: { ...keep, align: { default: [] } } } as NodeSpec,
    table_row: table['table_row'] as NodeSpec,
    table_cell: table['table_cell'] as NodeSpec,
    table_header: table['table_header'] as NodeSpec,
  },
  marks,
});

/** Orden canónico de anidación de marcas al serializar (de fuera hacia dentro). */
export const MARK_ORDER = ['link', 'strong', 'em', 'strike', 'code'] as const;
