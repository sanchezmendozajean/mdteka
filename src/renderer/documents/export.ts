import i18next from 'i18next';
import { bundledFont, fontKind, fontStack } from '@shared/document-config';
import { expandTokens, pageGeometry, type PageGeometry } from '@shared/page';
import tokensCss from '../styles/tokens.css?raw';
import editorCss from '../styles/editor.css?raw';
import { useToast } from '../app/toast';
import { editor } from '../editor/controller';
import { docFromSource } from '../editor/model/doc';
import { Paginator, type Analysis } from '../editor/paginator/paginator';
import { buildDocCss } from '../editor/typography';
import { createWysiwygState, createWysiwygView } from '../editor/wysiwyg/view';
import { resolveConfig } from './config';
import { imageKind } from './images';
import { askExportImages, showError, useDocs, type DocInfo } from './store';

const api = () => window.mdtor;
const CANCELLED = 'exportación cancelada';

/** Espera a que las imágenes del contenedor terminen de cargar (su altura cambia el reparto). */
const waitImages = (root: ParentNode): Promise<unknown> =>
  Promise.all(
    [...root.querySelectorAll('img')].map((img) =>
      img.complete
        ? undefined
        : new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
          }),
    ),
  );

/** Documento montado fuera de pantalla con el mismo CSS y los mismos *node views* que el editor. */
interface Offscreen {
  info: DocInfo;
  g: PageGeometry;
  container: HTMLElement;
  analysis: Analysis;
  dom: (block: number) => HTMLElement;
  dispose: () => void;
}

