import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import type { Root } from 'mdast';

const processor = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkGfm);

/** Parsea Markdown (CommonMark + GFM). El texto debe venir con EOL normalizado a `\n`. */
export function parseMarkdown(text: string): Root {
  return processor.parse(text);
}
