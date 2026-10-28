import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { serializeProject, type Project } from '@shared/project';
import { launch, waitForEditor } from './helpers';

/** Violaciones graves o críticas de accesibilidad de lo que hay en pantalla. */
async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .disableRules(['color-contrast']) // el contraste se revisa aparte (paleta con AA, ver abajo)
    .analyze();
  return results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 4)
          .join(' | ')}`,
    );
}

const PROJECT = serializeProject({
  format: 'mdtor-project',
  version: 1,
  title: 'Manual',
  collections: [
    {
      id: 'c-1',
      title: 'General',
      books: [
        { id: 'b-1', title: 'Uso', items: [{ id: 'i-1', file: 'a.md' }] },
        { id: 'b-2', title: 'Ref', items: [] },
      ],
    },
  ],
} as Project);

test.describe('[Fase 6] auditoría de accesibilidad', () => {
  test('pantalla de inicio', async () => {
    const l = await launch({});
    expect(await audit(l.page)).toEqual([]);
    await l.app.close();
  });

  test('editor con documento, cinta y paneles', async () => {
    const l = await launch({ 'a.md': '# Título\n\nTexto con [enlace](https://x.io).\n' });
    await waitForEditor(l.page);
    expect(await audit(l.page)).toEqual([]);
    for (const tab of ['insert', 'design', 'layout', 'view', 'project', 'file']) {
      await l.page.getByTestId(`tab-${tab}`).click();
      expect(await audit(l.page), tab).toEqual([]);
    }
    await l.app.close();
  });

  test('navegador de libros y esquema', async () => {
    const l = await launch({ 'p.mdtor': PROJECT, 'a.md': '# Uno\n' }, undefined, ['p.mdtor']);
    await expect(l.page.getByTestId('nav-header')).toBeVisible();
    expect(await audit(l.page)).toEqual([]);
    await l.page.getByTestId('left-tab-outline').click();
    expect(await audit(l.page)).toEqual([]);
    await l.app.close();
  });

  test('diálogos: ajustes, paleta y asistente', async () => {
    const l = await launch({ 'a.md': 'Hola\n' });
    await waitForEditor(l.page);
    await l.page.keyboard.press('Control+,');
    for (const section of [
      'general',
      'editor',
      'appearance',
      'documentDefaults',
      'images',
      'files',
      'shortcuts',
      'advanced',
    ]) {
      await l.page.getByTestId(`settings-tab-${section}`).click();
      expect(await audit(l.page), section).toEqual([]);
    }
    await l.page.keyboard.press('Escape');
    await l.page.keyboard.press('Control+Shift+p');
    expect(await audit(l.page), 'palette').toEqual([]);
    await l.page.keyboard.press('Escape');
    await l.app.close();
  });
});

test.describe('[Fase 6] contraste AA de la interfaz [UI-11]', () => {
  const contrast = async (page: Page) => {
    const results = await new AxeBuilder({ page })
      .setLegacyMode(true)
      .withRules(['color-contrast'])
      .analyze();
    return results.violations.flatMap((v) =>
      v.nodes.map((n) => `${n.target.join(' ')}: ${n.any[0]?.message ?? ''}`.slice(0, 160)),
    );
  };

  for (const theme of ['light', 'dark'] as const) {
    test(`tema ${theme}`, async () => {
      const l = await launch({ 'a.md': '# Título\n\nTexto.\n' });
      await waitForEditor(l.page);
      await l.page.keyboard.press('Control+,');
      await l.page.getByTestId('settings-tab-appearance').click();
      await l.page.getByTestId('set-theme').selectOption(theme);
      await l.page.getByTestId('settings-tab-general').click();
      expect(await contrast(l.page), 'ajustes').toEqual([]);
      await l.page.keyboard.press('Escape');
      expect(await contrast(l.page), 'editor').toEqual([]);
      await l.app.close();
    });
  }
});
