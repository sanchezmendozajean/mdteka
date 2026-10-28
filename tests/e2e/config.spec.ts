import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { launch, save, source, waitForEditor } from './helpers';

const BLOCK = `<!-- mdtor:config
{
  "version": 1,
  "typography": {
    "font": "Lora",
    "size": 11
  },
  "x-futuro": {
    "a": 1
  }
}
-->
`;

const setField = async (page: Page, id: string, value: string) => {
  const input = page.getByTestId(id);
  await input.fill(value);
  await input.press('Enter');
};

const family = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.querySelector('.ProseMirror')!).fontFamily);

test.describe('[Fase 2] configuración del documento', () => {
  test('[DOC-04] un documento sin cambios de configuración no recibe bloque', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await page.keyboard.type(' mundo');
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toContain(' mundo');
    expect(readFileSync(files[0]!, 'utf8')).not.toContain('mdtor:config');
    await app.close();
  });

  test('[DOC-04] cambiar el tamaño escribe un bloque mínimo al final del archivo', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(page);
    await setField(page, 'cfg-size', '14');
    await expect(page.getByTestId('dirty-dot')).toBeVisible();
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe(
      'Hola\n\n<!-- mdtor:config\n{\n  "version": 1,\n  "typography": {\n    "size": 14\n  }\n}\n-->\n',
    );
    // El bloque no es contenido: ni el editor ni la fuente lo muestran (DOC-05).
    expect(await source(page)).toBe('Hola\n');
    await app.close();
  });

  test('[DOC-03] cambiar el tamaño modifica una sola línea y conserva claves desconocidas', async () => {
    const original = `Texto\n\n${BLOCK}`;
    const { app, page, files } = await launch({ 'a.md': original });
    await waitForEditor(page);
    await expect(page.getByTestId('cfg-size')).toHaveValue('11');
    await expect(page.getByTestId('cfg-font')).toHaveValue('Lora');
    await setField(page, 'cfg-size', '13');
    await save(page);
    const before = original.split('\n');
    const after = readFileSync(files[0]!, 'utf8').split('\n');
    expect(after.length).toBe(before.length);
    expect(after.filter((l, i) => l !== before[i])).toEqual(['    "size": 13']);
    expect(after.join('\n')).toContain('"x-futuro"');
    await app.close();
  });

  test('[ED-20] abrir y guardar un documento con bloque no lo altera', async () => {
    const original = `Texto\n\n${BLOCK}`;
    const { app, page, files } = await launch({ 'a.md': original });
    await waitForEditor(page);
    await page.locator('.ProseMirror').click();
    await page.keyboard.type('x');
    await page.keyboard.press('Backspace');
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe(original);
    await app.close();
  });

  test('[DOC-11] dos pestañas con fuentes distintas no se afectan', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Uno\n', 'b.md': 'Dos\n' });
    await waitForEditor(page);
    const tabs = page.getByTestId('doc-tab');
    await tabs.nth(0).click();
    await setField(page, 'cfg-font', 'Lora');
    await tabs.nth(1).click();
    await setField(page, 'cfg-font', 'IBM Plex Mono');
    expect(await family(page)).toContain('IBM Plex Mono');
    await tabs.nth(0).click();
    expect(await family(page)).toContain('Lora');
    expect(await family(page)).not.toContain('IBM Plex Mono');
    // El CSS generado se acota al documento activo.
    const css = await page.getByTestId('doc-style').textContent();
    expect(css).toContain('[data-doc-id=');
    await page.keyboard.press('Control+s');
    await expect.poll(() => readFileSync(files[0]!, 'utf8')).toContain('"font": "Lora"');
    expect(readFileSync(files[1]!, 'utf8')).toBe('Dos\n');
    await app.close();
  });

  test('[DOC-12] los presets escriben theme y restablecer elimina el bloque', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(page);
    await page.getByTestId('tab-design').click();
    await page.getByTestId('preset-gallery').click();
    await page.locator('[data-preset="clasico"]').click();
    expect(await family(page)).toContain('Source Serif 4');
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe(
      'Hola\n\n<!-- mdtor:config\n{\n  "version": 1,\n  "theme": "clasico"\n}\n-->\n',
    );
    await page.getByTestId('cfg-reset').click();
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe('Hola\n');
    await app.close();
  });

  test('[DOC-10] la cinta cambia fuente, tamaño e interlineado del documento', async () => {
    const { app, page, files } = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(page);
    await page.getByTestId('tab-design').click();
    await page.getByTestId('size-picker').click();
    await page.locator('[data-value="14"]').click();
    await page.getByTestId('lineheight-picker').click();
    await page.locator('[data-value="2"]').click();
    await page.getByTestId('font-picker').click();
    await page.locator('[data-font="Literata"]').click();
    const lh = await page.evaluate(
      () => getComputedStyle(document.querySelector('.ProseMirror p')!).lineHeight,
    );
    expect(lh).toBe('37px'); // 14 pt = 18,67 px × 2
    await save(page);
    const text = readFileSync(files[0]!, 'utf8');
    expect(text).toContain('"font": "Literata"');
    expect(text).toContain('"size": 14');
    expect(text).toContain('"lineHeight": 2');
    await app.close();
  });

  test('[DOC-03] un bloque inválido se ignora, avisa y se puede reparar', async () => {
    const { app, page, files } = await launch({
      'a.md': 'Hola\n\n<!-- mdtor:config\n{ roto\n-->\n',
    });
    await waitForEditor(page);
    await expect(page.getByTestId('config-invalid')).toBeVisible();
    await page.getByRole('button', { name: 'Reparar' }).click();
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toBe('Hola\n');
    await app.close();
  });

  test('[DOC-13] los títulos numerados se activan desde la cinta', async () => {
    const { app, page, files } = await launch({ 'a.md': '# Uno\n\n## Dos\n' });
    await waitForEditor(page);
    await page.getByTestId('tab-design').click();
    await page.locator('[data-command="design.numberedHeadings"]').click();
    const content = await page.evaluate(
      () => getComputedStyle(document.querySelectorAll('.ProseMirror h2')[0]!, '::before').content,
    );
    expect(content).toContain('counter(h1)');
    await save(page);
    expect(readFileSync(files[0]!, 'utf8')).toContain('"numbering": true');
    await app.close();
  });
});

test('[DOC-13] una fuente ausente avisa en la barra de estado y no modifica el archivo', async () => {
  const original =
    'Hola\n\n<!-- mdtor:config\n{\n  "version": 1,\n  "typography": {\n    "font": "Fuente Que No Existe XYZ"\n  }\n}\n-->\n';
  const { app, page, files } = await launch({ 'a.md': original });
  await waitForEditor(page);
  await expect(page.getByTestId('font-fallback')).toContainText('Fuente Que No Existe XYZ');
  expect(await family(page)).toContain('Inter Variable');
  expect(readFileSync(files[0]!, 'utf8')).toBe(original);
  await app.close();
});
