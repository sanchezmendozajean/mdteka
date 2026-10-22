import { redoDepth, undoDepth, undo as pmUndo, redo as pmRedo } from 'prosemirror-history';
import { EditorState as PmState, Selection, TextSelection } from 'prosemirror-state';
import type { EditorView as PmView } from 'prosemirror-view';
import { EditorState as CmState } from '@codemirror/state';
import type { EditorView as CmView } from '@codemirror/view';
import { askLink, useDocs, type Mode } from '../documents/store';
import type { PageGeometry } from '@shared/page';
import { Paginator } from './paginator/paginator';
import { usePagination } from './pagination-store';
import { docFromSource, serializeDoc, sourceFromDoc } from './model/doc';
import {
  insertAtCursor,
  insertBlockText,
  insertLink,
  indentLines,
  readSourceFormatState,
  setHeading,
  sourceRedo,
  sourceUndo,
  tableTemplate,
  toggleCodeFence,
  toggleListLines,
  toggleQuoteLines,
  toggleWrap,
  currentLinkHref,
} from './source/commands';
import { setSourceFind, sourceFindMove, sourceReplaceAll, sourceReplaceNext } from './source/find';
import { createSourceState, createSourceView } from './source/view';
import { pmToSourceOffset, sourceToPmOffset } from './sync/map-position';
import {
  applyLink,
  clearFormatting,
  currentLink,
  indentList,
  insertHardBreak,
  insertHorizontalRule,
  insertHtmlBlock,
  insertPageBreak,
  insertTable,
  insertText,
  outdentList,
  pasteMarkdown,
  readFormatState,
  type FormatState,
  setColumnAlign,
  setParagraph,
  tableCommands,
  toggleBold,
  toggleCode,
  toggleCodeBlock,
  toggleHeading,
  toggleItalic,
  toggleList,
  toggleQuote,
  toggleStrike,
  toggleTaskList,
} from './wysiwyg/commands';
import {
  findMove,
  replaceAll as pmReplaceAll,
  replaceCurrent,
  setFind,
  type FindInfo,
  type FindOptions,
} from './wysiwyg/find';
import { createWysiwygState, createWysiwygView } from './wysiwyg/view';
import { schema } from './model/schema';

/** Sucio = el texto o el bloque de configuración difieren de lo guardado en disco. */
function isDirty(rt: { id: string; source: string; savedSource: string }): boolean {
  const info = useDocs.getState().docs.find((d) => d.id === rt.id);
  return rt.source !== rt.savedSource || (info ? info.configRaw !== info.savedConfigRaw : false);
}

/** Estado de edición de un documento: no es reactivo, vive fuera de React para no estorbar a la tecla. */
export interface DocRuntime {
  id: string;
  /** Markdown del cuerpo (EOL `\n`, sin bloque de configuración); la fuente de verdad. */
  source: string;
  savedSource: string;
  pmState: PmState | null;
  /** Fuente de la que se derivó (o con la que se sincronizó) `pmState`. */
  pmSource: string | null;
  cmState: CmState | null;
  cmSource: string | null;
  mode: Mode;
  scrollRatio: number;
  /** El editor activo tiene cambios aún no volcados a `source`. */
  stale: boolean;
}

export type FormatCommand =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'clearFormat'
  | 'link'
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'quote'
  | 'codeBlock'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'indent'
  | 'outdent'
  | 'hr'
  | 'pageBreak'
  | 'html'
  | 'date'
  | 'hardBreak'
  | 'undo'
  | 'redo'
  | 'tableAddRowBefore'
  | 'tableAddRowAfter'
  | 'tableDeleteRow'
  | 'tableAddColBefore'
  | 'tableAddColAfter'
  | 'tableDeleteCol'
  | 'tableDelete'
  | 'tableAlignLeft'
  | 'tableAlignCenter'
  | 'tableAlignRight';

const SYNC_DELAY_MS = 300;

/** Palabras: secuencias de letras o cifras; ignora la sintaxis Markdown. */
export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

function sameFormat(a: FormatState, b: FormatState): boolean {
  return (Object.keys(a) as (keyof FormatState)[]).every((key) => a[key] === b[key]);
}

class EditorController {
  private runtimes = new Map<string, DocRuntime>();
  private pm: PmView | null = null;
  private cm: CmView | null = null;
  private scroller: HTMLElement | null = null;
  private pmMount: HTMLElement | null = null;
  private pager: Paginator | null = null;
  private cmMount: HTMLElement | null = null;
  private activeId: string | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private formatFrame = 0;

