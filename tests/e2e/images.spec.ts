import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch, save, source, waitForEditor } from './helpers';

/** PNG de 1 × 1 px. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const FILE_MODE = (text: string) =>
  `${text}\n\n<!-- mdteca:config\n{\n  "version": 1,\n  "images": {\n    "pasteMode": "file"\n  }\n}\n-->\n`;
const BASE64_MODE = (text: string) =>
  `${text}\n\n<!-- mdteca:config\n{\n  "version": 1,\n  "images": {\n    "pasteMode": "base64"\n  }\n}\n-->\n`;

/** Simula el pegado de un archivo de imagen (el portapapeles real no es accesible desde la prueba). */
const pasteImage = (page: Page, b64 = PNG, name = 'captura.png', mime = 'image/png') =>
  page.evaluate(
    ({ b64, name, mime }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type: mime }));
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      (document.querySelector('.ProseMirror') as HTMLElement).dispatchEvent(event);
    },
    { b64, name, mime },
  );

const imgs = (dir: string, base: string) =>
  readdirSync(dir)
    .filter((f) => f.startsWith(`${base}.`) && /\.(png|jpg|gif)$/.test(f))
    .sort();

const caretToEnd = async (page: Page) => {
  await page.locator('.ProseMirror p').first().click();
  await page.keyboard.press('Control+End');
};

