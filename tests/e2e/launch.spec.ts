import { _electron as electron, expect, test } from '@playwright/test';

test('[Fase 0] la ventana abre con el layout vacío y aislamiento activo', async () => {
  // VS Code define ELECTRON_RUN_AS_NODE=1, lo que impediría arrancar Electron como app.
  const env = { ...process.env } as Record<string, string>;
  delete env['ELECTRON_RUN_AS_NODE'];
  const app = await electron.launch({ args: ['.'], cwd: process.cwd(), env });
  const page = await app.firstWindow();

  await expect(page.getByTestId('app')).toBeVisible();
  await expect(page.locator('.ribbon').getByRole('tab')).toHaveCount(7);
  await expect(page.getByTestId('navigator')).toBeVisible();
  await expect(page.getByTestId('document-panel')).toBeVisible();
  await expect(page.getByTestId('statusbar')).toBeVisible();

  // Aislamiento: el renderer no ve Node pero sí la API del preload.
  const probe = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    api: typeof window.mdteca?.app.info,
  }));
  expect(probe).toEqual({ require: 'undefined', process: 'undefined', api: 'function' });
  const info = await page.evaluate(() => window.mdteca.app.info());
  expect(info.name.toLowerCase()).toContain('mdteca');

  // Comando del registro: ocultar navegador.
  await page.getByRole('button', { name: /navegador/i }).click();
  await expect(page.getByTestId('navigator')).toHaveCount(0);

  await app.close();
});
