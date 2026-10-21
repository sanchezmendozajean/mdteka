import { z } from 'zod';

/** Contrato IPC único: cada canal declara el esquema de su petición y respuesta. */
export const ipcContract = {
  'app:info': {
    request: z.undefined(),
    response: z.object({
      name: z.string(),
      version: z.string(),
      platform: z.enum(['win32', 'darwin', 'linux']),
    }),
  },
} as const;

export type IpcChannel = keyof typeof ipcContract;
export type IpcRequest<C extends IpcChannel> = z.infer<(typeof ipcContract)[C]['request']>;
export type IpcResponse<C extends IpcChannel> = z.infer<(typeof ipcContract)[C]['response']>;

/** API expuesta en `window.mdteca` por el preload. */
export interface MdtecaApi {
  app: { info(): Promise<IpcResponse<'app:info'>> };
}
