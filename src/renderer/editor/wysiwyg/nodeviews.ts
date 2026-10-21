import DOMPurify from 'dompurify';
import i18next from 'i18next';
import type { Node as PmNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';

type GetPos = () => number | undefined;

/** Tarea: casilla de verificación fuera del contenido editable. */
class ListItemView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private checkbox: HTMLInputElement | null = null;
  private task: boolean;

  constructor(
    private node: PmNode,
    private view: EditorView,
    private getPos: GetPos,
  ) {
    this.task = node.attrs['checked'] !== null;
    this.dom = document.createElement('li');
    if (this.task) {
      this.dom.className = 'task-item';
      this.checkbox = document.createElement('input');
      this.checkbox.type = 'checkbox';
      this.checkbox.contentEditable = 'false';
      this.checkbox.checked = !!node.attrs['checked'];
      this.checkbox.addEventListener('change', () => {
        const pos = this.getPos();
        if (pos === undefined) return;
        this.view.dispatch(
          this.view.state.tr.setNodeAttribute(pos, 'checked', this.checkbox!.checked),
        );
      });
      this.contentDOM = document.createElement('div');
      this.contentDOM.className = 'task-content';
      this.dom.append(this.checkbox, this.contentDOM);
    } else {
      this.contentDOM = this.dom;
    }
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type || (node.attrs['checked'] !== null) !== this.task)
      return false;
    this.node = node;
    if (this.checkbox) this.checkbox.checked = !!node.attrs['checked'];
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target === this.checkbox;
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.target === this.checkbox;
  }
}

type ViewMutationRecord = MutationRecord | { type: 'selection'; target: Node };

const COMMON_LANGUAGES = [
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'go',
  'html',
  'java',
  'javascript',
  'json',
  'kotlin',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'sql',
  'swift',
  'typescript',
  'xml',
  'yaml',
];

/** Bloque de código con selector de lenguaje (no afecta a la altura del contenido). */
class CodeBlockView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private select: HTMLSelectElement;

  constructor(
    private node: PmNode,
    private view: EditorView,
    private getPos: GetPos,
  ) {
    this.dom = document.createElement('div');
    this.dom.className = 'code-block';
    this.select = document.createElement('select');
    this.select.className = 'code-lang';
    this.select.contentEditable = 'false';
    this.select.setAttribute('aria-label', i18next.t('editor.codeLanguage'));
    this.select.addEventListener('change', () => {
      const pos = this.getPos();
      if (pos === undefined) return;
      this.view.dispatch(
        this.view.state.tr.setNodeAttribute(pos, 'lang', this.select.value || null),
      );
    });
    const pre = document.createElement('pre');
    this.contentDOM = document.createElement('code');
    pre.append(this.contentDOM);
    this.dom.append(this.select, pre);
    this.fillSelect();
  }

  private fillSelect(): void {
    const current = (this.node.attrs['lang'] as string | null) ?? '';
    const langs = new Set(COMMON_LANGUAGES);
    if (current) langs.add(current);
    this.select.replaceChildren(
      new Option(i18next.t('editor.plainText'), ''),
      ...[...langs].sort().map((l) => new Option(l, l)),
    );
    this.select.value = current;
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    const langChanged = node.attrs['lang'] !== this.node.attrs['lang'];
    this.node = node;
    if (langChanged) this.fillSelect();
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target === this.select;
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.target === this.select || this.select.contains(mutation.target as Node);
  }
}

