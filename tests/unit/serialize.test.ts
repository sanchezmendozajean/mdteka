import { describe, expect, it } from 'vitest';
import type { Mark, Node as PmNode } from 'prosemirror-model';
import { docFromSource, sourceFromDoc } from '@renderer/editor/model/doc';
import { schema } from '@renderer/editor/model/schema';

const s = schema.nodes;
const m = (name: string, attrs?: Record<string, unknown>): Mark =>
  schema.marks[name]!.create(attrs);
const text = (value: string, ...marks: Mark[]) => schema.text(value, marks);
const doc = (...blocks: PmNode[]) => s['doc']!.create({ lead: '', tail: '\n' }, blocks);
const para = (...inline: PmNode[]) => s['paragraph']!.create(null, inline);

describe('[ED-22] serialización de bloques modificados', () => {
  it('anida las marcas en orden canónico y reutiliza las que no cambian', () => {
    const out = sourceFromDoc(
      doc(para(text('a ', m('strong')), text('b', m('strong'), m('em')), text(' c', m('strong')))),
    );
    expect(out).toBe('**a** **_b_** **c**\n');
  });

  it('los blancos de borde salen de la negrita (`** a **` no sería énfasis)', () => {
    const out = sourceFromDoc(doc(para(text('x '), text(' hola ', m('strong')), text('y'))));
    expect(out).toBe('x  **hola** y\n');
  });

  it('un salto duro se guarda como barra invertida y vuelve a leerse como salto duro', () => {
    const out = sourceFromDoc(doc(para(text('uno'), s['hard_break']!.create(), text('dos'))));
    expect(out).toBe('uno\\\ndos\n');
    const back = docFromSource(out);
    expect(back.child(0).child(1).type.name).toBe('hard_break');
  });

  it('el código en línea no se escapa y un enlace conserva su destino y título', () => {
    const out = sourceFromDoc(
      doc(
        para(
          text('a*b_c', m('code')),
          text(' '),
          text('sitio', m('link', { href: 'https://example.com/a b', title: 'T' })),
        ),
      ),
    );
    expect(out).toContain('`a*b_c`');
    expect(out).toMatch(/\[sitio\]\(<https:\/\/example\.com\/a b> "T"\)/);
  });

  it('las columnas de una tabla conservan su alineación', () => {
    const cell = (t: string, header = false) =>
      s[header ? 'table_header' : 'table_cell']!.create(null, t ? schema.text(t) : null);
    const table = s['table']!.create({ align: ['left', 'center', 'right'] }, [
      s['table_row']!.create(null, [cell('A', true), cell('B', true), cell('C', true)]),
      s['table_row']!.create(null, [cell('1'), cell('2'), cell('3')]),
    ]);
    const out = sourceFromDoc(doc(table));
    expect(out.split('\n')[1]).toMatch(/^\| :-+ \| :-+: \| -+: \|$/);
    expect(docFromSource(out).child(0).attrs['align']).toEqual(['left', 'center', 'right']);
  });

  it('dos listas contiguas no se funden en una al reserializarse', () => {
    const item = (t: string) => s['list_item']!.create(null, para(text(t)));
    const list = (t: string) => s['bullet_list']!.create(null, [item(t)]);
    const out = sourceFromDoc(doc(list('uno'), list('dos')));
    const back = docFromSource(out);
    expect(back.childCount).toBe(2);
    expect(out).toBe('- uno\n\n* dos\n');
  });

  it('una lista de tareas conserva el estado marcado', () => {
    const item = (checked: boolean, t: string) =>
      s['list_item']!.create({ checked }, para(text(t)));
    const out = sourceFromDoc(
      doc(s['bullet_list']!.create(null, [item(true, 'hecho'), item(false, 'pendiente')])),
    );
    expect(out).toBe('- [x] hecho\n- [ ] pendiente\n');
  });

  it('los párrafos vacíos no generan líneas en el archivo', () => {
    expect(sourceFromDoc(doc(para(text('a')), para(), para(text('b'))))).toBe('a\n\nb\n');
  });
});

describe('estructura del documento', () => {
  it('un documento vacío o solo con espacios conserva su contenido tal cual', () => {
    for (const source of ['', '\n', '\n\n  \n']) {
      expect(sourceFromDoc(docFromSource(source))).toBe(source);
    }
  });

  it('el HTML embebido y el Markdown desconocido se conservan como bloques literales', () => {
    const source = '<div>\n  <b>x</b>\n</div>\n\n[ref]: https://example.com\n';
    const d = docFromSource(source);
    expect(d.child(0).type.name).toBe('html_block');
    expect(d.child(1).type.name).toBe('raw_block');
    expect(sourceFromDoc(d)).toBe(source);
  });

  it('el salto de página es un bloque propio y se escribe como comentario HTML', () => {
    const d = docFromSource('a\n\n<!-- mdtor:pagebreak -->\n\nb\n');
    expect(d.child(1).type.name).toBe('page_break');
    expect(sourceFromDoc(d)).toBe('a\n\n<!-- mdtor:pagebreak -->\n\nb\n');
  });
});
