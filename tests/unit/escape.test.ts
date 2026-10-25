import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Node as PmNode } from 'prosemirror-model';
import { docFromSource, sourceFromDoc } from '@renderer/editor/model/doc';
import { schema } from '@renderer/editor/model/schema';

const s = schema.nodes;

const docOf = (...blocks: PmNode[]) => s['doc']!.create({ lead: '', tail: '\n' }, blocks);
const para = (text: string) => s['paragraph']!.create(null, text ? schema.text(text) : null);

/** Lo que se guarda en el .md cuando el usuario teclea `text` en un párrafo WYSIWYG. */
const saved = (text: string) => sourceFromDoc(docOf(para(text))).replace(/\n$/, '');

describe('[ED-25] escapado de texto literal (tabla de la especificación)', () => {
  const cases: [string, string][] = [
    ['# Hola', '\\# Hola'],
    ['Precio #1', 'Precio #1'],
    ['**importante**', '\\*\\*importante\\*\\*'],
    ['snake_case_var', 'snake_case_var'],
    ['_nota_', '\\_nota\\_'],
    ['- item', '\\- item'],
    ['+ item', '\\+ item'],
    ['* item', '\\* item'],
    ['1. Paso', '1\\. Paso'],
    ['> cita', '\\> cita'],
    ['`codigo`', '\\`codigo\\`'],
    ['[texto](url)', '\\[texto\\](url)'],
    ['![x](y)', '!\\[x\\](y)'],
    ['~~tachado~~', '\\~\\~tachado\\~\\~'],
    ['---', '\\---'],
    ['***', '\\*\\*\\*'],
    ['===', '\\==='],
    ['C:\\ruta', 'C:\\ruta'],
    ['a\\*b', 'a\\\\\\*b'],
    ['<div>', '&lt;div&gt;'],
    ['<b>', '&lt;b&gt;'],
    ['&copy;', '&amp;copy;'],
    ['```', '\\`\\`\\`'],
    ['https://example.com/a_b', 'https://example.com/a_b'],
  ];
  for (const [typed, expected] of cases) {
    it(`[ED-25] ${JSON.stringify(typed)} → ${JSON.stringify(expected)}`, () => {
      expect(saved(typed)).toBe(expected);
    });
  }

  it('[ED-25] "a | b" en una celda de tabla se escapa y en un párrafo no', () => {
    expect(saved('a | b')).toBe('a | b');
    const cell = (text: string) => s['table_cell']!.create(null, schema.text(text));
    const head = (text: string) => s['table_header']!.create(null, schema.text(text));
    const table = s['table']!.create({ align: [null, null] }, [
      s['table_row']!.create(null, [head('h1'), head('h2')]),
      s['table_row']!.create(null, [cell('a | b'), cell('c')]),
    ]);
    expect(sourceFromDoc(docOf(table))).toContain('a \\| b');
  });
});

/** parse(serialize(s)) debe dar exactamente un párrafo cuyo texto sea `s`, sin marcas. */
function roundTripsAsLiteral(text: string): boolean {
  const md = sourceFromDoc(docOf(para(text)));
  const doc = docFromSource(md);
  if (doc.childCount !== 1) return false;
  const p = doc.child(0);
  if (p.type.name !== 'paragraph' || p.childCount !== 1) return false;
  const t = p.child(0);
  return t.isText && t.text === text && t.marks.length === 0;
}

// Caracteres de sintaxis sobrerrepresentados para estresar el escapador.
const SYNTAX = [
  '#',
  '*',
  '_',
  '`',
  '[',
  ']',
  '(',
  ')',
  '!',
  '>',
  '<',
  '&',
  '~',
  '|',
  '\\',
  '-',
  '+',
  '=',
  '.',
  '1',
  ' ',
  '\t',
  ':',
  '$',
  '"',
  "'",
  '{',
  '}',
  ';',
  'a',
  'Z',
  '9',
  'é',
  '日',
  '😀',
];
const typed = fc
  .array(
    fc.oneof(
      { weight: 4, arbitrary: fc.constantFrom(...SYNTAX) },
      { weight: 1, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 1 }) },
    ),
    { maxLength: 30 },
  )
  .map((a) => a.join(''))
  // eslint-disable-next-line no-control-regex
  .filter((v) => v.length > 0 && !/[\u0000-\u0008\u000a-\u001f\u007f\u2028\u2029]/.test(v));