const SANITIZE = {
  FORBID_TAGS: ['style', 'script', 'link', 'meta', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['style'],
};

/**
 * Bloque atómico para HTML embebido (renderizado y sanitizado) y para Markdown no reconocido
 * ("bloque crudo", 03). Doble clic abre el editor de la fuente del bloque.
 */
class RawBlockView implements NodeView {
  dom: HTMLElement;
  private body: HTMLElement;
  private editor: HTMLTextAreaElement | null = null;

  constructor(
    private node: PmNode,
    private view: EditorView,
    private getPos: GetPos,
  ) {
    const html = node.type.name === 'html_block';
    this.dom = document.createElement('div');
    this.dom.className = html ? 'html-block' : 'raw-block';
    this.dom.contentEditable = 'false';
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'raw-chip';
    chip.textContent = i18next.t(html ? 'editor.htmlBlock' : 'editor.rawBlock');
    chip.addEventListener('click', () => this.edit());
    this.body = document.createElement('div');
    this.body.className = 'raw-body';
    this.dom.append(chip, this.body);
    this.dom.addEventListener('dblclick', () => this.edit());
    this.render();
  }

  private render(): void {
    const value = this.node.attrs['value'] as string;
    if (this.node.type.name === 'html_block') {
      this.body.innerHTML = DOMPurify.sanitize(value, SANITIZE);
    } else {
      this.body.textContent = value;
    }
  }

  private edit(): void {
    if (this.editor) return;
    const area = document.createElement('textarea');
    area.className = 'raw-editor';
    area.value = this.node.attrs['value'] as string;
    area.rows = Math.min(Math.max(area.value.split('\n').length, 2), 16);
    this.editor = area;
    this.body.replaceChildren(area);
    area.focus();
    const commit = (save: boolean) => {
      const pos = this.getPos();
      this.editor = null;
      if (save && pos !== undefined && area.value !== this.node.attrs['value']) {
        this.view.dispatch(this.view.state.tr.setNodeAttribute(pos, 'value', area.value));
      } else this.render();
      this.view.focus();
    };
    area.addEventListener('blur', () => this.editor && commit(true));
    area.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        commit(false);
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit(true);
      }
    });
  }

  update(node: PmNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    if (!this.editor) this.render();
    return true;
  }

  stopEvent(): boolean {
    return !!this.editor;
  }

  ignoreMutation(): boolean {
    return true;
  }
}

class PageBreakView implements NodeView {
  dom: HTMLElement;
  constructor() {
    this.dom = document.createElement('div');
    this.dom.className = 'page-break';
    this.dom.contentEditable = 'false';
    this.dom.dataset['label'] = i18next.t('editor.pageBreak');
  }
  ignoreMutation(): boolean {
    return true;
  }
}

const REMOTE_OR_DATA = /^(https?:|data:image\/)/i;

class ImageView implements NodeView {
  dom: HTMLElement;
  constructor(node: PmNode) {
    const src = node.attrs['src'] as string;
    const alt = (node.attrs['alt'] as string) || '';
    if (REMOTE_OR_DATA.test(src)) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      if (node.attrs['title']) img.title = node.attrs['title'] as string;
      this.dom = img;
    } else {
      // Las imágenes locales se resuelven con `mdteca-asset://` en la Fase 4.
      const span = document.createElement('span');
      span.className = 'image-placeholder';
      span.textContent = alt || src.split('/').pop() || i18next.t('editor.image');
      span.title = src;
      this.dom = span;
    }
  }
  ignoreMutation(): boolean {
    return true;
  }
}

class RawInlineView implements NodeView {
  dom: HTMLElement;
  constructor(node: PmNode) {
    this.dom = document.createElement('span');
    this.dom.className = 'raw-inline';
    this.dom.textContent = node.attrs['value'] as string;
  }
  ignoreMutation(): boolean {
    return true;
  }
}

export const nodeViews = {
  list_item: (node: PmNode, view: EditorView, getPos: GetPos) =>
    new ListItemView(node, view, getPos),
  code_block: (node: PmNode, view: EditorView, getPos: GetPos) =>
    new CodeBlockView(node, view, getPos),
  html_block: (node: PmNode, view: EditorView, getPos: GetPos) =>
    new RawBlockView(node, view, getPos),
  raw_block: (node: PmNode, view: EditorView, getPos: GetPos) =>
    new RawBlockView(node, view, getPos),
  page_break: () => new PageBreakView(),
  image: (node: PmNode) => new ImageView(node),
  raw_inline: (node: PmNode) => new RawInlineView(node),
};
