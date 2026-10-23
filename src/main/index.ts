import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  net,
  protocol,
  session,
  shell,
} from 'electron';
import { dirname, join } from 'node:path';
import { ipcContract, type IpcChannel, type IpcEvent } from '@shared/ipc';
import { buildCsp } from './csp';
import {
  closeAllWatchers,
  grant,
  isInDocDir,
  pathsFromArgv,
  readText,
  unwatchFile,
  watchFile,
  writeBytesAtomic,
  writeTextAtomic,
} from './files';
import { embedFontFaces } from './fonts';
import {
  assetResponse,
  copyImagesFor,
  downloadImage,
  IMAGE_TYPES,
  importImage,
  readImageFile,
  nextImageName,
  readImage,
  saveImage,
} from './images';
import { isSafeExternalUrl } from './security';
import { loadSettings, saveDocumentDefaults } from './settings';
import { getViewState, setViewState } from './state';

const isDev = !app.isPackaged && !!process.env['ELECTRON_RENDERER_URL'];
const e2e = process.env['MDTECA_E2E'] === '1';
// Las pruebas E2E usan un userData propio para no tocar los ajustes reales.
if (process.env['MDTECA_USER_DATA']) app.setPath('userData', process.env['MDTECA_USER_DATA']);

let mainWindow: BrowserWindow | null = null;
let allowClose = false;
const pendingPaths: string[] = pathsFromArgv(process.argv);

const send = (event: IpcEvent, payload?: unknown) => mainWindow?.webContents.send(event, payload);

type Handler = (req: never) => unknown | Promise<unknown>;

/** Registra un manejador validando petición y respuesta con el esquema del canal. */
function handle<C extends IpcChannel>(channel: C, fn: Handler): void {
  const schema = ipcContract[channel];
  ipcMain.handle(channel, async (_event, raw) =>
    schema.response.parse(await fn(schema.request.parse(raw) as never)),
  );
}