test.describe('[Fase 4] pegado de imágenes', () => {
  test('[IMG-02] pegar tres imágenes crea manual.001.png … 003 y no reutiliza huecos', async () => {
    const { app, page, dir } = await launch({ 'manual.md': FILE_MODE('Texto') });
    await waitForEditor(page);
    for (let i = 0; i < 3; i++) {
      await caretToEnd(page);
      await pasteImage(page);
      await expect.poll(async () => imgs(dir, 'manual').length).toBe(i + 1);
    }
    expect(imgs(dir, 'manual')).toEqual(['manual.001.png', 'manual.002.png', 'manual.003.png']);
    const md = await source(page);
    expect(md).toContain('![](manual.001.png)');
    expect(md).toContain('![](manual.002.png)');
    expect(md).toContain('![](manual.003.png)');
    // Se borra la 002 (del documento y del disco) y se pega otra: sale la 004, no la 002.
    rmSync(join(dir, 'manual.002.png'));
    await caretToEnd(page);
    await pasteImage(page);
    await expect.poll(async () => imgs(dir, 'manual').includes('manual.004.png')).toBe(true);
    expect(imgs(dir, 'manual')).not.toContain('manual.002.png');
    await app.close();
  });

  test('[IMG-02] la imagen se muestra desde mdteca-asset:// y el enlace es relativo', async () => {
    const { app, page } = await launch({ 'Mi manual.md': FILE_MODE('Texto') });
    await waitForEditor(page);
    await caretToEnd(page);
    await pasteImage(page);
    // El nombre lleva un espacio: el enlace lo codifica.
    await expect.poll(() => source(page)).toContain('![](Mi%20manual.001.png)');
    const img = page.locator('.ProseMirror .image-wrap img');
    await expect(img).toHaveAttribute('src', /^mdteca-asset:\/\/local\//);
    await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1);
    await app.close();
  });

  test('[IMG-01] pegar como base64 incrusta una data URL', async () => {
    const { app, page, dir } = await launch({ 'a.md': BASE64_MODE('Texto') });
    await waitForEditor(page);
    await caretToEnd(page);
    await pasteImage(page);
    await expect.poll(() => source(page)).toContain(`![](data:image/png;base64,${PNG})`);
    expect(imgs(dir, 'a')).toEqual([]);
    await app.close();
  });

  test('[IMG-01] una imagen de más de 300 KB avisa y permite guardarla como archivo', async () => {
    const { app, page, dir } = await launch({ 'a.md': BASE64_MODE('Texto') });
    await waitForEditor(page);
    const big = Buffer.alloc(400 * 1024, 7).toString('base64');
    await caretToEnd(page);
    await pasteImage(page, big);
    await expect(page.getByTestId('dialog-image-large')).toBeVisible();
    await page.getByTestId('image-large-file').click();
    await expect.poll(async () => imgs(dir, 'a')).toEqual(['a.001.png']);
    expect(await source(page)).toContain('![](a.001.png)');
    // Y con «Incrustar igual» se incrusta pese al peso.
    await caretToEnd(page);
    await pasteImage(page, big);
    await page.getByTestId('image-large-embed').click();
    await expect.poll(() => source(page)).toContain('data:image/png;base64,');
    await app.close();
  });

  test('[IMG-03] «preguntar»: miniatura, peso, nombre editable, Recordar y Enter = archivo', async () => {
    const { app, page, dir, files } = await launch({ 'a.md': 'Texto\n' });
    await waitForEditor(page);
    await caretToEnd(page);
    await pasteImage(page);
    const dialog = page.getByTestId('dialog-image-paste');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('img')).toBeVisible();
    await expect(page.getByTestId('image-meta')).toContainText('KB');
    await expect(page.getByTestId('image-name')).toHaveValue('a.001');
    await page.getByTestId('image-name').fill('foto');
    await page.getByTestId('image-remember').check();
    await page.getByTestId('image-as-file').click();
    await expect.poll(async () => existsSync(join(dir, 'foto.png'))).toBe(true);
    expect(await source(page)).toContain('![](foto.png)');
    await save(page);
    // «Recordar» escribe images.pasteMode en el bloque del documento.
    expect(readFileSync(files[0]!, 'utf8')).toContain('"pasteMode": "file"');
    // Con el modo recordado ya no pregunta.
    await caretToEnd(page);
    await pasteImage(page);
    await expect.poll(async () => existsSync(join(dir, 'a.001.png'))).toBe(true);
    await expect(page.getByTestId('dialog-image-paste')).toHaveCount(0);
    await app.close();
  });

  test('[IMG-03] Enter elige guardar como archivo y Esc cancela', async () => {
    const { app, page, dir } = await launch({ 'a.md': 'Texto\n' });
    await waitForEditor(page);
    await caretToEnd(page);
    await pasteImage(page);
    await page.getByTestId('dialog-image-paste').waitFor();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dialog-image-paste')).toHaveCount(0);
    expect(imgs(dir, 'a')).toEqual([]);
    expect(await source(page)).not.toContain('![');
    await pasteImage(page);
    await page.getByTestId('dialog-image-paste').waitFor();
    await page.getByTestId('image-as-file').focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => imgs(dir, 'a')).toEqual(['a.001.png']);
    await app.close();
  });

  test('[IMG-03] un documento sin guardar se guarda antes de crear el archivo de imagen', async () => {
    const { app, page } = await launch();
    await app.evaluate(
      (_e, p) => {
        process.env['MDTECA_E2E_SAVE_PATH'] = p;
      },
      join(process.env['TEMP'] ?? '.', `mdteca-nuevo-${Date.now()}.md`),
    );
    await page.evaluate(`window.__mdteca ? 0 : 0`);
    await page.getByTestId('tab-file').click();
    await page.locator('.ribbon [data-command="file.new"]').click();
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('Hola');
    await pasteImage(page);
    await page.getByTestId('image-as-file').waitFor();
    await expect(page.getByTestId('image-as-file')).toContainText(/guardará antes/i);
    await page.getByTestId('image-as-file').click();
    await expect.poll(() => source(page)).toMatch(/!\[\]\(mdteca-nuevo-\d+\.001\.png\)/);
    await app.close();
  });
});