describe('[ED-25] prueba por propiedad', () => {
  it('[ED-25] para cualquier cadena tecleada, parse(serialize(s)) es un párrafo con el texto literal s', () => {
    fc.assert(
      fc.property(typed, (value) => {
        const ok = roundTripsAsLiteral(value);
        if (!ok) console.log('contraejemplo', JSON.stringify(value), JSON.stringify(saved(value)));
        return ok;
      }),
      { numRuns: 20000 },
    );
  }, 120_000);
});

/** Igual que `roundTripsAsLiteral`, pero con el texto dentro de un contenedor. */
function roundTripsIn(wrap: (inner: PmNode) => PmNode, textblock: string, text: string): boolean {
  const inner =
    textblock === 'heading' ? s['heading']!.create({ level: 2 }, schema.text(text)) : para(text);
  const doc = docFromSource(sourceFromDoc(docOf(wrap(inner))));
  let found: PmNode | null = null;
  doc.descendants((n) => {
    if (n.isTextblock && !found) found = n;
    return !found;
  });
  const block = found as PmNode | null;
  return (
    !!block &&
    block.childCount === 1 &&
    block.child(0).isText &&
    block.child(0).text === text &&
    block.child(0).marks.length === 0
  );
}

describe('[ED-25] el escapado también es literal dentro de contenedores', () => {
  const containers: [string, string, (i: PmNode) => PmNode][] = [
    ['cita', 'paragraph', (i) => s['blockquote']!.create(null, i)],
    ['viñeta', 'paragraph', (i) => s['bullet_list']!.create(null, s['list_item']!.create(null, i))],
    [
      'numerada',
      'paragraph',
      (i) => s['ordered_list']!.create(null, s['list_item']!.create(null, i)),
    ],
    ['título', 'heading', (i) => i],
    [
      'celda',
      'cell',
      () => {
        throw new Error('no se usa');
      },
    ],
  ];
  for (const [name, kind, wrap] of containers.filter(([n]) => n !== 'celda')) {
    it(`[ED-25] contenedor: ${name}`, () => {
      fc.assert(
        fc.property(typed, (value) => roundTripsIn(wrap, kind, value)),
        { numRuns: 5000 },
      );
    }, 120_000);
  }
});

describe('[ED-21] editar un bloque solo cambia ese bloque', () => {
  const long = readFileSync(
    join(process.cwd(), 'tests/fixtures/roundtrip/long-document.md'),
    'utf8',
  );

  it('[ED-21] cambiar un párrafo modifica únicamente sus líneas en el diff', () => {
    const doc = docFromSource(long);
    // Tercer párrafo del documento: lo reemplazamos por texto nuevo con caracteres a escapar.
    let target = -1;
    let seen = 0;
    doc.forEach((block, _offset, index) => {
      if (block.type.name === 'paragraph' && ++seen === 3) target = index;
    });
    const blocks: PmNode[] = [];
    doc.forEach((block, _o, i) =>
      blocks.push(i === target ? para('Texto *nuevo* con #hash y 1. algo') : block),
    );
    const edited = s['doc']!.create(doc.attrs, blocks);

    const before = long.split('\n');
    const after = sourceFromDoc(edited).split('\n');
    expect(after.length).toBe(before.length);
    const changed = before.flatMap((line, i) => (line === after[i] ? [] : [i]));
    expect(changed).toHaveLength(1);
    expect(after[changed[0]!]).toBe('Texto \\*nuevo\\* con #hash y 1. algo');
  });

  it('[ED-21] los bloques no modificados conservan su fuente literal', () => {
    const doc = docFromSource('Uno   con  espacios\n\n*  viñeta rara\n*  otra\n\nTres\n');
    const out = sourceFromDoc(doc);
    expect(out).toBe('Uno   con  espacios\n\n*  viñeta rara\n*  otra\n\nTres\n');
  });
});

describe('bloques nacidos de partir otro', () => {
  it('un título partido en dos no se funde en una sola línea', () => {
    const doc = docFromSource('# Episodio 1 y más\n');
    const first = doc.child(0);
    const heading = (text: string) =>
      first.type.create({ ...first.attrs }, schema.text(text));
    const split = s['doc']!.create(doc.attrs, [heading('Episodio 1'), heading('y más')]);
    expect(sourceFromDoc(split)).toBe('# Episodio 1\n\n# y más\n');
  });
});
