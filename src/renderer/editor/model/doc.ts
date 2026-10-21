import { Mark, type Node as PmNode } from 'prosemirror-model';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';
import type { Root } from 'mdast';
import { blockToPm } from './from-mdast';
import { parseMarkdown } from './parse';
import { schema } from './schema';
import { blockToMdast, literalHandler } from './to-mdast';

/** Convenciones fijas de re-serialización (ED-22). */
const STRINGIFY_OPTIONS = {
  bullet: '-',
  bulletOrdered: '.',
  emphasis: '_',
  strong: '*',
  fence: '`',
  fences: true,
  rule: '-',
  ruleRepetition: 3,
  ruleSpaces: false,
  setext: false,
  listItemIndent: 'one',
  incrementListMarker: true,
  extensions: [gfmToMarkdown()],
  handlers: { literal: literalHandler },
} as const;

const NEW_BLOCK_GAP = '\n\n';

/**
 * Construye el documento ProseMirror desde Markdown (EOL ya normalizado a `\n`, sin bloque de
 * configuración). Cada bloque de primer nivel conserva su texto original (`src`) y el texto
 * que lo separa del anterior (`gap`), de modo que guardar sin editar es idéntico byte a byte.
 */
export function docFromSource(source: string): PmNode {
  const root = parseMarkdown(source);
  const blocks: PmNode[] = [];
  let cursor = 0;
  let lead = '';
  for (const child of root.children) {
    let start = child.position?.start.offset ?? cursor;
    // La sangría de la primera línea forma parte del bloque (cambia cómo se interpreta su contenido).
    const lineStart = source.lastIndexOf('\n', start - 1) + 1;
    if (lineStart >= cursor && /^[ \t]*$/.test(source.slice(lineStart, start))) start = lineStart;
    // Casos límite de remark: una definición seguida de un título setext comparten línea de inicio.
    if (start < cursor) start = cursor;
    const end = Math.max(child.position?.end.offset ?? start, start);
    const gap = source.slice(cursor, start);
    const node = blockToPm(child, { text: source });
    if (blocks.length === 0) lead = gap;
    blocks.push(
      node.type.create(
        { ...node.attrs, src: source.slice(start, end), gap },
        node.content,
        node.marks,
      ),
    );
    cursor = end;
  }
  const tail = source.slice(cursor);
  if (blocks.length === 0) {
    return schema.nodes['doc']!.create({ lead: '', tail: source }, [
      schema.nodes['paragraph']!.create(),
    ]);
  }
  return schema.nodes['doc']!.create({ lead, tail }, blocks);
}

/** Documento nuevo y vacío; termina en salto de línea (GIT-03). */
export function emptyDoc(): PmNode {
  return schema.nodes['doc']!.create({ lead: '', tail: '\n' }, [
    schema.nodes['paragraph']!.create(),
  ]);
}

const IGNORED_ATTRS = new Set(['src', 'gap']);

/** Igualdad estructural ignorando los atributos de preservación de fuente. */
export function sameContent(a: PmNode, b: PmNode): boolean {
  if (a.type !== b.type) return false;
  if (a.isText) return a.text === b.text && a.sameMarkup(b);
  for (const key of Object.keys(a.attrs)) {
    if (IGNORED_ATTRS.has(key)) continue;
    if (JSON.stringify(a.attrs[key]) !== JSON.stringify(b.attrs[key])) return false;
  }
  if (!Mark.sameSet(a.marks, b.marks) || a.childCount !== b.childCount) return false;
  for (let i = 0; i < a.childCount; i++) if (!sameContent(a.child(i), b.child(i))) return false;
  return true;
}

interface Markers {
  bullet: string;
  ordered: string;
}
const DEFAULT_MARKERS: Markers = { bullet: '-', ordered: '.' };

function stringifyBlock(node: PmNode, markers: Markers): string {
  const mdast = blockToMdast(node);
  if (!mdast) return '';
  const tree: Root = { type: 'root', children: [mdast] };
  const options = { ...STRINGIFY_OPTIONS, bullet: markers.bullet, bulletOrdered: markers.ordered };
  return toMarkdown(tree, options as never).replace(/\n+$/, '');
}