test.describe('[Fase 4] otras formas de insertar', () => {
  test('[IMG-10] soltar un archivo de imagen aplica el mismo modo', async () => {
    const { app, page, dir } = await launch({ 'a.md': FILE_MODE('Texto') });
    await waitForEditor(page);
    await page.evaluate(
      ({ b64 }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'foto.png', { type: 'image/png' }));
        const target = document.querySelector('.ProseMirror p') as HTMLElement;
        const r = target.getBoundingClientRect();
        target.dispatchEvent(
          new DragEvent('drop', {
            dataTransfer: dt,
            bubbles: true,
            cancelable: true,
            clientX: r.left + 5,
            clientY: r.top + 5,
          }),
        );
      },
      { b64: PNG },
    );
    await expect.poll(async () => imgs(dir, 'a')).toEqual(['a.001.png']);
    expect(await source(page)).toContain('![](a.001.png)');
    await app.close();
  });

  test('[IMG-10] una imagen que ya está en la carpeta del documento solo se enlaza', async () => {
    const { app, page, dir, files } = await launch({ 'a.md': 'Texto\n' });
    await waitForEditor(page);
    mkdirImg(dir, 'img/dibujo.png');
    const rel = await page.evaluate(
      ([doc, src]) => window.mdteca.image.importFile(doc!, src!),
      [files[0], join(dir, 'img', 'dibujo.png')],
    );
    expect(rel.rel).toBe('img/dibujo.png');
    expect(imgs(dir, 'a')).toEqual([]);
    // Fuera de la carpeta: se copia con nombre numerado.
    const other = join(process.env['TEMP'] ?? '.', `externa-${Date.now()}.png`);
    writeFileSync(other, Buffer.from(PNG, 'base64'));
    const copied = await page.evaluate(
      ([doc, src]) => window.mdteca.image.importFile(doc!, src!),
      [files[0], other],
    );
    expect(copied.rel).toBe('a.001.png');
    await app.close();
  });

  test('[IMG-11] Insertar › Imagen › desde una dirección enlaza la imagen remota', async () => {
    const { app, page } = await launch({ 'a.md': 'Texto\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await page.getByTestId('tab-insert').click();
    await page.getByTestId('image-menu').click();
    await page.locator('[data-command="insert.imageUrl"]').click();
    await page.getByTestId('image-url').fill('https://example.com/foto.png');
    await page.getByTestId('image-url-accept').click();
    await expect.poll(() => source(page)).toContain('![](https://example.com/foto.png)');
    await app.close();
  });

  test('[IMG-11] Insertar › Imagen ofrece archivo, dirección y portapapeles', async () => {
    const { app, page } = await launch({ 'a.md': 'Texto\n' });
    await waitForEditor(page);
    await page.getByTestId('tab-insert').click();
    await page.getByTestId('image-menu').click();
    for (const id of ['insert.image', 'insert.imageUrl', 'insert.imageClipboard']) {
      await expect(page.locator(`[data-command="${id}"]`)).toBeVisible();
    }
    await app.close();
  });
});

const mkdirImg = (dir: string, rel: string) => {
  const full = join(dir, rel);
  const parts = full.split(/[\\/]/);
  parts.pop();
  mkdirSync(parts.join('/'), { recursive: true });
  writeFileSync(full, Buffer.from(PNG, 'base64'));
};

