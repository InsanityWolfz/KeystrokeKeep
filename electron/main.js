// Keystroke Keep — Electron shell: a frameless, transparent, always-on-top strip docked
// to the bottom of a display, plus global input *counting* via uiohook-napi.
// Privacy: we only forward the words "key" / "click". Key codes are used in-memory to
// ignore auto-repeat and are never stored, logged or sent anywhere. The app makes no
// network requests at all (blocked below). Pausing input counting removes the hook entirely.
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, powerMonitor, globalShortcut, session } = require('electron');
const path = require('path');
const fs = require('fs');
// The KK_* environment flags (self-test, capture, demo) are for development: a retail build ignores them
// unless it is started with --kk-dev.
if (app.isPackaged && !process.argv.includes('--kk-dev')) for (const k of Object.keys(process.env)) if (/^KK_/.test(k)) delete process.env[k];

let win = null;
let tray = null;
let hook = null; // uIOhook instance once loaded
let hookRunning = false;
let desiredH = 192;
// mirrored from the game's saved settings (the renderer is the source of truth)
const state = { countInput: true, sound: true, onTop: true, displayId: null, autoHideFullscreen: !(process.env.KK_CAPTURE === '1') };
// what the OS is doing: the strip only draws/plays when someone can actually see it
const sys = { userShown: true, locked: false, suspended: false, fullscreen: false };
let pkg = {};
try { pkg = require('../package.json'); } catch (e) { /* ignore */ }
// Demo builds are baked at package time (electron-builder --config.extraMetadata.kkDemo=true);
// the env var / flag only exist for development.
const IS_DEMO = pkg.kkDemo === true || process.env.KK_DEMO === '1' || process.argv.includes('--kk-demo');
const HIDE_HOTKEY = 'Control+Shift+Alt+K';
// Capture mode (store screenshots / GIFs / trailer): own profile and saves, fixed 60 fps, cue scripts.
const CAPTURE = process.env.KK_CAPTURE === '1';
function captureConfig() {
  const env = process.env;
  let script = null;
  if (env.KK_CAPTURE_SCRIPT) { try { script = JSON.parse(fs.readFileSync(env.KK_CAPTURE_SCRIPT, 'utf8')); } catch (e) { console.warn('[capture] bad script', e.message); } }
  return {
    seed: +(env.KK_CAPTURE_SEED || (script && script.seed) || 1), size: env.KK_CAPTURE_SIZE || 'L', fps: +(env.KK_CAPTURE_FPS || 60),
    juice: env.KK_CAPTURE_JUICE || 'full', audio: env.KK_CAPTURE_AUDIO || 'sfx', toasts: env.KK_CAPTURE_TOASTS === '1',
    bg: env.KK_CAPTURE_BG || '', script,
  };
} // not Ctrl+Alt+K: that is AltGr+K, which types a letter on some layouts
let hotkeyOk = false;
// one strip per Windows user (pipe names are machine-wide)
const PIPE = '\\\\.\\pipe\\keystroke-keep-' + String((() => { try { return require('os').userInfo().username; } catch (e) { return 'user'; } })()).split('').map((ch) => /[A-Za-z0-9_-]/.test(ch) ? ch : '~' + ch.charCodeAt(0).toString(16)).join('');
let hideNoticeShown = false;

