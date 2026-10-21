import type { Node as PmNode } from 'prosemirror-model';
import type { SerializedDoc } from '../model/doc';

/**
 * Mapeo de posiciones entre WYSIWYG y modo texto (ED-02).
 *
 * Se localiza el bloque de primer nivel y el desplazamiento de carácter dentro de su texto visible;
 * en la fuente, ese desplazamiento se encuentra recorriendo el texto del bloque y saltando las marcas
 * Markdown (`#`, `**`, `-`…) que no aparecen en el texto visible.
 */

interface TextIndex {
  /** Texto visible del bloque (los saltos entre bloques de texto y los duros son '\n'). */
  text: string;
  /** `pos[i]` = posición ProseMirror justo antes del carácter `i`; `pos[text.length]` = final. */
  pos: number[];
}

function blockOffset(doc: PmNode, index: number): number {
  let offset = 0;
  for (let i = 0; i < index; i++) offset += doc.child(i).nodeSize;
  return offset;
}

function buildTextIndex(block: PmNode, base: number): TextIndex {
  let text = '';
  const pos: number[] = [];
  let seenTextblock = false;
  block.descendants((node, p) => {
    const abs = base + 1 + p;
    if (node.isText) {
      for (let k = 0; k < node.text!.length; k++) pos.push(abs + k);
      text += node.text;
    } else if (node.type.name === 'hard_break') {
      pos.push(abs);
      text += '\n';
    } else if (node.isLeaf) {
      pos.push(abs);
      text += '￼';
    } else if (node.isTextblock) {
      if (seenTextblock) {
        pos.push(abs);
        text += '\n';
      }
      seenTextblock = true;
    }
    return true;
  });
  pos.push(base + Math.max(block.nodeSize - 1, 0));
  return { text, pos };
}

/** Posición ProseMirror → desplazamiento en el Markdown serializado. */
export function pmToSourceOffset(doc: PmNode, head: number, serialized: SerializedDoc): number {
  if (doc.childCount === 0) return 0;
  const resolved = doc.resolve(Math.min(Math.max(head, 0), doc.content.size));
  const index = Math.min(resolved.index(0), doc.childCount - 1);
  const range = serialized.blocks[index];
  if (!range) return serialized.text.length;
  const block = doc.child(index);
  const { text: plain, pos } = buildTextIndex(block, blockOffset(doc, index));
  let target = pos.findIndex((p) => p >= head);
  if (target < 0 || target > plain.length) target = plain.length;
  const src = serialized.text.slice(range.from, range.to);
  if (target === 0 && plain.length > 0) {
    const first = src.indexOf(plain[0]!);
    return range.from + Math.max(first, 0);
  }
  let matched = 0;
  for (let i = 0; i < src.length; i++) {
    if (matched === target) return range.from + i;
    if (src[i] === plain[matched]) matched++;
  }
  return range.to;
}

/** Desplazamiento en el Markdown serializado → posición ProseMirror. */
export function sourceToPmOffset(doc: PmNode, offset: number, serialized: SerializedDoc): number {
  if (doc.childCount === 0) return 1;
  let index = serialized.blocks.findIndex((r) => offset >= r.from && offset <= r.to);
  if (index < 0) {
    // En el espacio entre bloques: el siguiente bloque, o el último.
    index = serialized.blocks.findIndex((r) => r.from > offset);
    if (index < 0) index = doc.childCount - 1;
    offset = serialized.blocks[index]!.from;
  }
  const range = serialized.blocks[index]!;
  const block = doc.child(index);
  const { text: plain, pos } = buildTextIndex(block, blockOffset(doc, index));
  const src = serialized.text.slice(range.from, range.to);
  let matched = 0;
  const limit = Math.min(offset - range.from, src.length);
  for (let i = 0; i < limit; i++) if (src[i] === plain[matched]) matched++;
  return pos[Math.min(matched, pos.length - 1)] ?? 1;
}
