import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron';
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
    saveDialog: (defaultName, kind) => invoke('file:saveDialog', { defaultName, kind }),
    read: async (path) => (await invoke<{ content: string }>('file:read', { path })).content,
    write: (path, content) => invoke('file:write', { path, content }),
    watch: (path) => invoke('file:watch', { path }),
    unwatch: (path) => invoke('file:unwatch', { path }),
  },
  edit: { action: (action) => invoke('edit:action', { action }) },
  clipboard: {
    readText: () => invoke('clipboard:readText'),
    writeText: (text) => invoke('clipboard:writeText', { text }),
  },
  export: {
    pdf: (path) => invoke('export:pdf', { path }),
    print: () => invoke('export:print'),
    fonts: (families) => invoke('export:fonts', { families }),
  },
  state: {
    getView: (path) => invoke('state:getView', { path }),
    setView: (path, zoom) => invoke('state:setView', { path, zoom }),
  },
  image: {
    save: (docPath, data, ext, name) => invoke('image:save', { docPath, data, ext, name }),
    nextName: (docPath, ext) => invoke('image:nextName', { docPath, ext }),
    importFile: (docPath, srcPath) => invoke('image:import', { docPath, srcPath }),
    pick: () => invoke('image:pick'),
    readFile: (path) => invoke('image:readFile', { path }),
    download: (docPath, url) => invoke('image:download', { docPath, url }),
    read: (docPath, rel) => invoke('image:read', { docPath, rel }),
    clipboard: () => invoke('image:clipboard'),
    showInFolder: (docPath, rel) => invoke('image:showInFolder', { docPath, rel }),
    copyForExport: (docPath, htmlPath, names) =>
      invoke('export:images', { docPath, htmlPath, names }),
    pathOf: (file) => webUtils.getPathForFile(file),
  },
  project: {
    openDialog: () => invoke('project:openDialog'),
    folderDialog: () => invoke('project:folderDialog'),
    grantFolder: (folder) => invoke('project:grantFolder', { folder }),
    load: (path) => invoke('project:load', { path }),
    save: (path, text) => invoke('project:save', { path, text }),
    scan: (root, ignore) => invoke('project:scan', { root, ignore }),
    find: (docPath) => invoke('project:find', { docPath }),
    inspect: (root, files) => invoke('project:inspect', { root, files }),
    search: (req) => invoke('project:search', req),
    createFile: (path, content) => invoke('project:createFile', { path, content }),
    move: (from, to) => invoke('project:move', { from, to }),
    duplicate: (from, to) => invoke('project:duplicate', { from, to }),
    trash: (path) => invoke('project:trash', { path }),
    reveal: (path) => invoke('project:reveal', { path }),
    orphans: (docPath) => invoke('project:orphans', { docPath }),
    getState: (path) => invoke('state:getProject', { path }),
    setState: (req) => invoke('state:setProject', req),
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (patch) => invoke('settings:set', { patch }),
    reset: () => invoke('settings:reset'),
    setDocumentDefaults: (documentDefaults) =>
      invoke('settings:setDocumentDefaults', { documentDefaults }),
  },
  recovery: {
    write: (id, path, name, content) => invoke('recovery:write', { id, path, name, content }),
    clear: (id) => invoke('recovery:clear', { id }),
    clearAll: () => invoke('recovery:clearAll'),
    list: () => invoke('recovery:list'),
  },
  lastProject: {
    get: () => invoke('state:getLastProject'),
    set: (path) => invoke('state:setLastProject', { path }),
  },
  spell: {
    configure: async (enabled, languages) =>
      (await invoke<{ available: string[] }>('spell:configure', { enabled, languages })).available,
    replace: (word) => invoke('spell:replace', { word }),
    addWord: (word) => invoke('spell:addWord', { word }),
  },
  window: { setFullScreen: (on) => invoke('window:setFullScreen', { on }) },
  appUi: {
    openDefaultApps: () => invoke('app:openDefaultApps'),
    setScale: (factor) => webFrame.setZoomFactor(factor),
  },
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