test.describe('[Fase 4] edición de una imagen', () => {
  const withImage = (name = 'a') => ({ [`${name}.md`]: `Texto ![](${name}.001.png) fin\n` });

  const open = async (): Promise<{
    app: ElectronApplication;
    page: Page;
    dir: string;
    files: string[];
  }> => {
    const l = await launch({
      'a.md': 'Texto ![](a.001.png) fin\n',
      'a.001.png': Buffer.from(PNG, 'base64'),
    });
    await waitForEditor(l.page);
    return l;
  };

  test('[IMG] clic selecciona la imagen y muestra su menú; el texto alternativo se escribe', async () => {
    void withImage;
    const { app, page } = await open();
    await page.locator('.ProseMirror .image-wrap').click();
    await expect(page.getByTestId('image-popover')).toBeVisible();
    await page.getByTestId('image-alt').fill('Un cuadrado');
    await page.getByTestId('image-alt').press('Enter');
    await page.getByTestId('image-title').fill('Título');
    await page.getByTestId('image-title').press('Enter');
    await expect.poll(() => source(page)).toContain('![Un cuadrado](a.001.png "Título")');
    await app.close();
  });

  test('[IMG] «Visible en el documento» muestra el título como pie y escribe el marcador', async () => {
    const { app, page } = await open();
    await page.locator('.ProseMirror .image-wrap').click();
    // Sin título la casilla no se puede marcar.
    await expect(page.getByTestId('image-caption')).toBeDisabled();
    await page.getByTestId('image-title').fill('Figura 1');
    await page.getByTestId('image-title').press('Enter');
    await expect(page.locator('.ProseMirror .image-caption')).toHaveText('');
    await page.getByTestId('image-caption').check();
    await expect(page.locator('.ProseMirror .image-caption')).toHaveText('Figura 1');
    await expect
      .poll(() => source(page))
      .toContain('![](a.001.png "Figura 1")<!-- mdteca:caption -->');
    await page.getByTestId('image-caption').uncheck();
    await expect(page.locator('.ProseMirror .image-caption')).toBeHidden();
    await expect.poll(() => source(page)).not.toContain('mdteca:caption');
    await app.close();
  });

  test('[IMG] convertir a base64 y de vuelta a archivo', async () => {
    const { app, page, dir } = await open();
    await page.locator('.ProseMirror .image-wrap').click();
    await page.getByTestId('image-to-base64').click();
    await expect.poll(() => source(page)).toContain('data:image/png;base64,');
    expect(await source(page)).not.toContain('a.001.png');
    await page.getByTestId('image-to-file').click();
    await expect.poll(() => source(page)).toContain('![](a.002.png)');
    expect(existsSync(join(dir, 'a.002.png'))).toBe(true);
    await app.close();
  });

  test('[IMG] quitar la imagen no borra el archivo', async () => {
    const { app, page, dir } = await open();
    await page.locator('.ProseMirror .image-wrap').click();
    await page.getByTestId('image-remove').click();
    await expect.poll(() => source(page)).toBe('Texto  fin\n');
    expect(existsSync(join(dir, 'a.001.png'))).toBe(true);
    await app.close();
  });

  test('[IMG] soltar el tirador escribe el tamaño en el documento', async () => {
    const { app, page, files } = await open();
    await page.evaluate(() => {
      // La imagen de 1 px se amplía para poder arrastrar el tirador con comodidad.
      document.querySelector('.ProseMirror img')!.setAttribute('style', 'width: 200px');
    });
    await page.locator('.ProseMirror .image-wrap').click();
    const handle = page.locator('.ProseMirror .image-handle');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + 85, box.y + 5, { steps: 5 });
    await page.mouse.up();
    await expect.poll(() => source(page)).toMatch(/<img src="a\.001\.png" alt="" width="\d+">/);
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toMatch(/<img src="a\.001\.png" alt="" width="\d+">/);
    // «Quitar tamaño» vuelve a la sintaxis Markdown.
    await page.locator('.ProseMirror .image-wrap').click();
    await page.getByTestId('image-reset-size').click();
    await expect.poll(() => source(page)).toBe('Texto ![](a.001.png) fin\n');
    await app.close();
  });

  test('[IMG] el tamaño elegido se conserva al hacer clic fuera', async () => {
    const { app, page } = await open();
    await page.locator('.ProseMirror .image-wrap').click();
    const handle = page.locator('.ProseMirror .image-handle');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + 5, box.y + 5);
    await page.mouse.down();
    await page.mouse.move(box.x + 65, box.y + 5, { steps: 4 });
    await page.mouse.up();
    await page.locator('.ProseMirror p').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('image-popover')).toHaveCount(0);
    await expect.poll(() => source(page)).toMatch(/<img src="a\.001\.png" alt="" width="\d+">/);
    await app.close();
  });
});

