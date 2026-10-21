import { lift, toggleMark, wrapIn } from 'prosemirror-commands';
import { Fragment, Slice, type Mark, type Node as PmNode, type NodeType } from 'prosemirror-model';
import { liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
import {
  EditorState,
  NodeSelection,
  TextSelection,
  type Command,
  type Transaction,
} from 'prosemirror-state';
import {
  TableMap,
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  selectionCell,
} from 'prosemirror-tables';
import { docFromSource } from '../model/doc';
import { schema } from '../model/schema';

const n = schema.nodes;
const m = schema.marks;

export interface FormatState {
  mode: 'wysiwyg' | 'source';
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  link: boolean;
  /** Estilo del bloque actual. */
  block: 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'code' | null;
  quote: boolean;
  list: 'bullet' | 'ordered' | 'task' | null;
  inTable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}

export const emptyFormatState: FormatState = {
  mode: 'wysiwyg',
  bold: false,
  italic: false,
  strike: false,
  code: false,
  link: false,
  block: null,
  quote: false,
  list: null,
  inTable: false,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
};

// ---------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------

function markActive(state: EditorState, type: NonNullable<(typeof m)[string]>): boolean {
  const { from, $from, to, empty } = state.selection;
  if (empty) return !!type.isInSet(state.storedMarks ?? $from.marks());
  return state.doc.rangeHasMark(from, to, type);
}

function ancestor(state: EditorState, test: (node: PmNode) => boolean): PmNode | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if (test($from.node(d))) return $from.node(d);
  return null;
}

export function readFormatState(
  state: EditorState,
  history: { undo: boolean; redo: boolean },
): FormatState {
  const { $from } = state.selection;
  const parent = $from.parent;
  let block: FormatState['block'] = null;
  if (parent.type === n['heading']) block = `h${parent.attrs['level']}` as FormatState['block'];
  else if (parent.type === n['code_block']) block = 'code';
  else if (parent.type === n['paragraph']) block = 'paragraph';
  const item = ancestor(state, (x) => x.type === n['list_item']);
  const listNode = ancestor(
    state,
    (x) => x.type === n['bullet_list'] || x.type === n['ordered_list'],
  );
  let list: FormatState['list'] = null;
  if (listNode) {
    if (item && item.attrs['checked'] !== null) list = 'task';
    else list = listNode.type === n['bullet_list'] ? 'bullet' : 'ordered';
  }
  return {
    mode: 'wysiwyg',
    bold: markActive(state, m['strong']!),
    italic: markActive(state, m['em']!),
    strike: markActive(state, m['strike']!),
    code: markActive(state, m['code']!),
    link: markActive(state, m['link']!),
    block,
    quote: !!ancestor(state, (x) => x.type === n['blockquote']),
    list,
    inTable: !!ancestor(state, (x) => x.type === n['table']),
    canUndo: history.undo,
    canRedo: history.redo,
    hasSelection: !state.selection.empty,
  };
}

// ---------------------------------------------------------------------------------------------
// Formato en línea
// ---------------------------------------------------------------------------------------------

export const toggleBold = toggleMark(m['strong']!);
export const toggleItalic = toggleMark(m['em']!);
export const toggleStrike = toggleMark(m['strike']!);
export const toggleCode = toggleMark(m['code']!);

export const clearFormatting: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const name of ['strong', 'em', 'strike', 'code', 'link']) {
      tr.removeMark(from, to, schema.marks[name]!);
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
};

export function currentLink(state: EditorState): { href: string; title: string | null } | null {
  const { $from, from, to, empty } = state.selection;
  const mark: Mark | undefined = empty
    ? (m['link']!.isInSet($from.marks()) ?? undefined)
    : state.doc.rangeHasMark(from, to, m['link']!)
      ? ($from.marks().find((x) => x.type === m['link']) ??
        $from.nodeAfter?.marks.find((x) => x.type === m['link']))
      : undefined;
  return mark
    ? { href: mark.attrs['href'] as string, title: (mark.attrs['title'] as string) ?? null }
    : null;
}

