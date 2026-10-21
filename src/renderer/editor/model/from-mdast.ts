import type { Mark, Node as PmNode } from 'prosemirror-model';
import type { PhrasingContent, RootContent } from 'mdast';
import { schema } from './schema';

export const PAGE_BREAK_COMMENT = '<!-- mdteca:pagebreak -->';

type Align = 'left' | 'right' | 'center' | null;

interface Ctx {
  /** Texto al que se refieren las posiciones (`offset`) de mdast. */
  text: string;
}

const slice = (
  ctx: Ctx,
  node: { position?: { start: { offset?: number }; end: { offset?: number } } },
) =>
  node.position?.start.offset !== undefined && node.position.end.offset !== undefined
    ? ctx.text.slice(node.position.start.offset, node.position.end.offset)
    : '';

/** Convierte un bloque mdast en un nodo ProseMirror. Lo desconocido se conserva como `raw_block`. */
export function blockToPm(node: RootContent, ctx: Ctx): PmNode {
  const s = schema.nodes;
  switch (node.type) {
    case 'paragraph':
      return s['paragraph']!.create(null, inlineToPm(node.children, ctx, []));
    case 'heading':
      return s['heading']!.create({ level: node.depth }, inlineToPm(node.children, ctx, []));
    case 'blockquote':
      return s['blockquote']!.create(null, blocksToPm(node.children, ctx));
    case 'list': {
      const items = node.children.map((item) =>
        s['list_item']!.create({ checked: item.checked ?? null }, blocksToPm(item.children, ctx)),
      );
      const tight = !node.spread && node.children.every((i) => !i.spread);
      return node.ordered
        ? s['ordered_list']!.create({ order: node.start ?? 1, tight }, items)
        : s['bullet_list']!.create({ tight }, items);
    }
    case 'code':
      return s['code_block']!.create(
        { lang: node.lang ?? null },
        node.value ? schema.text(node.value) : null,
      );
    case 'thematicBreak':
      return s['horizontal_rule']!.create();
    case 'html': {
      const value = slice(ctx, node) || node.value;
      return value.trim() === PAGE_BREAK_COMMENT
        ? s['page_break']!.create()
        : s['html_block']!.create({ value });
    }
    case 'table': {
      const align = (node.align ?? []).map((a) => a ?? null) as Align[];
      const rows = node.children.map((row, r) =>
        s['table_row']!.create(
          null,
          row.children.map((cell) =>
            s[r === 0 ? 'table_header' : 'table_cell']!.create(
              null,
              inlineToPm(cell.children, ctx, []),
            ),
          ),
        ),
      );
      return s['table']!.create({ align }, rows);
    }
    default:
      // definition, footnoteDefinition, yaml y cualquier otro: se conserva literal (03).
      return s['raw_block']!.create({ value: slice(ctx, node) });
  }
}

function blocksToPm(nodes: RootContent[], ctx: Ctx): PmNode[] {
  const out = nodes.map((n) => blockToPm(n, ctx));
  return out.length ? out : [schema.nodes['paragraph']!.create()];
}

function mark(name: string, attrs?: Record<string, unknown>): Mark {
  return schema.marks[name]!.create(attrs);
}

function inlineToPm(nodes: PhrasingContent[], ctx: Ctx, marks: readonly Mark[]): PmNode[] {
  const out: PmNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        if (node.value) out.push(schema.text(node.value, marks));
        break;
      case 'emphasis':
        out.push(...inlineToPm(node.children, ctx, mark('em').addToSet(marks)));
        break;
      case 'strong':
        out.push(...inlineToPm(node.children, ctx, mark('strong').addToSet(marks)));
        break;
      case 'delete':
        out.push(...inlineToPm(node.children, ctx, mark('strike').addToSet(marks)));
        break;
      case 'inlineCode':
        if (node.value) out.push(schema.text(node.value, mark('code').addToSet(marks)));
        break;
      case 'break':
        out.push(schema.nodes['hard_break']!.create(null, null, marks));
        break;
      case 'link': {
        const raw = slice(ctx, node);
        // Autolinks literales de GFM (sin `[` ni `<`): se tratan como texto (ED-25).
        if (!raw.startsWith('[') && !raw.startsWith('<')) {
          out.push(...inlineToPm(node.children, ctx, marks));
        } else {
          const link = mark('link', { href: node.url, title: node.title ?? null });
          out.push(...inlineToPm(node.children, ctx, link.addToSet(marks)));
        }
        break;
      }
      case 'image':
        out.push(
          schema.nodes['image']!.create(
            { src: node.url, alt: node.alt ?? '', title: node.title ?? null },
            null,
            marks,
          ),
        );
        break;
      default:
        // html en línea, footnoteReference, linkReference, imageReference…
        out.push(schema.nodes['raw_inline']!.create({ value: slice(ctx, node) }, null, marks));
    }
  }
  return out;
}
