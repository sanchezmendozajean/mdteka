import { app, BrowserWindow, clipboard, dialog, ipcMain, session, shell } from 'electron';
import { join } from 'node:path';
import { ipcContract, type IpcChannel, type IpcEvent } from '@shared/ipc';
import { buildCsp } from './csp';
import {
  closeAllWatchers,
  grant,
  pathsFromArgv,
  readText,
  unwatchFile,
  watchFile,
  writeTextAtomic,
} from './files';
import { isSafeExternalUrl } from './security';
import { loadSettings, saveDocumentDefaults } from './settings';

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
  handle('file:saveDialog', async (req: { defaultName: string }) => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: req.defaultName,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
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
