import { contextBridge, ipcRenderer } from 'electron';
import type { MdtecaApi } from '@shared/ipc';

const api: MdtecaApi = {
  app: { info: () => ipcRenderer.invoke('app:info') },
};

contextBridge.exposeInMainWorld('mdteca', api);
