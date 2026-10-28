import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { lineDiff } from '@renderer/documents/diff';
import {
  addItem,
  chapterFileName,
  firstH1,
  globToRegExp,
  isIgnored,
  importProject,
  isProjectPath,
  locate,
  makeId,
  moveItem,
  parseProject,
  ProjectSchema,
  relativeTo,
  removeItem,
  renameFiles,
  serializeProject,
  slugify,
  unindexed,
  type Project,
} from '@shared/project';

/** Ejemplo de `specs/05-proyectos.md`. */
const EXAMPLE = `{
  "$schema": "https://mdtor.app/schemas/project-v1.json",
  "format": "mdtor-project",
  "version": 1,
  "title": "Manual del Sistema de Planillas",
  "description": "Documentación funcional y técnica",
  "defaults": {
    "typography": { "font": "IBM Plex Sans", "size": 11 },
    "theme": "tecnico",
    "images": { "pasteMode": "file" }
  },
  "collections": [
    {
      "id": "tecnico-a1b2",
      "title": "Técnico",
      "icon": "cpu",
      "books": [
        {
          "id": "arquitectura-x9k2",
          "title": "Arquitectura",
          "icon": "book-open",
          "folder": "tecnico/arquitectura",
          "items": [
            { "id": "intro-77ad", "title": "Introducción", "file": "tecnico/arquitectura/01-introduccion.md" },
            {
              "id": "modulos-p0q1",
              "title": "Módulos",
              "file": "tecnico/arquitectura/02-modulos.md",
              "children": [
                { "id": "mod-pagos-z8x7", "file": "tecnico/arquitectura/modulos/pagos.md" }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "usuario-c3d4",
      "title": "Usuario",
      "icon": "users",
      "books": [
        { "id": "guia-rapida-m5n6", "title": "Guía rápida", "icon": "rocket", "folder": "usuario/guia-rapida", "items": [] }
      ]
    }
  ],
  "ignore": ["borradores/**", "**/_*.md"]
}
`;

const read = (text: string): Project => {
  const r = parseProject(text);
  if (!r.ok) throw new Error(r.error);
  return r.project;
};

/** Libro con cinco capítulos para probar reordenaciones. */
const book = (): Project =>
  read(
    serializeProject({
      format: 'mdtor-project',
      version: 1,
      title: 'P',
      collections: [
        {
          id: 'c-aaaa',
          title: 'C',
          books: [
            {
              id: 'b-bbbb',
              title: 'B',
              folder: 'b',
              items: ['uno', 'dos', 'tres', 'cuatro', 'cinco'].map((n) => ({
                id: `${n}-0001`,
                title: n,
                file: `b/${n}.md`,
              })),
            },
          ],
        },
      ],
    }),
  );

describe('[PRJ-01][PRJ-05] formato .mdtor', () => {
  it('lee el ejemplo de la especificación', () => {
    const p = read(EXAMPLE);
    expect(p.title).toBe('Manual del Sistema de Planillas');
    expect(p.collections).toHaveLength(2);
    expect(locate(p, 'mod-pagos-z8x7')?.parent?.id).toBe('modulos-p0q1');
  });

  it('la serialización es determinista e idempotente', () => {
    const once = serializeProject(read(EXAMPLE));
    expect(serializeProject(read(once))).toBe(once);
    expect(once.endsWith('}\n')).toBe(true);
    expect(once).not.toContain('\r');
    expect(once).toContain('\n  "collections": [');
  });

  it('el orden de claves es canónico aunque el archivo lo traiga distinto', () => {
    const shuffled = `{"title":"X","collections":[],"version":1,"format":"mdtor-project"}`;
    expect(serializeProject(read(shuffled))).toBe(
      '{\n  "format": "mdtor-project",\n  "version": 1,\n  "title": "X",\n  "collections": []\n}\n',
    );
  });

  it('conserva las claves desconocidas', () => {
    const p = read(
      '{"format":"mdtor-project","version":1,"title":"X","futuro":{"a":1},"collections":[]}',
    );
    expect(serializeProject(p)).toContain('"futuro": {\n    "a": 1\n  }');
  });

  it('los ítems sin hijos y los libros vacíos van en una línea', () => {
    const text = serializeProject(read(EXAMPLE));
    expect(text).toContain(
      '{ "id": "intro-77ad", "title": "Introducción", "file": "tecnico/arquitectura/01-introduccion.md" },',
    );
    expect(text).toContain('"items": [] }');
  });

  it('rechaza rutas absolutas, con «\\», con «./» o «..» y ids repetidos [PRJ-03]', () => {
    for (const bad of ['C:/a.md', '/a.md', 'a\\b.md', './a.md', '../a.md', 'a//b.md'])
      expect(isProjectPath(bad), bad).toBe(false);
    expect(isProjectPath('a/b.md')).toBe(true);
    const withFile = (file: string, id2 = 'y') =>
      JSON.stringify({
        format: 'mdtor-project',
        version: 1,
        title: 'X',
        collections: [
          {
            id: 'c',
            title: 'C',
            books: [
              {
                id: 'b',
                title: 'B',
                items: [
                  { id: 'x', file },
                  { id: id2, file: 'o.md' },
                ],
              },
            ],
          },
        ],
      });
    expect(parseProject(withFile('../fuera.md')).ok).toBe(false);
    expect(parseProject(withFile('bien.md')).ok).toBe(true);
    expect(parseProject(withFile('bien.md', 'x'))).toMatchObject({ ok: false });
  });

  it('marcadores de conflicto de Git: error con la línea y sin interpretar el archivo', () => {
    const text =
      '{\n  "format": "mdtor-project",\n<<<<<<< HEAD\n  "title": "A",\n=======\n  "title": "B",\n>>>>>>> otra\n  "version": 1\n}\n';
    expect(parseProject(text)).toEqual({
      ok: false,
      error: 'marcadores de conflicto de Git en la línea 3',
    });
  });

  it('un JSON inválido devuelve un error legible', () => {
    expect(parseProject('{ no es json')).toMatchObject({ ok: false });
    expect(parseProject('{"format":"otro"}')).toMatchObject({ ok: false });
  });

  it('[PRJ-04] la serialización no incluye datos de máquina ni de sesión', () => {
    const text = serializeProject(read(EXAMPLE));
    expect(text).not.toMatch(/(^|[^A-Za-z])[A-Za-z]:[\\/]|expanded|openTabs|lastOpened/);
  });
});

