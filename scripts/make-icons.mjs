/**
 * Genera los iconos de la app a partir de `specs/design/icono.svg`:
 *   build/icon.png (512 px) y build/icon.ico (16–256 px, entradas PNG).
 * Rasteriza el SVG con el Chromium de Electron: `npm run icons`. Lanzado con Node, se vuelve a
 * lanzar con Electron (sin ELECTRON_RUN_AS_NODE, que define VS Code).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import electron from 'electron';

const self = fileURLToPath(import.meta.url);
if (typeof electron === 'string') {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const r = spawnSync(electron, [self], { stdio: 'inherit', env });
  process.exit(r.status ?? 1);
}
const { app, BrowserWindow } = electron;

const root = join(dirname(self), '..');
const svg = readFileSync(join(root, 'specs/design/icono.svg'), 'utf8');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Contenedor ICO con imágenes PNG (Windows Vista en adelante). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<!doctype html><title>icons</title>');
  const render = (size) =>
    win.webContents.executeJavaScript(`(async () => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}';
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = ${size};
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, ${size}, ${size});
      return c.toDataURL('image/png');
    })()`);
  const png = async (size) => Buffer.from((await render(size)).split(',')[1], 'base64');

  const out = join(root, 'build');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'icon.png'), await png(512));
  const images = [];
  for (const size of ICO_SIZES) images.push({ size, png: await png(size) });
  writeFileSync(join(out, 'icon.ico'), ico(images));
  console.log('build/icon.png y build/icon.ico generados');
  app.quit();
});
