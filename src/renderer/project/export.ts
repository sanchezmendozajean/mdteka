import i18next from 'i18next';
import { BookOpen, FileDown, FileText } from 'lucide-react';
import { rewriteLinks } from '@shared/links';
import {
  dirnameOf,
  findBook,
  flatten,
  joinPath,
  itemTitle,
  slugify,
  type ProjectItem,
} from '@shared/project';
import { discardHidden, registerHidden } from '../documents/actions';
import { exportPdf } from '../documents/export';
import { askChoose, showError } from '../documents/store';
import { detectFormat, splitConfigBlock } from '../editor/model/text-format';
import { currentProject } from './actions';
import { absolutePath, useProject } from './store';

const t = (key: string, options?: Record<string, unknown>) => i18next.t(key, options);

const PAGE_BREAK = '<!-- mdtor:pagebreak -->';

/** Un capítulo del libro en el PDF: su texto con los enlaces relativos reescritos a la raíz. */
async function chapterText(item: ProjectItem): Promise<string> {
  const raw = await window.mdtor.file.read(absolutePath(item.file));
  const { body } = splitConfigBlock(detectFormat(raw).text);
  const dir = dirnameOf(item.file);
  // Las imágenes (y enlaces) relativos al capítulo pasan a ser relativos a la carpeta del proyecto.
  return rewriteLinks(body, (target) => joinPath(dir, target)).trim();
}

/**
 * Exporta un libro o el proyecto entero a un PDF único (05 · Exportación). Se arma un documento
 * temporal: portada, índice generado y los capítulos, cada uno en página nueva si se pide, y se
 * imprime con el mismo motor de páginas que el editor (así el PDF coincide con la pantalla).
 */
export async function exportProjectPdf(bookId?: string): Promise<void> {
  const project = currentProject();
  const info = useProject.getState().info;
  const scope = bookId ? findBook(project, bookId) : undefined;
  const entries = flatten(project).filter(
    (x) => (!scope || x.book.id === scope.id) && info[x.item.file]?.exists !== false,
  );
  if (entries.length === 0) {
    await showError(t('project.exportEmpty'));
    return;
  }
  const mode = await askChoose(t('project.exportTitle'), [
    {
      id: 'full',
      label: t('project.exportFull'),
      icon: BookOpen,
      hint: t('project.exportFullHint'),
    },
    {
      id: 'chapters',
      label: t('project.exportChapters'),
      icon: FileText,
      hint: t('project.exportChaptersHint'),
    },
    {
      id: 'flow',
      label: t('project.exportFlow'),
      icon: FileDown,
      hint: t('project.exportFlowHint'),
    },
  ]);
  if (!mode) return;

  const title = scope?.title ?? project.title;
  const parts: string[] = [];
  if (mode === 'full') {
    const cover = [`# ${title}`];
    if (!scope && project.description) cover.push(project.description);
    parts.push(cover.join('\n\n'));
    const index = entries
      .map(
        ({ item, depth }) =>
          `${'  '.repeat(depth)}- ${itemTitle(item, info[item.file]?.h1).replace(/([\\`*_[\]<>])/g, '\\$1')}`,
      )
      .join('\n');
    parts.push(`## ${t('project.exportIndex')}\n\n${index}`);
  }
  try {
    for (const { item } of entries) parts.push(await chapterText(item));
  } catch (error) {
    await showError(`${t('project.exportError')}\n${String(error)}`);
    return;
  }
  const separator = mode === 'flow' ? '\n\n' : `\n\n${PAGE_BREAK}\n\n`;
  const source = `${parts.join(separator)}\n`;
  const id = registerHidden(
    absolutePath('~export.md'),
    `${slugify(title) || 'proyecto'}.md`,
    source,
  );
  try {
    await exportPdf(id);
  } finally {
    discardHidden(id);
  }
}