/** Elige marcadores de lista distintos de los de las listas vecinas, para que no se fundan en una. */
function pickMarkers(neighbours: (string | null)[]): Markers {
  const used = new Set<string>();
  for (const text of neighbours) {
    if (!text) continue;
    const bullet = /^ {0,3}([-*+])[ \t]/.exec(text);
    if (bullet) used.add(bullet[1]!);
    const ordered = /^ {0,3}\d{1,9}([.)])[ \t]/.exec(text);
    if (ordered) used.add(ordered[1]!);
  }
  return {
    bullet: ['-', '*', '+'].find((c) => !used.has(c)) ?? '-',
    ordered: ['.', ')'].find((c) => !used.has(c)) ?? '.',
  };
}

/** Memoria por identidad de nodo (ProseMirror comparte los nodos que no cambian). */
const blockCache = new WeakMap<PmNode, Map<string, string>>();

/**
 * Texto de un bloque de primer nivel: su fuente original si no cambió, o su re-serialización.
 * `defs` son las definiciones de enlaces/notas del documento, necesarias para reparsear el
 * bloque en su contexto (una referencia `[foo]` solo lo es si existe `[foo]: …`).
 */
export function blockSource(node: PmNode, defs = '', markers: Markers = DEFAULT_MARKERS): string {
  let perNode = blockCache.get(node);
  if (!perNode) blockCache.set(node, (perNode = new Map()));
  const key = `${markers.bullet}${markers.ordered}|${defs}`;
  const cached = perNode.get(key);
  if (cached !== undefined) return cached;
  const src = node.attrs['src'] as string | null;
  const original = src === null ? null : parseSingle(src, defs);
  const out =
    src !== null && original && sameContent(original, node) ? src : stringifyBlock(node, markers);
  perNode.set(key, out);
  return out;
}

function parseSingle(src: string, defs: string): PmNode | null {
  const text = defs ? src + '\n\n' + defs : src;
  const root = parseMarkdown(text);
  // Si la fuente no es un único bloque, se considera cambiada.
  const own = root.children.filter((c) => (c.position?.start.offset ?? 0) < src.length);
  if (own.length !== 1) return null;
  return blockToPm(own[0]!, { text });
}

const DEFINITION = /^ {0,3}\[[^\]]+\]:/;

function collectDefinitions(doc: PmNode): string {
  const defs: string[] = [];
  doc.forEach((block) => {
    if (block.type.name === 'raw_block' && DEFINITION.test(block.attrs['value'] as string)) {
      defs.push(block.attrs['value'] as string);
    }
  });
  return defs.join('\n');
}

const isList = (n: PmNode) => n.type.name === 'bullet_list' || n.type.name === 'ordered_list';

/** Reconstruye el Markdown completo (con `\n`; el EOL real se aplica al escribir). */
export function sourceFromDoc(doc: PmNode): string {
  return serializeDoc(doc).text;
}

export interface SerializedDoc {
  text: string;
  /** Rango [from, to) que ocupa en `text` el texto de cada bloque de primer nivel (alineado con `doc`). */
  blocks: { from: number; to: number }[];
}

/** Como `sourceFromDoc`, pero informa también de dónde cae cada bloque (mapeo de cursor entre modos). */
export function serializeDoc(doc: PmNode): SerializedDoc {
  const lead = doc.attrs['lead'] as string;
  const tail = doc.attrs['tail'] as string;
  const defs = collectDefinitions(doc);
  const blocks: PmNode[] = [];
  doc.forEach((b) => blocks.push(b));
  const initial = blocks.map((b) => blockSource(b, defs));

  let out = '';
  let first = true;
  let prevText: string | null = null;
  const ranges: { from: number; to: number }[] = [];
  blocks.forEach((block, i) => {
    let text = initial[i]!;
    if (isList(block) && text !== (block.attrs['src'] as string | null)) {
      // Se evita el marcador del vecino anterior y el del siguiente solo si este no va a cambiar
      // (si también se reescribe, será él quien se adapte).
      const next = blocks[i + 1];
      const nextIsStable =
        !next || !isList(next) || initial[i + 1] === (next.attrs['src'] as string | null);
      text = blockSource(
        block,
        defs,
        pickMarkers([prevText, nextIsStable ? (initial[i + 1] ?? null) : null]),
      );
    }
    if (text === '' && block.type.name === 'paragraph') {
      ranges.push({ from: out.length, to: out.length });
      return;
    }
    const gap = first ? lead : ((block.attrs['gap'] as string | null) ?? NEW_BLOCK_GAP);
    out += gap;
    ranges.push({ from: out.length, to: out.length + text.length });
    out += text;
    first = false;
    prevText = text;
  });
  return { text: out + tail, blocks: ranges };
}
