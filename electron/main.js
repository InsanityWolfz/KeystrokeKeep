// Keystroke Keep — Electron shell: a frameless, transparent, always-on-top strip docked
// to the bottom of a display, plus global input *counting* via uiohook-napi.
// Privacy: we only forward the words "key" / "click". Key codes are used in-memory to
// ignore auto-repeat and are never stored, logged or sent anywhere. The app makes no
// network requests at all (blocked below). Pausing input counting removes the hook entirely.
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, powerMonitor, globalShortcut, session } = require('electron');
const path = require('path');

let win = null;
let tray = null;
let hook = null; // uIOhook instance once loaded
let hookRunning = false;
let desiredH = 192;
// mirrored from the game's saved settings (the renderer is the source of truth)
const state = { countInput: true, sound: true, onTop: true, displayId: null, autoHideFullscreen: true };
// what the OS is doing: the strip only draws/plays when someone can actually see it
const sys = { userShown: true, locked: false, suspended: false, fullscreen: false };
const HIDE_HOTKEY = 'Control+Shift+Alt+K'; // not Ctrl+Alt+K: that is AltGr+K, which types a letter on some layouts
let hotkeyOk = false;
let hideNoticeShown = false;

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
const redock = () => win && win.setBounds(dockBounds(desiredH));

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
      additionalArguments: process.env.KK_DEMO === '1' || process.argv.includes('--kk-demo') ? ['--kk-demo'] : [],
    },
  });
  applyOnTop();
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.once('ready-to-show', applyVisibility);
  win.on('closed', () => { win = null; });
  screen.on('display-metrics-changed', redock);
  screen.on('display-removed', redock);
  screen.on('display-added', redock);
}
function applyOnTop() {
  if (!win) return;
  // On Windows every always-on-top level is plain TOPMOST, so this alone still covers
  // fullscreen video and games: the fullscreen watcher below hides the strip for those.
  win.setAlwaysOnTop(state.onTop, 'floating');
}

/** One source of truth for "should the strip be on screen / draw / make sound". */
let lastActive = null;
function applyVisibility() {
  if (!win) return;
  const shouldShow = sys.userShown && !(state.autoHideFullscreen && sys.fullscreen);
  if (shouldShow && !win.isVisible()) win.showInactive();
  if (!shouldShow && win.isVisible()) win.hide();
  const active = shouldShow && !sys.locked && !sys.suspended;
  if (active !== lastActive) { lastActive = active; send('kk:power', active ? 'on' : 'off'); }
  rebuildTray();
}
function toggleVisible() {
  sys.userShown = !sys.userShown;
  applyVisibility();
  if (!sys.userShown && !hideNoticeShown && tray) {
    hideNoticeShown = true;
    try {
      tray.displayBalloon({ title: 'Keystroke Keep is still running', content: `Your heroes keep delving. Click the crown in the tray${hotkeyOk ? ' or press Ctrl+Shift+Alt+K' : ''} to bring the strip back.` });
    } catch (e) { /* not supported */ }
  }
}

// Fullscreen watcher: SHQueryUserNotificationState reports a fullscreen app (QUNS_BUSY=2),
// a fullscreen D3D game (3) or presentation mode (4) in front.
function startFullscreenWatch() {
  if (process.platform !== 'win32') return;
  let query;
  try {
    const koffi = require('koffi');
    query = koffi.load('shell32.dll').func('int __stdcall SHQueryUserNotificationState(_Out_ int *pquns)');
  } catch (e) { console.warn('[KK] fullscreen detection unavailable:', e.message); return; }
  const out = [0];
  setInterval(() => {
    let fs = false;
    try { if (query(out) === 0) fs = out[0] === 2 || out[0] === 3 || out[0] === 4; } catch (e) { /* ignore */ }
    if (fs !== sys.fullscreen) { sys.fullscreen = fs; applyVisibility(); }
  }, 1500);
}

// The input hook only exists while counting is on: pausing removes it from the system.
const down = new Set();
function syncHook() {
  if (process.env.KK_SNAPSHOT) return;
  if (!hook) {
    try {
      ({ uIOhook: hook } = require('uiohook-napi'));
    } catch (e) {
      console.warn('[KK] uiohook-napi not available, global input disabled:', e.message);
      return;
    }
    const fwd = (kind) => { if (state.countInput && win && !win.isDestroyed()) win.webContents.send('kk:activity', kind); };
    hook.on('keydown', (e) => {
      if (down.has(e.keycode)) return; // auto-repeat
      down.add(e.keycode);
      fwd('key');
    });
    hook.on('keyup', (e) => { down.delete(e.keycode); });
    hook.on('mousedown', () => fwd('click'));
    app.on('will-quit', () => { try { if (hookRunning) hook.stop(); } catch (e) { /* ignore */ } });
  }
  try {
    if (state.countInput && !hookRunning) { down.clear(); hook.start(); hookRunning = true; }
    else if (!state.countInput && hookRunning) { hook.stop(); hookRunning = false; }
  } catch (e) { console.warn('[KK] input hook error:', e.message); }
}

