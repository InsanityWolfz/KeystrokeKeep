// Keystroke Keep — Electron shell: a frameless, transparent, always-on-top strip docked
// to the bottom of a display, plus global input *counting* via uiohook-napi.
// Privacy: we only forward the words "key" / "click". Key codes are used in-memory to
// ignore auto-repeat and are never stored, logged or sent anywhere. The app makes no
// network requests at all (blocked below).
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, powerMonitor, globalShortcut, session } = require('electron');
const path = require('path');

let win = null;
let tray = null;
let hookStarted = false;
let desiredH = 192;
// mirrored from the game's saved settings (the renderer is the source of truth)
const state = { countInput: true, sound: true, onTop: true, displayId: null };
const HIDE_HOTKEY = 'Control+Alt+K';

function targetDisplay() {
  const all = screen.getAllDisplays();
  return all.find((d) => d.id === state.displayId) || screen.getPrimaryDisplay();
}
function dockBounds(height) {
  const { workArea } = targetDisplay();
  const h = Math.min(Math.max(80, Math.round(height)), workArea.height);
  return { x: workArea.x, y: workArea.y + workArea.height - h, width: workArea.width, height: h };
}
const send = (ch, v) => { if (win && !win.isDestroyed()) win.webContents.send(ch, v); };

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
    focusable: false, // clicking the strip never steals keyboard focus from your work
    hasShadow: false,
    skipTaskbar: true, // lives in the tray
    show: false,
    backgroundColor: '#00000000',
    title: 'Keystroke Keep',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  applyOnTop();
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', () => win.showInactive());
  win.on('closed', () => { win = null; });
  // keep it docked if the screen layout changes
  screen.on('display-metrics-changed', () => win && win.setBounds(dockBounds(desiredH)));
  screen.on('display-removed', () => win && win.setBounds(dockBounds(desiredH)));
}
function applyOnTop() {
  if (!win) return;
  // 'floating' sits above normal windows but below fullscreen apps and games
  win.setAlwaysOnTop(state.onTop, 'floating');
}
function toggleVisible() {
  if (!win) return;
  if (win.isVisible()) { win.hide(); send('kk:power', 'off'); }
  else { win.showInactive(); send('kk:power', 'on'); }
  rebuildTray();
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
  const fwd = (kind) => { if (state.countInput && win && !win.isDestroyed()) win.webContents.send('kk:activity', kind); };
  uIOhook.on('keydown', (e) => {
    if (down.has(e.keycode)) return; // auto-repeat
    down.add(e.keycode);
    fwd('key');
  });
  uIOhook.on('keyup', (e) => { down.delete(e.keycode); });
  uIOhook.on('mousedown', () => fwd('click'));
  uIOhook.start();
  hookStarted = true;
  app.on('will-quit', () => { try { uIOhook.stop(); } catch (e) { /* ignore */ } });
}

let trayImg = null;
function rebuildTray() {
  if (!tray) return;
  const displays = screen.getAllDisplays();
  const cur = targetDisplay();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Keystroke Keep', enabled: false },
    { type: 'separator' },
    { label: win && win.isVisible() ? `Hide strip  (${HIDE_HOTKEY.replace('Control', 'Ctrl')})` : `Show strip  (${HIDE_HOTKEY.replace('Control', 'Ctrl')})`, click: toggleVisible },
    { label: 'Count keystrokes & clicks', type: 'checkbox', checked: state.countInput, click: (i) => send('kk:setting', { k: 'countInput', v: i.checked }) },
    { label: 'Sound', type: 'checkbox', checked: state.sound, click: (i) => send('kk:setting', { k: 'sound', v: i.checked }) },
    { label: 'Always on top', type: 'checkbox', checked: state.onTop, click: (i) => { state.onTop = i.checked; applyOnTop(); send('kk:setting', { k: 'onTop', v: i.checked }); } },
    ...(displays.length > 1 ? [{
      label: 'Display', submenu: displays.map((d, i) => ({
        label: `Display ${i + 1} (${d.size.width}x${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' · primary' : ''}`,
        type: 'radio', checked: d.id === cur.id,
        click: () => { state.displayId = d.id; win && win.setBounds(dockBounds(desiredH)); send('kk:setting', { k: 'displayId', v: d.id }); },
      })),
    }] : []),
    { type: 'separator' },
    { label: 'Open dev tools', click: () => win && win.webContents.openDevTools({ mode: 'detach' }) },
    { label: 'Quit', click: () => app.quit() },
  ]));
}
function buildTray(iconDataURL) {
  if (tray) return;
  trayImg = nativeImage.createFromDataURL(iconDataURL).resize({ width: 16, height: 16, quality: 'best' });
  tray = new Tray(trayImg);
  tray.setToolTip('Keystroke Keep');
  tray.on('click', toggleVisible);
  rebuildTray();
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
// the renderer tells us its saved settings at boot and whenever they change
ipcMain.on('kk:settings', (_e, s) => {
  if (!s || typeof s !== 'object') return;
  state.countInput = s.countInput !== false;
  state.sound = s.sound !== false;
  if (typeof s.onTop === 'boolean' && s.onTop !== state.onTop) { state.onTop = s.onTop; applyOnTop(); }
  if (s.displayId !== undefined && s.displayId !== state.displayId) { state.displayId = s.displayId; win && win.setBounds(dockBounds(desiredH)); }
  rebuildTray();
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.whenReady().then(() => {
    // no network, ever: everything the game needs ships in the app folder
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
    createWindow();
    // stop rendering and audio while the PC is locked or asleep; cap fps on battery
    const power = (p) => () => send('kk:power', p);
    powerMonitor.on('lock-screen', power('off'));
    powerMonitor.on('suspend', power('off'));
    powerMonitor.on('unlock-screen', power('on'));
    powerMonitor.on('resume', power('on'));
    const battery = () => send('kk:battery', powerMonitor.isOnBatteryPower());
    powerMonitor.on('on-battery', battery);
    powerMonitor.on('on-ac', battery);
    win.webContents.on('did-finish-load', battery);
    try { globalShortcut.register(HIDE_HOTKEY, toggleVisible); } catch (e) { /* taken by another app */ }
    app.on('will-quit', () => globalShortcut.unregisterAll());

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
