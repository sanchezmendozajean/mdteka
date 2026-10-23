import { z } from 'zod';
import { SettingsSchema } from './settings';

const path = z.string().min(1).max(4096);

/** Contrato IPC único: cada canal declara el esquema de su petición y respuesta. */
export const ipcContract = {
  'app:info': {
    request: z.undefined(),
    response: z.object({
      name: z.string(),
      version: z.string(),
      platform: z.enum(['win32', 'darwin', 'linux']),
      e2e: z.boolean(),
    }),
  },
  /** Archivos pasados por línea de comandos o por asociación de archivos al arrancar. */
  'app:launchPaths': { request: z.undefined(), response: z.array(path) },
  'app:closeNow': { request: z.undefined(), response: z.undefined() },
  'file:openDialog': { request: z.undefined(), response: z.array(path) },
  'file:saveDialog': {
    request: z.object({
      defaultName: z.string().max(260),
      kind: z.enum(['md', 'pdf', 'html']).optional(),
    }),
    response: path.nullable(),
  },
  'file:read': { request: z.object({ path }), response: z.object({ content: z.string() }) },
  'file:write': {
    request: z.object({ path, content: z.string() }),
    response: z.undefined(),
  },
  'file:watch': { request: z.object({ path }), response: z.undefined() },
  'file:unwatch': { request: z.object({ path }), response: z.undefined() },
  'edit:action': {
    request: z.object({ action: z.enum(['cut', 'copy', 'paste', 'pastePlain']) }),
    response: z.undefined(),
  },
  'clipboard:readText': { request: z.undefined(), response: z.string() },
  'clipboard:writeText': {
    request: z.object({ text: z.string().max(100000) }),
    response: z.undefined(),
  },
  /** Genera un PDF de la ventana (la vista de impresión ya está montada) y lo guarda. */
  'export:pdf': {
    request: z.object({ path }),
    response: z.undefined(),
  },
  /** Abre el diálogo de impresión del sistema con la vista de impresión montada. */
  'export:print': { request: z.undefined(), response: z.undefined() },
  /** CSS `@font-face` con las fuentes empaquetadas pedidas, incrustadas en base64. */
  'export:fonts': {
    request: z.object({ families: z.array(z.string().max(120)).max(20) }),
    response: z.string(),
  },
  'state:getView': {
    request: z.object({ path }),
    response: z.object({ zoom: z.number().min(0.5).max(3).nullable() }),
  },
  'state:setView': {
    request: z.object({ path, zoom: z.number().min(0.5).max(3) }),
    response: z.undefined(),
  },
  /** Guarda bytes (base64) como `<doc>.NNN.<ext>` junto al documento. */
  'image:save': {
    request: z.object({
      docPath: path,
      data: z.string().max(90_000_000),
      ext: z.string().max(8),
      name: z.string().max(200).optional(),
    }),
    response: z.object({ name: z.string() }),
  },
  /** Nombre que recibiría la próxima imagen del documento (se muestra en el diálogo). */
  'image:nextName': {
    request: z.object({ docPath: path, ext: z.string().max(8) }),
    response: z.object({ name: z.string() }),
  },
  /** Copia (o solo enlaza si ya está en la carpeta del documento) un archivo de imagen. */
  'image:import': {
    request: z.object({ docPath: path, srcPath: path }),
    response: z.object({ rel: z.string() }),
  },
  'image:pick': { request: z.undefined(), response: z.array(path) },
  /** Bytes de un archivo de imagen elegido por el usuario (selector o arrastre). */
  'image:readFile': {
    request: z.object({ path }),
    response: z.object({ mime: z.string(), data: z.string() }),
  },
  /** Descarga una imagen remota junto al documento («Guardar localmente», IMG-12). */
  'image:download': {
    request: z.object({ docPath: path, url: z.string().max(4096) }),
    response: z.object({ name: z.string() }),
  },
  'image:read': {
    request: z.object({ docPath: path, rel: z.string().max(1024) }),
    response: z.object({ mime: z.string(), data: z.string() }),
  },
  'image:clipboard': {
    request: z.undefined(),
    response: z.object({ data: z.string().nullable(), ext: z.string() }),
  },
  'image:showInFolder': {
    request: z.object({ docPath: path, rel: z.string().max(1024) }),
    response: z.undefined(),
  },
  'export:images': {
    request: z.object({
      docPath: path,
      htmlPath: path,
      names: z.array(z.string().max(1024)).max(500),
    }),
    response: z.object({ folder: z.string() }),
  },
  // ---- Proyectos (05) ----
  'project:openDialog': { request: z.undefined(), response: path.nullable() },
  'project:folderDialog': { request: z.undefined(), response: path.nullable() },
  /** Concede la carpeta de un documento abierto para crear en ella un proyecto. */
  'project:grantFolder': { request: z.object({ folder: path }), response: path },
  /** Lee el .mdteca y concede la carpeta del proyecto. */
  'project:load': {
    request: z.object({ path }),
    response: z.object({ path, root: path, text: z.string() }),
  },
  'project:save': { request: z.object({ path, text: z.string() }), response: z.undefined() },
  'project:scan': {
    request: z.object({ root: path, ignore: z.array(z.string().max(300)).max(200) }),
    response: z.array(z.string()),
  },
  /** Archivos .mdteca de la carpeta del documento o de las superiores. */
  'project:find': { request: z.object({ docPath: path }), response: z.array(path) },
  /** Existencia y primer título de cada archivo indexado. */
  'project:inspect': {
    request: z.object({ root: path, files: z.array(z.string().max(1024)).max(5000) }),
    response: z.record(z.string(), z.object({ exists: z.boolean(), h1: z.string().optional() })),
  },
  'project:search': {
    request: z.object({
      root: path,
      files: z.array(z.string().max(1024)).max(5000),
      query: z.string().max(500),
      caseSensitive: z.boolean(),
      wholeWord: z.boolean(),
      regex: z.boolean(),
    }),
    response: z.array(
      z.object({
        file: z.string(),
        n: z.number(),
        line: z.number(),
        text: z.string(),
        from: z.number(),
        to: z.number(),
      }),
    ),
  },
  'project:createFile': {
    request: z.object({ path, content: z.string() }),
    response: z.undefined(),
  },
  'project:move': {
    request: z.object({ from: path, to: path }),
    response: z.object({ images: z.number(), links: z.number() }),
  },
  'project:duplicate': { request: z.object({ from: path, to: path }), response: z.undefined() },
  'project:trash': { request: z.object({ path }), response: z.undefined() },
  'project:reveal': { request: z.object({ path }), response: z.undefined() },
  'project:orphans': { request: z.object({ docPath: path }), response: z.array(path) },
  'state:getProject': {
    request: z.object({ path }),
    response: z.object({
      expanded: z.array(z.string()),
      open: z.array(z.string()),
      active: z.string().nullable(),
    }),
  },
  'state:setProject': {
    request: z.object({
      path,
      expanded: z.array(z.string().max(200)).max(5000),
      open: z.array(z.string().max(1024)).max(200),
      active: z.string().max(1024).nullable(),
    }),
    response: z.undefined(),
  },
  'settings:get': { request: z.undefined(), response: SettingsSchema },
  /** Aplica un parche a los ajustes (se valida y se guarda en main). */
  'settings:set': {
    request: z.object({ patch: z.record(z.string(), z.unknown()) }),
    response: SettingsSchema,
  },
  'settings:reset': { request: z.undefined(), response: SettingsSchema },
  'settings:setDocumentDefaults': {
    request: z.object({ documentDefaults: z.record(z.string(), z.unknown()) }),
    response: SettingsSchema,
  },
  'recovery:write': {
    request: z.object({
      id: z.string().max(80),
      path: path.nullable(),
      name: z.string().max(260),
      content: z.string(),
    }),
    response: z.undefined(),
  },
  'recovery:clear': { request: z.object({ id: z.string().max(80) }), response: z.undefined() },
  'recovery:clearAll': { request: z.undefined(), response: z.undefined() },
  'recovery:list': {
    request: z.undefined(),
    response: z.array(
      z.object({
        id: z.string(),
        path: z.string().nullable(),
        name: z.string(),
        content: z.string(),
        savedAt: z.number(),
      }),
    ),
  },
  /** Último proyecto abierto (Ajustes › Al iniciar). Se concede al leerlo. */
  'state:getLastProject': { request: z.undefined(), response: path.nullable() },
  'state:setLastProject': { request: z.object({ path: path.nullable() }), response: z.undefined() },
  /** Idiomas del corrector ortográfico y su estado (Chromium). */
  'spell:configure': {
    request: z.object({ enabled: z.boolean(), languages: z.array(z.string().max(16)).max(8) }),
    response: z.object({ available: z.array(z.string()) }),
  },
  'window:setFullScreen': { request: z.object({ on: z.boolean() }), response: z.undefined() },
  /** Abre «Aplicaciones predeterminadas» de Windows para asociar .md y .mdteca. */
  'app:openDefaultApps': { request: z.undefined(), response: z.undefined() },
  'shell:openExternal': {
    request: z.object({ url: z.string().max(4096) }),
    response: z.undefined(),
  },
} as const;

