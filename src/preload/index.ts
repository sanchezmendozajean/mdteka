import { contextBridge, ipcRenderer } from 'electron';
import { ipcEvents, type IpcChannel, type MdtecaApi } from '@shared/ipc';

const invoke = <T>(channel: IpcChannel, payload?: unknown) =>
  ipcRenderer.invoke(channel, payload) as Promise<T>;

const api: MdtecaApi = {
  app: {
    info: () => invoke('app:info'),
    launchPaths: () => invoke('app:launchPaths'),
    closeNow: () => invoke('app:closeNow'),
  },
  file: {
    openDialog: () => invoke('file:openDialog'),
    saveDialog: (defaultName) => invoke('file:saveDialog', { defaultName }),
    read: async (path) => (await invoke<{ content: string }>('file:read', { path })).content,
    write: (path, content) => invoke('file:write', { path, content }),
    watch: (path) => invoke('file:watch', { path }),
    unwatch: (path) => invoke('file:unwatch', { path }),
  },
  edit: { action: (action) => invoke('edit:action', { action }) },
  clipboard: { readText: () => invoke('clipboard:readText') },
  shell: { openExternal: (url) => invoke('shell:openExternal', { url }) },
  on(event, callback) {
    if (!(ipcEvents as readonly string[]).includes(event))
      throw new Error(`Evento no permitido: ${event}`);
    const listener = (_e: unknown, payload: unknown) => callback(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
};

contextBridge.exposeInMainWorld('mdteca', api);
