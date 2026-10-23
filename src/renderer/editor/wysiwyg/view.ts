import DOMPurify from 'dompurify';
import { baseKeymap, chainCommands } from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import type { Node as PmNode } from 'prosemirror-model';
import { liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import { goToNextCell, tableEditing } from 'prosemirror-tables';
import { EditorView } from 'prosemirror-view';
import { schema } from '../model/schema';
import { insertHardBreak } from './commands';
import { findPlugin } from './find';
import { pagePlugin } from '../paginator/plugin';
import { imageFilesFrom, imageHooks } from '../image-hooks';
import { highlightPlugin } from './highlight';
import { installMarginSelect } from './margin-select';
import { nodeViews } from './nodeviews';

const item = schema.nodes['list_item']!;

/**
 * Plugins del editor visual. IMPORTANTE (ED-15): no hay input rules ni autoformato; lo tecleado
 * es siempre texto literal. El formato solo llega por comandos (cinta, atajos, menús).
 */
function plugins() {
  return [
    history(),
    keymap({
      'Mod-z': undo,
      'Mod-y': redo,
      'Mod-Shift-z': redo,
      'Shift-Enter': insertHardBreak,
      Enter: (state, dispatch, view) => {
        // Una nueva tarea hereda la condición de tarea (sin marcar).
        const { $from } = state.selection;
        let checked: unknown = null;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === item) {
            checked = $from.node(d).attrs['checked'];
            break;
          }
        }
        return splitListItem(item, checked === null ? undefined : { checked: false })(
          state,
          dispatch,
          view,
        );
      },
      // Un bloque de código al final del documento (o contenedor) no deja dónde seguir: flecha
      // abajo desde su última línea añade un párrafo vacío debajo y entra en él.
      ArrowDown: (state, dispatch, view) => {
        const { selection } = state;
        const { $from } = selection;
        if (!selection.empty || $from.parent.type !== schema.nodes['code_block']) return false;
        if (!view?.endOfTextblock('down')) return false;
        const after = $from.after();
        if (after !== $from.end($from.depth - 1)) return false;
        if (dispatch) {
          const tr = state.tr.insert(after, schema.nodes['paragraph']!.create());
          dispatch(tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView());
        }
        return true;
      },
      Tab: chainCommands(goToNextCell(1), sinkListItem(item), () => true),
      'Shift-Tab': chainCommands(goToNextCell(-1), liftListItem(item), () => true),
    }),
    keymap(baseKeymap),
    tableEditing(),
    gapCursor(),
    dropCursor({ color: 'var(--accent)', width: 2 }),
    highlightPlugin(),
    findPlugin(),
    pagePlugin(),
  ];
}

export function createWysiwygState(doc: PmNode): EditorState {
  return EditorState.create({ doc, schema, plugins: plugins() });
}

/** Los atributos `style`/`class` del HTML pegado no se conservan: solo la estructura (ED-14). */
function sanitizePasted(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['style', 'script', 'link', 'meta', 'iframe', 'object', 'embed', 'form', 'svg'],
    FORBID_ATTR: ['class', 'id'],
  });
}

export interface WysiwygCallbacks {
  onTransaction: (tr: Transaction, state: EditorState) => void;
}

export function createWysiwygView(
  mount: HTMLElement,
  state: EditorState,
  callbacks: WysiwygCallbacks,
): EditorView {
  const view: EditorView = new EditorView(mount, {
    state,
    nodeViews,
    attributes: {
      'data-testid': 'wysiwyg',
      spellcheck: 'true',
      role: 'textbox',
      'aria-multiline': 'true',
    },
    transformPastedHTML: sanitizePasted,
    // Imágenes pegadas o arrastradas (06): el flujo decide si se incrustan o se guardan como archivo.
    handlePaste(_v, event) {
      const files = imageFilesFrom(event.clipboardData?.files);
      if (files.length === 0 || !imageHooks.onFiles) return false;
      event.preventDefault();
      imageHooks.onFiles(files, null);
      return true;
    },
    handleDrop(v, event, _slice, moved) {
      const files = imageFilesFrom((event as DragEvent).dataTransfer?.files);
      if (moved || files.length === 0 || !imageHooks.onFiles) return false;
      event.preventDefault();
      const at = v.posAtCoords({ left: event.clientX, top: event.clientY });
      imageHooks.onFiles(files, at?.pos ?? null);
      return true;
    },
    // Ctrl/Cmd + clic abre el enlace (solo http, https y mailto: lo valida el proceso principal).
    handleClick(v, pos, event) {
      if (!(event.ctrlKey || event.metaKey)) return false;
      const $pos = v.state.doc.resolve(pos);
      const link = [...$pos.marks(), ...($pos.nodeAfter?.marks ?? [])].find(
        (m) => m.type.name === 'link',
      );
      if (!link) return false;
      void window.mdteca.shell.openExternal(link.attrs['href'] as string);
      return true;
    },
    dispatchTransaction(tr) {
      const next = view.state.apply(tr);
      view.updateState(next);
      callbacks.onTransaction(tr, next);
    },
  });
  if (mount.parentElement) installMarginSelect(view, mount.parentElement);
  return view;
}
