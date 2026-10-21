import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Node as PmNode } from 'prosemirror-model';
import { docFromSource, sameContent, sourceFromDoc } from '@renderer/editor/model/doc';
import { schema } from '@renderer/editor/model/schema';

const DIR = join(process.cwd(), 'tests/fixtures/roundtrip');

/** Quita la fuente preservada para obligar a re-serializar cada bloque con las convenciones fijas. */
function dirtyAll(doc: PmNode): PmNode {
  const strip = (n: PmNode): PmNode => {
    if (n.isText) return n;
    const children: PmNode[] = [];
    n.forEach((c) => children.push(strip(c)));
    const attrs = 'gap' in n.attrs ? { ...n.attrs, src: null } : n.attrs;
    return n.type.create(attrs, children, n.marks);
  };
  return strip(doc);
}

const files = readdirSync(DIR).filter((f) => f.endsWith('.md') && !/^(crlf|bom)/.test(f));

describe('[ED-22] re-serializar y reparsear conserva el contenido', () => {
  for (const f of files) {
    it(`[ED-22] ${f}`, () => {
      const original = docFromSource(readFileSync(join(DIR, f), 'utf8').replace(/\r\n/g, '\n'));
      const rewritten = docFromSource(sourceFromDoc(dirtyAll(original)));
      expect(rewritten.childCount).toBe(original.childCount);
      original.forEach((block, _o, i) => {
        const same = sameContent(block, rewritten.child(i));
        if (!same) {
          console.log('DIFERENTE', f, i, block.type.name, JSON.stringify(block.attrs['src']));
        }
        expect(same).toBe(true);
      });
    });
  }

  it('[ED-22] usa las convenciones fijas: - para viñetas, _ para cursiva, ** para negrita, ``` para código', () => {
    const out = sourceFromDoc(
      dirtyAll(docFromSource('* a\n* b\n\n*i* y __b__\n\n    codigo\n\nTítulo\n=====\n\n***\n')),
    );
    expect(out).toBe('- a\n- b\n\n_i_ y **b**\n\n```\ncodigo\n```\n\n# Título\n\n---\n');
  });
});

describe('esquema', () => {
  it('no define input rules ni nodos que muestren sintaxis', () => {
    expect(Object.keys(schema.nodes)).not.toContain('markdown_syntax');
  });
});

/** Informativo: ejemplos de la especificación CommonMark que sobreviven a la re-serialización. */
describe('ED-24 · ejemplos CommonMark tras re-serializar (informativo)', () => {
  it('al menos el 90 % conserva su contenido', () => {
    const dir = join(DIR, 'commonmark');
    const names = readdirSync(dir).filter((f) => f.endsWith('.md'));
    let ok = 0;
    const bad: string[] = [];
    for (const f of names) {
      const original = docFromSource(readFileSync(join(dir, f), 'utf8'));
      const rewritten = docFromSource(sourceFromDoc(dirtyAll(original)));
      let same = rewritten.childCount === original.childCount;
      if (same) original.forEach((b, _o, i) => (same &&= sameContent(b, rewritten.child(i))));
      if (same) ok++;
      else bad.push(f);
    }
    console.log(`CommonMark: ${ok}/${names.length} conservan contenido. Fallan: ${bad.join(' ')}`);
    expect(ok / names.length).toBeGreaterThan(0.9);
  });
});
