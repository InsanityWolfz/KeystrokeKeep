// Exposes a tiny, explicit bridge to the page. No Node access leaks into the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kkNative', {
  demo: process.argv.includes('--kk-demo'),
  onActivity: (cb) => ipcRenderer.on('kk:activity', (_e, kind) => cb(kind === 'click' ? 'click' : 'key')),
  onSetting: (cb) => ipcRenderer.on('kk:setting', (_e, s) => cb(s && typeof s.k === 'string' ? { k: s.k, v: s.v } : null)),
  onPower: (cb) => ipcRenderer.on('kk:power', (_e, p) => cb(p === 'off' ? 'off' : 'on')),
  onBattery: (cb) => ipcRenderer.on('kk:battery', (_e, b) => cb(!!b)),
  setHeight: (h) => ipcRenderer.send('kk:height', h),
  ignoreMouse: (ignore) => ipcRenderer.send('kk:ignoreMouse', !!ignore),
  setTrayIcon: (dataURL) => ipcRenderer.send('kk:tray', dataURL),
  syncSettings: (s) => ipcRenderer.send('kk:settings', s),
  quit: () => ipcRenderer.send('kk:quit'),
  openStore: (url) => ipcRenderer.send('kk:openStore', String(url)),
  // save file (JSON text only; main validates and writes it atomically)
  loadFile: () => ipcRenderer.sendSync('kk:loadSave'),
  saveFile: (json) => ipcRenderer.send('kk:save', String(json)),
  saveFileSync: (json) => ipcRenderer.sendSync('kk:saveSync', String(json)),
  wipeFile: () => ipcRenderer.sendSync('kk:wipeSave'),
});
