import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { docFromSource, sourceFromDoc } from '@renderer/editor/model/doc';
import { imgTag, parseImgTag } from '@renderer/editor/model/image-html';
import { nextImageName } from '../../src/main/images';

describe('[IMG-02] nombres de imagen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mdteca-img-'));
  const touch = (name: string) => writeFileSync(join(dir, name), 'x');
  const doc = join(dir, 'manual.md');

  it('empieza en 001 y usa el siguiente libre', async () => {
    expect(await nextImageName(doc, 'png')).toBe('manual.001.png');
    touch('manual.001.png');
    touch('manual.002.png');
    expect(await nextImageName(doc, 'PNG')).toBe('manual.003.png');
  });

  it('no reutiliza huecos: borrar la 002 no devuelve el 002', async () => {
    rmSync(join(dir, 'manual.002.png'));
    touch('manual.003.jpg');
    expect(await nextImageName(doc, 'png')).toBe('manual.004.png');
  });

  it('ignora imágenes de otros documentos y pasa a 4 dígitos tras 999', async () => {
    touch('otro.050.png');
    touch('manual.999.gif');
    expect(await nextImageName(doc, 'png')).toBe('manual.1000.png');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('[IMG] imagen con tamaño guardado', () => {
  it('lee y escribe <img> con src, alt, title y width', () => {
    const a = parseImgTag('<img src="a b.png" alt="Una &quot;foto&quot;" title="t" width="400">');
    expect(a).toEqual({ src: 'a b.png', alt: 'Una "foto"', title: 't', width: 400 });
    expect(imgTag(a!)).toBe('<img src="a b.png" alt="Una &quot;foto&quot;" title="t" width="400">');
  });

  it('rechaza etiquetas con atributos desconocidos o sin src', () => {
    expect(parseImgTag('<img src="a.png" onerror="x()">')).toBeNull();
    expect(parseImgTag('<img alt="x">')).toBeNull();
    expect(parseImgTag('<img src="a.png" width="-3">')).toBeNull();
    expect(parseImgTag('<span>')).toBeNull();
  });

  it('un documento con <img width> se abre como imagen y se guarda idéntico', () => {
    const src = 'Antes <img src="m.001.png" alt="" width="320"> después\n';
    const doc = docFromSource(src);
    let found: Record<string, unknown> | null = null;
    doc.descendants((n) => {
      if (n.type.name === 'image') found = n.attrs;
    });
    expect(found).toMatchObject({ src: 'm.001.png', width: 320 });
    expect(sourceFromDoc(doc)).toBe(src);
  });

  it('el tamaño se escribe como HTML y sin tamaño como Markdown', () => {
    const doc = docFromSource('![texto](m.001.png)\n');
    expect(sourceFromDoc(doc)).toBe('![texto](m.001.png)\n');
    const para = doc.child(0);
    const image = para.child(0).type.create({ ...para.child(0).attrs, width: 250 });
    const edited = doc.type.create(doc.attrs, [para.type.create(null, [image], para.marks)]);
    expect(sourceFromDoc(edited)).toBe('<img src="m.001.png" alt="texto" width="250">\n');
  });
});

describe('[IMG] cambiar el origen de una imagen cambia el documento', () => {
  it('sameContent distingue imágenes con distinto src (el src de un bloque es solo su fuente)', () => {
    const doc = docFromSource('![x](a.001.png)\n');
    const para = doc.child(0);
    const image = para.child(0);
    const swapped = image.type.create({ ...image.attrs, src: 'data:image/png;base64,AAAA' });
    const edited = doc.type.create(doc.attrs, [para.type.create(para.attrs, [swapped])]);
    expect(sourceFromDoc(edited)).toBe('![x](data:image/png;base64,AAAA)\n');
  });
});

describe('[IMG] <img> sola en su línea', () => {
  it('se lee como imagen en su párrafo y se guarda idéntica', () => {
    const src = 'Texto\n\n<img src="a.001.png" alt="figura" width="700">\n\nFin\n';
    const doc = docFromSource(src);
    expect(doc.child(1).type.name).toBe('paragraph');
    expect(doc.child(1).child(0).type.name).toBe('image');
    expect(doc.child(1).child(0).attrs['width']).toBe(700);
    expect(sourceFromDoc(doc)).toBe(src);
  });
});
