// Keystroke Keep — Electron shell: a frameless, transparent, always-on-top strip docked
// to the bottom of the primary display, plus global input *counting* via uiohook-napi.
// Privacy: we only forward the words "key" / "click". Key codes are used in-memory to
// ignore auto-repeat and are never stored, logged or sent anywhere.
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let win = null;
let tray = null;
let hookStarted = false;
let desiredH = 192;
let paused = false;

function dockBounds(height) {
  const { workArea } = screen.getPrimaryDisplay();
  const h = Math.min(Math.max(80, Math.round(height)), workArea.height);
  return { x: workArea.x, y: workArea.y + workArea.height - h, width: workArea.width, height: h };
}

function createWindow() {
  win = new BrowserWindow({
    ...dockBounds(desiredH),
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    title: 'Keystroke Keep',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.on('closed', () => { win = null; });
  // keep it docked if the screen layout changes
  screen.on('display-metrics-changed', () => win && win.setBounds(dockBounds(desiredH)));
}

function startHook() {
  if (hookStarted) return;
  let uIOhook;
  try {
    ({ uIOhook } = require('uiohook-napi'));
  } catch (e) {
    console.warn('[KK] uiohook-napi not available, global input disabled:', e.message);
    return;
  }
  const down = new Set();
  const send = (kind) => { if (!paused && win && !win.isDestroyed()) win.webContents.send('kk:activity', kind); };
  uIOhook.on('keydown', (e) => {
    if (down.has(e.keycode)) return; // auto-repeat
    down.add(e.keycode);
    send('key');
  });
  uIOhook.on('keyup', (e) => { down.delete(e.keycode); });
  uIOhook.on('mousedown', () => send('click'));
  uIOhook.start();
  hookStarted = true;
  app.on('will-quit', () => { try { uIOhook.stop(); } catch (e) { /* ignore */ } });
}

function buildTray(iconDataURL) {
  if (tray) return;
  const img = nativeImage.createFromDataURL(iconDataURL).resize({ width: 16, height: 16, quality: 'best' });
  tray = new Tray(img);
  tray.setToolTip('Keystroke Keep');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Keystroke Keep', enabled: false },
    { type: 'separator' },
    { label: paused ? 'Resume counting input' : 'Pause counting input', click: () => { paused = !paused; tray.setContextMenu(menu()); } },
    { label: 'Show / hide strip', click: () => { if (!win) return; win.isVisible() ? win.hide() : win.showInactive(); } },
    { label: 'Open dev tools', click: () => win && win.webContents.openDevTools({ mode: 'detach' }) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu());
  tray.on('click', () => { if (win) (win.isVisible() ? win.hide() : win.showInactive()); });
}

ipcMain.on('kk:height', (_e, h) => {
  if (!win || Math.abs(h - desiredH) < 1) return;
  desiredH = h;
  win.setBounds(dockBounds(h));
});
ipcMain.on('kk:ignoreMouse', (_e, ignore) => {
  if (win) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
ipcMain.on('kk:tray', (_e, dataURL) => buildTray(dataURL));
ipcMain.on('kk:quit', () => app.quit());

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.whenReady().then(() => {
    createWindow();
    // KK_SNAPSHOT=out.png: self-test mode. Captures the strip after a few seconds and quits
    // (no input hook), so the build can be verified headlessly.
    if (process.env.KK_SNAPSHOT) {
      win.webContents.on('console-message', (e, _level, msg) => console.log('[renderer]', e && e.message !== undefined ? e.message : msg));
      if (process.env.KK_SNAPSHOT_JS) setTimeout(() => win.webContents.executeJavaScript(process.env.KK_SNAPSHOT_JS).catch((e) => console.log('[KK] js error', e.message)), 2500);
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(process.env.KK_SNAPSHOT, img.toPNG());
        console.log('[KK] snapshot saved', win.getBounds());
        app.quit();
      }, +(process.env.KK_SNAPSHOT_DELAY || 6000));
      return;
    }
    startHook();
  });
  app.on('window-all-closed', () => app.quit());
}
