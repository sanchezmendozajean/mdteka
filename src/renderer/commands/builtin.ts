import {
  AlignCenter,
  AlignJustify,
  Brush,
  ListTree,
  RotateCcw,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  Calendar,
  ClipboardCheck,
  ClipboardPaste,
  ClipboardType,
  Code,
  CodeXml,
  Copy,
  Eye,
  FileMinus,
  FilePlus,
  FolderOpen,
  Footprints,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Library,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Moon,
  PanelRight,
  PanelTop,
  Pilcrow,
  Quote,
  Redo2,
  Replace,
  Search,
  RemoveFormatting,
  Save,
  SaveAll,
  Scissors,
  SquareCode,
  Strikethrough,
  Table,
  Trash2,
  Undo2,
  X,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  type LucideIcon,
} from 'lucide-react';
import { useUi } from '../app/store';
import { closeDocument, newDocument, openFileDialog, saveDocument } from '../documents/actions';
import { resetConfig, resolveConfig, updateActiveConfig } from '../documents/config';
import { activeDoc, useDocs } from '../documents/store';
import { useFind } from '../editor/find-store';
import { editor, type FormatCommand } from '../editor/controller';
import type { FormatState } from '../editor/wysiwyg/commands';
import { registerCommand } from './registry';

const ui = () => useUi.getState();

interface Options {
  shortcut?: string;
  native?: boolean;
  global?: boolean;
  inFields?: boolean;
  when?: () => boolean;
  active?: (f: FormatState) => boolean;
}

const def = (id: string, icon: LucideIcon, run: () => void, options: Options = {}) =>
  registerCommand({ id, icon, run, ...options });

/** Comando de formato del editor activo. */
const fmt = (id: string, icon: LucideIcon, command: FormatCommand, options: Options = {}) =>
  def(id, icon, () => void editor.run(command), options);

const activeId = () => useDocs.getState().activeId;
const withDoc = (fn: (id: string) => void) => () => {
  const id = activeId();
  if (id) fn(id);
};

// ----- Archivo ---------------------------------------------------------------------------------
def('file.new', FilePlus, () => void newDocument(), {
  shortcut: 'Ctrl+N',
  global: true,
  inFields: true,
});
def('file.open', FolderOpen, () => void openFileDialog(), {
  shortcut: 'Ctrl+O',
  global: true,
  inFields: true,
});
def(
  'file.save',
  Save,
  withDoc((id) => void saveDocument(id)),
  { shortcut: 'Ctrl+S', inFields: true },
);
def(
  'file.saveAs',
  SaveAll,
  withDoc((id) => void saveDocument(id, true)),
  { shortcut: 'Ctrl+Shift+S', inFields: true },
);
def(
  'file.close',
  X,
  withDoc((id) => void closeDocument(id)),
  { shortcut: 'Ctrl+W' },
);

// ----- Editar / portapapeles ---------------------------------------------------------------------
def('edit.undo', Undo2, () => void editor.run('undo'), { shortcut: 'Ctrl+Z', native: true });
def('edit.redo', Redo2, () => void editor.run('redo'), { shortcut: 'Ctrl+Y', native: true });
const clip = (action: 'cut' | 'copy' | 'paste' | 'pastePlain') => () => {
  editor.focus();
  void window.mdteca.edit.action(action);
};
def('clipboard.paste', ClipboardPaste, clip('paste'), { shortcut: 'Ctrl+V', native: true });
def('clipboard.cut', Scissors, clip('cut'), { shortcut: 'Ctrl+X', native: true });
def('clipboard.copy', Copy, clip('copy'), { shortcut: 'Ctrl+C', native: true });
def('clipboard.pastePlain', ClipboardType, clip('pastePlain'), {
  shortcut: 'Ctrl+Shift+V',
  native: true,
});
def(
  'clipboard.pasteMarkdown',
  ClipboardCheck,
  () => void window.mdteca.clipboard.readText().then((text) => editor.pasteAsMarkdown(text)),
  { shortcut: 'Ctrl+Alt+V' },
);

def('edit.find', Search, () => useFind.getState().show(false), {
  shortcut: 'Ctrl+F',
  inFields: true,
});
def('edit.replace', Replace, () => useFind.getState().show(true), {
  shortcut: 'Ctrl+H',
  inFields: true,
});

// ----- Formato en línea ----------------------------------------------------------------------------
fmt('format.bold', Bold, 'bold', { shortcut: 'Ctrl+B', active: (f) => f.bold });
fmt('format.italic', Italic, 'italic', { shortcut: 'Ctrl+I', active: (f) => f.italic });
fmt('format.strike', Strikethrough, 'strike', {
  shortcut: 'Ctrl+Shift+X',
  active: (f) => f.strike,
});
fmt('format.code', Code, 'code', { shortcut: 'Ctrl+E', active: (f) => f.code });
def('format.link', Link, () => void editor.editLink(), {
  shortcut: 'Ctrl+K',
  active: (f) => f.link,
});
fmt('format.clear', RemoveFormatting, 'clearFormat', { when: () => editor.mode() === 'wysiwyg' });

