import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { rewriteLinks } from '@shared/links';
import { grantTree } from '../../src/main/files';
import {
  duplicateDocument,
  findProjectFiles,
  moveDocument,
  orphanImages,
  scanMarkdown,
  searchFiles,
} from '../../src/main/project';

const root = mkdtempSync(join(realpathSync.native(tmpdir()), 'mdtor-prj-'));
grantTree(root);
afterAll(() => rmSync(root, { recursive: true, force: true }));
const put = (rel: string, content = 'x') => {
  const full = join(root, ...rel.split('/'));
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
  return full;
};
const text = (rel: string) => readFileSync(join(root, ...rel.split('/')), 'utf8');

describe('[IMG-20] reescritura de enlaces', () => {
  it('cambia solo destinos locales de ](…) y src="…"', () => {
    const src =
      '![a](a.png "t") [web](https://x.io/a.png) ![b](<mi foto.png>) <img src="c.png" width="3"> [anc](#x) ![d](data:image/png;base64,AA)';
    const seen: string[] = [];
    const out = rewriteLinks(src, (t) => {
      seen.push(t);
      return `n/${t}`;
    });
    expect(seen).toEqual(['a.png', 'mi foto.png', 'c.png']);
    expect(out).toBe(
      '![a](n/a.png "t") [web](https://x.io/a.png) ![b](<n/mi%20foto.png>) <img src="n/c.png" width="3"> [anc](#x) ![d](data:image/png;base64,AA)',
    );
  });
});

describe('[PRJ-24][IMG-20] mover un documento con sus imágenes', () => {
  it('las imágenes propias viajan y se renombran; las demás se recalculan', async () => {
    put(
      'a.md',
      '![uno](a.001.png)\n\n![logo](shared/logo.png)\n\n<img src="a.002.png" width="9">\n',
    );
    put('a.001.png');
    put('a.002.png');
    put('shared/logo.png');
    const result = await moveDocument(join(root, 'a.md'), join(root, 'sub', 'b.md'));
    expect(result).toEqual({ images: 2, links: 1 });
    expect(existsSync(join(root, 'a.md'))).toBe(false);
    expect(existsSync(join(root, 'a.001.png'))).toBe(false);
    expect(existsSync(join(root, 'sub', 'b.001.png'))).toBe(true);
    expect(existsSync(join(root, 'sub', 'b.002.png'))).toBe(true);
    expect(text('sub/b.md')).toBe(
      '![uno](b.001.png)\n\n![logo](../shared/logo.png)\n\n<img src="b.002.png" width="9">\n',
    );
  });

  it('renombrar en la misma carpeta renombra las imágenes y no toca otros enlaces', async () => {
    put('c.md', '![](c.001.png) ![](otra.png)\n');
    put('c.001.png');
    put('otra.png');
    await moveDocument(join(root, 'c.md'), join(root, 'd.md'));
    expect(text('d.md')).toBe('![](d.001.png) ![](otra.png)\n');
    expect(existsSync(join(root, 'd.001.png'))).toBe(true);
  });

  it('no pisa un archivo existente', async () => {
    put('e.md');
    put('f.md');
    await expect(moveDocument(join(root, 'e.md'), join(root, 'f.md'))).rejects.toThrow(/Ya existe/);
  });

  it('si el nombre de la imagen ya está tomado usa el siguiente número libre', async () => {
    put('g.md', '![](g.001.png)\n');
    put('g.001.png', 'g');
    put('h.001.png', 'previa');
    await moveDocument(join(root, 'g.md'), join(root, 'h.md'));
    expect(text('h.001.png')).toBe('previa');
    expect(text('h.md')).toBe('![](h.002.png)\n');
    expect(text('h.002.png')).toBe('g');
  });

  it('duplicar copia el documento con sus imágenes', async () => {
    put('k.md', '![](k.001.png)\n');
    put('k.001.png', 'k');
    await duplicateDocument(join(root, 'k.md'), join(root, 'k copia.md'));
    expect(text('k copia.md')).toBe('![](k%20copia.001.png)\n');
    expect(text('k copia.001.png')).toBe('k');
    expect(text('k.md')).toBe('![](k.001.png)\n');
  });

  it('detecta las imágenes huérfanas de un documento', async () => {
    put('m.md', '![](m.001.png)\n');
    put('m.001.png');
    put('m.002.png');
    expect(await orphanImages(join(root, 'm.md'))).toEqual([join(root, 'm.002.png')]);
  });
});

describe('[PRJ-27] exploración y búsqueda', () => {
  it('lista los .md respetando ignore y saltando carpetas ocultas', async () => {
    put('docs/uno.md');
    put('docs/_borrador.md');
    put('borradores/x.md');
    put('.oculta/y.md');
    put('node_modules/z/readme.md');
    const files = await scanMarkdown(root, ['borradores/**', '**/_*.md']);
    expect(files).toContain('docs/uno.md');
    expect(files).not.toContain('docs/_borrador.md');
    expect(files).not.toContain('borradores/x.md');
    expect(files.some((f) => f.startsWith('.oculta') || f.startsWith('node_modules'))).toBe(false);
  });

  it('busca texto, sin contar el bloque de configuración', async () => {
    put('s/a.md', 'Hola mundo\n\nOtro hola\n\n<!-- mdtor:config\n{ "x": "hola" }\n-->\n');
    const hits = await searchFiles(root, ['s/a.md'], {
      query: 'hola',
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    });
    expect(hits.map((h) => [h.line, h.from, h.to])).toEqual([
      [1, 0, 4],
      [3, 5, 9],
    ]);
    const sensitive = await searchFiles(root, ['s/a.md'], {
      query: 'hola',
      caseSensitive: true,
      wholeWord: true,
      regex: false,
    });
    expect(sensitive).toHaveLength(1);
  });
});

describe('[PRJ-32] buscar el .mdtor de un archivo', () => {
  it('sube por las carpetas hasta encontrarlo', async () => {
    put('proy/p.mdtor', '{}');
    put('proy/a/b/doc.md');
    expect(await findProjectFiles(join(root, 'proy', 'a', 'b', 'doc.md'))).toEqual([
      join(root, 'proy', 'p.mdtor'),
    ]);
  });

  it('devuelve todos si hay varios en la misma carpeta y se detiene en la raíz de Git', async () => {
    put('dos/uno.mdtor', '{}');
    put('dos/otro.mdtor', '{}');
    put('dos/d.md');
    expect(await findProjectFiles(join(root, 'dos', 'd.md'))).toHaveLength(2);
    put('repo/.git/HEAD');
    put('repo/src/x.md');
    put('p.mdtor', '{}');
    expect(await findProjectFiles(join(root, 'repo', 'src', 'x.md'))).toEqual([]);
  });

  it('no sube más de 5 niveles', async () => {
    put('lejos.mdtor', '{}');
    put('n1/n2/n3/n4/n5/n6/doc.md');
    expect(
      await findProjectFiles(join(root, 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'doc.md')),
    ).toEqual([]);
  });
});
