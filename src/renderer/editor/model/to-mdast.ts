import { CAPTION_MARK, imgTag } from './image-html';
import type { Mark, Node as PmNode } from 'prosemirror-model';
import type { PhrasingContent, RootContent, TableCell, TableRow } from 'mdast';
import { escapeText } from './escape';
import { PAGE_BREAK_COMMENT } from './from-mdast';
import { MARK_ORDER } from './schema';

/** Un tramo de contenido en línea ya aplanado: texto con marcas o un nodo atómico. */
interface Run {
  node: PmNode;
  marks: readonly Mark[];
  /** Texto ya escapado (solo para nodos de texto sin la marca `code`). */
  escaped?: string;
}

interface InlineOptions {
  cell?: boolean;
  heading?: boolean;
}

/**
 * Texto que se emite tal cual (ya escapado). Se usa un nodo propio y no `html` porque este último
 * hace que mdast-util-to-markdown degrade los saltos duros contiguos a un espacio.
 */
function literal(value: string): PhrasingContent {
  return { type: 'literal', value } as unknown as PhrasingContent;
}

export const literalHandler = (node: { value: string }) => node.value;

const WS_EDGE = /^([ \t]*)([\s\S]*?)([ \t]*)$/;

function markNames(marks: readonly Mark[]): string[] {
  return MARK_ORDER.filter((name) => marks.some((m) => m.type.name === name));
}

/** Convierte el contenido en línea de un bloque en nodos mdast, escapando el texto literal. */
export function inlineToMdast(parent: PmNode, opts: InlineOptions = {}): PhrasingContent[] {
  const runs: Run[] = [];
  parent.forEach((child) => {
    if (child.isText) {
      const text = child.text!;
      const marks = child.marks;
      const emphasised = marks.some((m) => ['strong', 'em', 'strike'].includes(m.type.name));
      if (!emphasised || marks.some((m) => m.type.name === 'code')) {
        runs.push({ node: child, marks });
        return;
      }
      // Los blancos en el borde de una marca de énfasis salen de ella (`** a **` no es énfasis).
      const [, lead, core, trail] = WS_EDGE.exec(text)!;
      const plain = marks.filter((m) => !['strong', 'em', 'strike'].includes(m.type.name));
      const schemaText = (t: string, ms: readonly Mark[]) => child.type.schema.text(t, ms);
      if (lead) runs.push({ node: schemaText(lead, plain), marks: plain });
      if (core) runs.push({ node: schemaText(core, marks), marks });
      if (trail) runs.push({ node: schemaText(trail, plain), marks: plain });
      return;
    }
    runs.push({ node: child, marks: child.marks });
  });

  // Contexto de escapado: la frontera con un vecino distinto cuenta como signo ('*').
  runs.forEach((run, i) => {
    const node = run.node;
    if (!node.isText || run.marks.some((m) => m.type.name === 'code')) return;
    const prev = runs[i - 1];
    const next = runs[i + 1];
    const edge = (r: Run | undefined, side: 'before' | 'after'): string => {
      if (!r) return '';
      if (r.node.type.name === 'hard_break') return '\n';
      return '*';
      void side;
    };
    run.escaped = escapeText(node.text!, {
      before: edge(prev, 'before'),
      after: edge(next, 'after'),
      cell: opts.cell,
      heading: opts.heading,
    });
  });

  return buildPhrasing(runs);
}

function runToLeaf(run: Run): PhrasingContent | PhrasingContent[] | null {
  const node = run.node;
  switch (node.type.name) {
    case 'text':
      if (run.marks.some((m) => m.type.name === 'code')) {
        return { type: 'inlineCode', value: node.text! };
      }
      return literal(run.escaped ?? node.text!);
    case 'hard_break':
      return { type: 'break' };
    case 'image': {
      // Con tamaño guardado se escribe como HTML en línea (06).
      const title = (node.attrs['title'] as string | null) ?? null;
      // El pie de foto visible solo existe si hay título.
      const mark = node.attrs['caption'] && title ? [literal(CAPTION_MARK)] : [];
      if (node.attrs['width']) {
        return [
          literal(
            imgTag({
              src: node.attrs['src'] as string,
              alt: node.attrs['alt'] as string,
              title,
              width: node.attrs['width'] as number,
            }),
          ),
          ...mark,
        ];
      }
      return [
        {
          type: 'image',
          url: node.attrs['src'] as string,
          alt: node.attrs['alt'] as string,
          title,
        },
        ...mark,
      ];
    }
    case 'raw_inline':
      return literal(node.attrs['value'] as string);
    default:
      return null;
  }
}