/** Rango del enlace que contiene `pos` (para editar un enlace sin selección). */
function linkRange(state: EditorState, pos: number): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos);
  const parent = $pos.parent;
  let start = $pos.start();
  let from = -1;
  let to = -1;
  parent.forEach((child, offset) => {
    const has = child.marks.some((x) => x.type === m['link']);
    const a = start + offset;
    const b = a + child.nodeSize;
    if (has && pos >= a && pos <= b) {
      if (from < 0) from = a;
      to = b;
    }
  });
  start = 0;
  return from >= 0 ? { from, to } : null;
}

export interface LinkInput {
  href: string;
  title?: string | null;
  /** Texto a insertar cuando no hay selección ni enlace bajo el cursor. */
  text?: string;
}

export function applyLink(input: LinkInput): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    const type = m['link']!;
    const href = input.href.trim();
    const tr = state.tr;
    let range = { from, to };
    if (empty) {
      const existing = linkRange(state, from);
      if (existing) range = existing;
      else if (href) {
        const text = input.text || href;
        const node = schema.text(text, [type.create({ href, title: input.title ?? null })]);
        dispatch?.(tr.replaceSelectionWith(node, false).scrollIntoView());
        return true;
      } else return false;
    }
    tr.removeMark(range.from, range.to, type);
    if (href) tr.addMark(range.from, range.to, type.create({ href, title: input.title ?? null }));
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

// ---------------------------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------------------------

/** Cambia el tipo de los bloques de texto seleccionados conservando el espacio previo (`gap`). */
function retype(type: NodeType, attrs: Record<string, unknown> | null): Command {
  return (state, dispatch) => {
    const { from, to } = state.selection;
    const gaps: [number, string][] = [];
    state.doc.nodesBetween(from, to, (node, pos, parent) => {
      if (parent === state.doc && node.attrs['gap'] != null)
        gaps.push([pos, node.attrs['gap'] as string]);
      return false;
    });
    if (selectedTextblocks(state).length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      if (type !== n['code_block']) {
        // Un bloque de código admite saltos de línea; el destino no: cada línea pasa a ser un
        // párrafo (o, en un título, se une con un espacio) en lugar de fundirse sin separador.
        const codes: [number, PmNode][] = [];
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type === n['code_block'] && node.textContent.includes('\n'))
            codes.push([pos, node]);
          return false;
        });
        for (const [pos, node] of codes.reverse()) {
          const lines = node.textContent.split('\n');
          const replacement =
            type === n['paragraph']
              ? lines.map((l) => n['paragraph']!.create(null, l ? schema.text(l) : null))
              : [n['code_block']!.create(node.attrs, schema.text(lines.join(' ')))];
          tr.replaceWith(pos, pos + node.nodeSize, replacement);
        }
      }
      tr.setBlockType(tr.mapping.map(from, -1), tr.mapping.map(to, 1), type, attrs);
      for (const [pos, gap] of gaps) {
        const at = tr.mapping.map(pos, -1);
        if (tr.doc.nodeAt(at)?.type.spec.attrs?.['gap']) tr.setNodeAttribute(at, 'gap', gap);
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function selectedTextblocks(state: EditorState): PmNode[] {
  const out: PmNode[] = [];
  state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
    if (node.isTextblock) out.push(node);
    return !node.isTextblock;
  });
  return out;
}

export const setParagraph: Command = retype(n['paragraph']!, null);

export function toggleHeading(level: 1 | 2 | 3 | 4 | 5 | 6): Command {
  return (state, dispatch) => {
    const blocks = selectedTextblocks(state);
    const all =
      blocks.length > 0 &&
      blocks.every((b) => b.type === n['heading'] && b.attrs['level'] === level);
    return (all ? setParagraph : retype(n['heading']!, { level }))(state, dispatch);
  };
}

