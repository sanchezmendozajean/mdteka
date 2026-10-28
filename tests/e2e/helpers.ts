import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export interface Launched {
  userData: string;
  app: ElectronApplication;
  page: Page;
  dir: string;
  files: string[];
}

/** Crea archivos en un directorio temporal y lanza MDTor abriéndolos (como la asociación de archivos). */
export async function launch(
  files: Record<string, string | Buffer> = {},
  reuse?: { dir: string; userData: string },
  /** Nombres de los archivos que se pasan por línea de comandos (por defecto, todos). */
  opening?: string[],
  /** Variables de entorno extra (diálogos nativos simulados). */
  extraEnv: Record<string, string> = {},
): Promise<Launched> {
  const dir = reuse?.dir ?? mkdtempSync(join(realpathSync.native(tmpdir()), 'mdtor-e2e-'));
  const userData =
    reuse?.userData ?? mkdtempSync(join(realpathSync.native(tmpdir()), 'mdtor-ud-'));
  const all = Object.entries(files).map(([name, content]) => {
    const path = join(dir, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    return [name, path] as const;
  });
  const paths = all.filter(([name]) => !opening || opening.includes(name)).map(([, path]) => path);
  // VS Code define ELECTRON_RUN_AS_NODE=1, lo que impediría arrancar Electron como app.
  const env = {
    ...process.env,
    MDTOR_E2E: '1',
    MDTOR_USER_DATA: userData,
    ...extraEnv,
  } as Record<string, string>;
  delete env['ELECTRON_RUN_AS_NODE'];
  const app = await electron.launch({ args: ['.', ...paths], cwd: process.cwd(), env });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app"]');
  return { app, page, dir, files: paths, userData };
}

export async function waitForEditor(page: Page): Promise<void> {
  await page.waitForSelector('.ProseMirror', { state: 'visible' });
}

/** Markdown actual del documento activo según el controlador. */
export function source(page: Page): Promise<string> {
  return page.evaluate(() =>
    (
      window as unknown as { __mdtor: { editor: { getSource(): string } } }
    ).__mdtor.editor.getSource(),
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