function wrap(name: string, run: Run, children: PhrasingContent[]): PhrasingContent {
  switch (name) {
    case 'strong':
      return { type: 'strong', children };
    case 'em':
      return { type: 'emphasis', children };
    case 'strike':
      return { type: 'delete', children };
    default: {
      const link = run.marks.find((m) => m.type.name === 'link')!;
      return {
        type: 'link',
        url: link.attrs['href'] as string,
        title: (link.attrs['title'] as string | null) ?? null,
        children,
      };
    }
  }
}

/** Anida las marcas según el orden canónico, abriendo y cerrando solo lo necesario. */
function buildPhrasing(runs: Run[]): PhrasingContent[] {
  const root: PhrasingContent[] = [];
  const stack: { name: string; mark: Mark | null; children: PhrasingContent[] }[] = [];
  const top = () => (stack.length ? stack[stack.length - 1]!.children : root);

  for (const run of runs) {
    // `code` es una hoja (inlineCode), no un contenedor.
    const names = markNames(run.marks).filter((n) => n !== 'code');
    const markOf = (n: string) => run.marks.find((m) => m.type.name === n) ?? null;
    let keep = 0;
    while (
      keep < stack.length &&
      keep < names.length &&
      stack[keep]!.name === names[keep] &&
      (names[keep] !== 'link' || stack[keep]!.mark!.eq(markOf('link')!))
    ) {
      keep++;
    }
    while (stack.length > keep) {
      const done = stack.pop()!;
      top().push(
        wrap(done.name, { node: run.node, marks: done.mark ? [done.mark] : [] }, done.children),
      );
    }
    for (let k = keep; k < names.length; k++) {
      stack.push({
        name: names[k]!,
        mark: names[k] === 'link' ? markOf('link') : null,
        children: [],
      });
    }
    const leaf = runToLeaf(run);
    if (leaf) top().push(...(Array.isArray(leaf) ? leaf : [leaf]));
  }
  while (stack.length) {
    const done = stack.pop()!;
    top().push(
      wrap(done.name, { node: runs[0]!.node, marks: done.mark ? [done.mark] : [] }, done.children),
    );
  }
  return root;
}

/** Convierte un bloque ProseMirror en mdast. Devuelve null para bloques vacíos que Markdown no puede expresar. */
export function blockToMdast(node: PmNode): RootContent | null {
  switch (node.type.name) {
    case 'paragraph':
      return node.childCount ? { type: 'paragraph', children: inlineToMdast(node) } : null;
    case 'heading':
      return {
        type: 'heading',
        depth: node.attrs['level'] as 1 | 2 | 3 | 4 | 5 | 6,
        children: inlineToMdast(node, { heading: true }),
      };
    case 'blockquote': {
      const children = childrenToMdast(node);
      return children.length ? { type: 'blockquote', children } : null;
    }
    case 'bullet_list':
    case 'ordered_list': {
      const tight = node.attrs['tight'] as boolean;
      const ordered = node.type.name === 'ordered_list';
      return {
        type: 'list',
        ordered,
        start: ordered ? (node.attrs['order'] as number) : null,
        spread: !tight,
        children: Array.from({ length: node.childCount }, (_, i) => {
          const item = node.child(i);
          return {
            type: 'listItem' as const,
            spread: !tight,
            checked: (item.attrs['checked'] as boolean | null) ?? null,
            children: childrenToMdast(item) as never,
          };
        }),
      };
    }
    case 'code_block':
      return {
        type: 'code',
        lang: (node.attrs['lang'] as string | null) ?? null,
        value: node.textContent,
      };
    case 'horizontal_rule':
      return { type: 'thematicBreak' };
    case 'page_break':
      return { type: 'html', value: PAGE_BREAK_COMMENT };
    case 'html_block':
    case 'raw_block':
      return { type: 'html', value: node.attrs['value'] as string };
    case 'table': {
      const children: TableRow[] = [];
      node.forEach((row) => {
        const cells: TableCell[] = [];
        row.forEach((cell) =>
          cells.push({ type: 'tableCell', children: inlineToMdast(cell, { cell: true }) }),
        );
        children.push({ type: 'tableRow', children: cells });
      });
      return { type: 'table', align: node.attrs['align'] as never, children };
    }
    default:
      return null;
  }
}

function childrenToMdast(parent: PmNode): never[] {
  const out: RootContent[] = [];
  parent.forEach((child) => {
    const m = blockToMdast(child);
    if (m) out.push(m);
  });
  return out as never[];
}