  // -------------------------------------------------------------------------------------------
  // Ciclo de vida
  // -------------------------------------------------------------------------------------------

  mount(scroller: HTMLElement, pmMount: HTMLElement, cmMount: HTMLElement): void {
    this.scroller = scroller;
    this.pmMount = pmMount;
    this.cmMount = cmMount;
    this.pm = createWysiwygView(pmMount, createWysiwygState(docFromSource('')), {
      onTransaction: (tr, state) => {
        const rt = this.current();
        if (!rt || rt.mode !== 'wysiwyg') return;
        rt.pmState = state;
        if (tr.docChanged) {
          this.markStale(rt);
          this.pager?.schedule(true);
        }
        this.scheduleFormat();
      },
    });
    this.pager = new Paginator(this.pm, {
      scroller: () => this.scroller,
      onLayout: (layout) => usePagination.getState().set({ pages: layout?.pages ?? 0 }),
    });
    this.cm = createSourceView(cmMount, createSourceState(''), {
      onTransaction: (tr) => {
        const rt = this.current();
        if (!rt || rt.mode !== 'source' || !this.cm) return;
        rt.cmState = this.cm.state;
        if (tr.docChanged) this.markStale(rt);
        this.scheduleFormat();
      },
    });
    this.showMode(null);
    if (this.activeId) this.activate(this.activeId);
  }

  /** Activa la vista de páginas con esta geometría (null = vista continua). */
  setPageLayout(geometry: PageGeometry | null, styleKey: string): void {
    this.pager?.configure(geometry, styleKey);
  }

  unmount(): void {
    this.pm?.destroy();
    this.cm?.destroy();
    this.pm = this.cm = null;
  }

  register(rt: DocRuntime): void {
    this.runtimes.set(rt.id, rt);
  }

  runtime(id: string): DocRuntime | undefined {
    return this.runtimes.get(id);
  }

  discard(id: string): void {
    this.runtimes.delete(id);
    if (this.activeId === id) this.activeId = null;
  }

  private current(): DocRuntime | null {
    return this.activeId ? (this.runtimes.get(this.activeId) ?? null) : null;
  }

  activate(id: string | null): void {
    const previous = this.current();
    if (previous) {
      this.flush();
      previous.scrollRatio = this.scrollRatio();
    }
    this.activeId = id;
    useDocs.getState().setActive(id);
    const rt = this.current();
    if (!this.pm || !this.cm) return;
    if (!rt) {
      this.showMode(null);
      return;
    }
    this.showMode(rt.mode);
    this.load(rt);
    useDocs.getState().update(rt.id, { words: countWords(rt.source) });
    this.restoreScroll(rt.scrollRatio);
    this.scheduleFormat();
    this.focus();
  }

  /** Reconstruye los editores de un documento tras cambiar su contenido desde fuera (recarga). */
  invalidate(id: string): void {
    const rt = this.runtimes.get(id);
    if (!rt) return;
    rt.pmState = null;
    rt.cmState = null;
    rt.pmSource = null;
    rt.cmSource = null;
    rt.stale = false;
    if (this.activeId === id) {
      const ratio = this.scrollRatio();
      this.load(rt);
      this.restoreScroll(ratio);
    }
  }

  focus(): void {
    const rt = this.current();
    if (!rt) return;
    if (rt.mode === 'wysiwyg') this.pm?.focus();
    else this.cm?.focus();
  }

  // -------------------------------------------------------------------------------------------
  // Carga y sincronización
  // -------------------------------------------------------------------------------------------

  private showMode(mode: Mode | null): void {
    if (this.pmMount) this.pmMount.hidden = mode !== 'wysiwyg';
    if (this.cmMount) this.cmMount.hidden = mode !== 'source';
  }

  private load(rt: DocRuntime): void {
    if (rt.mode === 'wysiwyg') {
      if (!rt.pmState || rt.pmSource !== rt.source) {
        rt.pmState = createWysiwygState(docFromSource(rt.source));
        rt.pmSource = rt.source;
      }
      this.pm?.updateState(rt.pmState);
      this.pager?.invalidate();
    } else {
      if (!rt.cmState || rt.cmSource !== rt.source) {
        rt.cmState = createSourceState(rt.source);
        rt.cmSource = rt.source;
      }
      this.cm?.setState(rt.cmState);
    }
  }

  private markStale(rt: DocRuntime): void {
    rt.stale = true;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    // ED-12: la serialización queda fuera del camino de la tecla.
    this.syncTimer = setTimeout(() => this.flush(), SYNC_DELAY_MS);
  }