describe('[PRJ-24] reordenar cambia solo las líneas del ítem movido', () => {
  /** Líneas añadidas o quitadas entre dos textos. */
  const changed = (a: string, b: string) =>
    lineDiff(a, b)
      .filter((l) => l.kind !== 'same')
      .map((l) => l.text.trim().replace(/,$/, ''));

  it('subir un capítulo al principio toca solo su línea', () => {
    const p = book();
    const after = moveItem(p, 'tres-0001', { bookId: 'b-bbbb', parentId: null, index: 0 });
    const diff = changed(serializeProject(p), serializeProject(after));
    expect(diff.length).toBeGreaterThan(0);
    for (const line of diff) expect(line).toContain('"id": "tres-0001"');
  });

  it('bajar un capítulo en medio toca solo su línea', () => {
    const p = book();
    const after = moveItem(p, 'dos-0001', { bookId: 'b-bbbb', parentId: null, index: 4 });
    expect(locate(after, 'dos-0001')?.index).toBe(3);
    const diff = changed(serializeProject(p), serializeProject(after));
    for (const line of diff) expect(line).toContain('"id": "dos-0001"');
  });

  it('mover entre libros y anidar', () => {
    let p = book();
    p = {
      ...p,
      collections: [
        {
          ...p.collections[0]!,
          books: [...p.collections[0]!.books, { id: 'b2-cccc', title: 'B2', items: [] }],
        },
      ],
    };
    const moved = moveItem(p, 'uno-0001', { bookId: 'b2-cccc', parentId: null, index: 0 });
    expect(locate(moved, 'uno-0001')?.book.id).toBe('b2-cccc');
    const nested = moveItem(moved, 'cinco-0001', {
      bookId: 'b-bbbb',
      parentId: 'dos-0001',
      index: 0,
    });
    expect(locate(nested, 'cinco-0001')?.parent?.id).toBe('dos-0001');
    // No se puede anidar un capítulo dentro de sí mismo ni de su descendiente.
    expect(
      moveItem(nested, 'dos-0001', { bookId: 'b-bbbb', parentId: 'cinco-0001', index: 0 }),
    ).toBe(nested);
  });

  it('quitar el último hijo borra la clave children', () => {
    let p = book();
    p = moveItem(p, 'cinco-0001', { bookId: 'b-bbbb', parentId: 'dos-0001', index: 0 });
    p = removeItem(p, 'cinco-0001');
    expect(locate(p, 'dos-0001')?.item).not.toHaveProperty('children');
  });

  it('agregar y renombrar archivos actualiza las rutas del subárbol', () => {
    let p = book();
    p = addItem(
      p,
      { id: 'nuevo-0002', file: 'b/nuevo.md' },
      { bookId: 'b-bbbb', parentId: null, index: 5 },
    );
    expect(locate(p, 'nuevo-0002')?.index).toBe(5);
    const renamed = renameFiles(p, 'b', 'libro');
    expect(locate(renamed, 'dos-0001')?.item.file).toBe('libro/dos.md');
    expect(renamed.collections[0]!.books[0]!.folder).toBe('libro');
  });
});

