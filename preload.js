const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qb', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  onWinState: (cb) => ipcRenderer.on('win:state', (_e, max) => cb(max)),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  save: (name, content) => ipcRenderer.invoke('file:save', { name, content }),

  storeAll: () => ipcRenderer.sendSync('store:all'),
  storeSet: (key, value) => ipcRenderer.sendSync('store:set', key, value),

  updGet: () => ipcRenderer.invoke('upd:get'),
  updCheck: () => ipcRenderer.invoke('upd:check'),
  updInstall: () => ipcRenderer.send('upd:install'),
  updReleases: () => ipcRenderer.send('upd:releases'),
  onUpdate: (cb) => ipcRenderer.on('upd:status', (_e, s) => cb(s)),

  applySettings: () => ipcRenderer.send('prefs:apply'),
  onQuickGen: (cb) => ipcRenderer.on('quick:gen', (_e, kind) => cb(kind)),
  notify: (title, body) => ipcRenderer.send('notify', title, body),
});