  /** Vuelca el editor activo a `source` y actualiza el estado reactivo (dirty, palabras). */
  flush(): void {
    const rt = this.current();
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = null;
    if (!rt || !rt.stale) return;
    let text: string;
    if (rt.mode === 'wysiwyg' && rt.pmState) {
      rt.source = sourceFromDoc(rt.pmState.doc);
      rt.pmSource = rt.source;
      text = rt.pmState.doc.textBetween(0, rt.pmState.doc.content.size, ' ', ' ');
    } else if (this.cm) {
      rt.source = this.cm.state.doc.toString();
      rt.cmSource = rt.source;
      text = rt.source;
    } else return;
    rt.stale = false;
    useDocs.getState().update(rt.id, {
      dirty: isDirty(rt),
      words: countWords(text),
    });
  }

  /** Markdown actual del documento activo (cuerpo, sin bloque de configuración). */
  getSource(): string {
    this.flush();
    return this.current()?.source ?? '';
  }

  /** Texto del documento `id`; vuelca primero si está activo. */
  sourceOf(id: string): string {
    if (id === this.activeId) this.flush();
    return this.runtimes.get(id)?.source ?? '';
  }

  // -------------------------------------------------------------------------------------------
  // Modo (ED-01…ED-04, ED-23)
  // -------------------------------------------------------------------------------------------

  mode(): Mode | null {
    return this.current()?.mode ?? null;
  }

  setMode(target: Mode): void {
    const rt = this.current();
    if (!rt || !this.pm || !this.cm || rt.mode === target) return;
    this.flush();
    const ratio = this.scrollRatio();

    // 1. Selección actual expresada como desplazamientos en la fuente.
    let anchor: number;
    let head: number;
    if (rt.mode === 'wysiwyg' && rt.pmState) {
      const { doc, selection } = rt.pmState;
      const serialized = serializeDoc(doc);
      anchor = pmToSourceOffset(doc, selection.anchor, serialized);
      head = pmToSourceOffset(doc, selection.head, serialized);
    } else {
      const sel = this.cm.state.selection.main;
      anchor = sel.anchor;
      head = sel.head;
    }

    // 2. Cambio de modo: solo se reconstruye el editor destino si su contenido quedó desfasado.
    rt.mode = target;
    useDocs.getState().update(rt.id, { mode: target });
    this.showMode(target);
    this.load(rt);

    // 3. Selección equivalente en el destino.
    if (target === 'source') {
      const length = this.cm.state.doc.length;
      this.cm.dispatch({
        selection: { anchor: Math.min(anchor, length), head: Math.min(head, length) },
      });
      rt.cmState = this.cm.state;
    } else if (rt.pmState) {
      const { doc } = rt.pmState;
      const serialized = serializeDoc(doc);
      const $a = doc.resolve(sourceToPmOffset(doc, anchor, serialized));
      const $h = doc.resolve(sourceToPmOffset(doc, head, serialized));
      const selection =
        $a.parent.inlineContent && $h.parent.inlineContent
          ? TextSelection.between($a, $h)
          : Selection.near($h);
      this.pm.dispatch(rt.pmState.tr.setSelection(selection).setMeta('addToHistory', false));
      rt.pmState = this.pm.state;
    }
    this.restoreScroll(ratio);
    this.scheduleFormat();
    this.focus();
  }

  toggleMode(): void {
    const mode = this.mode();
    if (mode) this.setMode(mode === 'wysiwyg' ? 'source' : 'wysiwyg');
  }

  // -------------------------------------------------------------------------------------------
  // Scroll
  // -------------------------------------------------------------------------------------------

  private scrollRatio(): number {
    const el = this.scroller;
    if (!el) return 0;
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? el.scrollTop / max : 0;
  }

  private restoreScroll(ratio: number): void {
    const apply = () => {
      const el = this.scroller;
      if (el) el.scrollTop = ratio * Math.max(el.scrollHeight - el.clientHeight, 0);
    };
    apply();
    requestAnimationFrame(apply);
  }

  // -------------------------------------------------------------------------------------------
  // Estado de formato (botones activos de la cinta)
  // -------------------------------------------------------------------------------------------

  private scheduleFormat(): void {
    if (this.formatFrame) return;
    this.formatFrame = requestAnimationFrame(() => {
      this.formatFrame = 0;
      const rt = this.current();
      if (!rt) return;
      let next: FormatState | null = null;
      if (rt.mode === 'wysiwyg' && this.pm) {
        const state = this.pm.state;
        next = readFormatState(state, { undo: undoDepth(state) > 0, redo: redoDepth(state) > 0 });
      } else if (this.cm) {
        next = readSourceFormatState(this.cm);
      }
      // Solo se publica si cambió algo: evita repintar la cinta en cada tecla (ED-12).
      const store = useDocs.getState();
      if (next && !sameFormat(store.format, next)) store.setFormat(next);
    });
  }

