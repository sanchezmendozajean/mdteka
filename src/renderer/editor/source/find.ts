import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from '@codemirror/search';
import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { FindInfo, FindOptions } from '../wysiwyg/find';

/** Buscar y reemplazar en el modo texto, sobre la API de búsqueda de CodeMirror. */
function toQuery(opts: FindOptions, replace: string): SearchQuery {
  return new SearchQuery({
    search: opts.query,
    caseSensitive: opts.caseSensitive,
    wholeWord: opts.wholeWord,
    regexp: opts.regex,
    replace,
  });
}

function infoFor(view: EditorView, opts: FindOptions | null, replace: string): FindInfo {
  if (!opts || !opts.query) return { count: 0, current: -1, invalid: false };
  const query = toQuery(opts, replace);
  if (!query.valid) return { count: 0, current: -1, invalid: opts.regex };
  const { from } = view.state.selection.main;
  let count = 0;
  let current = -1;
  const cursor = query.getCursor(view.state);
  for (let r = cursor.next(); !r.done && count < 20000; r = cursor.next()) {
    if (current < 0 && r.value.from >= from) current = count;
    count++;
  }
  return { count, current: count ? Math.max(current, 0) : -1, invalid: false };
}

export function setSourceFind(
  view: EditorView,
  opts: FindOptions | null,
  replace: string,
): FindInfo {
  view.dispatch({
    effects: setSearchQuery.of(
      toQuery(opts ?? { query: '', caseSensitive: false, wholeWord: false, regex: false }, replace),
    ),
  });
  return infoFor(view, opts, replace);
}

/** Selecciona la primera coincidencia desde el cursor (sin saltarse la que ya está bajo él). */
export function sourceFindReveal(view: EditorView, opts: FindOptions): FindInfo {
  const query = toQuery(opts, '');
  if (query.valid) {
    const from = view.state.selection.main.from;
    let r = query.getCursor(view.state, from).next();
    if (r.done) r = query.getCursor(view.state).next();
    if (!r.done) {
      view.dispatch({
        selection: EditorSelection.range(r.value.from, r.value.to),
        scrollIntoView: true,
      });
    }
  }
  return infoFor(view, opts, '');
}

export function sourceFindMove(view: EditorView, opts: FindOptions, direction: 1 | -1): FindInfo {
  (direction === 1 ? findNext : findPrevious)(view);
  return infoFor(view, opts, '');
}

export function sourceReplaceNext(view: EditorView, opts: FindOptions, replace: string): FindInfo {
  view.dispatch({ effects: setSearchQuery.of(toQuery(opts, replace)) });
  replaceNext(view);
  return infoFor(view, opts, replace);
}

export function sourceReplaceAll(view: EditorView, opts: FindOptions, replace: string): FindInfo {
  view.dispatch({ effects: setSearchQuery.of(toQuery(opts, replace)) });
  replaceAll(view);
  return infoFor(view, opts, replace);
}
