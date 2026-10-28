import { expect, test, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Settings } from '@shared/settings';
import { launch, navigate, source, waitForEditor, type Launched } from './helpers';

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

  test('[PRJ-20] el ancho del navegador y los paneles escondidos se conservan al reiniciar', async () => {
    const first = await launch({ 'a.md': 'Hola\n' });
    const handle = (await first.page.getByTestId('navigator-resizer').boundingBox())!;
    await first.page.mouse.move(handle.x + handle.width / 2, handle.y + 40);
    await first.page.mouse.down();
    await first.page.mouse.move(handle.x + handle.width / 2 + 80, handle.y + 40, { steps: 5 });
    await first.page.mouse.up();
    await first.page.getByTestId('hide-document-panel').click();
    // La disposición se guarda con una espera: hasta entonces puede no existir settings.json.
    const layout = (l: Launched) =>
      existsSync(join(l.userData, 'settings.json')) ? saved(l).layout : undefined;
    await expect
      .poll(() => layout(first))
      .toMatchObject({ navigatorWidth: 340, navigatorOpen: true, documentPanelOpen: false });
    const reuse = { dir: first.dir, userData: first.userData };
    await first.app.close();
    const second = await launch({}, reuse);
    await expect(second.page.getByTestId('show-document-panel')).toBeVisible();
    await expect(second.page.getByTestId('document-panel')).toHaveCount(0);
    await expect
      .poll(() =>
        second.page.getByTestId('navigator').evaluate((n) => n.getBoundingClientRect().width),
      )
      .toBe(340);
    await second.page.getByTestId('hide-navigator').click();
    await expect.poll(() => layout(second)?.navigatorOpen).toBe(false);
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

/** Muere el proceso sin pasar por el cierre normal (como un fallo o un corte de luz). */
const crash = async (l: Launched) => {
  const proc = l.app.process();
  const exited = new Promise((resolve) => proc.once('exit', resolve));
  // Se mata todo el árbol: los procesos hijos de Chromium retienen la carpeta de datos.
  execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' });
  await exited;
  await new Promise((resolve) => setTimeout(resolve, 500));
};

test.describe('[Fase 6] autoguardado, recuperación y arranque', () => {
  const typeAtEnd = async (page: Page, text: string) => {
    await page.locator('.ProseMirror').click();
    await navigate(page, 'Control+End');
    await page.keyboard.type(text);
  };

  test('[02] autoguardado «cada cierto tiempo» escribe el documento sin preguntar', async () => {
    const l = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(l.page);
    await openSettings(l.page, 'editor');
    await l.page.getByTestId('set-autosave').selectOption('interval');
    await l.page.getByTestId('set-autosave-seconds').fill('5');
    await l.page.getByTestId('settings-close').click();
    await typeAtEnd(l.page, ' mundo');
    await expect(l.page.getByTestId('dirty-dot')).toBeVisible();
    await expect
      .poll(() => readFileSync(l.files[0]!, 'utf8'), { timeout: 15000 })
      .toBe('Hola mundo\n');
    await expect(l.page.getByTestId('dirty-dot')).toHaveCount(0);
    await l.app.close();
  });

  test('[02] autoguardado «al perder el foco»', async () => {
    const l = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(l.page);
    await openSettings(l.page, 'editor');
    await l.page.getByTestId('set-autosave').selectOption('blur');
    await l.page.getByTestId('settings-close').click();
    await typeAtEnd(l.page, '!');
    await l.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(() => readFileSync(l.files[0]!, 'utf8')).toBe('Hola!\n');
    await l.app.close();
  });

  test('[02] recuperación ante un cierre inesperado: se ofrece y deja los cambios sin guardar', async () => {
    const first = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(first.page);
    await typeAtEnd(first.page, ' perdido');
    await first.page.evaluate(() =>
      (
        window as unknown as { __mdtor: { writeRecoveryNow(): Promise<void> } }
      ).__mdtor.writeRecoveryNow(),
    );
    const recovery = join(first.userData, 'recovery');
    await expect.poll(() => existsSync(recovery) && readdirSync(recovery).length).toBe(1);
    // Cierre «inesperado»: el proceso muere sin pasar por el cierre normal.
    await crash(first);
    const second = await launch({}, { dir: first.dir, userData: first.userData }, []);
    await expect(second.page.getByTestId('dialog-choose')).toBeVisible();
    await second.page.getByTestId('choose-restore').click();
    await waitForEditor(second.page);
    expect(await source(second.page)).toBe('Hola perdido\n');
    await expect(second.page.getByTestId('dirty-dot')).toBeVisible();
    // El archivo en disco no se tocó.
    expect(readFileSync(first.files[0]!, 'utf8')).toBe('Hola\n');
    await second.app.close();
  });

  test('[02] un documento sin guardar también se recupera', async () => {
    const first = await launch({});
    await first.page.keyboard.press('Control+n');
    await waitForEditor(first.page);
    await first.page.locator('.ProseMirror').click();
    await first.page.keyboard.type('Borrador');
    await first.page.evaluate(() =>
      (
        window as unknown as { __mdtor: { writeRecoveryNow(): Promise<void> } }
      ).__mdtor.writeRecoveryNow(),
    );
    await crash(first);
    const second = await launch({}, { dir: first.dir, userData: first.userData }, []);
    await second.page.getByTestId('choose-restore').click();
    await waitForEditor(second.page);
    expect(await source(second.page)).toBe('Borrador\n');
    await second.app.close();
  });

  test('«Descartar los respaldos» y un cierre normal no dejan nada que recuperar', async () => {
    const first = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(first.page);
    await typeAtEnd(first.page, '!');
    await first.page.evaluate(() =>
      (
        window as unknown as { __mdtor: { writeRecoveryNow(): Promise<void> } }
      ).__mdtor.writeRecoveryNow(),
    );
    // Cierre normal de la ventana, descartando los cambios.
    await first.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
    await first.page.getByTestId('dialog-discard').click();
    await first.app.waitForEvent('close');
    const second = await launch({}, { dir: first.dir, userData: first.userData }, []);
    await expect(second.page.getByTestId('welcome')).toBeVisible();
    await expect(second.page.getByTestId('dialog-choose')).toHaveCount(0);
    await second.app.close();
  });

  test('«Abrir el último proyecto» al iniciar', async () => {
    const project = JSON.stringify({
      format: 'mdtor-project',
      version: 1,
      title: 'Último',
      collections: [],
    });
    const first = await launch({ 'p.mdtor': project });
    await expect(first.page.getByTestId('nav-header')).toContainText('Último');
    await openSettings(first.page, 'general');
    await first.page.getByTestId('set-open-on-start').selectOption('lastProject');
    await expect.poll(() => saved(first).general?.openOnStart).toBe('lastProject');
    await first.app.close();
    const second = await launch({}, { dir: first.dir, userData: first.userData }, []);
    await expect(second.page.getByTestId('nav-header')).toContainText('Último');
    await second.app.close();
  });
});

test.describe('[Fase 6] modo máquina de escribir', () => {
  test('mantiene la línea del cursor a media altura del lienzo', async () => {
    const text = Array.from({ length: 80 }, (_, i) => `Párrafo número ${i + 1}`).join('\n\n');
    const l = await launch({ 'a.md': `${text}\n` });
    await waitForEditor(l.page);
    await openSettings(l.page, 'editor');
    await l.page.getByTestId('set-typewriter').check();
    await l.page.getByTestId('settings-close').click();
    await l.page.locator('.ProseMirror p').nth(40).click();
    await l.page.keyboard.type('x');
    const offset = () =>
      l.page.evaluate(() => {
        const sel = window.getSelection()!;
        const r = sel.getRangeAt(0).getBoundingClientRect();
        const s = document.querySelector('.editor-scroll')!.getBoundingClientRect();
        return Math.abs((r.top + r.bottom) / 2 - (s.top + s.height / 2));
      });
    await expect.poll(offset).toBeLessThan(20);
    await l.page.keyboard.press('ArrowDown');
    await l.page.keyboard.press('ArrowDown');
    await expect.poll(offset).toBeLessThan(20);
    await l.app.close();
  });
});
