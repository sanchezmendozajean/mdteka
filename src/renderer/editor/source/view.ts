import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  foldGutter,
  foldKeymap,
  foldService,
  HighlightStyle,
  syntaxHighlighting,
} from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { highlightSelectionMatches, search } from '@codemirror/search';
import { EditorState, type Extension, type Transaction } from '@codemirror/state';
import { drawSelection, EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { imageFilesFrom, imageHooks } from '../image-hooks';
import { foldDataUrls } from './data-urls';
import { sourcePages } from './pages';

/** Pliegue de secciones por título: desde la línea del título hasta antes del siguiente de igual o mayor rango. */
const headingFolding = foldService.of((state, lineStart) => {
  const line = state.doc.lineAt(lineStart);
  const match = /^(#{1,6})\s/.exec(line.text);
  if (!match) return null;
  const level = match[1]!.length;
  let end = line.to;
  for (let n = line.number + 1; n <= state.doc.lines; n++) {
    const next = state.doc.line(n);
    const m = /^(#{1,6})\s/.exec(next.text);
    if (m && m[1]!.length <= level) break;
    end = next.to;
  }
  return end > line.to ? { from: line.to, to: end } : null;
});

/** Resaltado sutil: títulos en peso mayor, marcas atenuadas, código en monoespaciada (03). */
const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700' },
  { tag: tags.heading2, fontWeight: '700' },
  { tag: tags.heading3, fontWeight: '600' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.processingInstruction, color: 'var(--text-3)' },
  { tag: tags.monospace, fontFamily: 'var(--doc-mono)' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--accent)' },
  { tag: tags.quote, color: 'var(--text-2)' },
  { tag: tags.comment, color: 'var(--text-3)' },
]);

export interface SourceCallbacks {
  onTransaction: (tr: Transaction) => void;
}

export function sourceExtensions(): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    sourcePages(),
    foldDataUrls(),
    EditorView.domEventHandlers({
      paste(event) {
        const files = imageFilesFrom(event.clipboardData?.files);
        if (files.length === 0 || !imageHooks.onFiles) return false;
        event.preventDefault();
        imageHooks.onFiles(files, null);
        return true;
      },
      drop(event, view) {
        const files = imageFilesFrom(event.dataTransfer?.files);
        if (files.length === 0 || !imageHooks.onFiles) return false;
        event.preventDefault();
        imageHooks.onFiles(files, view.posAtCoords({ x: event.clientX, y: event.clientY }));
        return true;
      },
    }),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    syntaxHighlighting(highlightStyle),
    headingFolding,
    foldGutter({ openText: '▾', closedText: '▸' }),
    highlightSelectionMatches(),
    // La barra de búsqueda es la de MDteca, común a ambos modos: se anula el panel de CodeMirror.
    search({ createPanel: () => ({ dom: document.createElement('span') }) }),
    keymap.of([...historyKeymap, ...foldKeymap, ...defaultKeymap, indentWithTab]),
    EditorView.contentAttributes.of({ 'data-testid': 'source', spellcheck: 'true' }),
  ];
}

export function createSourceState(text: string): EditorState {
  return EditorState.create({ doc: text, extensions: sourceExtensions() });
}

export function createSourceView(
  mount: HTMLElement,
  state: EditorState,
  callbacks: SourceCallbacks,
): EditorView {
  const view: EditorView = new EditorView({
    state,
    parent: mount,
    dispatchTransactions(trs) {
      view.update(trs);
      for (const tr of trs) callbacks.onTransaction(tr);
    },
  });
  return view;
}
