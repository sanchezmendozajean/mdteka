import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface Launched {
  app: ElectronApplication;
  page: Page;
  dir: string;
  files: string[];
}

/** Crea archivos en un directorio temporal y lanza MDteca abriéndolos (como la asociación de archivos). */
export async function launch(files: Record<string, string | Buffer> = {}): Promise<Launched> {
  const dir = mkdtempSync(join(realpathSync.native(tmpdir()), 'mdteca-e2e-'));
  const paths = Object.entries(files).map(([name, content]) => {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  });
  // VS Code define ELECTRON_RUN_AS_NODE=1, lo que impediría arrancar Electron como app.
  const env = { ...process.env, MDTECA_E2E: '1' } as Record<string, string>;
  delete env['ELECTRON_RUN_AS_NODE'];
  const app = await electron.launch({ args: ['.', ...paths], cwd: process.cwd(), env });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app"]');
  return { app, page, dir, files: paths };
}

export async function waitForEditor(page: Page): Promise<void> {
  await page.waitForSelector('.ProseMirror', { state: 'visible' });
}

/** Markdown actual del documento activo según el controlador. */
export function source(page: Page): Promise<string> {
  return page.evaluate(() =>
    (
      window as unknown as { __mdteca: { editor: { getSource(): string } } }
    ).__mdteca.editor.getSource(),
  );
}

export const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

/** Guarda con el atajo y espera a que termine la escritura (el guardado es asíncrono). */
export async function save(page: Page): Promise<void> {
  await page.keyboard.press(`${mod}+s`);
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="dirty-dot"]').length === 0,
  );
  await page.waitForTimeout(150);
}

/** Extiende la selección carácter a carácter con una pausa, como el autorepetir real del teclado. */
export async function extendSelection(
  page: Page,
  key: 'Shift+ArrowLeft' | 'Shift+ArrowRight',
  count: number,
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(40);
  }
}

/**
 * Pulsa una tecla de navegación y espera a que ProseMirror procese el `selectionchange`.
 * Las teclas de CDP llegan en pocos ms; una persona tarda mucho más entre dos pulsaciones.
 */
export async function navigate(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}