function rebuildTray() {
  if (!tray) return;
  const displays = screen.getAllDisplays();
  const cur = targetDisplay();
  tray.setToolTip(state.countInput ? 'Keystroke Keep: counting keystrokes (never which keys)' : 'Keystroke Keep: input counting PAUSED');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Keystroke Keep', enabled: false },
    { type: 'separator' },
    { label: (sys.userShown ? 'Hide strip' : 'Show strip') + (hotkeyOk ? '  (Ctrl+Shift+Alt+K)' : ''), click: toggleVisible },
    { label: 'Count keystrokes & clicks', type: 'checkbox', checked: state.countInput, click: (i) => send('kk:setting', { k: 'countInput', v: i.checked }) },
    { label: 'Sound', type: 'checkbox', checked: state.sound, click: (i) => send('kk:setting', { k: 'sound', v: i.checked }) },
    { label: 'Always on top', type: 'checkbox', checked: state.onTop, click: (i) => { state.onTop = i.checked; applyOnTop(); send('kk:setting', { k: 'onTop', v: i.checked }); } },
    { label: 'Hide during fullscreen apps & games', type: 'checkbox', checked: state.autoHideFullscreen, click: (i) => { state.autoHideFullscreen = i.checked; applyVisibility(); send('kk:setting', { k: 'autoHideFullscreen', v: i.checked }); } },
    ...(displays.length > 1 ? [{
      label: 'Display', submenu: displays.map((d, i) => ({
        label: `Display ${i + 1} (${d.size.width}x${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' · primary' : ''}`,
        type: 'radio', checked: d.id === cur.id,
        click: () => { state.displayId = d.id; redock(); send('kk:setting', { k: 'displayId', v: d.id }); },
      })),
    }] : []),
    { type: 'separator' },
    ...(app.isPackaged ? [] : [{ label: 'Open dev tools', click: () => win && win.webContents.openDevTools({ mode: 'detach' }) }]),
    { label: 'Quit', click: () => app.quit() },
  ]));
}
function buildTray(iconDataURL) {
  if (tray) return;
  const img = nativeImage.createFromDataURL(iconDataURL).resize({ width: 16, height: 16, quality: 'best' });
  tray = new Tray(img);
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
  if (typeof s.autoHideFullscreen === 'boolean') state.autoHideFullscreen = s.autoHideFullscreen;
  if (s.displayId !== undefined && s.displayId !== state.displayId) { state.displayId = s.displayId; redock(); }
  syncHook();
  applyVisibility();
});

// self-test runs use their own profile so they never touch the player's real save
if (process.env.KK_SNAPSHOT) app.setPath('userData', app.getPath('userData') + '-selftest');

const gotLock = process.env.KK_SNAPSHOT ? true : app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.whenReady().then(() => {
    // no network, ever: everything the game needs ships in the app folder
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
    createWindow();
    // stop drawing and audio while locked, asleep, hidden or behind a fullscreen app; cap fps on battery
    const sysSet = (k, v) => () => { sys[k] = v; applyVisibility(); };
    powerMonitor.on('lock-screen', sysSet('locked', true));
    powerMonitor.on('unlock-screen', sysSet('locked', false));
    powerMonitor.on('suspend', sysSet('suspended', true));
    powerMonitor.on('resume', sysSet('suspended', false));
    const battery = () => send('kk:battery', powerMonitor.isOnBatteryPower());
    powerMonitor.on('on-battery', battery);
    powerMonitor.on('on-ac', battery);
    win.webContents.on('did-finish-load', () => { battery(); lastActive = null; applyVisibility(); });
    startFullscreenWatch();
    try { hotkeyOk = globalShortcut.register(HIDE_HOTKEY, toggleVisible); } catch (e) { hotkeyOk = false; }
    if (!hotkeyOk) console.warn('[KK] hide hotkey unavailable (taken by another app)');
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
    syncHook();
  });
  app.on('window-all-closed', () => app.quit());
}
