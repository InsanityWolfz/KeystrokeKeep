// Exposes a tiny, explicit bridge to the page. No Node access leaks into the renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kkNative', {
  onActivity: (cb) => ipcRenderer.on('kk:activity', (_e, kind) => cb(kind === 'click' ? 'click' : 'key')),
  setHeight: (h) => ipcRenderer.send('kk:height', h),
  ignoreMouse: (ignore) => ipcRenderer.send('kk:ignoreMouse', !!ignore),
  setTrayIcon: (dataURL) => ipcRenderer.send('kk:tray', dataURL),
  quit: () => ipcRenderer.send('kk:quit'),
});
