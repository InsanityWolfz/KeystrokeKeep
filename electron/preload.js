// Exposes a tiny, explicit bridge to the page. No Node access leaks into the renderer.
const { contextBridge, ipcRenderer } = require('electron');

const capArg = process.argv.find((x) => x.startsWith('--kk-capture='));
let capture = null;
try { if (capArg) capture = JSON.parse(decodeURIComponent(capArg.slice(13))); } catch (e) { capture = null; }

contextBridge.exposeInMainWorld('kkNative', {
  capture,
  onCapture: (cb) => ipcRenderer.on('kk:capture', (_e, d) => cb(+d)),
  mark: (v) => ipcRenderer.send('kk:mark', String(v)),
  captureJs: (code) => ipcRenderer.send('kk:captureJs', String(code)),
  demo: process.argv.includes('--kk-demo'),
  onActivity: (cb) => ipcRenderer.on('kk:activity', (_e, kind) => cb(kind === 'click' ? 'click' : 'key')),
  onSetting: (cb) => ipcRenderer.on('kk:setting', (_e, s) => cb(s && typeof s.k === 'string' ? { k: s.k, v: s.v } : null)),
  onPower: (cb) => ipcRenderer.on('kk:power', (_e, p) => cb(p === 'off' ? 'off' : 'on')),
  onBattery: (cb) => ipcRenderer.on('kk:battery', (_e, b) => cb(!!b)),
  setHeight: (h) => ipcRenderer.send('kk:height', h),
  ignoreMouse: (ignore) => ipcRenderer.send('kk:ignoreMouse', !!ignore),
  onCursor: (cb) => ipcRenderer.on('kk:cursor', (_e, p) => cb(p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: +p.x, y: +p.y } : null)),
  setTrayIcon: (dataURL) => ipcRenderer.send('kk:tray', dataURL),
  syncSettings: (s) => ipcRenderer.send('kk:settings', s),
  quit: () => ipcRenderer.send('kk:quit'),
  openStore: (url) => ipcRenderer.send('kk:openStore', String(url)),
  // save file (JSON text only; main validates and writes it atomically)
  loadFile: () => ipcRenderer.sendSync('kk:loadSave'),
  saveFile: (json) => ipcRenderer.send('kk:save', String(json)),
  saveFileSync: (json) => ipcRenderer.sendSync('kk:saveSync', String(json)),
  wipeFile: () => ipcRenderer.sendSync('kk:wipeSave'),
  saveInfo: () => ipcRenderer.sendSync('kk:saveInfo'),
});