function registerIpc(): void {
  handle('app:info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    platform: process.platform as 'win32' | 'darwin' | 'linux',
    e2e,
  }));
  handle('app:launchPaths', () => pendingPaths.splice(0));
  handle('app:closeNow', () => {
    allowClose = true;
    mainWindow?.close();
  });
  handle('file:openDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown'] },
        { name: 'Texto', extensions: ['txt'] },
      ],
    });
    return result.canceled ? [] : result.filePaths.map((p) => grant(p));
  });
  handle('file:saveDialog', async (req: { defaultName: string; kind?: 'md' | 'pdf' | 'html' }) => {
    // Las pruebas E2E indican la ruta por variable de entorno (el diálogo nativo no es automatizable).
    const forced = process.env['MDTECA_E2E_SAVE_PATH'];
    if (e2e && forced) return grant(forced);
    const kind = req.kind ?? 'md';
    const filters = {
      md: [{ name: 'Markdown', extensions: ['md'] }],
      pdf: [{ name: 'PDF', extensions: ['pdf'] }],
      html: [{ name: 'HTML', extensions: ['html'] }],
    }[kind];
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: req.defaultName,
      filters,
    });
    return result.canceled || !result.filePath ? null : grant(result.filePath);
  });
  handle('file:read', async (req: { path: string }) => ({ content: await readText(req.path) }));
  handle('file:write', async (req: { path: string; content: string }) => {
    await writeTextAtomic(req.path, req.content);
  });
  handle('file:watch', (req: { path: string }) => {
    watchFile(req.path, (path) => send('file:changed', { path }));
  });
  handle('file:unwatch', async (req: { path: string }) => {
    await unwatchFile(req.path);
  });
  handle('edit:action', (req: { action: 'cut' | 'copy' | 'paste' | 'pastePlain' }) => {
    const wc = mainWindow?.webContents;
    if (!wc) return;
    if (req.action === 'cut') wc.cut();
    else if (req.action === 'copy') wc.copy();
    else if (req.action === 'paste') wc.paste();
    else wc.pasteAndMatchStyle();
  });
  handle('clipboard:readText', () => clipboard.readText());
  handle('export:pdf', async (req: { path: string }) => {
    const wc = mainWindow?.webContents;
    if (!wc) return;
    const data = await wc.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      generateDocumentOutline: true,
      generateTaggedPDF: true,
    });
    await writeBytesAtomic(req.path, data);
  });
  handle(
    'export:print',
    () =>
      new Promise<void>((resolve) => {
        const wc = mainWindow?.webContents;
        if (!wc) return resolve();
        wc.print({ silent: false, printBackground: true }, () => resolve());
      }),
  );
  handle('export:fonts', (req: { families: string[] }) =>
    embedFontFaces(join(__dirname, '../renderer/assets'), req.families),
  );
  handle('state:getView', (req: { path: string }) => ({
    zoom: getViewState(req.path)?.zoom ?? null,
  }));
  handle('state:setView', (req: { path: string; zoom: number }) => {
    setViewState(req.path, { zoom: req.zoom });
  });
  handle(
    'image:save',
    async (req: { docPath: string; data: string; ext: string; name?: string }) => ({
      name: await saveImage(req.docPath, req.data, req.ext, req.name),
    }),
  );
  handle('image:nextName', async (req: { docPath: string; ext: string }) => ({
    name: await nextImageName(grant(req.docPath), req.ext),
  }));
  handle('image:import', async (req: { docPath: string; srcPath: string }) => ({
    rel: await importImage(req.docPath, req.srcPath),
  }));
  handle('image:pick', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Imágenes', extensions: Object.keys(IMAGE_TYPES) }],
    });
    return result.canceled ? [] : result.filePaths;
  });
  handle('image:readFile', async (req: { path: string }) => readImageFile(req.path));
  handle('image:download', async (req: { docPath: string; url: string }) => ({
    name: await downloadImage(req.docPath, req.url, (u) => net.fetch(u)),
  }));
  handle('image:read', async (req: { docPath: string; rel: string }) =>
    readImage(req.docPath, req.rel),
  );
  handle('image:clipboard', async () => {
    // API asíncrona del portapapeles (Electron ≥ 40): la imagen llega como Blob.
    for (const item of await clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (!type) continue;
      const blob = (await item.getType(type)) as Blob;
      const ext = Object.entries(IMAGE_TYPES).find(([, mime]) => mime === type)?.[0] ?? 'png';
      return { data: Buffer.from(await blob.arrayBuffer()).toString('base64'), ext };
    }
    return { data: null, ext: 'png' };
  });
  handle('image:showInFolder', (req: { docPath: string; rel: string }) => {
    const full = join(dirname(grant(req.docPath)), req.rel);
    if (isInDocDir(full)) shell.showItemInFolder(full);
  });
  handle('export:images', async (req: { docPath: string; htmlPath: string; names: string[] }) => ({
    folder: await copyImagesFor(req.docPath, req.htmlPath, req.names),
  }));
  handle('settings:get', () => loadSettings());
  handle('settings:setDocumentDefaults', (req: { documentDefaults: Record<string, unknown> }) =>
    saveDocumentDefaults(req.documentDefaults),
  );
  handle('shell:openExternal', async (req: { url: string }) => {
    if (isSafeExternalUrl(req.url)) await shell.openExternal(req.url);
  });
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: '#5B5750', height: 40 },
    backgroundColor: '#F3F2EF',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault();
  });
  // Cerrar la ventana pasa por el renderer, que avisa de cambios sin guardar.
  win.on('close', (e) => {
    if (allowClose) return;
    e.preventDefault();
    send('app:beforeClose');
  });
  win.on('closed', () => {
    mainWindow = null;
  });
  if (isDev) void win.loadURL(process.env['ELECTRON_RENDERER_URL']!);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
  return win;
}

// El esquema debe registrarse antes de que la app esté lista.
protocol.registerSchemesAsPrivileged([
  { scheme: 'mdteca-asset', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const paths = pathsFromArgv(argv);
    if (paths.length) send('app:openPaths', paths);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.on('before-quit', () => {
    allowClose = true;
    void closeAllWatchers();
  });
  void app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [buildCsp(isDev)],
        },
      });
    });
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    protocol.handle('mdteca-asset', (request) => assetResponse(request.url));
    registerIpc();
    mainWindow = createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
