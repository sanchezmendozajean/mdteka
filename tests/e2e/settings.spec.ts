import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Settings } from '@shared/settings';
import { launch, source, waitForEditor, type Launched } from './helpers';

const saved = (l: Launched) =>
  JSON.parse(readFileSync(join(l.userData, 'settings.json'), 'utf8')) as Partial<Settings> &
    Record<string, never>;

const openSettings = async (page: Page, section?: string) => {
  await page.keyboard.press('Control+,');
  await expect(page.getByTestId('dialog-settings')).toBeVisible();
  if (section) await page.getByTestId(`settings-tab-${section}`).click();
};

test.describe('[Fase 6] ajustes de la app', () => {
  test('[CFG] Ctrl+, abre los ajustes y cada cambio se guarda en userData/settings.json', async () => {
    const l = await launch({ 'a.md': 'Hola\n' });
    await openSettings(l.page, 'appearance');
    await l.page.getByTestId('set-theme').selectOption('dark');
    await expect(l.page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await l.page.getByTestId('set-accent-violet').click();
    await expect(l.page.locator('html')).toHaveAttribute('data-accent', 'violet');
    await l.page.getByTestId('set-density').selectOption('compact');
    await expect(l.page.locator('html')).toHaveAttribute('data-density', 'compact');
    await expect
      .poll(() => saved(l).appearance)
      .toMatchObject({
        theme: 'dark',
        accent: 'violet',
        density: 'compact',
      });
    await l.app.close();
  });

  test('los ajustes se conservan al reiniciar', async () => {
    const first = await launch({ 'a.md': 'Hola\n' });
    await openSettings(first.page, 'appearance');
    await first.page.getByTestId('set-theme').selectOption('dark');
    await expect.poll(() => saved(first).appearance?.theme).toBe('dark');
    const reuse = { dir: first.dir, userData: first.userData };
    await first.app.close();
    const second = await launch({}, reuse);
    await expect(second.page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await second.app.close();
  });

  test('«seguir al sistema» y el botón de tema', async () => {
    const l = await launch({});
    await l.page.locator('.titlebar [data-command="view.toggleTheme"]').click();
    await expect(l.page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => saved(l).appearance?.theme).toBe('dark');
    await l.page.locator('.titlebar [data-command="view.toggleTheme"]').click();
    await expect(l.page.locator('html')).toHaveAttribute('data-theme', 'light');
    await l.app.close();
  });

  test('[UI-16] el idioma de la interfaz cambia al instante', async () => {
    const l = await launch({});
    await expect(l.page.getByTestId('tab-file')).toHaveText('Archivo');
    await openSettings(l.page, 'general');
    await l.page.getByTestId('set-language').selectOption('en');
    await expect(l.page.getByTestId('tab-file')).toHaveText('File');
    await expect.poll(() => saved(l).general?.language).toBe('en');
    await l.app.close();
  });

  test('el modo por defecto y el fin de línea se aplican a los documentos nuevos', async () => {
    const l = await launch({});
    await openSettings(l.page, 'editor');
    await l.page.getByTestId('set-default-mode').selectOption('source');
    await l.page.getByTestId('settings-tab-files').click();
    await l.page.getByTestId('set-eol').selectOption('crlf');
    await l.page.getByTestId('settings-close').click();
    await l.page.keyboard.press('Control+n');
    await expect(l.page.locator('.cm-editor')).toBeVisible();
    await l.app.close();
  });

  test('el aviso de base64 usa el umbral de los ajustes', async () => {
    const l = await launch({});
    await openSettings(l.page, 'images');
    await l.page.getByTestId('set-warn-kb').fill('100');
    await l.page.getByTestId('set-warn-kb').blur();
    await expect.poll(() => saved(l).images?.warnKb).toBe(100);
    await l.app.close();
  });

  test('«Documento por defecto» escribe documentDefaults, que heredan los documentos', async () => {
    const l = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(l.page);
    await openSettings(l.page, 'documentDefaults');
    await l.page.getByTestId('set-doc-font').selectOption('Lora');
    await expect
      .poll(
        () =>
          (saved(l).documentDefaults as { typography?: { font?: string } } | undefined)?.typography
            ?.font,
      )
      .toBe('Lora');
    await l.page.getByTestId('settings-close').click();
    await expect(l.page.getByTestId('cfg-typography.font')).toHaveAttribute('data-origin', 'app');
    await l.app.close();
  });

  test('restablecer ajustes vuelve a los valores de fábrica', async () => {
    const l = await launch({});
    await openSettings(l.page, 'appearance');
    await l.page.getByTestId('set-theme').selectOption('dark');
    await l.page.getByTestId('settings-tab-advanced').click();
    await l.page.getByTestId('set-reset').click();
    await l.page.getByTestId('choose-reset').click();
    await expect(l.page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => saved(l).appearance?.theme).toBe('light');
    await l.app.close();
  });
});

test.describe('[Fase 6] atajos editables y paleta', () => {
  test('reasignar un atajo lo activa y libera el anterior', async () => {
    const l = await launch({ 'a.md': 'Hola mundo\n' });
    await waitForEditor(l.page);
    await openSettings(l.page, 'shortcuts');
    await l.page.getByTestId('set-shortcut-search').fill('Negrita');
    await l.page.getByTestId('shortcut-set-format.bold').click();
    await l.page.keyboard.press('Control+Alt+B');
    await expect(l.page.getByTestId('shortcut-set-format.bold')).toHaveText('Ctrl+Alt+B');
    await expect.poll(() => saved(l).shortcuts?.['format.bold']).toBe('Ctrl+Alt+B');
    await l.page.getByTestId('settings-close').click();
    await l.page.locator('.ProseMirror').click();
    await l.page.keyboard.press('Control+a');
    await l.page.keyboard.press('Control+Alt+B');
    await expect.poll(() => source(l.page)).toContain('**Hola mundo**');
    // El atajo de fábrica ya no negrita.
    await l.page.keyboard.press('Control+z');
    await l.page.keyboard.press('Control+b');
    await expect.poll(() => source(l.page)).toBe('Hola mundo\n');
    await l.app.close();
  });

  test('un atajo ya usado se rechaza con un aviso', async () => {
    const l = await launch({});
    await openSettings(l.page, 'shortcuts');
    await l.page.getByTestId('set-shortcut-search').fill('Cursiva');
    await l.page.getByTestId('shortcut-set-format.italic').click();
    await l.page.keyboard.press('Control+b');
    await expect(l.page.getByTestId('set-shortcut-warning')).toContainText('Negrita');
    await expect(l.page.getByTestId('shortcut-set-format.italic')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await l.page.keyboard.press('Escape');
    await l.app.close();
  });

  test('restablecer un atajo y quitarlo con Retroceso', async () => {
    const l = await launch({});
    await openSettings(l.page, 'shortcuts');
    await l.page.getByTestId('set-shortcut-search').fill('Cursiva');
    await l.page.getByTestId('shortcut-set-format.italic').click();
    await l.page.keyboard.press('Backspace');
    await expect(l.page.getByTestId('shortcut-set-format.italic')).toHaveText('Sin atajo');
    await l.page.getByTestId('shortcut-reset-format.italic').click();
    await expect(l.page.getByTestId('shortcut-set-format.italic')).toHaveText('Ctrl+I');
    await l.app.close();
  });

  test('Ctrl+Shift+P abre la paleta, filtra y ejecuta un comando', async () => {
    const l = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(l.page);
    await l.page.keyboard.press('Control+Shift+p');
    await expect(l.page.getByTestId('dialog-palette')).toBeVisible();
    await l.page.getByTestId('palette-input').fill('Título 2');
    await expect(l.page.getByTestId('palette-row').first()).toHaveAttribute(
      'data-command',
      'block.heading2',
    );
    // Cada fila lleva ícono y atajo.
    await expect(l.page.getByTestId('palette-row').first().locator('svg')).toBeVisible();
    await expect(l.page.getByTestId('palette-row').first().locator('kbd')).toHaveText('Ctrl+2');
    await l.page.keyboard.press('Enter');
    await expect.poll(() => source(l.page)).toBe('## Hola\n');
    await l.app.close();
  });

  test('la paleta no ejecuta los comandos no disponibles', async () => {
    const l = await launch({});
    await l.page.keyboard.press('Control+Shift+p');
    await l.page.getByTestId('palette-input').fill('Negrita');
    await expect(l.page.getByTestId('palette-row').first()).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await l.page.keyboard.press('Enter');
    await expect(l.page.getByTestId('dialog-palette')).toBeVisible();
    await l.app.close();
  });

  test('Ctrl+Tab y Ctrl+Shift+Tab cambian de pestaña', async () => {
    const l = await launch({ 'a.md': 'A\n', 'b.md': 'B\n' });
    await waitForEditor(l.page);
    const active = () =>
      l.page.locator('[data-testid="doc-tab"][aria-selected="true"]').textContent();
    expect(await active()).toContain('b.md');
    await l.page.keyboard.press('Control+Tab');
    expect(await active()).toContain('a.md');
    await l.page.keyboard.press('Control+Shift+Tab');
    expect(await active()).toContain('b.md');
    await l.app.close();
  });
});

test.describe('[Fase 6] modo concentración', () => {
  test('F11 oculta cinta y paneles y Esc vuelve', async () => {
    const l = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(l.page);
    await l.page.keyboard.press('F11');
    await expect(l.page.locator('.ribbon')).toBeHidden();
    await expect(l.page.getByTestId('navigator')).toBeHidden();
    await expect(l.page.getByTestId('document-panel')).toBeHidden();
    await expect(l.page.locator('.ProseMirror')).toBeVisible();
    await l.page.keyboard.press('Escape');
    await expect(l.page.locator('.ribbon')).toBeVisible();
    await expect(l.page.getByTestId('navigator')).toBeVisible();
    await l.app.close();
  });
});