describe('[PRJ-05] ids, nombres y patrones', () => {
  it('los ids son slug corto + 4 caracteres y no se repiten', () => {
    const id = makeId('Instalación y puesta en marcha del sistema', []);
    expect(id).toMatch(/^instalacion-y-puesta-en-[a-z0-9]{4}$/);
    const rnd = () => 0;
    const first = makeId('Hola', [], rnd);
    expect(makeId('Hola', [first], () => Math.random())).not.toBe(first);
  });

  it('slugify quita tildes y símbolos', () => {
    expect(slugify('  ¿Qué es esto? – Cap. 3 ')).toBe('que-es-esto-cap-3');
  });

  it('[PRJ-26] nombre de capítulo con prefijo numérico opcional y sin colisiones', () => {
    expect(chapterFileName('Configuración', new Set(), true, 3)).toBe('03-configuracion.md');
    expect(chapterFileName('Configuración', new Set(), false, 3)).toBe('configuracion.md');
    expect(chapterFileName('Configuración', new Set(['configuracion.md']), false, 3)).toBe(
      'configuracion-2.md',
    );
  });

  it('globs de ignore: ** cruza carpetas, * no', () => {
    expect(globToRegExp('borradores/**').test('borradores/a/b.md')).toBe(true);
    expect(globToRegExp('**/_*.md').test('a/b/_x.md')).toBe(true);
    expect(globToRegExp('**/_*.md').test('_x.md')).toBe(true);
    expect(globToRegExp('*.md').test('a/b.md')).toBe(false);
    expect(isIgnored('x/_nota.md', ['**/_*.md'])).toBe(true);
  });

  it('[PRJ-27] «sin indexar» excluye lo indexado y lo ignorado', () => {
    const p = read(EXAMPLE);
    const files = [
      'tecnico/arquitectura/01-introduccion.md',
      'tecnico/arquitectura/nuevo.md',
      'borradores/x.md',
      'tecnico/_privado.md',
    ];
    expect(unindexed(p, files)).toEqual(['tecnico/arquitectura/nuevo.md']);
  });

  it('rutas relativas entre carpetas del proyecto', () => {
    expect(relativeTo('a/b', 'a/c/x.png')).toBe('../c/x.png');
    expect(relativeTo('', 'x.png')).toBe('x.png');
    expect(relativeTo('a', 'a/x.png')).toBe('x.png');
  });

  it('el título de un ítem sale del primer H1 sin contar bloques de código', () => {
    expect(firstH1('texto\n\n# Título real\n')).toBe('Título real');
    expect(firstH1('```\n# no\n```\n\n## otro\n')).toBeUndefined();
  });
});

describe('JSON Schema publicado', () => {
  it('specs/schemas/project.schema.json está al día', () => {
    const schema = z.toJSONSchema(ProjectSchema, { io: 'input' });
    const text = `${JSON.stringify({ $id: 'https://mdtor.app/schemas/project-v1.json', title: 'MDTorProject', ...schema }, null, 2)}\n`;
    const file = resolve(__dirname, '../../specs/schemas/project.schema.json');
    if (process.env['UPDATE_SCHEMA'] === '1' || !existsSync(file)) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
    }
    expect(readFileSync(file, 'utf8')).toBe(text);
  });
});

describe('[PRJ-32] importar una carpeta', () => {
  it('cada carpeta con .md es un libro y los de la raíz van a uno con el nombre del proyecto', () => {
    const p = importProject('Manual', ['b/02.md', 'b/01.md', 'raiz.md', 'a/x.md'], 'General');
    expect(p.collections).toHaveLength(1);
    const books = p.collections[0]!.books;
    expect(books.map((b) => [b.title, b.folder])).toEqual([
      ['a', 'a'],
      ['b', 'b'],
      ['Manual', undefined],
    ]);
    // Orden natural y ids únicos.
    expect(books[1]!.items.map((i) => i.file)).toEqual(['b/01.md', 'b/02.md']);
    const ids = new Set<string>();
    for (const book of books) for (const i of book.items) ids.add(i.id);
    expect(ids.size).toBe(4);
    // El resultado se lee de vuelta tal cual.
    const text = serializeProject(p);
    const back = parseProject(text);
    expect(back.ok && serializeProject(back.project)).toBe(text);
  });

  it('sin archivos solo crea el proyecto vacío', () => {
    expect(importProject('Vacío', [], 'General').collections).toEqual([]);
  });
});

describe('[PRJ] título del navegador', () => {
  it('quita entidades y escapes del primer H1', () => {
    expect(firstH1('# Episodio 1&#x20;## El pueblo \* &amp; más')).toBe(
      'Episodio 1 ## El pueblo * & más',
    );
  });
});