  // -------------------------------------------------------------------------------------------
  // Comandos de edición
  // -------------------------------------------------------------------------------------------

  /** Ejecuta un comando de formato en el modo activo. Devuelve si hizo algo. */
  run(command: FormatCommand): boolean {
    const rt = this.current();
    if (!rt) return false;
    const done = rt.mode === 'wysiwyg' ? this.runWysiwyg(command) : this.runSource(command);
    this.focus();
    this.scheduleFormat();
    return done;
  }

  private runWysiwyg(command: FormatCommand): boolean {
    const view = this.pm;
    if (!view) return false;
    const { state, dispatch } = view;
    const heading = /^h([1-6])$/.exec(command);
    if (heading)
      return toggleHeading(Number(heading[1]) as 1 | 2 | 3 | 4 | 5 | 6)(state, dispatch, view);
    switch (command) {
      case 'bold':
        return toggleBold(state, dispatch, view);
      case 'italic':
        return toggleItalic(state, dispatch, view);
      case 'strike':
        return toggleStrike(state, dispatch, view);
      case 'code':
        return toggleCode(state, dispatch, view);
      case 'clearFormat':
        return clearFormatting(state, dispatch, view);
      case 'paragraph':
        return setParagraph(state, dispatch, view);
      case 'quote':
        return toggleQuote(state, dispatch, view);
      case 'codeBlock':
        return toggleCodeBlock(state, dispatch, view);
      case 'bulletList':
        return toggleList(schema.nodes['bullet_list']!)(state, dispatch, view);
      case 'orderedList':
        return toggleList(schema.nodes['ordered_list']!)(state, dispatch, view);
      case 'taskList':
        return toggleTaskList(state, dispatch, view);
      case 'indent':
        return indentList(state, dispatch, view);
      case 'outdent':
        return outdentList(state, dispatch, view);
      case 'hr':
        return insertHorizontalRule(state, dispatch, view);
      case 'pageBreak':
        return insertPageBreak(state, dispatch, view);
      case 'html':
        return insertHtmlBlock(state, dispatch, view);
      case 'hardBreak':
        return insertHardBreak(state, dispatch, view);
      case 'date':
        return insertText(new Date().toLocaleDateString())(state, dispatch, view);
      case 'undo':
        return pmUndo(state, dispatch);
      case 'redo':
        return pmRedo(state, dispatch);
      case 'tableAddRowBefore':
        return tableCommands.addRowBefore(state, dispatch);
      case 'tableAddRowAfter':
        return tableCommands.addRowAfter(state, dispatch);
      case 'tableDeleteRow':
        return tableCommands.deleteRow(state, dispatch);
      case 'tableAddColBefore':
        return tableCommands.addColumnBefore(state, dispatch);
      case 'tableAddColAfter':
        return tableCommands.addColumnAfter(state, dispatch);
      case 'tableDeleteCol':
        return tableCommands.deleteColumn(state, dispatch);
      case 'tableDelete':
        return tableCommands.deleteTable(state, dispatch);
      case 'tableAlignLeft':
        return setColumnAlign('left')(state, dispatch, view);
      case 'tableAlignCenter':
        return setColumnAlign('center')(state, dispatch, view);
      case 'tableAlignRight':
        return setColumnAlign('right')(state, dispatch, view);
      default:
        return false;
    }
  }

  private runSource(command: FormatCommand): boolean {
    const view = this.cm;
    if (!view) return false;
    const heading = /^h([1-6])$/.exec(command);
    if (heading) return setHeading(view, Number(heading[1]));
    switch (command) {
      case 'bold':
        return toggleWrap(view, '**');
      case 'italic':
        return toggleWrap(view, '_');
      case 'strike':
        return toggleWrap(view, '~~');
      case 'code':
        return toggleWrap(view, '`');
      case 'paragraph':
        return setHeading(view, 0);
      case 'quote':
        return toggleQuoteLines(view);
      case 'codeBlock':
        return toggleCodeFence(view);
      case 'bulletList':
        return toggleListLines(view, 'bullet');
      case 'orderedList':
        return toggleListLines(view, 'ordered');
      case 'taskList':
        return toggleListLines(view, 'task');
      case 'indent':
        return indentLines(view, 1);
      case 'outdent':
        return indentLines(view, -1);
      case 'hr':
        return insertBlockText(view, '---\n');
      case 'pageBreak':
        return insertBlockText(view, '<!-- mdteca:pagebreak -->\n');
      case 'html':
        return insertBlockText(view, '<div></div>\n');
      case 'hardBreak':
        return insertAtCursor(view, '\\\n');
      case 'date':
        return insertAtCursor(view, new Date().toLocaleDateString());
      case 'undo':
        return sourceUndo(view);
      case 'redo':
        return sourceRedo(view);
      default:
        return false;
    }
  }

