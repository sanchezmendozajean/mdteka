import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { classHighlighter, highlightTree } from '@lezer/highlight';
import type { Node as PmNode } from 'prosemirror-model';
import { Plugin, PluginKey, type Transaction } from 'prosemirror-state';
import { AttrStep } from 'prosemirror-transform';
import { Decoration, DecorationSet } from 'prosemirror-view';

interface Span {
  from: number;
  to: number;
  cls: string;
}

const key = new PluginKey<DecorationSet>('code-highlight');
/** Resultado por contenido: `lang\0texto` → tramos resaltados (o null mientras carga). */
const cache = new Map<string, Span[]>();
const loading = new Set<string>();

function spansFor(lang: string, code: string, refresh: () => void): Span[] | null {
  const id = `${lang}\0${code}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const desc = LanguageDescription.matchLanguageName(languages, lang, true);
  if (!desc) {
    cache.set(id, []);
    return [];
  }
  if (loading.has(id)) return null;
  loading.add(id);
  void desc
    .load()
    .then((support) => {
      const tree = support.language.parser.parse(code);
      const spans: Span[] = [];
      highlightTree(tree, classHighlighter, (from, to, cls) => spans.push({ from, to, cls }));
      if (cache.size > 500) cache.clear();
      cache.set(id, spans);
    })
    .catch(() => cache.set(id, []))
    .finally(() => {
      loading.delete(id);
      refresh();
    });
  return null;
}

function buildDecorations(doc: PmNode, refresh: () => void): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return true;
    const lang = node.attrs['lang'] as string | null;
    if (lang && node.textContent) {
      const spans = spansFor(lang, node.textContent, refresh);
      for (const s of spans ?? []) {
        decos.push(Decoration.inline(pos + 1 + s.from, pos + 1 + s.to, { class: s.cls }));
      }
    }
    return false;
  });
  return DecorationSet.create(doc, decos);
}

/**
 * ¿La transacción toca algún bloque de código? Si no, las decoraciones solo se desplazan (barato);
 * recalcularlas en cada tecla recorrería todo el documento (ED-12).
 */
function touchesCodeBlock(tr: Transaction): boolean {
  if (tr.steps.some((step) => step instanceof AttrStep)) return true;
  let touched = false;
  tr.mapping.maps.forEach((map, i) => {
    if (touched) return;
    const doc = tr.docs[i + 1] ?? tr.doc;
    map.forEach((_a, _b, newStart, newEnd) => {
      if (touched) return;
      const size = doc.content.size;
      const $from = doc.resolve(Math.min(newStart, size));
      for (let d = $from.depth; d >= 0; d--)
        if ($from.node(d).type.name === 'code_block') touched = true;
      if (!touched) {
        doc.nodesBetween(Math.min(newStart, size), Math.min(newEnd, size), (node) => {
          if (node.type.name === 'code_block') touched = true;
          return !touched;
        });
      }
    });
  });
  return touched;
}

/** Resaltado de sintaxis de los bloques de código con los analizadores de Lezer (carga perezosa). */
export function highlightPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_, state) => buildDecorations(state.doc, () => undefined),
      apply(tr, value, _old, state) {
        if (!tr.docChanged && !tr.getMeta(key)) return value;
        if (tr.docChanged && !tr.getMeta(key) && !touchesCodeBlock(tr)) {
          return value.map(tr.mapping, tr.doc);
        }
        return buildDecorations(state.doc, () => pendingRefresh?.());
      },
    },
    props: { decorations: (state) => key.getState(state) },
    view(view) {
      pendingRefresh = () =>
        view.dispatch(view.state.tr.setMeta(key, true).setMeta('addToHistory', false));
      return {
        destroy() {
          pendingRefresh = null;
        },
      };
    },
  });
}

let pendingRefresh: (() => void) | null = null;