async function mountOffscreen(id: string): Promise<Offscreen> {
  editor.flush();
  const info = useDocs.getState().docs.find((d) => d.id === id);
  if (!info) throw new Error('Documento no encontrado');
  const eff = resolveConfig(info);
  const g = pageGeometry(eff.page);
  const container = document.createElement('div');
  container.className = 'print-measure';
  container.dataset['docId'] = id;
  container.lang = eff.typography.language;
  Object.assign(container.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${g.contentWidth}px`,
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  document.body.append(container);
  const view = createWysiwygView(
    container,
    createWysiwygState(docFromSource(editor.sourceOf(id))),
    {
      onTransaction: () => undefined,
    },
  );
  // El layout debe medirse con las fuentes ya cargadas.
  await Promise.all([
    document.fonts.load(`1em "${eff.typography.font}"`),
    document.fonts.load(`1em "${eff.typography.monoFont}"`),
    document.fonts.load(`bold 1em "${eff.typography.font}"`),
    document.fonts.ready,
  ]).catch(() => undefined);
  await waitImages(container);
  const pager = new Paginator(view, { scroller: () => null, onLayout: () => undefined }, false);
  const analysis = pager.analyze(g);
  if (!analysis) {
    view.destroy();
    container.remove();
    throw new Error('No se pudo medir el documento');
  }
  return {
    info,
    g,
    container,
    analysis,
    dom: (block) => view.nodeDOM(analysis.positions[block]!) as HTMLElement,
    dispose: () => {
      view.destroy();
      container.remove();
    },
  };
}

/** Limpia un bloque clonado: nada de controles de edición. */
function cleanClone(el: HTMLElement): HTMLElement {
  el.querySelectorAll('.code-lang, .page-gap').forEach((n) => n.remove());
  el.removeAttribute('contenteditable');
  el.querySelectorAll('[contenteditable]').forEach((n) => n.removeAttribute('contenteditable'));
  el.querySelectorAll('input[type="checkbox"]').forEach(
    (n) => ((n as HTMLInputElement).disabled = true),
  );
  return el;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export interface PrintView {
  root: HTMLElement;
  pages: number;
  /** Quita la vista de impresión y su regla `@page`. */
  dispose: () => void;
}

/**
 * Vista de impresión (VW-14): cada página es un rectángulo del tamaño del papel que recorta los
 * mismos bloques que el paginador reparte en pantalla, de modo que PDF y pantalla coinciden.
 */
export async function preparePrint(id: string): Promise<PrintView> {
  const off = await mountOffscreen(id);
  const { g, analysis, info } = off;
  const { layout } = analysis;
  const root = document.createElement('div');
  root.id = 'print-root';
  root.dataset['docId'] = id;
  root.lang = off.container.lang;
  const title = info.name.replace(/\.(md|markdown)$/i, '');
  const date = new Date().toLocaleDateString();
  const used = new Set<string>();

  for (let p = 1; p <= layout.pages; p++) {
    const page = document.createElement('section');
    page.className = 'print-page';
    page.style.width = `${g.widthMm}mm`;
    page.style.height = `${g.heightMm - 0.2}mm`;

    const content = document.createElement('div');
    content.className = 'print-content';
    Object.assign(content.style, {
      left: `${g.margins.left}px`,
      top: `${g.margins.top}px`,
      width: `${g.contentWidth}px`,
      height: `${g.contentHeight}px`,
    });
    const flow = document.createElement('div');
    flow.className = 'ProseMirror print-flow';
    content.append(flow);

    for (const part of layout.parts.filter((x) => x.page === p)) {
      const win = document.createElement('div');
      win.className = 'print-part';
      win.style.top = `${Math.max(0, part.top)}px`;
      win.style.height = `${part.height}px`;
      const clone = cleanClone(off.dom(part.block).cloneNode(true) as HTMLElement);
      if (/^H[1-6]$/.test(clone.tagName)) {
        let id2 = slug(clone.textContent ?? '') || 'seccion';
        for (let n = 2; used.has(id2); n++) id2 = `${slug(clone.textContent ?? '')}-${n}`;
        used.add(id2);
        clone.id = id2;
      }
      clone.style.position = 'absolute';
      clone.style.left = '0';
      clone.style.width = '100%';
      clone.style.margin = '0';
      clone.style.top = `${Math.min(0, part.top)}px`;
      win.append(clone);
      flow.append(win);
    }
    page.append(content);

    const values = { title, page: p, pages: layout.pages, date };
    const bars: ['header' | 'footer', typeof g.header][] = [
      ['header', g.header],
      ['footer', g.footer],
    ];
    for (const [kind, cfg] of bars) {
      const text = g.firstPageDifferent && p === 1 ? '' : expandTokens(cfg.text, values);
      if (!text) continue;
      const bar = document.createElement('div');
      bar.className = `sheet-bar sheet-${kind}`;
      Object.assign(bar.style, {
        left: `${g.margins.left}px`,
        right: `${g.margins.right}px`,
        justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[cfg.align],
        ...(kind === 'header'
          ? { top: '0', height: `${g.margins.top}px` }
          : { bottom: '0', height: `${g.margins.bottom}px` }),
      });
      bar.textContent = text;
      page.append(bar);
    }
    root.append(page);
  }

  const pageStyle = document.createElement('style');
  pageStyle.id = 'print-page-style';
  pageStyle.textContent = `@page { size: ${g.widthMm}mm ${g.heightMm}mm; margin: 0; }`;
  document.head.append(pageStyle);
  document.body.append(root);
  off.dispose();
  await waitImages(root);
  return {
    root,
    pages: layout.pages,
    dispose: () => {
      root.remove();
      pageStyle.remove();
    },
  };
}

function baseName(info: DocInfo, ext: string): string {
  return info.name.replace(/\.(md|markdown)$/i, '') + ext;
}

/** *Archivo › Exportar › PDF* (VW-40). Devuelve la ruta escrita o null si se cancela. */
export async function exportPdf(id: string): Promise<string | null> {
  const info = useDocs.getState().docs.find((d) => d.id === id);
  if (!info) return null;
  const path = await api().file.saveDialog(baseName(info, '.pdf'), 'pdf');
  if (!path) return null;
  let print: PrintView | null = null;
  try {
    print = await preparePrint(id);
    await api().export.pdf(path);
    useToast.getState().show(i18next.t('export.pdfDone'), {
      label: i18next.t('export.goToFile'),
      run: () => void api().project.reveal(path),
    });
    return path;
  } catch (error) {
    await showError(`${i18next.t('export.error', { name: info.name })}\n${String(error)}`);
    return null;
  } finally {
    print?.dispose();
  }
}

/** *Archivo › Imprimir* (VW-41): diálogo del sistema con la misma vista de impresión. */
export async function printDocument(id: string): Promise<void> {
  let print: PrintView | null = null;
  try {
    print = await preparePrint(id);
    await api().export.print();
  } catch (error) {
    await showError(`${i18next.t('export.error', { name: id })}\n${String(error)}`);
  } finally {
    print?.dispose();
  }
}

// ---------------------------------------------------------------------------------------------
// HTML autocontenido (VW-42)
// ---------------------------------------------------------------------------------------------

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML de un documento: un solo archivo con su CSS y sus fuentes. */
export async function buildHtml(id: string, htmlPath?: string): Promise<string> {
  const off = await mountOffscreen(id);
  try {
    const { info } = off;
    const eff = resolveConfig(info);
    const flow = off.container.querySelector('.ProseMirror') as HTMLElement;
    const body = cleanClone(flow.cloneNode(true) as HTMLElement);
    body.removeAttribute('id');
    await bundleImages(info, body, htmlPath);
    body.querySelectorAll('.page-break').forEach((n) => {
      (n as HTMLElement).style.breakAfter = 'page';
    });
    const families = new Set<string>();
    for (const [name, mono] of [
      [eff.typography.font, false],
      [eff.typography.monoFont, true],
    ] as const) {
      const stack = fontStack(name, fontKind(name, mono));
      for (const m of stack.matchAll(/'([^']+)'/g)) families.add(m[1]!);
      const own = bundledFont(name);
      if (own) families.add(own.css);
    }
    const fonts = await api().export.fonts([...families]);
    const css = buildDocCss(id, eff);
    const title = info.name.replace(/\.(md|markdown)$/i, '');
    const width = info.view === 'continuous' ? info.columnWidth : 760;
    return `<!doctype html>
<html lang="${escapeHtml(eff.typography.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${tokensCss}
${fonts}
${editorCss}
html, body { margin: 0; background: var(--canvas); }
.mdtor-page { box-sizing: border-box; max-width: ${width}px; margin: 24px auto; padding: 64px 72px; background: var(--paper); color: var(--ink); box-shadow: var(--sheet-shadow); }
@media (max-width: 720px) { .mdtor-page { margin: 0; padding: 32px 20px; } }
@media print { html, body { background: #fff; } .mdtor-page { box-shadow: none; margin: 0; max-width: none; } }
${css}
</style>
</head>
<body>
<main class="mdtor-page" data-doc-id="${id}">
${body.outerHTML}
</main>
</body>
</html>
`;
  } finally {
    off.dispose();
  }
}

/** *Archivo › Exportar › HTML* (VW-42). */
export async function exportHtml(id: string): Promise<string | null> {
  const info = useDocs.getState().docs.find((d) => d.id === id);
  if (!info) return null;
  const path = await api().file.saveDialog(baseName(info, '.html'), 'html');
  if (!path) return null;
  try {
    await api().file.write(path, await buildHtml(id, path));
    return path;
  } catch (error) {
    if (error instanceof Error && error.message === CANCELLED) return null;
    await showError(`${i18next.t('export.error', { name: info.name })}\n${String(error)}`);
    return null;
  }
}

/**
 * Imágenes-archivo del HTML (VW-42): se incrustan en base64 o se copian a `<html>_files/`, a
 * elección. Las remotas y las ya incrustadas se dejan como están.
 */
async function bundleImages(info: DocInfo, body: HTMLElement, htmlPath?: string): Promise<void> {
  const imgs = [...body.querySelectorAll<HTMLImageElement>('img[data-src]')];
  const local = imgs.filter((i) => imageKind(i.dataset['src']!) === 'file');
  for (const img of imgs) {
    if (!local.includes(img)) img.setAttribute('src', img.dataset['src']!);
  }
  if (local.length && info.path) {
    const names = [...new Set(local.map((i) => decodeURI(i.dataset['src']!)))];
    const how = htmlPath ? await askExportImages(names.length) : 'embed';
    if (how === null) throw new Error(CANCELLED);
    if (how === 'folder' && htmlPath) {
      const { folder } = await api().image.copyForExport(info.path, htmlPath, names);
      for (const img of local) {
        const file = decodeURI(img.dataset['src']!).split('/').pop()!;
        img.setAttribute('src', `${folder}/${encodeURIComponent(file)}`);
      }
    } else {
      const data = new Map<string, string>();
      for (const rel of names) {
        const { mime, data: b64 } = await api().image.read(info.path, rel);
        data.set(rel, `data:${mime};base64,${b64}`);
      }
      for (const img of local) img.setAttribute('src', data.get(decodeURI(img.dataset['src']!))!);
    }
  }
  for (const img of imgs) img.removeAttribute('data-src');
  body.querySelectorAll('.image-handle').forEach((n) => n.remove());
}
