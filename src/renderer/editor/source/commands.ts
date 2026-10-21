import { redo, undo, undoDepth, redoDepth } from '@codemirror/commands';
import { EditorSelection, type ChangeSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { emptyFormatState, type FormatState } from '../wysiwyg/commands';

/**
 * Comandos del modo texto (CodeMirror). Aquí el Markdown es Markdown (ED-16): los atajos de formato
 * insertan o quitan la sintaxis correspondiente alrededor de la selección.
 */

// ---------------------------------------------------------------------------------------------
// En línea
// ---------------------------------------------------------------------------------------------

export function toggleWrap(view: EditorView, marker: string): boolean {
  const { state } = view;
  const len = marker.length;
  const changes: ChangeSpec[] = [];
  const ranges = state.selection.ranges.map((range) => {
    const text = state.sliceDoc(range.from, range.to);
    const before = state.sliceDoc(Math.max(range.from - len, 0), range.from);
    const after = state.sliceDoc(range.to, Math.min(range.to + len, state.doc.length));
    if (
      !range.empty &&
      text.length >= len * 2 &&
      text.startsWith(marker) &&
      text.endsWith(marker)
    ) {
      changes.push(
        { from: range.from, to: range.from + len },
        { from: range.to - len, to: range.to },
      );
      return EditorSelection.range(range.from, range.to - len * 2);
    }
    if (before === marker && after === marker) {
      changes.push(
        { from: range.from - len, to: range.from },
        { from: range.to, to: range.to + len },
      );
      return EditorSelection.range(range.from - len, range.to - len);
    }
    changes.push({ from: range.from, insert: marker }, { from: range.to, insert: marker });
    return EditorSelection.range(range.from + len, range.to + len);
  });
  view.dispatch(
    state.update({ changes, selection: EditorSelection.create(ranges), scrollIntoView: true }),
  );
  return true;
}

export function insertLink(view: EditorView, href: string, text?: string): boolean {
  const { state } = view;
  const range = state.selection.main;
  const label = range.empty ? (text ?? href) : state.sliceDoc(range.from, range.to);
  const insert = `[${label}](${href})`;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.cursor(range.from + insert.length),
    scrollIntoView: true,
  });
  return true;
}

export function currentLinkHref(view: EditorView): string | null {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const col = view.state.selection.main.head - line.from;
  for (const m of line.text.matchAll(/\[[^\]]*\]\(([^)\s]*)[^)]*\)/g)) {
    if (m.index! <= col && col <= m.index! + m[0].length) return m[1]!;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Por líneas
// ---------------------------------------------------------------------------------------------

function selectedLines(view: EditorView) {
  const { state } = view;
  const seen = new Set<number>();
  const lines = [];
  for (const r of state.selection.ranges) {
    const first = state.doc.lineAt(r.from).number;
    const last = state.doc.lineAt(r.to).number;
    for (let i = first; i <= last; i++) {
      if (seen.has(i)) continue;
      seen.add(i);
      lines.push(state.doc.line(i));
    }
  }
  return lines;
}

function mapLines(view: EditorView, fn: (text: string, index: number) => string): boolean {
  const lines = selectedLines(view);
  const changes: ChangeSpec[] = [];
  lines.forEach((line, i) => {
    const next = fn(line.text, i);
    if (next !== line.text) changes.push({ from: line.from, to: line.to, insert: next });
  });
  if (changes.length) view.dispatch({ changes, scrollIntoView: true });
  return true;
}

const HEADING = /^#{1,6}[ \t]+/;
const QUOTE = /^>[ \t]?/;
const TASK = /^(\s*)[-*+] \[[ xX]\] /;
const BULLET = /^(\s*)[-*+] /;
const ORDERED = /^(\s*)\d+[.)] /;

export function setHeading(view: EditorView, level: number): boolean {
  const lines = selectedLines(view);
  const all = lines.every((l) => new RegExp(`^#{${level}}[ \\t]`).test(l.text));
  return mapLines(view, (text) => {
    const bare = text.replace(HEADING, '');
    return all || level === 0 ? bare : `${'#'.repeat(level)} ${bare}`;
  });
}

export function toggleQuoteLines(view: EditorView): boolean {
  const all = selectedLines(view).every((l) => QUOTE.test(l.text));
  return mapLines(view, (text) => (all ? text.replace(QUOTE, '') : `> ${text}`));
}

