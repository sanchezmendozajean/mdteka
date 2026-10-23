import { expect, test } from '@playwright/test';
import { launch, navigate, source, waitForEditor } from './helpers';

test.describe('[Fase 6] barra flotante y menú contextual del editor', () => {
  test('[03] al seleccionar texto aparece la barra flotante y da formato', async () => {
    const l = await launch({ 'a.md': 'Hola mundo\n' });
    await waitForEditor(l.page);
    await expect(l.page.getByTestId('floating-toolbar')).toHaveCount(0);
    await l.page.locator('.ProseMirror p').dblclick({ position: { x: 10, y: 8 } });
    await expect(l.page.getByTestId('floating-toolbar')).toBeVisible();
    // Cada botón lleva ícono y comando del registro.
    await expect(l.page.locator('[data-testid="floating-toolbar"] [data-command]')).toHaveCount(5);
    await l.page.locator('[data-testid="floating-toolbar"] [data-command="format.bold"]').click();
    await expect.poll(() => source(l.page)).toBe('**Hola** mundo\n');
    // Sin selección desaparece.
    await l.page.locator('.ProseMirror p').click({ position: { x: 150, y: 8 } });
    await expect(l.page.getByTestId('floating-toolbar')).toHaveCount(0);
    await l.app.close();
  });

  test('se puede desactivar en Ajustes › Editor', async () => {
    const l = await launch({ 'a.md': 'Hola mundo\n' });
    await waitForEditor(l.page);
    await l.page.keyboard.press('Control+,');
    await l.page.getByTestId('settings-tab-editor').click();
    await l.page.getByTestId('set-floating-toolbar').uncheck();
    await l.page.getByTestId('settings-close').click();
    await l.page.locator('.ProseMirror p').dblclick({ position: { x: 10, y: 8 } });
    await expect(l.page.getByTestId('floating-toolbar')).toHaveCount(0);
    await l.app.close();
  });

  test('el clic derecho muestra el menú propio con íconos, no el de Chromium', async () => {
    const l = await launch({ 'a.md': 'Hola mundo\n' });
    await waitForEditor(l.page);
    await l.page.locator('.ProseMirror p').click({ button: 'right', position: { x: 10, y: 8 } });
    await expect(l.page.getByTestId('context-menu')).toBeVisible();
    await expect(l.page.getByTestId('menu-clipboard.paste')).toBeVisible();
    await expect(l.page.getByTestId('menu-format.bold')).toBeVisible();
    // Sin selección no se ofrece cortar ni copiar.
    await expect(l.page.getByTestId('menu-clipboard.cut')).toHaveCount(0);
    await expect(l.page.locator('[data-testid="context-menu"] svg').first()).toBeVisible();
    await l.page.keyboard.press('Escape');
    await l.page.locator('.ProseMirror p').dblclick({ position: { x: 10, y: 8 } });
    await l.page.locator('.ProseMirror p').click({ button: 'right', position: { x: 10, y: 8 } });
    await expect(l.page.getByTestId('menu-clipboard.copy')).toBeVisible();
    await l.page.getByTestId('menu-format.bold').click();
    await expect.poll(() => source(l.page)).toBe('**Hola** mundo\n');
    await l.app.close();
  });

  test('las sugerencias del corrector aparecen en el menú y se pueden añadir palabras', async () => {
    const l = await launch({ 'a.md': 'Hola mundo\n' });
    await waitForEditor(l.page);
    const box = (await l.page.locator('.ProseMirror p').boundingBox())!;
    // Chromium avisa del clic derecho con las sugerencias; aquí se simula ese aviso.
    await l.app.evaluate(
      ({ BrowserWindow }, p) => {
        BrowserWindow.getAllWindows()[0]!.webContents.send('editor:contextMenu', {
          x: p.x,
          y: p.y,
          misspelledWord: 'holaa',
          suggestions: ['hola', 'holas'],
          hasSelection: false,
          isEditable: true,
        });
      },
      { x: box.x + 10, y: box.y + 8 },
    );
    await expect(l.page.getByTestId('menu-spell-hola')).toBeVisible();
    await expect(l.page.getByTestId('menu-spell-add')).toContainText('holaa');
    await l.page.getByTestId('menu-spell-hola').click();
    await expect(l.page.getByTestId('context-menu')).toHaveCount(0);
    await l.app.close();
  });
});

test.describe('[Fase 6] esquema del documento', () => {
  const DOC = '# Uno\n\nTexto\n\n## Dos\n\n```\n# no es título\n```\n\n### Tres\n';

  test('el esquema lista los títulos con su nivel y se actualiza al editar', async () => {
    const l = await launch({ 'a.md': DOC });
    await waitForEditor(l.page);
    await l.page.getByTestId('left-tab-outline').click();
    await expect(l.page.getByTestId('outline-item')).toHaveText(['Uno', 'Dos', 'Tres']);
    await expect(l.page.getByTestId('outline-item').nth(2)).toHaveAttribute('data-level', '3');
    await l.page.locator('.ProseMirror').click();
    await navigate(l.page, 'Control+End');
    await l.page.keyboard.press('Enter');
    await l.page.keyboard.type('Nuevo');
    await l.page.keyboard.press('Control+1');
    await expect(l.page.getByTestId('outline-item')).toHaveText(['Uno', 'Dos', 'Tres', 'Nuevo']);
    await l.app.close();
  });

  test('clic en un título lleva el cursor allí, en WYSIWYG y en modo texto', async () => {
    const l = await launch({ 'a.md': DOC });
    await waitForEditor(l.page);
    await l.page.getByTestId('left-tab-outline').click();
    await l.page.getByTestId('outline-item').nth(1).click();
    await l.page.keyboard.type('X');
    await expect.poll(() => source(l.page)).toContain('## XDos');
    // Modo texto.
    await l.page.keyboard.press('Control+/');
    await expect(l.page.locator('.cm-editor')).toBeVisible();
    await expect(l.page.getByTestId('outline-item')).toHaveCount(3);
    await l.page.getByTestId('outline-item').nth(2).click();
    await l.page.keyboard.type('Y');
    await expect.poll(() => source(l.page)).toContain('Y### Tres');
    await l.app.close();
  });

  test('sin documento o sin títulos el esquema lo dice, y el comando de la cinta lo abre', async () => {
    const l = await launch({});
    await l.page.getByTestId('tab-view').click();
    await l.page.locator('[data-command="view.outline"]').click();
    await expect(l.page.getByTestId('outline-empty')).toBeVisible();
    await l.app.close();
  });
});
