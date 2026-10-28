import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { extendSelection, launch, mod, navigate, save, source, waitForEditor } from './helpers';

const INTRO = ['# Título', '', 'Primer párrafo.', '', 'Segundo párrafo.', ''].join('\n');

test.describe('[Fase 1] editor', () => {
  test('[ED-10] teclear 2 000 caracteres no mueve los bloques anteriores', async () => {
    const long = Array.from(
      { length: 12 },
      (_, i) => `## Sección ${i}\n\nTexto de la sección ${i}.\n`,
    ).join('\n');
    const { app, page } = await launch({ 'a.md': long });
    await waitForEditor(page);
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await navigate(page, `${mod}+End`);

    // Posición de cada bloque en el documento (rect + scroll) medida en una sola lectura síncrona.
    const rects = () =>
      page.evaluate(() => {
        const scroller = document.querySelector('.editor-scroll')!;
        return Array.from(document.querySelectorAll('.ProseMirror > *'))
          .slice(0, -1)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return [
              Math.round((r.top + scroller.scrollTop) * 100) / 100,
              Math.round(r.height * 100) / 100,
            ];
          });
      });
    const before = await rects();
    await page.keyboard.press('Enter');
    const lorem =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor. ';
    await page.keyboard.type(lorem.repeat(Math.ceil(2000 / lorem.length)).slice(0, 2000), {
      delay: 0,
    });
    const after = await rects();
    for (const [i, [top, height]] of before.entries()) {
      expect(Math.abs(after[i]![0]! - top!), `posición del bloque ${i}`).toBeLessThan(1);
      expect(after[i]![1], `altura del bloque ${i}`).toBe(height);
    }
    await app.close();
  });

  test('[ED-11] ninguna marca Markdown visible en WYSIWYG, tampoco con selección', async () => {
    const md = [
      '# Título',
      '',
      '**negrita** _cursiva_ ~~tachado~~ `código` [enlace](https://example.com)',
      '',
      '> cita',
      '',
      '- uno',
      '- dos',
      '',
      '1. primero',
      '',
      '- [ ] tarea',
      '',
      '```js',
      'const a = 1;',
      '```',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
    ].join('\n');
    const { app, page } = await launch({ 'a.md': md });
    await waitForEditor(page);
    const visible = () => page.locator('.ProseMirror').innerText();
    const forbidden = /(\*\*|__|`|#|>|\[|\]|~~|\|)/;
    expect(await visible()).not.toMatch(forbidden);

    for (const selector of [
      'h1',
      'strong',
      'em',
      's',
      'p code',
      'a',
      'blockquote',
      'li',
      'td',
      'th',
    ]) {
      await page.locator(`.ProseMirror ${selector}`).first().dblclick();
      expect(await visible(), `selección sobre ${selector}`).not.toMatch(forbidden);
      await page.keyboard.press('ArrowRight');
      expect(await visible(), `cursor sobre ${selector}`).not.toMatch(forbidden);
    }
    await page.keyboard.press(`${mod}+a`);
    expect(await visible()).not.toMatch(forbidden);
    await app.close();
  });

  test('[ED-15][ED-25] lo tecleado en WYSIWYG es texto literal y se guarda escapado', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Inicio\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await navigate(page, `${mod}+End`);
    for (const line of ['# Hola', '**x**', '- a', '1. b', '<b>']) {
      await page.keyboard.press('Enter');
      await page.keyboard.type(line);
    }
    // Todo son párrafos literales: ningún título, negrita ni lista.
    expect(
      await page
        .locator('.ProseMirror h1, .ProseMirror strong, .ProseMirror ul, .ProseMirror ol')
        .count(),
    ).toBe(0);
    await expect(page.locator('.ProseMirror p')).toHaveCount(6);
    await save(page);
    await expect(page.getByTestId('dirty-dot')).toHaveCount(0);

    const saved = readFileSync(files[0]!, 'utf8');
    expect(saved).toBe(
      [
        'Inicio',
        '',
        '\\# Hola',
        '',
        '\\*\\*x\\*\\*',
        '',
        '\\- a',
        '',
        '1\\. b',
        '',
        '&lt;b&gt;',
        '',
      ]
        .join('\n')
        .replace(/\n$/, '\n'),
    );
    await app.close();

    // Al reabrir se ven sin barras.
    const again = await launch({});
    void again;
    await again.app.close();
    const reopened = await launch({ 'b.md': saved });
    await waitForEditor(reopened.page);
    const text = await reopened.page.locator('.ProseMirror').innerText();
    expect(text).toContain('# Hola');
    expect(text).toContain('**x**');
    expect(text).toContain('- a');
    expect(text).toContain('1. b');
    expect(text).toContain('<b>');
    expect(text).not.toContain('\\');
    await reopened.app.close();
  });

  test('[ED-16] en modo texto el Markdown se interpreta', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Inicio\n' });
    await waitForEditor(page);
    await page.getByTestId('mode-source').click();
    const cm = page.locator('.cm-content');
    await cm.click();
    await navigate(page, `${mod}+End`);
    await page.keyboard.type('\n# Hola\n\n**x**');
    await page.getByTestId('mode-wysiwyg').click();
    await expect(page.locator('.ProseMirror h1')).toHaveText('Hola');
    await expect(page.locator('.ProseMirror strong')).toHaveText('x');
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe('Inicio\n\n# Hola\n\n**x**');
    await app.close();
  });

  test('[ED-01][ED-02] alternar modo conserva el cursor y [ED-23] no altera la fuente', async () => {
    const { app, page, files } = await launch({ 'a.md': INTRO });
    await waitForEditor(page);
    await page.locator('.ProseMirror p', { hasText: 'Segundo' }).click();
    await navigate(page, 'End');

    await page.keyboard.press(`${mod}+/`);
    await expect(page.locator('.cm-content')).toBeVisible();
    const line = await page.evaluate(() => {
      const w = window as unknown as {
        __mdtor: {
          editor: {
            debug(): {
              cm: {
                state: {
                  doc: { lineAt(p: number): { text: string } };
                  selection: { main: { head: number } };
                };
              };
            };
          };
        };
      };
      const { cm } = w.__mdtor.editor.debug();
      return cm.state.doc.lineAt(cm.state.selection.main.head).text;
    });
    expect(line).toBe('Segundo párrafo.');

    await page.keyboard.press(`${mod}+/`);
    await expect(page.locator('.ProseMirror')).toBeVisible();
    const caretParagraph = await page.evaluate(
      () => window.getSelection()!.anchorNode!.parentElement!.closest('p')!.textContent,
    );
    expect(caretParagraph).toBe('Segundo párrafo.');

    // Sin editar: el documento no está sucio y guardar no toca el archivo (GIT-01).
    await expect(page.getByTestId('dirty-dot')).toHaveCount(0);
    expect(await source(page)).toBe(INTRO);
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe(INTRO);
    await app.close();
  });

  test('[ED-12] latencia tecla→pintado < 16 ms p95 en un documento de 50+ páginas', async () => {
    const long = readFileSync('tests/fixtures/roundtrip/long-document.md', 'utf8');
    const { app, page } = await launch({ 'long.md': long });
    await waitForEditor(page);
    const editor = page.locator('.ProseMirror');
    await editor.click();
    await navigate(page, `${mod}+Home`);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    // Latencia de la tecla: desde `beforeinput` hasta que ProseMirror termina de actualizar el DOM,
    // más el coste de estilo/layout pendiente en el siguiente fotograma. No incluye el rasterizado.
    await page.evaluate(() => {
      const samples: number[] = [];
      const w = window as unknown as {
        __lat: number[];
        __mdtor: { editor: { debug(): { pm: { updateState(s: unknown): void } } } };
      };
      w.__lat = samples;
      const { pm } = w.__mdtor.editor.debug();
      const update = pm.updateState.bind(pm);
      let t0 = 0;
      document.addEventListener('beforeinput', () => (t0 = performance.now()), true);
      pm.updateState = (state: unknown) => {
        update(state);
        if (!t0) return;
        const js = performance.now() - t0;
        t0 = 0;
        requestAnimationFrame(() => {
          const t1 = performance.now();
          void document.body.offsetHeight; // fuerza estilo + layout pendientes
          samples.push(js + (performance.now() - t1));
        });
      };
    });
    for (let i = 0; i < 300; i++) await page.keyboard.type('a');
    await page.waitForTimeout(300);
    const samples = await page.evaluate(() => (window as unknown as { __lat: number[] }).__lat);
    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    console.log(
      `latencia: n=${samples.length} p50=${sorted[Math.floor(sorted.length / 2)]!.toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${sorted.at(-1)!.toFixed(2)}ms`,
    );
    expect(samples.length).toBeGreaterThan(250);
    expect(p95).toBeLessThan(16);
    await app.close();
  });
});

test.describe('[Fase 1] formato y archivos', () => {
  test('la cinta aplica formato y se guarda como Markdown estándar (ED-22)', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Hola mundo\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror p').click();
    await navigate(page, 'Home');
    await extendSelection(page, 'Shift+ArrowRight', 4); // «Hola»
    await page.locator('.ribbon [data-command="format.bold"]').click();
    await navigate(page, 'End');
    await extendSelection(page, 'Shift+ArrowLeft', 5); // «mundo»
    await page.keyboard.press(`${mod}+i`);
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe('**Hola** _mundo_\n');
    await app.close();
  });

  test('estilos, listas, cita, código y tabla desde la cinta', async () => {
    const { app, page } = await launch({ 'a.md': 'Uno\n\nDos\n\nTres\n\nCuatro\n' });
    await waitForEditor(page);
    const p = (text: string) => page.locator('.ProseMirror p', { hasText: text });

    await p('Uno').click();
    await page.getByTestId('styles-gallery').click();
    await page.locator('[data-command="block.heading2"]').click();
    await expect(page.locator('.ProseMirror h2')).toHaveText('Uno');

    await p('Dos').click();
    await page.locator('[data-command="list.tasks"]').click();
    await expect(page.locator('.ProseMirror li.task-item')).toHaveCount(1);
    await page.locator('.ProseMirror li.task-item input').check();
    await p('Tres').click();
    await page.locator('[data-command="block.quote"]').click();
    await expect(page.locator('.ProseMirror blockquote')).toHaveText('Tres');
    await p('Cuatro').click();
    await page.locator('[data-command="block.codeBlock"]').click();
    await expect(page.locator('.ProseMirror pre')).toContainText('Cuatro');

    await page.getByTestId('tab-insert').click();
    await page.getByTestId('table-grid').click();
    await page.getByTestId('grid-2-3').click();
    await expect(page.locator('.ProseMirror table tr')).toHaveCount(2);

    const md = await source(page);
    expect(md).toContain('## Uno');
    expect(md).toContain('- [x] Dos');
    expect(md).toContain('> Tres');
    expect(md).toContain('```\nCuatro\n```');
    expect(md).toMatch(/\| {3}\| {3}\| {3}\|/);
    await app.close();
  });

  test('enlace con Ctrl+K y cambios de bloques con atajos', async () => {
    const { app, page } = await launch({ 'a.md': 'Visita el sitio\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror p').click();
    await navigate(page, 'Home');
    await extendSelection(page, 'Shift+ArrowRight', 6); // «Visita»
    await page.keyboard.press(`${mod}+k`);
    await page.getByTestId('link-url').fill('https://example.com');
    await page.getByTestId('link-accept').click();
    expect(await source(page)).toBe('[Visita](https://example.com) el sitio\n');
    await page.keyboard.press(`${mod}+1`);
    expect(await source(page)).toBe('# [Visita](https://example.com) el sitio\n');
    await app.close();
  });

  test('guardar solo el bloque editado deja el resto del archivo intacto (ED-21)', async () => {
    const original =
      '# Título\n\n*  viñeta   rara\n*  otra\n\nPárrafo   con  espacios.\n\n\n\nFinal\n';
    const { app, page, files } = await launch({ 'a.md': original });
    await waitForEditor(page);
    await page.locator('.ProseMirror p', { hasText: 'Final' }).click();
    await navigate(page, 'End');
    await page.keyboard.type('!');
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe(original.replace('Final', 'Final!'));
    await app.close();
  });

  test('CRLF, BOM y bloque de configuración se conservan al editar (ED-20)', async () => {
    const original = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(
        '# T\r\n\r\nUno\r\n\r\n<!-- mdtor:config\r\n{ "version": 1 }\r\n-->\r\n',
        'utf8',
      ),
    ]);
    const { app, page, files } = await launch({ 'a.md': original });
    await waitForEditor(page);
    await page.locator('.ProseMirror p').click();
    await navigate(page, 'End');
    await page.keyboard.type('s');
    await save(page);
    const saved = readFileSync(files[0]!);
    expect(saved.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(saved.toString('utf8')).toBe(
      '﻿# T\r\n\r\nUnos\r\n\r\n<!-- mdtor:config\r\n{ "version": 1 }\r\n-->\r\n',
    );
    // El bloque de configuración no se muestra como contenido.
    expect(await page.locator('.ProseMirror').innerText()).not.toContain('mdtor:config');
    await app.close();
  });

  test('cambio externo: se recarga sin diálogo si no hay cambios locales', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Original\n' });
    await waitForEditor(page);
    await page.waitForTimeout(1500); // el observador de archivos necesita estar listo
    writeFileSync(files[0]!, 'Cambiado fuera\n');
    await expect(page.locator('.ProseMirror p')).toHaveText('Cambiado fuera', { timeout: 10_000 });
    await app.close();
  });

  test('cambio externo con cambios locales pregunta y permite mantener lo propio', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Original\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror p').click();
    await navigate(page, 'End');
    await page.keyboard.type(' local');
    await page.waitForTimeout(1500);
    writeFileSync(files[0]!, 'Otro contenido\n');
    await expect(page.getByTestId('dialog-external')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('dialog-compare').click();
    await expect(page.getByTestId('dialog-compare-view')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('dialog-keep').click();
    await expect(page.locator('.ProseMirror p')).toHaveText('Original local');
    await app.close();
  });

  test('cerrar con cambios pregunta y «No guardar» descarta', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Original\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror p').click();
    await page.keyboard.type('X');
    await expect(page.getByTestId('dirty-dot')).toHaveCount(1);
    await page.keyboard.press(`${mod}+w`);
    await expect(page.getByTestId('dialog-unsaved')).toBeVisible();
    await page.getByTestId('dialog-discard').click();
    await expect(page.getByTestId('welcome')).toBeVisible();
    expect(readFileSync(files[0]!, 'utf8')).toBe('Original\n');
    await app.close();
  });
});