export type IpcChannel = keyof typeof ipcContract;
export type IpcRequest<C extends IpcChannel> = z.infer<(typeof ipcContract)[C]['request']>;
export type IpcResponse<C extends IpcChannel> = z.infer<(typeof ipcContract)[C]['response']>;

/** Eventos de main hacia el renderer. */
export const ipcEvents = ['file:changed', 'app:openPaths', 'app:beforeClose'] as const;
export type IpcEvent = (typeof ipcEvents)[number];

/** API expuesta en `window.mdteca` por el preload. */
export interface MdtecaApi {
  app: {
    info(): Promise<IpcResponse<'app:info'>>;
    launchPaths(): Promise<string[]>;
    closeNow(): Promise<void>;
  };
  file: {
    openDialog(): Promise<string[]>;
    saveDialog(defaultName: string, kind?: 'md' | 'pdf' | 'html'): Promise<string | null>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    watch(path: string): Promise<void>;
    unwatch(path: string): Promise<void>;
  };
  edit: { action(action: 'cut' | 'copy' | 'paste' | 'pastePlain'): Promise<void> };
  clipboard: { readText(): Promise<string>; writeText(text: string): Promise<void> };
  export: {
    pdf(path: string): Promise<void>;
    print(): Promise<void>;
    fonts(families: string[]): Promise<string>;
  };
  state: {
    getView(path: string): Promise<{ zoom: number | null }>;
    setView(path: string, zoom: number): Promise<void>;
  };
  image: {
    save(docPath: string, data: string, ext: string, name?: string): Promise<{ name: string }>;
    nextName(docPath: string, ext: string): Promise<{ name: string }>;
    importFile(docPath: string, srcPath: string): Promise<{ rel: string }>;
    pick(): Promise<string[]>;
    readFile(path: string): Promise<{ mime: string; data: string }>;
    download(docPath: string, url: string): Promise<{ name: string }>;
    read(docPath: string, rel: string): Promise<{ mime: string; data: string }>;
    clipboard(): Promise<{ data: string | null; ext: string }>;
    showInFolder(docPath: string, rel: string): Promise<void>;
    copyForExport(docPath: string, htmlPath: string, names: string[]): Promise<{ folder: string }>;
    /** Ruta de un archivo arrastrado al editor. */
    pathOf(file: File): string;
  };
  project: {
    openDialog(): Promise<string | null>;
    folderDialog(): Promise<string | null>;
    grantFolder(folder: string): Promise<string>;
    load(path: string): Promise<IpcResponse<'project:load'>>;
    save(path: string, text: string): Promise<void>;
    scan(root: string, ignore: string[]): Promise<string[]>;
    find(docPath: string): Promise<string[]>;
    inspect(root: string, files: string[]): Promise<IpcResponse<'project:inspect'>>;
    search(req: IpcRequest<'project:search'>): Promise<IpcResponse<'project:search'>>;
    createFile(path: string, content: string): Promise<void>;
    move(from: string, to: string): Promise<IpcResponse<'project:move'>>;
    duplicate(from: string, to: string): Promise<void>;
    trash(path: string): Promise<void>;
    reveal(path: string): Promise<void>;
    orphans(docPath: string): Promise<string[]>;
    getState(path: string): Promise<IpcResponse<'state:getProject'>>;
    setState(req: IpcRequest<'state:setProject'>): Promise<void>;
  };
  settings: {
    get(): Promise<IpcResponse<'settings:get'>>;
    set(patch: Record<string, unknown>): Promise<IpcResponse<'settings:set'>>;
    reset(): Promise<IpcResponse<'settings:reset'>>;
    setDocumentDefaults(
      documentDefaults: Record<string, unknown>,
    ): Promise<IpcResponse<'settings:setDocumentDefaults'>>;
  };
  recovery: {
    write(id: string, path: string | null, name: string, content: string): Promise<void>;
    clear(id: string): Promise<void>;
    clearAll(): Promise<void>;
    list(): Promise<IpcResponse<'recovery:list'>>;
  };
  lastProject: { get(): Promise<string | null>; set(path: string | null): Promise<void> };
  spell: { configure(enabled: boolean, languages: string[]): Promise<string[]> };
  window: { setFullScreen(on: boolean): Promise<void> };
  appUi: {
    openDefaultApps(): Promise<void>;
    /** Escala de toda la interfaz (zoom del navegador, independiente del zoom del documento). */
    setScale(factor: number): void;
  };
  shell: { openExternal(url: string): Promise<void> };
  on(event: IpcEvent, callback: (payload: unknown) => void): () => void;
}
