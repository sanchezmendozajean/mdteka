import { EditorState, Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { buildTextIndex } from '../sync/map-position';

/** Buscar y reemplazar en el editor visual: coincidencias dentro de cada bloque de texto. */
export interface FindOptions {
  query: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface FindInfo {
  count: number;
  /** Índice (base 0) de la coincidencia actual, o -1 si no hay. */
  current: number;
  /** La expresión regular no es válida. */
  invalid: boolean;
}

interface Match {
  from: number;
  to: number;
}

interface FindState {
  opts: FindOptions | null;
  matches: Match[];
  current: number;
  invalid: boolean;
  decorations: DecorationSet;
}

const key = new PluginKey<FindState>('find');
const EMPTY: FindState = {
  opts: null,
  matches: [],
  current: -1,
  invalid: false,
  decorations: DecorationSet.empty,
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildRegExp(opts: FindOptions): RegExp | null {
  if (!opts.query) return null;
  try {
    const source = opts.regex ? opts.query : escapeRegExp(opts.query);
    return new RegExp(
      opts.wholeWord ? `\\b(?:${source})\\b` : source,
      opts.caseSensitive ? 'gu' : 'giu',
    );
  } catch {
    return null;
  }
}

function findMatches(
  state: EditorState,
  opts: FindOptions,
): { matches: Match[]; invalid: boolean } {
  const re = buildRegExp(opts);
  if (!re) return { matches: [], invalid: !!opts.query && opts.regex };
  const matches: Match[] = [];
  state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const { text, pos: positions } = buildTextIndex(node, pos);
    re.lastIndex = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      matches.push({ from: positions[m.index]!, to: positions[m.index + m[0].length - 1]! + 1 });
      if (matches.length >= 20000) return false;
    }
    return false;
  });
  return { matches, invalid: false };
}

function compute(
  state: EditorState,
  opts: FindOptions | null,
  previous: number,
  reset: boolean,
): FindState {
  if (!opts || !opts.query) return EMPTY;
  const { matches, invalid } = findMatches(state, opts);
  let current = -1;
  if (matches.length) {
    if (reset || previous < 0) {
      current = matches.findIndex((m) => m.from >= state.selection.from);
      if (current < 0) current = 0;
    } else current = Math.min(previous, matches.length - 1);
  }
  const decorations = DecorationSet.create(
    state.doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, { class: i === current ? 'find-current' : 'find-match' }),
    ),
  );
  return { opts, matches, current, invalid, decorations };
}

interface FindMeta {
  opts?: FindOptions | null;
  current?: number;
  reset?: boolean;
}

export function findPlugin(): Plugin<FindState> {
  return new Plugin<FindState>({
    key,
    state: {
      init: () => EMPTY,
      apply(tr: Transaction, prev, _old, state) {
        const meta = tr.getMeta(key) as FindMeta | undefined;
        if (meta === undefined) {
          return tr.docChanged && prev.opts ? compute(state, prev.opts, prev.current, false) : prev;
        }
        const opts = 'opts' in meta ? (meta.opts ?? null) : prev.opts;
        const next = compute(state, opts, meta.current ?? prev.current, meta.reset ?? false);
        return meta.current !== undefined && next.matches.length
          ? compute(state, opts, meta.current, false)
          : next;
      },
    },
    props: { decorations: (state) => key.getState(state)?.decorations },
  });
}

export function info(state: EditorState): FindInfo {
  const s = key.getState(state) ?? EMPTY;
  return { count: s.matches.length, current: s.current, invalid: s.invalid };
}

/** Define (o borra, con `null`) la búsqueda activa. */
export function setFind(view: EditorView, opts: FindOptions | null): FindInfo {
  view.dispatch(view.state.tr.setMeta(key, { opts, reset: true } satisfies FindMeta));
  return info(view.state);
}

function select(view: EditorView, index: number): FindInfo {
  const s = key.getState(view.state) ?? EMPTY;
  const match = s.matches[index];
  const tr = view.state.tr.setMeta(key, { current: index } satisfies FindMeta);
  if (match) {
    tr.setSelection(TextSelection.create(view.state.doc, match.from, match.to)).scrollIntoView();
  }
  view.dispatch(tr);
  if (match) {
    // Con el foco en la barra de búsqueda, ProseMirror no siempre desplaza: se asegura aquí.
    const { node } = view.domAtPos(match.from);
    const el = node.nodeType === 1 ? (node as Element) : node.parentElement;
    el?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }
  return info(view.state);
}

export function findMove(view: EditorView, direction: 1 | -1): FindInfo {
  const s = key.getState(view.state) ?? EMPTY;
  if (!s.matches.length) return info(view.state);
  const index =
    (Math.max(s.current, 0) + (s.current < 0 ? 0 : direction) + s.matches.length) %
    s.matches.length;
  return select(view, index);
}

/** Selecciona la coincidencia actual si aún no está seleccionada. */
export function findReveal(view: EditorView): FindInfo {
  const s = key.getState(view.state) ?? EMPTY;
  return s.current >= 0 ? select(view, s.current) : info(view.state);
}

export function replaceCurrent(view: EditorView, text: string): FindInfo {
  const s = key.getState(view.state) ?? EMPTY;
  const match = s.matches[s.current];
  if (!match) return info(view.state);
  const sel = view.state.selection;
  // Si la coincidencia aún no está seleccionada, el primer pulso solo la selecciona.
  if (sel.from !== match.from || sel.to !== match.to) return select(view, s.current);
  const tr = view.state.tr.insertText(text, match.from, match.to);
  view.dispatch(tr);
  return findMove(view, 1);
}

export function replaceAll(view: EditorView, text: string): FindInfo {
  const s = key.getState(view.state) ?? EMPTY;
  if (!s.matches.length) return info(view.state);
  const tr = view.state.tr;
  // De atrás hacia delante para que las posiciones anteriores sigan siendo válidas.
  for (const m of [...s.matches].reverse()) tr.insertText(text, m.from, m.to);
  view.dispatch(tr.setMeta(key, { reset: true } satisfies FindMeta));
  return info(view.state);
}