function targetDisplay() {
  const all = screen.getAllDisplays();
  return all.find((d) => d.id === state.displayId) || screen.getPrimaryDisplay();
}
// KK_CAPTURE_DISPLAY=secondary|<id>: capture runs dock on that monitor, whatever the staged save says
let captureDisplay = null;
function resolveCaptureDisplay() {
  const v = process.env.KK_CAPTURE_DISPLAY;
  if (!CAPTURE || !v) return;
  const all = screen.getAllDisplays(), prim = screen.getPrimaryDisplay();
  const d = v === 'secondary' ? all.find((x) => x.id !== prim.id) : all.find((x) => String(x.id) === v);
  if (d) { captureDisplay = d.id; state.displayId = d.id; } else console.warn('[capture] KK_CAPTURE_DISPLAY: no such display', v);
}
// the saved monitor is known before the window exists, so the strip never flashes on the primary first
function readSavedDisplay() {
  try {
    const st = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'saves', 'keystroke-keep.json'), 'utf8')).settings || {};
    if (st.displayId != null && screen.getAllDisplays().some((d) => d.id === st.displayId)) state.displayId = st.displayId;
  } catch (e) { /* no save yet: primary */ }
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
    backgroundColor: CAPTURE && process.env.KK_CAPTURE_BG ? process.env.KK_CAPTURE_BG : '#00000000',
    title: 'Keystroke Keep',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      additionalArguments: [...(IS_DEMO ? ['--kk-demo'] : []), ...(CAPTURE ? ['--kk-capture=' + encodeURIComponent(JSON.stringify(captureConfig()))] : [])],
    },
  });
  applyOnTop();
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  // first show waits for the renderer's settings (monitor, size), at most 2 s
  win.once('ready-to-show', () => setTimeout(() => { firstShowOk = true; applyVisibility(); }, settingsSeen ? 0 : 2000));
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
let lastActive = null, settingsSeen = false, firstShowOk = false;
function applyVisibility() {
  if (!win || !firstShowOk) return;
  const shouldShow = sys.userShown && !(state.autoHideFullscreen && sys.fullscreen);
  if (shouldShow && !win.isVisible()) { win.showInactive(); win.setIgnoreMouseEvents(lastIgnore, { forward: true }); }
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
    send('kk:setting', { k: 'hideNoticeShown', v: true });
    try {
      tray.displayBalloon({ title: 'Keystroke Keep is still running', content: `Your heroes keep fighting. Click the crown in the tray${hotkeyOk ? ' or press Ctrl+Shift+Alt+K' : ''} to bring the strip back.` });
    } catch (e) { /* not supported */ }
  }
}