  insertTable(rows: number, cols: number): boolean {
    const rt = this.current();
    if (!rt) return false;
    const done =
      rt.mode === 'wysiwyg' && this.pm
        ? insertTable(rows, cols)(this.pm.state, this.pm.dispatch, this.pm)
        : this.cm
          ? insertBlockText(this.cm, tableTemplate(rows, cols) + '\n')
          : false;
    this.focus();
    return done;
  }

  /** Abre el diálogo de enlace y lo aplica (Ctrl+K). */
  async editLink(): Promise<void> {
    const rt = this.current();
    if (!rt) return;
    let initial = { href: '', title: '', text: '', hasSelection: false };
    if (rt.mode === 'wysiwyg' && this.pm) {
      const { state } = this.pm;
      const existing = currentLink(state);
      const { from, to, empty } = state.selection;
      initial = {
        href: existing?.href ?? '',
        title: existing?.title ?? '',
        text: empty ? '' : state.doc.textBetween(from, to, ' '),
        hasSelection: !empty,
      };
    } else if (this.cm) {
      const sel = this.cm.state.selection.main;
      initial = {
        href: currentLinkHref(this.cm) ?? '',
        title: '',
        text: this.cm.state.sliceDoc(sel.from, sel.to),
        hasSelection: !sel.empty,
      };
    }
    const result = await askLink(initial);
    if (!result) {
      this.focus();
      return;
    }
    if (rt.mode === 'wysiwyg' && this.pm) {
      applyLink(result)(this.pm.state, this.pm.dispatch);
    } else if (this.cm && result.href) {
      insertLink(this.cm, result.href, result.text);
    }
    this.focus();
  }

  /** Pegar como Markdown (ED-14): interpreta la sintaxis del portapapeles. */
  pasteAsMarkdown(text: string): boolean {
    const rt = this.current();
    if (!rt) return false;
    if (rt.mode === 'wysiwyg' && this.pm) {
      return pasteMarkdown(text)(this.pm.state, this.pm.dispatch);
    }
    return this.cm ? insertAtCursor(this.cm, text) : false;
  }

  // -------------------------------------------------------------------------------------------
  // Buscar y reemplazar (la barra es común a los dos modos)
  // -------------------------------------------------------------------------------------------

  private static readonly NO_MATCHES: FindInfo = { count: 0, current: -1, invalid: false };

  /** Define la búsqueda activa (o la borra con `null`) y devuelve el recuento. */
  find(opts: FindOptions | null, replace = ''): FindInfo {
    const rt = this.current();
    if (!rt) return EditorController.NO_MATCHES;
    if (rt.mode === 'wysiwyg' && this.pm) return setFind(this.pm, opts);
    return this.cm ? setSourceFind(this.cm, opts, replace) : EditorController.NO_MATCHES;
  }

  findStep(opts: FindOptions, direction: 1 | -1): FindInfo {
    const rt = this.current();
    if (!rt) return EditorController.NO_MATCHES;
    if (rt.mode === 'wysiwyg' && this.pm) return findMove(this.pm, direction);
    return this.cm ? sourceFindMove(this.cm, opts, direction) : EditorController.NO_MATCHES;
  }

  replaceOne(opts: FindOptions, replace: string): FindInfo {
    const rt = this.current();
    if (!rt) return EditorController.NO_MATCHES;
    if (rt.mode === 'wysiwyg' && this.pm) return replaceCurrent(this.pm, replace);
    return this.cm ? sourceReplaceNext(this.cm, opts, replace) : EditorController.NO_MATCHES;
  }

  replaceEvery(opts: FindOptions, replace: string): FindInfo {
    const rt = this.current();
    if (!rt) return EditorController.NO_MATCHES;
    if (rt.mode === 'wysiwyg' && this.pm) return pmReplaceAll(this.pm, replace);
    return this.cm ? sourceReplaceAll(this.cm, opts, replace) : EditorController.NO_MATCHES;
  }

  // Utilidades para pruebas E2E y diagnóstico.
  debug() {
    return { pm: this.pm, cm: this.cm, current: this.current() };
  }
}

export const editor = new EditorController();