export const toggleCodeBlock: Command = (state, dispatch) => {
  const blocks = selectedTextblocks(state);
  const all = blocks.length > 0 && blocks.every((b) => b.type === n['code_block']);
  return (all ? setParagraph : retype(n['code_block']!, { lang: null }))(state, dispatch);
};

export const toggleQuote: Command = (state, dispatch, view) => {
  if (ancestor(state, (x) => x.type === n['blockquote'])) return lift(state, dispatch);
  return wrapIn(n['blockquote']!)(state, dispatch, view);
};

// ---------------------------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------------------------

const isList = (node: PmNode) => node.type === n['bullet_list'] || node.type === n['ordered_list'];

function listAncestor(state: EditorState): { node: PmNode; pos: number; depth: number } | null {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if (isList($from.node(d))) return { node: $from.node(d), pos: $from.before(d), depth: d };
  }
  return null;
}

export function toggleList(type: NodeType): Command {
  return (state, dispatch, view) => {
    const parent = listAncestor(state);
    if (parent) {
      if (parent.node.type === type) return liftListItem(n['list_item']!)(state, dispatch);
      if (dispatch) {
        const attrs =
          type === n['ordered_list']
            ? { order: 1, tight: parent.node.attrs['tight'] }
            : { tight: parent.node.attrs['tight'] };
        const tr = state.tr.setNodeMarkup(parent.pos, type, {
          ...attrs,
          gap: parent.node.attrs['gap'] ?? null,
        });
        // Al pasar de tareas a numerada, los elementos dejan de ser tareas.
        tr.doc.nodesBetween(parent.pos, parent.pos + parent.node.nodeSize, (node, pos) => {
          if (node.type === n['list_item'] && node.attrs['checked'] !== null) {
            tr.setNodeAttribute(pos, 'checked', null);
          }
        });
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    return wrapInList(type)(state, dispatch, view);
  };
}

export const toggleTaskList: Command = (state, dispatch, view) => {
  const parent = listAncestor(state);
  const setChecked =
    (value: boolean | null): Command =>
    (s, d) => {
      const list = listAncestor(s);
      if (!list) return false;
      if (d) {
        const tr = s.tr;
        list.node.forEach((_item, offset) => {
          tr.setNodeAttribute(list.pos + 1 + offset, 'checked', value);
        });
        if (list.node.attrs['src'] != null) tr.setNodeAttribute(list.pos, 'src', null);
        d(tr);
      }
      return true;
    };
  if (parent) {
    const allTasks = (() => {
      let all = true;
      parent.node.forEach((child) => (all &&= child.attrs['checked'] !== null));
      return all;
    })();
    if (parent.node.type === n['ordered_list'] && !allTasks) {
      // Una lista numerada se convierte primero en lista de viñetas.
      toggleList(n['bullet_list']!)(state, dispatch);
      return true;
    }
    return setChecked(allTasks ? null : false)(state, dispatch, view);
  }
  if (!wrapInList(n['bullet_list']!)(state, dispatch, view)) return false;
  if (dispatch && view) setChecked(false)(view.state, view.dispatch, view);
  return true;
};

export const indentList: Command = sinkListItem(n['list_item']!);
export const outdentList: Command = liftListItem(n['list_item']!);

// ---------------------------------------------------------------------------------------------
// Inserciones
// ---------------------------------------------------------------------------------------------

/** Inserta un bloque tras el bloque de primer nivel actual (o sustituyendo un párrafo vacío). */
function insertBlock(block: PmNode, then: 'inside' | 'after'): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const top = $from.depth >= 1 ? $from.node(1) : null;
    const tr = state.tr;
    let pos: number;
    if (top && top.type === n['paragraph'] && top.childCount === 0 && $from.depth === 1) {
      pos = $from.before(1);
      tr.replaceWith(pos, pos + top.nodeSize, block);
    } else {
      pos = $from.depth >= 1 ? $from.after(1) : state.selection.to;
      tr.insert(pos, block);
    }
    const after = pos + block.nodeSize;
    const next = tr.doc.nodeAt(after);
    if (!next || !next.isTextblock) {
      if (then === 'after' || !next) tr.insert(after, n['paragraph']!.create());
    }
    if (dispatch) {
      const target =
        then === 'inside' ? pos + 1 : tr.doc.nodeAt(after)?.isTextblock ? after + 1 : after;
      tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(target, tr.doc.content.size)), 1));
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export const insertHorizontalRule = insertBlock(n['horizontal_rule']!.create(), 'after');
export const insertPageBreak = insertBlock(n['page_break']!.create(), 'after');
export const insertHtmlBlock = insertBlock(
  n['html_block']!.create({ value: '<div></div>' }),
  'after',
);