// Fullscreen watcher, per monitor. Walk the top-level windows in z-order and look only at the
// strip's own monitor: a window covering that whole monitor in front of everything normal means
// fullscreen video / a borderless game. SHQueryUserNotificationState adds presentation mode (4)
// and exclusive D3D games (3, primary monitor only), which don't show up as normal windows.
function startFullscreenWatch() {
  if (process.platform !== 'win32') return;
  let W;
  try {
    const koffi = require('koffi');
    const u32 = koffi.load('user32.dll'), sh32 = koffi.load('shell32.dll'), dwm = koffi.load('dwmapi.dll');
    const RECT = koffi.struct('KK_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
    const MONINFO = koffi.struct('KK_MONINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
    W = {
      koffi, MONINFO,
      top: u32.func('__stdcall', 'GetTopWindow', 'intptr', ['intptr']),
      next: u32.func('__stdcall', 'GetWindow', 'intptr', ['intptr', 'uint32']),
      vis: u32.func('__stdcall', 'IsWindowVisible', 'int', ['intptr']),
      iconic: u32.func('__stdcall', 'IsIconic', 'int', ['intptr']),
      zoomed: u32.func('__stdcall', 'IsZoomed', 'int', ['intptr']),
      rect: u32.func('__stdcall', 'GetWindowRect', 'int', ['intptr', koffi.out(koffi.pointer(RECT))]),
      mon: u32.func('__stdcall', 'MonitorFromWindow', 'intptr', ['intptr', 'uint32']),
      monInfo: u32.func('__stdcall', 'GetMonitorInfoW', 'int', ['intptr', koffi.inout(koffi.pointer(MONINFO))]),
      exstyle: u32.func('__stdcall', 'GetWindowLongPtrW', 'intptr', ['intptr', 'int']),
      cls: u32.func('__stdcall', 'GetClassNameW', 'int', ['intptr', 'void *', 'int']),
      cloaked: dwm.func('__stdcall', 'DwmGetWindowAttribute', 'int', ['intptr', 'uint32', koffi.out(koffi.pointer('uint32')), 'uint32']),
      quns: sh32.func('__stdcall', 'SHQueryUserNotificationState', 'int', [koffi.out(koffi.pointer('int'))]),
    };
  } catch (e) { console.warn('[KK] fullscreen detection unavailable:', e.message); return; }
  const SHELL = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);
  const WS_EX_TOPMOST = 0x8, WS_EX_TOOLWINDOW = 0x80, GW_HWNDNEXT = 2, MONITOR_NEAREST = 2;
  const buf = Buffer.alloc(512);
  const monitorRect = (m) => { const mi = { cbSize: W.koffi.sizeof(W.MONINFO) }; W.monInfo(m, mi); return { r: mi.rcMonitor, primary: (mi.dwFlags & 1) === 1 }; };
  function scan() {
    if (!win) return false;
    const nh = win.getNativeWindowHandle();
    const self = nh.length >= 8 ? Number(nh.readBigUInt64LE(0)) : nh.readUInt32LE(0);
    const myMon = W.mon(self, MONITOR_NEAREST);
    const { r: M, primary } = monitorRect(myMon);
    let h = W.top(0), n = 0, fs = false;
    while (h && n++ < 600) {
      if (h !== self && W.vis(h) && !W.iconic(h) && W.mon(h, MONITOR_NEAREST) === myMon) {
        const ex = Number(W.exstyle(h, -20));
        const cl = [0];
        const isCloaked = W.cloaked(h, 14, cl, 4) === 0 && cl[0] !== 0;
        const n2 = W.cls(h, buf, 256);
        const cname = buf.toString('utf16le', 0, n2 * 2);
        // overlays (click-through dimmers, recorder HUDs) never count; neither do no-activate topmost popups
        const overlay = (ex & 0x20) || ((ex & WS_EX_TOPMOST) && (ex & 0x08000000));
        if (!isCloaked && !overlay && !(ex & WS_EX_TOOLWINDOW) && !SHELL.has(cname)) {
          const r = {}; W.rect(h, r);
          const covers = r.left <= M.left && r.top <= M.top && r.right >= M.right && r.bottom >= M.bottom;
          // fullscreen = covers the monitor and has no full title bar (a maximized normal window keeps its caption)
          const style = Number(W.exstyle(h, -16));
          if (covers && (style & 0xC00000) !== 0xC00000) { fs = true; break; }
          if (!(ex & WS_EX_TOPMOST)) break; // the first normal window on this monitor decides
        }
      }
      h = W.next(h, GW_HWNDNEXT);
    }
    const q = [0];
    const state = W.quns(q) === 0 ? q[0] : 0;
    return fs || state === 4 || (state === 3 && primary);
  }
  setInterval(() => {
    let fs = false;
    try { fs = scan(); } catch (e) { /* ignore */ }
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
  tray.setToolTip((state.countInput ? 'Keystroke Keep: counting keystrokes (nothing typed is stored)' : 'Keystroke Keep: input counting PAUSED') + (sys.userShown ? '' : ' · strip hidden'));
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
let lastIgnore = true;
ipcMain.on('kk:ignoreMouse', (_e, ignore) => {
  lastIgnore = !!ignore;
  if (win) win.setIgnoreMouseEvents(lastIgnore, { forward: true });
});
// Click-through used to rely only on Chromium forwarding mouse moves while the window ignores the
// mouse. On Windows that forwarding can die after the window is hidden and shown again (fullscreen
// apps, the hide hotkey, minimising things), and then the strip never noticed the cursor and could
// not be clicked. So main also watches the cursor itself and tells the page where it is.
function startCursorWatch() {
  let lastKey = '';
  setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) { lastKey = ''; return; }
    const p = screen.getCursorScreenPoint(), b = win.getBounds();
    const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
    const key = inside ? (p.x - b.x) + ',' + (p.y - b.y) : 'out';
    if (key === lastKey) return;
    lastKey = key;
    send('kk:cursor', inside ? { x: p.x - b.x, y: p.y - b.y } : null);
  }, 50);
}
ipcMain.on('kk:tray', (_e, dataURL) => buildTray(dataURL));
ipcMain.on('kk:quit', () => app.quit());
// only ever opens the Steam store / steam:// links in the user's browser or client
ipcMain.on('kk:openStore', (_e, url) => {
  if (/^(https:\/\/store\.steampowered\.com\/|steam:\/\/)/.test(url)) require('electron').shell.openExternal(url);
});

// ---------------------------------------------------------------- save file
// <userData>/saves/keystroke-keep.json, written atomically (tmp + rename), with a ring of
// 3 backups rotated at most every 10 minutes. Loading falls back through the backups.
// Explicit folder names (not the package name), so dev, packaged, demo and full builds agree:
// %APPDATA%/Keystroke Keep/saves and %APPDATA%/Keystroke Keep Demo/saves. Self-tests use their own.
const saveDir = () => process.env.KK_SNAPSHOT || CAPTURE
  ? path.join(app.getPath('userData'), 'saves')
  : path.join(app.getPath('appData'), IS_DEMO ? 'Keystroke Keep Demo' : 'Keystroke Keep', 'saves');
const demoSavePath = () => path.join(app.getPath('appData'), 'Keystroke Keep Demo', 'saves', 'keystroke-keep.json');
const savePath = () => path.join(saveDir(), 'keystroke-keep.json');
const backupPath = (i) => path.join(saveDir(), `keystroke-keep.bak${i}.json`);
let lastBackup = 0;
function validSave(text) {
  if (typeof text !== 'string' || text.length < 2 || text.length > 5e6) return false;
  try { const o = JSON.parse(text); return !!o && typeof o === 'object' && typeof o.v === 'number'; } catch (e) { return false; }
}
const sleepSync = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* ignore */ } };
/** async save: retries locked files on a timer instead of blocking the main process */
let saveGen = 0;
function writeSaveAsync(text, attempt = 0, gen = ++saveGen) {
  if (gen < saveGen) return; // a newer save already went out
  try { writeSaveNoRetry(text); } catch (e) {
    if (attempt < 5 && ['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) setTimeout(() => writeSaveAsync(text, attempt + 1, gen), 20 * Math.pow(2, attempt));
    else console.warn('[KK] save failed', e.message);
  }
}
/** rename with retries: antivirus / OneDrive / backup tools briefly lock files on Windows */
function renameRetry(a, b) {
  for (let i = 0, wait = 20; ; i++, wait *= 2) {
    try { fs.renameSync(a, b); return; } catch (e) {
      if (i >= 4 || !['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) throw e;
      sleepSync(wait);
    }
  }
}
let lastSaveText = null;
function writeSaveNoRetry(text) { return writeSave(text, false, true); }
function writeSave(text, durable, noRetry) {
  if (!validSave(text)) return false;
  lastSaveText = text;
  fs.mkdirSync(saveDir(), { recursive: true });
  if (Date.now() - lastBackup > 10 * 60 * 1000 && fs.existsSync(savePath())) {
    lastBackup = Date.now();
    let cur = null;
    try { cur = fs.readFileSync(savePath(), 'utf8'); } catch (e) { /* ignore */ }
    if (validSave(cur)) {
      // only a good main file joins the backup ring
      for (let i = 3; i > 1; i--) { try { if (fs.existsSync(backupPath(i - 1))) fs.copyFileSync(backupPath(i - 1), backupPath(i)); } catch (e) { /* ignore */ } }
      try { fs.copyFileSync(savePath(), backupPath(1)); } catch (e) { /* ignore */ }
    }
  }
  const tmp = savePath() + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, text, 0, 'utf8'); if (durable) fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (noRetry) fs.renameSync(tmp, savePath()); else renameRetry(tmp, savePath());
  if (!IS_DEMO && !importMarked) { importMarked = true; try { if (!fs.existsSync(importMarker())) fs.writeFileSync(importMarker(), 'own save ' + Date.now()); } catch (e) { /* ignore */ } }
  return true;
}
let importMarked = false;
const importMarker = () => path.join(saveDir(), 'demo-imported.flag');
let loadSource = 'none';
function readSave() {
  loadSource = 'none';
  const order = [savePath(), backupPath(1), backupPath(2), backupPath(3)];
  // a leftover .tmp newer than the main file means the last rename failed: it holds the newest save
  try {
    const tmp = savePath() + '.tmp';
    const tt = fs.statSync(tmp).mtimeMs, mt = fs.existsSync(savePath()) ? fs.statSync(savePath()).mtimeMs : 0;
    if (tt > mt) { const t = fs.readFileSync(tmp, 'utf8'); if (validSave(t)) { loadSource = 'main'; return t; } }
  } catch (e) { /* no tmp */ }
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    let t = null;
    try { t = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    if (validSave(t)) { loadSource = i === 0 ? 'main' : 'backup'; return t; }
    if (i === 0) { try { renameRetry(p, path.join(saveDir(), `keystroke-keep.corrupt-${Date.now()}.json`)); } catch (e) { /* ignore */ } }
  }
  // the full game imports a demo save once, and only when it has never had a save of its own
  if (!IS_DEMO && !process.env.KK_SNAPSHOT && !CAPTURE && !fs.existsSync(importMarker())) {
    try {
      const t = fs.readFileSync(demoSavePath(), 'utf8');
      if (validSave(t)) {
        fs.mkdirSync(saveDir(), { recursive: true });
        fs.writeFileSync(importMarker(), String(Date.now()));
        loadSource = 'demo';
        return t;
      }
    } catch (e) { /* no demo save */ }
  }
  return null;
}
ipcMain.on('kk:loadSave', (e) => { e.returnValue = readSave(); });
ipcMain.on('kk:saveInfo', (e) => { e.returnValue = loadSource; });
ipcMain.on('kk:save', (_e, text) => writeSaveAsync(text));
ipcMain.on('kk:saveSync', (e, text) => { saveGen++; try { e.returnValue = writeSave(text, true); } catch (err) { e.returnValue = false; } });
ipcMain.on('kk:wipeSave', (e) => {
  for (const p of [savePath(), backupPath(1), backupPath(2), backupPath(3)]) { try { fs.unlinkSync(p); } catch (err) { /* ignore */ } }
  // a reset must never resurrect an old demo save
  try { fs.mkdirSync(saveDir(), { recursive: true }); fs.writeFileSync(importMarker(), 'reset ' + Date.now()); } catch (err) { /* ignore */ }
  lastSaveText = null;
  e.returnValue = true;
});
// Windows shutdown / logoff: write the last known save durably
const flushSave = () => { if (lastSaveText) { saveGen++; try { writeSave(lastSaveText, true); } catch (e) { /* ignore */ } } };
// the renderer tells us its saved settings at boot and whenever they change
ipcMain.on('kk:settings', (_e, s) => {
  if (!s || typeof s !== 'object') return;
  state.countInput = s.countInput !== false;
  state.sound = s.sound !== false;
  if (typeof s.onTop === 'boolean' && s.onTop !== state.onTop) { state.onTop = s.onTop; applyOnTop(); }
  if (typeof s.autoHideFullscreen === 'boolean' && !CAPTURE) state.autoHideFullscreen = s.autoHideFullscreen;
  if (s.hideNoticeShown) hideNoticeShown = true;
  if (s.displayId !== undefined && s.displayId !== state.displayId && !captureDisplay) { state.displayId = s.displayId; redock(); }
  syncHook();
  if (!settingsSeen) { settingsSeen = true; if (win && !win.isVisible()) setTimeout(() => { firstShowOk = true; applyVisibility(); }, 60); }
  applyVisibility();
});

// self-test runs use their own profile so they never touch the player's real save
if (process.env.KK_SNAPSHOT) app.setPath('userData', app.getPath('userData') + '-selftest');
if (CAPTURE) {
  app.setPath('userData', app.getPath('userData') + '-capture');
  // a staged save for the shot replaces the capture profile's save
  if (process.env.KK_CAPTURE_SAVE) {
    try { const d = path.join(app.getPath('userData'), 'saves'); fs.mkdirSync(d, { recursive: true }); fs.copyFileSync(process.env.KK_CAPTURE_SAVE, path.join(d, 'keystroke-keep.json')); } catch (e) { console.warn('[capture] staged save failed', e.message); }
  }
}

// Low-GPU mode: DirectComposition off measured 5% -> 0% GPU while typing, but about 2x CPU on
// laptop-class cores. 'auto' (default) = on for machines without a battery, off for laptops.
// Read from the save before the GPU process starts (self-tests: KK_LOWGPU=1/0 only).
function hasBattery() {
  try {
    const koffi = require('koffi');
    const SPS = koffi.struct('KK_SPS', { ACLineStatus: 'uint8', BatteryFlag: 'uint8', BatteryLifePercent: 'uint8', SystemStatusFlag: 'uint8', BatteryLifeTime: 'uint32', BatteryFullLifeTime: 'uint32' });
    const f = koffi.load('kernel32.dll').func('__stdcall', 'GetSystemPowerStatus', 'int', [koffi.out(koffi.pointer(SPS))]);
    const o = {};
    if (!f(o)) return false;
    return o.BatteryFlag !== 255 && (o.BatteryFlag & 128) === 0; // bit 128 = no system battery, 255 = unknown
  } catch (e) { return false; }
}
if (process.platform === 'win32') {
  let pref = 'auto';
  if (process.env.KK_SNAPSHOT || CAPTURE) pref = process.env.KK_LOWGPU === '1' ? true : process.env.KK_LOWGPU === '0' ? false : (CAPTURE ? false : 'auto');
  else {
    try {
      const t = fs.readFileSync(path.join(app.getPath('appData'), IS_DEMO ? 'Keystroke Keep Demo' : 'Keystroke Keep', 'saves', 'keystroke-keep.json'), 'utf8');
      const v = JSON.parse(t).settings.lowGpu;
      const st = JSON.parse(t).settings;
      if (v === false || (v === true && st.lowGpuMigrated)) pref = v; // an old 'true' from the previous default means auto
    } catch (e) { /* no save yet: auto */ }
  }
  const on = pref === 'auto' ? !hasBattery() : pref;
  if (on) app.commandLine.appendSwitch('disable-direct-composition');
}
if (process.platform === 'win32') app.setAppUserModelId('com.keystrokekeep.game');

const gotLock = process.env.KK_SNAPSHOT || CAPTURE ? true : app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.whenReady().then(async () => {
    // One strip per PC, across the demo and the full game (their single-instance locks are
    // separate because their folders differ): a named pipe both builds try to own.
    if (!process.env.KK_SNAPSHOT && !CAPTURE && process.platform === 'win32') {
      const owned = await new Promise((resolve) => {
        const srv = require('net').createServer((c) => {
          c.on('data', (d) => { if (String(d).trim() === 'quit') { try { srv.close(); } catch (e) { /* ignore */ } flushSave(); app.quit(); } });
          c.on('error', () => {});
        });
        srv.once('error', () => resolve(false));
        srv.listen(PIPE, () => resolve(true));
      });
      if (!owned) {
        const choice = require('electron').dialog.showMessageBoxSync({
          type: 'question', title: 'Keystroke Keep', buttons: [IS_DEMO ? 'Close the other one and start the demo' : 'Close the other one and start', 'Cancel'], defaultId: 0, cancelId: 1,
          message: 'Keystroke Keep is already running (demo or full game).',
          detail: 'Only one strip can run at a time. The other one saves before it closes.',
        });
        if (choice === 0) {
          await new Promise((resolve) => {
            const c = require('net').connect(PIPE, () => c.end('quit'));
            c.on('error', resolve); c.on('close', resolve);
          });
          // wait until the other copy has really let go of the pipe (up to 10 s)
          for (let i = 0; i < 40; i++) {
            const alive = await new Promise((r) => { const c = require('net').connect(PIPE, () => { c.destroy(); r(true); }); c.on('error', () => r(false)); });
            if (!alive) break;
            await new Promise((r) => setTimeout(r, 250));
          }
          app.relaunch();
        }
        app.quit();
        return;
      }
    }
    // no network, ever: everything the game needs ships in the app folder
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_d, cb) => cb({ cancel: true }));
    readSavedDisplay(); resolveCaptureDisplay();
    createWindow();
    app.on('second-instance', () => { sys.userShown = true; applyVisibility(); if (tray) { try { tray.displayBalloon({ title: 'Keystroke Keep', content: 'Already running: the strip is back.' }); } catch (e) { /* ignore */ } } });
    app.on('before-quit', flushSave);
    win.on('session-end', flushSave);
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
    startCursorWatch();
    try { hotkeyOk = globalShortcut.register(HIDE_HOTKEY, toggleVisible); } catch (e) { hotkeyOk = false; }
    if (CAPTURE) {
      for (let d = 0; d <= 9; d++) { try { globalShortcut.register('Control+Shift+Alt+' + d, () => send('kk:capture', d)); } catch (e) { /* taken */ } }
      ipcMain.on('kk:mark', (_e, v) => console.log(`[capture] MARK ${new Date().toISOString()} ${String(v)}`));
      // capture-only escape hatch: the page's CSP forbids eval, so cue JS runs through the shell
      ipcMain.on('kk:captureJs', (_e, code) => { win.webContents.executeJavaScript(String(code)).catch((err) => console.log('[capture] js cue failed', err.message)); });
      win.webContents.on('console-message', (e, _l, msg) => { const m = e && e.message !== undefined ? e.message : msg; if (String(m).startsWith('[capture]')) console.log(m); });
    }
    if (!hotkeyOk) console.warn('[KK] hide hotkey unavailable (taken by another app)');
    app.on('will-quit', () => globalShortcut.unregisterAll());

    // KK_SNAPSHOT=out.png: self-test mode. Captures the strip after a few seconds and quits
    // (no input hook), so the build can be verified headlessly.
    if (process.env.KK_SNAPSHOT) {
      win.webContents.on('console-message', (e, _level, msg) => console.log('[renderer]', e && e.message !== undefined ? e.message : msg));
      if (process.env.KK_SNAPSHOT_JS) setTimeout(() => win.webContents.executeJavaScript(process.env.KK_SNAPSHOT_JS).catch((e) => console.log('[KK] js error', e.message)), 2500);
      setTimeout(async () => {
        // regression gate: baked sprites must survive (low-GPU context loss once blanked them all)
        const px = await win.webContents.executeJavaScript("(() => { const f = KK.SPR.frames.knight[0].c; const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })()").catch(() => -1);
        console.log(px > 0 ? `[KK] sprite check ok (${px} px)` : `[KK] SPRITE CHECK FAILED (${px})`);
        if (!(px > 0)) process.exitCode = 1;
        const img = await win.webContents.capturePage();
        require('fs').writeFileSync(process.env.KK_SNAPSHOT, img.toPNG());
        console.log('[KK] snapshot saved', win.getBounds());
        app.exit(px > 0 ? 0 : 1);
      }, +(process.env.KK_SNAPSHOT_DELAY || 6000));
      return;
    }
    syncHook();
  });
  app.on('window-all-closed', () => app.quit());
}
