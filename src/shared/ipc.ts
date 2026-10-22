import { z } from 'zod';

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
    request: z.object({ defaultName: z.string().max(260) }),
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
  'settings:get': {
    request: z.undefined(),
    response: z.object({ documentDefaults: z.record(z.string(), z.unknown()) }),
  },
  'settings:setDocumentDefaults': {
    request: z.object({ documentDefaults: z.record(z.string(), z.unknown()) }),
    response: z.object({ documentDefaults: z.record(z.string(), z.unknown()) }),
  },
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
    saveDialog(defaultName: string): Promise<string | null>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    watch(path: string): Promise<void>;
    unwatch(path: string): Promise<void>;
  };
  edit: { action(action: 'cut' | 'copy' | 'paste' | 'pastePlain'): Promise<void> };
  clipboard: { readText(): Promise<string> };
  settings: {
    get(): Promise<IpcResponse<'settings:get'>>;
    setDocumentDefaults(
      documentDefaults: Record<string, unknown>,
    ): Promise<IpcResponse<'settings:setDocumentDefaults'>>;
  };
  shell: { openExternal(url: string): Promise<void> };
  on(event: IpcEvent, callback: (payload: unknown) => void): () => void;
}