// ----- Estilos de bloque -----------------------------------------------------------------------------
fmt('block.paragraph', Pilcrow, 'paragraph', {
  shortcut: 'Ctrl+0',
  active: (f) => f.block === 'paragraph',
});
const headings: [string, LucideIcon, FormatCommand][] = [
  ['1', Heading1, 'h1'],
  ['2', Heading2, 'h2'],
  ['3', Heading3, 'h3'],
  ['4', Heading4, 'h4'],
  ['5', Heading5, 'h5'],
  ['6', Heading6, 'h6'],
];
for (const [n, icon, command] of headings) {
  fmt(`block.heading${n}`, icon, command, {
    shortcut: `Ctrl+${n}`,
    active: (f) => f.block === command,
  });
}
fmt('block.quote', Quote, 'quote', { shortcut: 'Ctrl+Shift+.', active: (f) => f.quote });
fmt('block.codeBlock', SquareCode, 'codeBlock', {
  shortcut: 'Ctrl+Alt+C',
  active: (f) => f.block === 'code',
});

// ----- Listas ------------------------------------------------------------------------------------------
fmt('list.bullet', List, 'bulletList', {
  shortcut: 'Ctrl+Shift+8',
  active: (f) => f.list === 'bullet',
});
fmt('list.ordered', ListOrdered, 'orderedList', {
  shortcut: 'Ctrl+Shift+7',
  active: (f) => f.list === 'ordered',
});
fmt('list.tasks', ListChecks, 'taskList', {
  shortcut: 'Ctrl+Shift+9',
  active: (f) => f.list === 'task',
});
fmt('list.indent', IndentIncrease, 'indent');
fmt('list.outdent', IndentDecrease, 'outdent');

// ----- Insertar ------------------------------------------------------------------------------------------
def('insert.table', Table, () => void editor.insertTable(3, 3));
fmt('insert.separator', Minus, 'hr');
fmt('insert.pageBreak', FileMinus, 'pageBreak', { shortcut: 'Ctrl+Enter' });
fmt('insert.html', CodeXml, 'html');
fmt('insert.date', Calendar, 'date');
// Llegan en la Fase 4 (imágenes) y posteriores (notas al pie): quedan registrados pero no disponibles.
def('insert.image', Image, () => undefined, { when: () => false });
def('insert.footnote', Footprints, () => undefined, { when: () => false });

// ----- Tablas (contextuales) ------------------------------------------------------------------------------
const inTable = () => useDocs.getState().format.inTable && editor.mode() === 'wysiwyg';
const table = (id: string, icon: LucideIcon, command: FormatCommand) =>
  fmt(`table.${id}`, icon, command, { when: inTable });
table('addRowBefore', ArrowUpToLine, 'tableAddRowBefore');
table('addRowAfter', ArrowDownToLine, 'tableAddRowAfter');
table('deleteRow', BetweenHorizontalEnd, 'tableDeleteRow');
table('addColBefore', ArrowLeftToLine, 'tableAddColBefore');
table('addColAfter', ArrowRightToLine, 'tableAddColAfter');
table('deleteCol', BetweenVerticalEnd, 'tableDeleteCol');
table('delete', Trash2, 'tableDelete');
table('alignLeft', AlignLeft, 'tableAlignLeft');
table('alignCenter', AlignCenter, 'tableAlignCenter');
table('alignRight', AlignRight, 'tableAlignRight');

// ----- Vista --------------------------------------------------------------------------------------------
def('view.toggleMode', Eye, () => editor.toggleMode(), { shortcut: 'Ctrl+/' });
def('view.toggleNavigator', Library, () => ui().set({ navigatorOpen: !ui().navigatorOpen }), {
  shortcut: 'Ctrl+Shift+B',
  global: true,
});
def(
  'view.toggleDocumentPanel',
  PanelRight,
  () => ui().set({ documentPanelOpen: !ui().documentPanelOpen }),
  { shortcut: 'Ctrl+Shift+D', global: true },
);
def('view.collapseRibbon', PanelTop, () => ui().set({ ribbonCollapsed: !ui().ribbonCollapsed }), {
  shortcut: 'Ctrl+F1',
  global: true,
});
def(
  'view.toggleTheme',
  Moon,
  () => ui().set({ theme: ui().theme === 'light' ? 'dark' : 'light' }),
  {
    global: true,
  },
);

// ----- Diseño (04) ---------------------------------------------------------------------------------
def('design.alignLeft', AlignLeft, () => updateActiveConfig({ typography: { textAlign: 'left' } }));
def('design.alignJustify', AlignJustify, () =>
  updateActiveConfig({ typography: { textAlign: 'justify' } }),
);
def('design.numberedHeadings', ListTree, () => {
  const on = resolveConfig(activeDoc()).styles.h1.numbering === true;
  const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  updateActiveConfig({
    styles: Object.fromEntries(levels.map((k) => [k, { numbering: on ? undefined : true }])),
  });
});
def('design.editStyles', Brush, () =>
  ui().set({ documentPanelOpen: true, stylesFocus: ui().stylesFocus + 1 }),
);
def(
  'design.reset',
  RotateCcw,
  withDoc((id) => resetConfig(id)),
);