export function insertTable(rows: number, cols: number): Command {
  const cell = (type: NodeType) => type.createAndFill()!;
  const row = (type: NodeType) =>
    n['table_row']!.create(
      null,
      Array.from({ length: cols }, () => cell(type)),
    );
  const table = n['table']!.create({ align: Array.from({ length: cols }, () => null) }, [
    row(n['table_header']!),
    ...Array.from({ length: Math.max(rows - 1, 1) }, () => row(n['table_cell']!)),
  ]);
  return insertBlock(table, 'inside');
}

export const insertHardBreak: Command = (state, dispatch) => {
  if (dispatch) dispatch(state.tr.replaceSelectionWith(n['hard_break']!.create()).scrollIntoView());
  return true;
};

export function insertText(text: string): Command {
  return (state, dispatch) => {
    if (dispatch) dispatch(state.tr.insertText(text).scrollIntoView());
    return true;
  };
}

// ---------------------------------------------------------------------------------------------
// Tablas
// ---------------------------------------------------------------------------------------------

export const tableCommands = {
  addRowBefore,
  addRowAfter,
  deleteRow,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  deleteTable,
};

export function setColumnAlign(align: 'left' | 'center' | 'right' | null): Command {
  return (state, dispatch) => {
    const $cell = selectionCell(state);
    if (!$cell) return false;
    let tablePos = -1;
    let table: PmNode | null = null;
    for (let d = $cell.depth; d >= 0; d--) {
      if ($cell.node(d).type === n['table']) {
        table = $cell.node(d);
        tablePos = $cell.before(d);
        break;
      }
    }
    if (!table) return false;
    const map = TableMap.get(table);
    const col = map.colCount($cell.pos - (tablePos + 1));
    if (dispatch) {
      const current = (table.attrs['align'] as (string | null)[]) ?? [];
      const next = Array.from({ length: map.width }, (_, i) => current[i] ?? null);
      next[col] = align;
      const tr = state.tr.setNodeMarkup(tablePos, undefined, {
        ...table.attrs,
        align: next,
        src: null,
      });
      dispatch(tr);
    }
    return true;
  };
}

// ---------------------------------------------------------------------------------------------
// Pegado
// ---------------------------------------------------------------------------------------------

/** Pegar como Markdown (ED-14): interpreta la sintaxis del texto. */
export function markdownSlice(text: string): Slice {
  const doc = docFromSource(text.replace(/\r\n/g, '\n'));
  const blocks: PmNode[] = [];
  doc.forEach((block) => {
    blocks.push(block.type.create({ ...block.attrs, gap: null }, block.content, block.marks));
  });
  const single = blocks.length === 1 && blocks[0]!.type === n['paragraph'];
  return new Slice(Fragment.from(blocks), single ? 1 : 0, single ? 1 : 0);
}

export const pasteMarkdown =
  (text: string): Command =>
  (state, dispatch) => {
    if (dispatch) dispatch(state.tr.replaceSelection(markdownSlice(text)).scrollIntoView());
    return true;
  };

export function selectionIsNode(state: EditorState): boolean {
  return state.selection instanceof NodeSelection;
}

export type { Transaction };
