import { expect, test } from '@playwright/test';
import { launch, mod, navigate, save, source, waitForEditor } from './helpers';

/** Simula un pegado con los formatos dados (el portapapeles del sistema no es accesible desde la prueba). */
const paste = (page: import('@playwright/test').Page, data: Record<string, string>) =>
  page.evaluate((formats) => {
    const dt = new DataTransfer();
    for (const [type, value] of Object.entries(formats)) dt.setData(type, value);
    const event = new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector('.ProseMirror')!.dispatchEvent(event);
  }, data);

test.describe('[Fase 1] buscar y reemplazar', () => {
  test('buscar, navegar, reemplazar todo y deshacer en WYSIWYG', async () => {
    const { app, page } = await launch({ 'a.md': 'uno dos uno\n\ntres Uno\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await page.keyboard.press(`${mod}+f`);
    await expect(page.getByTestId('find-bar')).toBeVisible();
    await page.getByTestId('find-input').fill('uno');
    await expect(page.getByTestId('find-status')).toHaveText('1 de 3');
    await page.getByTestId('find-input').press('Enter');
    await expect(page.getByTestId('find-status')).toHaveText('2 de 3');
    await expect(page.locator('.ProseMirror .find-match, .ProseMirror .find-current')).toHaveCount(
      3,
    );

    await page.getByRole('button', { name: 'Distinguir mayúsculas' }).click();
    await expect(page.getByTestId('find-status')).toHaveText(/de 2$/);
    await page.getByRole('button', { name: 'Distinguir mayúsculas' }).click();

    await page.keyboard.press(`${mod}+h`);
    await page.getByTestId('replace-input').fill('X');
    await page.getByTestId('replace-all').click();
    expect(await source(page)).toBe('X dos X\n\ntres X\n');

    await page.getByTestId('find-close').click();
    await page.keyboard.press(`${mod}+z`);
    expect(await source(page)).toBe('uno dos uno\n\ntres Uno\n');
    await app.close();
  });

  test('expresiones regulares y expresión inválida', async () => {
    const { app, page } = await launch({ 'a.md': 'a1 b22 c333\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await page.keyboard.press(`${mod}+f`);
    await page.getByRole('button', { name: 'Expresión regular' }).click();
    await page.getByTestId('find-input').fill('\\d+');
    await expect(page.getByTestId('find-status')).toHaveText('1 de 3');
    await page.getByTestId('find-input').fill('(');
    await expect(page.getByTestId('find-status')).toHaveText('Expresión no válida');
    await app.close();
  });

  test('en modo texto la misma barra busca y reemplaza', async () => {
    const { app, page } = await launch({ 'a.md': 'uno\n\ndos uno\n\ntres\n' });
    await waitForEditor(page);
    await page.getByTestId('mode-source').click();
    await page.locator('.cm-content').click();
    await page.keyboard.press(`${mod}+f`);
    await page.getByTestId('find-input').fill('uno');
    await expect(page.getByTestId('find-status')).toHaveText(/de 2$/);
    await page.keyboard.press(`${mod}+h`);
    await page.getByTestId('replace-input').fill('1');
    await page.getByTestId('replace-all').click();
    expect(await source(page)).toBe('1\n\ndos 1\n\ntres\n');
    await app.close();
  });
});

test.describe('[Fase 1] pegado (ED-14)', () => {
  test('pegar HTML conserva la estructura y descarta estilos y scripts', async () => {
    const { app, page } = await launch({ 'a.md': 'Inicio\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await navigate(page, `${mod}+End`);
    await page.keyboard.press('Enter');
    await paste(page, {
      'text/html':
        '<h2 style="color:red;font-family:Comic Sans MS">Título</h2><p style="font-size:30px">Hola <b>mundo</b> <i>cursiva</i><script>alert(1)</script></p><ul><li>uno</li><li>dos</li></ul>',
      'text/plain': 'Título\nHola mundo cursiva\nuno\ndos',
    });
    await expect(page.locator('.ProseMirror h2')).toHaveText('Título');
    const md = await source(page);
    expect(md).toContain('## Título');
    expect(md).toContain('Hola **mundo** _cursiva_');
    expect(md).toContain('- uno\n- dos');
    expect(md).not.toMatch(/style|script|alert|font/i);
    await app.close();
  });

  test('pegar texto plano es literal: la sintaxis se escapa', async () => {
    const { app, page } = await launch({ 'a.md': 'Inicio\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await navigate(page, `${mod}+End`);
    await page.keyboard.press('Enter');
    await paste(page, { 'text/plain': '# no es título\n\n- ni lista\n\n**ni negrita**' });
    await expect(page.locator('.ProseMirror h1, .ProseMirror ul, .ProseMirror strong')).toHaveCount(
      0,
    );
    const md = await source(page);
    expect(md).toContain('\\# no es título');
    expect(md).toContain('\\- ni lista');
    expect(md).toContain('\\*\\*ni negrita\\*\\*');
    await app.close();
  });

  test('Pegar como Markdown (Ctrl+Alt+V) interpreta la sintaxis', async () => {
    const { app, page } = await launch({ 'a.md': 'Inicio\n' });
    await waitForEditor(page);
    await app.evaluate(({ clipboard }) =>
      clipboard.writeText('## Pegado\n\n- a\n- b\n\n**fuerte**'),
    );
    await page.locator('.ProseMirror').click();
    await navigate(page, `${mod}+End`);
    await page.keyboard.press(`${mod}+Alt+v`);
    await expect(page.locator('.ProseMirror h2')).toHaveText('Pegado');
    await expect(page.locator('.ProseMirror li')).toHaveCount(2);
    await expect(page.locator('.ProseMirror strong')).toHaveText('fuerte');
    await app.close();
  });
});

test.describe('[Fase 1] elementos', () => {
  test('el bloque de código se resalta con el lenguaje y la casilla de tarea se guarda', async () => {
    const md = '```js\nconst a = 1;\n```\n\n- [ ] tarea\n';
    const { app, page, files } = await launch({ 'a.md': md });
    await waitForEditor(page);
    await expect(page.locator('.ProseMirror pre .tok-keyword').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('.ProseMirror li.task-item input').check();
    await save(page);
    expect(await source(page)).toBe('```js\nconst a = 1;\n```\n\n- [x] tarea\n');
    void files;
    await app.close();
  });

  test('el contador de palabras funciona al abrir y al escribir', async () => {
    const { app, page } = await launch({ 'a.md': '# Título\n\nuno dos tres\n' });
    await waitForEditor(page);
    await expect(page.getByTestId('word-count')).toContainText('4 palabras');
    await page.locator('.ProseMirror p').click();
    await navigate(page, 'End');
    await page.keyboard.type(' cuatro');
    await expect(page.getByTestId('word-count')).toContainText('5 palabras', { timeout: 5000 });
    await app.close();
  });

  test('Tab y Mayús+Tab anidan listas; Enter en tarea crea otra tarea', async () => {
    const { app, page } = await launch({ 'a.md': '- [ ] uno\n- [ ] dos\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror li', { hasText: 'dos' }).click();
    await navigate(page, 'End');
    await page.keyboard.press('Tab');
    await expect(page.locator('.ProseMirror li li')).toHaveCount(1);
    await page.keyboard.press('Enter');
    await page.keyboard.type('tres');
    expect(await source(page)).toBe('- [ ] uno\n  - [ ] dos\n  - [ ] tres\n');
    await page.keyboard.press('Shift+Tab');
    expect(await source(page)).toBe('- [ ] uno\n  - [ ] dos\n- [ ] tres\n');
    await app.close();
  });

  test('operaciones de tabla desde la cinta y alineación', async () => {
    const { app, page } = await launch({ 'a.md': '| A | B |\n| - | - |\n| 1 | 2 |\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror td', { hasText: '1' }).click();
    await page.locator('[data-command="table.addRowAfter"]').click();
    await page.locator('[data-command="table.addColAfter"]').click();
    await page.locator('[data-command="table.alignRight"]').click();
    await expect(page.locator('.ProseMirror tr')).toHaveCount(3);
    const md = await source(page);
    expect(md.split('\n')[0]).toBe('|  A |   | B |');
    expect(md).toMatch(/^\| -: \|/m);
    await app.close();
  });
});

test.describe('[Fase 1] bloque de código', () => {
  test('[ED-15] flecha abajo al final de un bloque de código final añade un párrafo debajo', async () => {
    const { app, page } = await launch({ 'c.md': 'hola\n\n```\nuno\ndos\n```\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror pre').click();
    await navigate(page, `${mod}+End`);
    await navigate(page, 'ArrowDown');
    await page.keyboard.type('fuera');
    expect(await source(page)).toBe('hola\n\n```\nuno\ndos\n```\n\nfuera\n');
    await app.close();
  });
});

test.describe('[Fase 1] barra de selección del margen', () => {
  test('[ED-15] clic en el margen izquierdo selecciona la línea; doble clic, el párrafo', async () => {
    const { app, page } = await launch({ 'm.md': 'uno dos\n\ntres cuatro\n\ncinco\n' });
    await waitForEditor(page);
    const target = await page.evaluate(() => {
      const p = document.querySelectorAll('.ProseMirror p')[1]!.getBoundingClientRect();
      return { x: p.left - 20, y: p.top + p.height / 2 };
    });
    const barActive = () =>
      page.evaluate(() => document.querySelector('.doc-column.margin-select') !== null);
    await page.mouse.move(target.x, target.y);
    await expect.poll(barActive).toBe(true);
    // Pegado al texto (dentro de la separación de 5 px) y en el vacío bajo el contenido: sin barra.
    await page.mouse.move(target.x + 17, target.y);
    await expect.poll(barActive).toBe(false);
    await page.mouse.move(target.x, target.y + 400);
    await expect.poll(barActive).toBe(false);
    await page.mouse.click(target.x, target.y);
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('tres cuatro');
    await page.mouse.dblclick(target.x, target.y);
    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString()))
      .toBe('tres cuatro');
    await app.close();
  });

  test('[ED-15] clic en el margen derecho pone el cursor al final de la línea, también tras una imagen a todo el ancho', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const { app, page } = await launch({
      'm.md': 'uno dos\n\ntres cuatro\n\n<img src="m.001.png" alt="" width="3000">\n',
      'm.001.png': png,
    });
    await waitForEditor(page);
    // La hoja es más ancha que la ventana de pruebas: se desplaza hasta ver su margen derecho.
    await page.evaluate(() => {
      for (
        let el: Element | null = document.querySelector('.ProseMirror');
        el;
        el = el.parentElement
      )
        el.scrollLeft = el.scrollWidth;
    });
    const rightOf = (selector: string, index: number) =>
      page.evaluate(
        ({ selector, index }) => {
          const r = document.querySelectorAll(selector)[index]!.getBoundingClientRect();
          const pm = document.querySelector('.ProseMirror')!.getBoundingClientRect();
          return { x: pm.right + 12, y: r.top + r.height / 2 };
        },
        { selector, index },
      );
    const para = await rightOf('.ProseMirror p', 0);
    await page.mouse.click(para.x, para.y);
    await page.keyboard.type('X');
    expect(await source(page)).toContain('uno dosX\n');
    const image = await rightOf('.ProseMirror .image-wrap', 0);
    await page.mouse.click(image.x, image.y);
    await page.keyboard.type('Y');
    expect(await source(page)).toContain('width="3000">Y');
    await app.close();
  });

  test('[ED-15] clic bajo la última línea pone el cursor al final del documento', async () => {
    const { app, page } = await launch({ 'm.md': 'uno dos\n\ntres cuatro\n' });
    await waitForEditor(page);
    const target = await page.evaluate(() => {
      const p = document.querySelectorAll('.ProseMirror p')[1]!.getBoundingClientRect();
      return { x: p.left + 20, y: p.bottom + 120 };
    });
    await page.mouse.click(target.x, target.y);
    await page.keyboard.type('Z');
    expect(await source(page)).toBe('uno dos\n\ntres cuatroZ\n');
    await app.close();
  });
});

test('[UI-10] una palabra muy larga se parte y no empuja los paneles', async () => {
  const { app, page } = await launch({ 'l.md': `${'a'.repeat(400)}\n` });
  await waitForEditor(page);
  const overflow = await page.evaluate(() => {
    const panel = document.querySelector('.panel.right')!.getBoundingClientRect();
    return panel.right - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  await app.close();
});