type ListKind = 'bullet' | 'ordered' | 'task';
const LIST_RE: Record<ListKind, RegExp> = { task: TASK, bullet: BULLET, ordered: ORDERED };

export function toggleListLines(view: EditorView, kind: ListKind): boolean {
  const lines = selectedLines(view);
  const matches = (text: string) => {
    if (kind === 'task') return TASK.test(text);
    if (kind === 'bullet') return BULLET.test(text) && !TASK.test(text);
    return ORDERED.test(text);
  };
  const all = lines.every((l) => matches(l.text));
  return mapLines(view, (text, i) => {
    const bare = text.replace(TASK, '$1').replace(BULLET, '$1').replace(ORDERED, '$1');
    if (all) return bare;
    const indent = /^\s*/.exec(bare)![0];
    const body = bare.slice(indent.length);
    if (kind === 'task') return `${indent}- [ ] ${body}`;
    if (kind === 'bullet') return `${indent}- ${body}`;
    return `${indent}${i + 1}. ${body}`;
  });
}

export function indentLines(view: EditorView, delta: 1 | -1): boolean {
  return mapLines(view, (text) => (delta > 0 ? `  ${text}` : text.replace(/^ {1,2}/, '')));
}

export function toggleCodeFence(view: EditorView): boolean {
  const { state } = view;
  const range = state.selection.main;
  const first = state.doc.lineAt(range.from);
  const last = state.doc.lineAt(range.to);
  if (range.empty && first.text.trim() === '') {
    view.dispatch({
      changes: { from: first.from, to: first.to, insert: '```\n\n```' },
      selection: EditorSelection.cursor(first.from + 4),
    });
    return true;
  }
  const open = first.number > 1 ? state.doc.line(first.number - 1) : null;
  const close = last.number < state.doc.lines ? state.doc.line(last.number + 1) : null;
  if (open && close && /^```/.test(open.text) && /^```\s*$/.test(close.text)) {
    view.dispatch({
      changes: [
        { from: open.from, to: open.to + 1 },
        { from: close.from - 1, to: close.to },
      ],
    });
    return true;
  }
  view.dispatch({
    changes: [
      { from: first.from, insert: '```\n' },
      { from: last.to, insert: '\n```' },
    ],
    scrollIntoView: true,
  });
  return true;
}

/** Inserta un bloque en líneas propias tras la línea actual. */
export function insertBlockText(view: EditorView, block: string): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const empty = line.text.trim() === '';
  const insert = empty ? block : `\n\n${block}`;
  const from = empty ? line.from : line.to;
  const to = empty ? line.to : line.to;
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + insert.length),
    scrollIntoView: true,
  });
  return true;
}

export function tableTemplate(rows: number, cols: number): string {
  const row = (cell: string) => `| ${Array.from({ length: cols }, () => cell).join(' | ')} |`;
  const head = row('   ');
  const sep = `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`;
  return [head, sep, ...Array.from({ length: Math.max(rows - 1, 1) }, () => row('   '))].join('\n');
}

export function insertAtCursor(view: EditorView, text: string): boolean {
  view.dispatch(view.state.replaceSelection(text));
  return true;
}

export { undo as sourceUndo, redo as sourceRedo };

// ---------------------------------------------------------------------------------------------
// Estado de formato
// ---------------------------------------------------------------------------------------------

export function readSourceFormatState(view: EditorView): FormatState {
  const { state } = view;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.head).text;
  const heading = /^(#{1,6})\s/.exec(line);
  let list: FormatState['list'] = null;
  if (TASK.test(line)) list = 'task';
  else if (BULLET.test(line)) list = 'bullet';
  else if (ORDERED.test(line)) list = 'ordered';
  const wrapped = (marker: string) =>
    !sel.empty &&
    state.sliceDoc(Math.max(sel.from - marker.length, 0), sel.from) === marker &&
    state.sliceDoc(sel.to, sel.to + marker.length) === marker;
  return {
    ...emptyFormatState,
    mode: 'source',
    bold: wrapped('**'),
    italic: wrapped('_') || wrapped('*'),
    strike: wrapped('~~'),
    code: wrapped('`'),
    link: currentLinkHref(view) !== null,
    block: heading ? (`h${heading[1]!.length}` as FormatState['block']) : 'paragraph',
    quote: QUOTE.test(line),
    list,
    canUndo: undoDepth(state) > 0,
    canRedo: redoDepth(state) > 0,
    hasSelection: !sel.empty,
  };
}

export { LIST_RE };