test.describe('[Fase 4] modo texto, exportación y seguridad', () => {
  test('[IMG-01] en modo texto la data URL se pliega sin cambiar el texto', async () => {
    const payload = 'A'.repeat(4000);
    const md = `![](data:image/png;base64,${payload})\n`;
    const { app, page } = await launch({ 'a.md': md });
    await waitForEditor(page);
    await page.getByTestId('mode-source').click();
    const fold = page.locator('.cm-data-fold');
    await expect(fold).toBeVisible();
    await expect(fold).toContainText('KB');
    expect(await page.locator('.cm-content').innerText()).not.toContain(payload.slice(0, 200));
    expect(await source(page)).toBe(md);
    await app.close();
  });

  test('[IMG-10][ED-04] pegar una imagen en modo texto inserta el Markdown', async () => {
    const { app, page, dir } = await launch({ 'a.md': FILE_MODE('Texto') });
    await waitForEditor(page);
    await page.getByTestId('mode-source').click();
    await page.getByTestId('source').click();
    await page.evaluate(
      ({ b64 }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const dt = new DataTransfer();
        dt.items.add(new File([bytes], 'x.png', { type: 'image/png' }));
        document
          .querySelector('.cm-content')!
          .dispatchEvent(
            new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
          );
      },
      { b64: PNG },
    );
    await expect.poll(async () => imgs(dir, 'a')).toEqual(['a.001.png']);
    expect(await source(page)).toContain('![](a.001.png)');
    await app.close();
  });

  test('[VW-42] el HTML exportado incrusta las imágenes o las copia a una carpeta', async () => {
    const files = { 'a.md': '# T\n\n![](a.001.png)\n', 'a.001.png': Buffer.from(PNG, 'base64') };
    const first = await launch(files);
    await waitForEditor(first.page);
    const html = join(first.dir, 'salida.html');
    await first.app.evaluate((_e, p) => {
      process.env['MDTECA_E2E_SAVE_PATH'] = p;
    }, html);
    await first.page.getByTestId('tab-file').click();
    await first.page.locator('[data-command="file.exportHtml"]').click();
    await first.page.getByTestId('export-embed').click();
    await expect.poll(() => existsSync(html)).toBe(true);
    expect(readFileSync(html, 'utf8')).toContain(`data:image/png;base64,${PNG}`);
    await first.app.close();

    const second = await launch(files);
    await waitForEditor(second.page);
    const html2 = join(second.dir, 'otra.html');
    await second.app.evaluate((_e, p) => {
      process.env['MDTECA_E2E_SAVE_PATH'] = p;
    }, html2);
    await second.page.getByTestId('tab-file').click();
    await second.page.locator('[data-command="file.exportHtml"]').click();
    await second.page.getByTestId('export-folder').click();
    await expect.poll(() => existsSync(html2)).toBe(true);
    expect(readFileSync(html2, 'utf8')).toContain('src="otra_files/a.001.png"');
    expect(existsSync(join(second.dir, 'otra_files', 'a.001.png'))).toBe(true);
    await second.app.close();
  });

  test('[SEC] mdteca-asset:// solo sirve imágenes de la carpeta del documento', async () => {
    const { app, page, dir } = await launch({
      'a.md': 'Texto\n',
      'a.001.png': Buffer.from(PNG, 'base64'),
      'secreto.txt': 'no se sirve',
    });
    await waitForEditor(page);
    const load = (path: string) =>
      page.evaluate(
        (p) =>
          new Promise<number>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img.naturalWidth);
            img.onerror = () => resolve(-1);
            img.src = `mdteca-asset://local/${encodeURIComponent(p)}`;
          }),
        path,
      );
    expect(await load(join(dir, 'a.001.png'))).toBe(1);
    expect(await load(join(dir, 'secreto.txt'))).toBe(-1);
    expect(await load('C:/Windows/System32/drivers/etc/hosts')).toBe(-1);
    expect(await load(join(dir, '..', 'x.png'))).toBe(-1);
    await app.close();
  });
});

test.describe('[Fase 4] imágenes y páginas', () => {
  test('[VW-14] con imágenes grandes el PDF y la pantalla reparten igual, y ninguna excede la página', async () => {
    const tag = (n: number) => `<img src="a.001.png" alt="figura ${n}" width="700">`;
    let md = '# Con imágenes\n\n';
    for (let i = 1; i <= 4; i++) md += `Texto previo ${i}.\n\n${tag(i)}\n\n`;
    // Una imagen más alta que la página se escala para caber en el área de texto.
    md += '<img src="a.001.png" alt="enorme" width="2400">\n';
    const { app, page, dir } = await launch({
      'a.md': md,
      'a.001.png': Buffer.from(PNG, 'base64'),
    });
    await waitForEditor(page);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const all = [...document.querySelectorAll('.ProseMirror .image-wrap img')];
          return all.length === 5 && all.every((i) => (i as HTMLImageElement).naturalWidth === 1);
        }),
      )
      .toBe(true);
    await page.waitForTimeout(500);
    const screen = await page.evaluate(() => document.querySelectorAll('.sheet').length);
    expect(screen).toBeGreaterThanOrEqual(4);
    const tallest = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll('.ProseMirror .image-wrap img')].map(
          (i) => i.getBoundingClientRect().height,
        ),
      ),
    );
    expect(tallest).toBeLessThanOrEqual(933.6); // área de texto de una página A4 con márgenes de 25 mm
    const path = join(dir, 'salida.pdf');
    await app.evaluate((_e, p) => {
      process.env['MDTECA_E2E_SAVE_PATH'] = p;
    }, path);
    await page.evaluate(`window.__mdteca.exportPdf(window.__mdteca.activeDoc().id)`);
    const pdfPages = (
      readFileSync(path)
        .toString('latin1')
        .match(/\/Type\s*\/Page[^s]/g) ?? []
    ).length;
    expect(pdfPages).toBe(screen);
    await app.close();
  });
});
