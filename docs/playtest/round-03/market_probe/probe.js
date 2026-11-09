// Round 03 market probe. Loads the REAL electron/main.js (compiled with a few closure
// exports appended so the probe can drive toggleVisible / read sys, hook state, tray),
// under its own app name (userData = %APPDATA%/kk-market-probe-r3: the player's real save is
// never touched). Unlike R2 this runs WITHOUT KK_SNAPSHOT, so the real uiohook path runs too.
// Run from the project dir:  npx electron docs/playtest/round-03/market_probe
// Takes ~4 min. Opens three fullscreen test windows for ~6 s each and taps F24 (a key that does
// nothing) four times to check whether the input hook is really removed on pause.
// Modes: default = full R3 pass (out/results.json); KK_PROBE=2 = fps/size/interval + multi-monitor
// fullscreen experiments (out/results2.json); KK_PROBE=3 = CSS-transition cost while typing (out/results3.json).
const path = require('path');
const fs = require('fs');
const Module = require('module');
const { execFile, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MAIN = path.join(ROOT, 'electron', 'main.js');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const { app, BrowserWindow, powerMonitor, globalShortcut, desktopCapturer, screen, Tray, Menu } = require('electron');
const R = { phases: {}, shell: {}, fullscreen: {} };
const log = (...a) => console.log('[probe]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (script) => new Promise((res) => execFile('powershell', ['-NoProfile', '-Command', script], { maxBuffer: 1 << 24 }, (e, so, se) => res((so || '') + (se ? '\nERR ' + se : ''))));

// ---- record tray tooltip / balloon / menu templates before main.js builds them
const T = { tooltips: [], balloons: [], lastMenu: null };
try { const o = Tray.prototype.setToolTip; Tray.prototype.setToolTip = function (t) { T.tooltips.push(t); return o.call(this, t); }; } catch (e) { T.patchErr = e.message; }
try { const o = Tray.prototype.displayBalloon; Tray.prototype.displayBalloon = function (b) { T.balloons.push(b); return o.call(this, b); }; } catch (e) { T.patchErr = e.message; }
{ const o = Menu.buildFromTemplate; Menu.buildFromTemplate = (t) => { T.lastMenu = t.map((i) => i.type === 'separator' ? '---' : (i.label || '') + (i.type === 'checkbox' ? (i.checked ? ' [x]' : ' [ ]') : '')); return o.call(Menu, t); }; }

// ---- win32 helpers (koffi from the game's node_modules)
const koffi = require(path.join(ROOT, 'node_modules', 'koffi'));
const u32 = koffi.load('user32.dll'), k32 = koffi.load('kernel32.dll'), sh32 = koffi.load('shell32.dll');
const RECT = koffi.struct('PRB_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
const MONINFO = koffi.struct('PRB_MONINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
const W32 = {
  fg: u32.func('__stdcall', 'GetForegroundWindow', 'intptr', []),
  rect: u32.func('__stdcall', 'GetWindowRect', 'int', ['intptr', koffi.out(koffi.pointer(RECT))]),
  monFromWin: u32.func('__stdcall', 'MonitorFromWindow', 'intptr', ['intptr', 'uint32']),
  monInfo: u32.func('__stdcall', 'GetMonitorInfoW', 'int', ['intptr', koffi.inout(koffi.pointer(MONINFO))]),
  tpid: u32.func('__stdcall', 'GetWindowThreadProcessId', 'uint32', ['intptr', koffi.out(koffi.pointer('uint32'))]),
  cls: u32.func('__stdcall', 'GetClassNameW', 'int', ['intptr', 'void *', 'int']),
  setFg: u32.func('__stdcall', 'SetForegroundWindow', 'int', ['intptr']),
  attach: u32.func('__stdcall', 'AttachThreadInput', 'int', ['uint32', 'uint32', 'int']),
  isVis: u32.func('__stdcall', 'IsWindowVisible', 'int', ['intptr']),
  key: u32.func('__stdcall', 'keybd_event', 'void', ['uint8', 'uint8', 'uint32', 'uintptr']),
  tid: k32.func('__stdcall', 'GetCurrentThreadId', 'uint32', []),
  quns: sh32.func('__stdcall', 'SHQueryUserNotificationState', 'int', [koffi.out(koffi.pointer('int'))]),
};
const quns = () => { const o = [0]; return W32.quns(o) === 0 ? o[0] : -1; };
const winInfo = (h) => {
  if (!h) return null;
  const r = {}; W32.rect(h, r);
  const pid = [0]; W32.tpid(h, pid);
  const buf = Buffer.alloc(512); const n = W32.cls(h, buf, 256);
  const mi = { cbSize: koffi.sizeof(MONINFO) }; W32.monInfo(W32.monFromWin(h, 2), mi);
  const m = mi.rcMonitor;
  const covers = r.left <= m.left && r.top <= m.top && r.right >= m.right && r.bottom >= m.bottom;
  return { hwnd: String(h), pid: pid[0], cls: buf.toString('utf16le', 0, n * 2), rect: [r.left, r.top, r.right - r.left, r.bottom - r.top], monitor: [m.left, m.top, m.right - m.left, m.bottom - m.top], mon: String(W32.monFromWin(h, 2)), coversMonitor: covers };
};
// proposed fallback: foreground window covers its whole monitor, isn't the desktop/taskbar, and is on the strip's monitor
const SHELL = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);
const fallbackFs = (stripH) => { const i = winInfo(W32.fg()); return !!i && i.coversMonitor && !SHELL.has(i.cls) && i.hwnd !== String(stripH) && i.mon === String(W32.monFromWin(stripH, 2)); };
const tapF24 = () => { W32.key(0x87, 0, 0, 0); W32.key(0x87, 0, 2, 0); };
function forceFg(h) {
  if (W32.setFg(h) && String(W32.fg()) === String(h)) return 'direct';
  const fgT = W32.tpid(W32.fg(), [0]); const me = W32.tid();
  W32.attach(me, fgT, 1); const ok = W32.setFg(h); W32.attach(me, fgT, 0);
  return String(W32.fg()) === String(h) ? 'attachThreadInput' : 'failed(' + ok + ')';
}

// ---- one PowerShell sampler: GPU 3D % (KK pids, DWM) + context switches/s (KK, DWM) per second
function sysSample(pids, secs = 5) {
  return ps(`$p=@(${pids.join(',')}); $dwm=(Get-Process dwm).Id;
  $s=Get-Counter -Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage','\\Thread(electron*)\\Context Switches/sec','\\Thread(electron*)\\ID Process','\\Thread(dwm*)\\Context Switches/sec' -SampleInterval 1 -MaxSamples ${secs} -ErrorAction SilentlyContinue;
  $o=@(); foreach($x in $s){ $kk=0; $d=0; $cs=0; $dcs=0; $own=@{}; $csv=@{};
    foreach($c in $x.CounterSamples){ $pth=$c.Path;
      if($pth -match 'engtype_3d'){ if($c.InstanceName -match 'pid_(\\d+)_'){ $id=[int]$matches[1]; if($p -contains $id){$kk+=$c.CookedValue}; if($id -eq $dwm){$d+=$c.CookedValue} } }
      elseif($pth -match 'thread\\((electron[^)]*)\\)\\\\id process'){ $own[$matches[1]]=[int]$c.CookedValue }
      elseif($pth -match 'thread\\((electron[^)]*)\\)\\\\context'){ $csv[$matches[1]]=$c.CookedValue }
      elseif($pth -match 'thread\\(dwm[^)]*\\)\\\\context'){ $dcs+=$c.CookedValue } }
    foreach($k in $csv.Keys){ if($p -contains $own[$k]){ $cs+=$csv[$k] } }
    $o+=('{0:F2},{1:F2},{2:F0},{3:F0}' -f $kk,$d,$cs,$dcs) }; $o -join ';'`).then((txt) => {
    const rows = txt.trim().split(';').map((r) => r.replace(/[^\d.,-]/g, '')).filter(Boolean).map((r) => r.split(',').map(Number)).filter((r) => r.length === 4 && r.every((v) => !isNaN(v)));
    // the first second is cooked against nothing: drop it when we have more
    const use = rows.length > 2 ? rows.slice(1) : rows;
    const stat = (i) => { const v = use.map((r) => r[i]); return v.length ? { avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), min: Math.min(...v), max: Math.max(...v) } : null; };
    return { kk3d: stat(0), dwm3d: stat(1), kkCtxSw: stat(2), dwmCtxSw: stat(3), raw: rows.map((r) => r.join('/')).join(' ') };
  });
}

const js = (win, code) => win.webContents.executeJavaScript(code).catch((e) => ({ err: e.message }));
const MEASURE = `(async () => { const K = window.KKdebug.KK; __m.draw = 0; __m.to = 0; __m.toBy = {}; __a.run = 0; __a.susp = 0; const t0 = performance.now(); await new Promise(r => __oST.call(window, r, 5000)); const s = (performance.now() - t0) / 1000;
  const per = (n) => +(n / s).toFixed(1); const by = {}; for (const k in __m.toBy) by[k] = per(__m.toBy[k]);
  return { drawPerSec: per(__m.draw), timeoutFiresPerSec: per(__m.to), timeoutsBy: by, targetFps: K.targetFps(), kkPaused: document.documentElement.classList.contains('kk-paused'), vis: document.visibilityState, power: K.powerState || 'on',
    audio: K.audio.ctx ? K.audio.ctx.state : 'none', nodesRunPerSec: per(__a.run), nodesSuspPerSec: per(__a.susp), lastInputAgo: +K.lastInputAgo().toFixed(1), fervorTier: K.fervorTier(), boss: !!window.KKdebug.W.boss,
    infiniteAnims: document.getAnimations().filter(a => a.effect && a.effect.getTiming().iterations === Infinity).map(a => a.animationName || '?'), runningAnims: document.getAnimations().filter(a => a.playState === 'running').length,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; })()`;


// per-process context switches/s (avg of 4 one-second samples), labelled by Electron process type
function ctxByPid() {
  const types = {}; for (const m of app.getAppMetrics()) types[m.pid] = m.type + (m.serviceName ? ':' + m.serviceName : '');
  return ps(`$s=Get-Counter -Counter '\Thread(electron*)\Context Switches/sec','\Thread(electron*)\ID Process' -SampleInterval 1 -MaxSamples 5 -ErrorAction SilentlyContinue; $acc=@{};
  foreach($x in ($s | Select-Object -Skip 1)){ $own=@{}; $csv=@{}; foreach($c in $x.CounterSamples){ if($c.Path -match 'thread\((electron[^)]*)\)\\id process'){ $own[$matches[1]]=[int]$c.CookedValue } elseif($c.Path -match 'thread\((electron[^)]*)\)\\context'){ $csv[$matches[1]]=$c.CookedValue } }
    foreach($k in $csv.Keys){ $id=$own[$k]; if($acc.ContainsKey($id)){ $acc[$id]+=$csv[$k] } else { $acc[$id]=$csv[$k] } } }; ($acc.Keys | % { '{0}={1:F0}' -f $_, ($acc[$_]/4) }) -join ';'`).then((t) => {
    const o = {}; for (const kv of t.trim().split(';')) { const [pid, v] = kv.split('='); if (types[pid]) o[types[pid] + '#' + pid] = +v; } return o; });
}
async function probe2(P, stripH) {
  const R2 = {};
  const typeOn = () => js(WIN, `window.__typer = setInterval(() => window.KKdebug.KK.input.event('key'), 180)`);
  const typeOff = () => js(WIN, `clearInterval(window.__typer)`);
  const ph = async (name) => { await phase(name); R2[name] = { ...R.phases[name], timeline: undefined, ctxByProc: await ctxByPid() }; log(name, 'ctx', JSON.stringify(R2[name].ctxByProc)); };
  await typeOn(); await sleep(2500);
  await ph('typing_fps30');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 20`); await sleep(500);
  await ph('typing_fps20');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 30; window.KKdebug.KK.ui.setSetting('size', 'S')`); await sleep(1500);
  await ph('typing_fps30_sizeS');
  await js(WIN, `window.KKdebug.KK.ui.setSetting('size', 'auto')`); await sleep(1000);
  await typeOff();
  for (let i = 0; i < 75; i++) { const a = await js(WIN, 'window.KKdebug.KK.lastInputAgo()'); if (a > 47) break; await sleep(1000); }
  await ph('idle_fps12');
  P.toggleVisible(); await sleep(800);
  await ph('hidden');
  R2.pageIntervalsCleared = await js(WIN, `(() => { let n = 0; for (let i = 1; i < 20000; i++) { clearInterval(i); n++; } return n; })()`);
  await sleep(500);
  await ph('hidden_pageIntervalsCleared');
  P.toggleVisible(); await sleep(1500);
  // ---- multi-monitor fullscreen cases
  const ds = screen.getAllDisplays(); const prim = screen.getPrimaryDisplay(); const other = ds.find((d) => d.id !== prim.id);
  R2.fs = {};
  const watch = async (name, secs, mid) => {
    const tl = []; const t0 = Date.now(); let did = false;
    while (Date.now() - t0 < secs * 1000) {
      if (mid && !did && Date.now() - t0 > mid.at * 1000) { did = true; await mid.fn(); }
      const fi = winInfo(W32.fg());
      tl.push({ t: +((Date.now() - t0) / 1000).toFixed(2), quns: quns(), stripVisible: WIN.isVisible(), fgPid: fi && fi.pid, fgMon: fi && fi.monitor.join(','), fallback: fallbackFs(stripH) });
      await sleep(250);
    }
    R2.fs[name] = { stripBounds: WIN.getBounds(), timeline: tl.filter((_, i) => i % 2 === 0) };
    log(name, JSON.stringify(R2.fs[name]));
  };
  if (other) {
    P.state.displayId = other.id; P.redock(); await sleep(1500);
    let c = await fsElectronExternal(other, '#00ffff')(); if (c.hwnd) forceFg(c.hwnd);
    await watch('strip_on_secondary__fullscreen_on_secondary', 5); await c.close(); await sleep(2000);
    c = await fsElectronExternal(prim, '#00ff00')(); if (c.hwnd) forceFg(c.hwnd);
    await watch('strip_on_secondary__fullscreen_on_primary', 5); await c.close(); await sleep(2000);
    P.state.displayId = prim.id; P.redock(); await sleep(1500);
    c = await fsElectronExternal(prim, '#00ff00', false, 12000)();  if (c.hwnd) forceFg(c.hwnd);
    let w2 = null;
    await watch('strip_on_primary__fullscreen_on_primary__then_focus_window_on_secondary', 9, { at: 3, fn: async () => { w2 = await fsElectronExternal(other, '#ff8800', true, 8000)(); R2.focusMoved = w2.hwnd ? forceFg(w2.hwnd) : 'no hwnd'; } });
    await c.close(); if (w2) await w2.close();
  }
  fs.writeFileSync(path.join(OUT, 'results2.json'), JSON.stringify(R2, null, 2));
  log('probe2 done');
  app.exit(0);
}

async function probe3() {
  const R3 = {};
  const css = (id, txt) => js(WIN, `(() => { let s = document.getElementById('${id}'); if (!s) { s = document.createElement('style'); s.id = '${id}'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(txt)}; })()`);
  const ph = async (name) => { await phase(name); R3[name] = R.phases[name]; };
  await js(WIN, `window.__typer = setInterval(() => window.KKdebug.KK.input.event('key'), 180)`); await sleep(2500);
  await ph('typing_fps30');
  await css('__t1', '.fv-bar i, .sparkbar i { transition: none !important; }'); await sleep(500);
  await ph('typing_fps30_barTransitionsOff');
  await css('__t2', '*,*::before,*::after{animation:none!important;transition:none!important}'); await sleep(500);
  await ph('typing_fps30_allCssMotionOff');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 12`); await sleep(500);
  await ph('typing_fps12_allCssMotionOff');
  await js(WIN, `(() => { window.__noUi = window.KKdebug.KK.ui.update; window.KKdebug.KK.ui.update = function () {}; })()`); await sleep(500);
  await ph('typing_fps12_allCssMotionOff_noHudUpdate');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 30`); await sleep(500);
  await ph('typing_fps30_allCssMotionOff_noHudUpdate');
  fs.writeFileSync(path.join(OUT, 'results3.json'), JSON.stringify(R3, null, 2));
  log('probe3 done'); app.exit(0);
}

let WIN = null;
const pidsNow = () => app.getAppMetrics().map((m) => m.pid);
async function phase(name, extra) {
  log('phase', name);
  app.getAppMetrics(); // reset the cpu window
  const [m, g] = await Promise.all([js(WIN, MEASURE), sysSample(pidsNow())]);
  const mets = app.getAppMetrics();
  R.phases[name] = Object.assign({ stripVisible: WIN.isVisible() }, m || {}, { cpuPct: +mets.reduce((a, x) => a + x.cpu.percentCPUUsage, 0).toFixed(2), wsMB: +(mets.reduce((a, x) => a + x.memory.workingSetSize, 0) / 1024).toFixed(0) }, g, extra || {});
  log(name, JSON.stringify(R.phases[name]));
}

// ---- fullscreen scenario: launch(), then watch the strip, QUNS and the fallback for `secs`
async function fsScenario(name, launch, P, stripH, secs = 6) {
  log('fullscreen', name);
  const tl = [];
  const ctl = await launch();
  const t0 = Date.now();
  let cap = null, fgHow = null;
  while (Date.now() - t0 < secs * 1000) {
    if (ctl.hwnd && !fgHow && Date.now() - t0 > 600) fgHow = forceFg(ctl.hwnd);
    const fi = winInfo(W32.fg());
    tl.push({ t: +((Date.now() - t0) / 1000).toFixed(2), quns: quns(), stripVisible: WIN.isVisible(), sysFullscreen: P.sys.fullscreen, fgPid: fi && fi.pid, fgCls: fi && fi.cls, fgCovers: fi && fi.coversMonitor, fallback: fallbackFs(stripH) });
    if (!cap && Date.now() - t0 > secs * 1000 - 1800) cap = await capture(name).catch((e) => ({ err: e.message }));
    await sleep(250);
  }
  await ctl.close();
  const t1 = Date.now(); let back = null;
  while (Date.now() - t1 < 5000) { if (WIN.isVisible() && back === null) { back = (Date.now() - t1) / 1000; break; } await sleep(100); }
  const hid = tl.find((x) => !x.stripVisible);
  R.fullscreen[name] = { fgMethod: fgHow, helperPid: ctl.pid, qunsSeen: [...new Set(tl.map((x) => x.quns))], fallbackTrueSamples: tl.filter((x) => x.fallback).length, samples: tl.length, hiddenAfterS: hid ? hid.t : null, reappearedAfterS: back, capture: cap, timeline: tl };
  log(name, JSON.stringify({ ...R.fullscreen[name], timeline: undefined }));
  await sleep(1200);
}
async function capture(name) {
  const d = screen.getDisplayMatching(WIN.getBounds());
  const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: d.size.width, height: d.size.height } });
  const src = srcs.find((s) => String(s.display_id) === String(d.id)) || srcs[0];
  const img = src.thumbnail; const sz = img.getSize(); const bmp = img.toBitmap();
  const px = (x, y) => { const i = (y * sz.width + x) * 4; return [bmp[i + 2], bmp[i + 1], bmp[i]]; };
  const sh = Math.round(160 * sz.height / d.size.height);
  fs.writeFileSync(path.join(OUT, 'fs_' + name + '.png'), img.resize({ width: Math.round(sz.width / 3) }).toPNG());
  return { stripDisplayTopCenter: px(sz.width >> 1, 20), stripRowCenter: px(sz.width >> 1, sz.height - Math.max(4, sh >> 2)), stripRowLeft: px(40, sz.height - Math.max(4, sh >> 2)) };
}
const fsElectronExternal = (d, color, windowed, ms = 9000) => async () => {
  const cp = spawn(process.execPath, [path.join(__dirname, 'fsapp'), '--x', d.bounds.x + 50, '--y', d.bounds.y + 50, '--w', 800, '--h', 600, '--ms', ms, '--color', color, '--windowed', windowed ? '1' : '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let hwnd = null; cp.stdout.on('data', (b) => { const m = /HWND (\d+)/.exec(String(b)); if (m) hwnd = Number(m[1]); });
  for (let i = 0; i < 40 && !hwnd; i++) await sleep(100);
  await sleep(300);
  return { pid: cp.pid, hwnd, close: async () => { try { cp.kill(); } catch (e) { /* gone */ } await sleep(300); } };
};
const fsWinForms = () => async () => {
  const script = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing;
  $s=[System.Windows.Forms.Screen]::PrimaryScreen; $f=New-Object System.Windows.Forms.Form; $f.FormBorderStyle='None'; $f.StartPosition='Manual'; $f.Bounds=$s.Bounds; $f.BackColor=[System.Drawing.Color]::FromArgb(255,0,255); $f.TopMost=$false; $f.Text='KK borderless test';
  $t=New-Object System.Windows.Forms.Timer; $t.Interval=9000; $t.add_Tick({$f.Close()}); $t.Start();
  $f.add_Shown({ [Console]::Out.WriteLine('HWND ' + $f.Handle.ToInt64()); [Console]::Out.Flush(); $f.Activate() }); [System.Windows.Forms.Application]::Run($f)`;
  const cp = spawn('powershell', ['-NoProfile', '-Command', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let hwnd = null; cp.stdout.on('data', (b) => { const m = /HWND (\d+)/.exec(String(b)); if (m) hwnd = Number(m[1]); });
  for (let i = 0; i < 60 && !hwnd; i++) await sleep(100);
  await sleep(300);
  return { pid: cp.pid, hwnd, close: async () => { try { cp.kill(); } catch (e) { /* gone */ } await sleep(300); } };
};
const fsOwnProcess = (d) => async () => {
  const w = new BrowserWindow({ x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height, frame: false, backgroundColor: '#00ff00', show: false });
  w.loadURL('data:text/html,<body style="background:#0f0;margin:0"></body>');
  await new Promise((r) => w.once('ready-to-show', r));
  w.show(); w.setFullScreen(true); w.focus();
  const h = w.getNativeWindowHandle();
  return { pid: process.pid, hwnd: Number(h.length >= 8 ? h.readBigUInt64LE(0) : h.readUInt32LE(0)), close: async () => { w.close(); await sleep(300); } };
};

(async () => {
  await app.whenReady();
  // DWM baseline before any Keystroke Keep window exists
  R.baselineNoKK = await sysSample([process.pid]);
  log('baseline', JSON.stringify(R.baselineNoKK));

  // ---- load the real main.js with closure exports appended (no edits to the file on disk)
  const src = fs.readFileSync(MAIN, 'utf8') + `\n;module.exports.__probe = { toggleVisible, applyVisibility, rebuildTray, redock, sys, state, HIDE_HOTKEY, get tray() { return tray; }, get hotkeyOk() { return hotkeyOk; }, get hookRunning() { return hookRunning; }, get hideNoticeShown() { return hideNoticeShown; } };`;
  const m = new Module(MAIN, module); m.filename = MAIN; m.paths = Module._nodeModulePaths(path.dirname(MAIN)); m._compile(src, MAIN);
  const P = m.exports.__probe;

  for (let i = 0; i < 80 && !BrowserWindow.getAllWindows()[0]; i++) await sleep(100);
  WIN = BrowserWindow.getAllWindows()[0];
  if (!WIN) { log('no window'); app.exit(1); return; }
  const con = []; WIN.webContents.on('console-message', (e, lvl, msg) => con.push(e && e.message !== undefined ? e.message : msg));
  // count what main forwards to the renderer (real hook events)
  const oSend = WIN.webContents.send.bind(WIN.webContents); const sent = { activity: 0, power: [] };
  WIN.webContents.send = (ch, v) => { if (ch === 'kk:activity') sent.activity++; if (ch === 'kk:power') sent.power.push(v); return oSend(ch, v); };
  await sleep(4000);
  const stripH = Number(WIN.getNativeWindowHandle().readBigUInt64LE(0));

  // ---- page instrumentation; dismiss the welcome (boots audio like a real first launch)
  R.setup = await js(WIN, `(() => { window.__m = { draw: 0, to: 0, toBy: {} }; window.__a = { run: 0, susp: 0 }; window.__oST = window.setTimeout;
    window.setTimeout = function (fn, ms, ...a) { const nm = (fn && fn.name) || 'anon'; return __oST.call(window, function () { __m.to++; __m.toBy[nm] = (__m.toBy[nm] || 0) + 1; return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }, ms, ...a); };
    const K = window.KKdebug.KK; const od = K.render.draw; K.render.draw = function () { __m.draw++; return od.apply(this, arguments); };
    for (const n of ['createOscillator', 'createBufferSource']) { const o = BaseAudioContext.prototype[n]; AudioContext.prototype[n] = function () { if (this.state === 'running') __a.run++; else __a.susp++; return o.apply(this, arguments); }; }
    const go = document.querySelector('[data-x=go]'); if (go) go.click();
    return { welcomeClicked: !!go, demo: !!(window.kkNative && window.kkNative.demo), settings: K.S.settings }; })()`);
  log('setup', JSON.stringify(R.setup));
  await sleep(1500);

  // ---- shell checks
  R.shell.hotkey = { combo: P.HIDE_HOTKEY, hotkeyOk: P.hotkeyOk, isRegistered: globalShortcut.isRegistered(P.HIDE_HOTKEY), oldComboRegistered: globalShortcut.isRegistered('Control+Alt+K') };
  R.shell.trayMenuDev = T.lastMenu;
  try { Object.defineProperty(app, 'isPackaged', { get: () => true, configurable: true }); P.rebuildTray(); R.shell.trayMenuPackaged = T.lastMenu; delete app.isPackaged; P.rebuildTray(); } catch (e) { R.shell.packagedErr = e.message; }
  R.shell.window = { bounds: WIN.getBounds(), isAlwaysOnTop: WIN.isAlwaysOnTop(), isFocusable: WIN.isFocusable(), displays: screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor, primary: d.id === screen.getPrimaryDisplay().id })) };
  // display-added: handler wired?
  R.shell.displayAddedListeners = screen.listenerCount('display-added');
  const b0 = WIN.getBounds(); WIN.setBounds({ ...b0, y: b0.y - 37 }); screen.emit('display-added', {}, screen.getPrimaryDisplay()); await sleep(200);
  R.shell.displayAddedRedocks = JSON.stringify(WIN.getBounds()) === JSON.stringify(b0);
  log('shell', JSON.stringify(R.shell));

  // ---- input hook: present while counting, removed on pause (F24 taps)
  const threads = async () => +(await ps(`(Get-Process -Id ${process.pid}).Threads.Count`)).trim();
  const hookCheck = async (label) => { const a0 = sent.activity; tapF24(); await sleep(150); tapF24(); await sleep(600); return { label, hookRunning: P.hookRunning, countInput: P.state.countInput, f24Forwarded: sent.activity - a0, mainThreads: await threads() }; };
  R.shell.hook = [await hookCheck('counting')];
  await js(WIN, `window.KKdebug.KK.ui.setSetting('countInput', false)`); await sleep(800);
  R.shell.hook.push(await hookCheck('paused'));
  R.shell.tooltipPaused = T.tooltips[T.tooltips.length - 1];
  await js(WIN, `window.KKdebug.KK.ui.setSetting('countInput', true)`); await sleep(800);
  R.shell.hook.push(await hookCheck('resumed'));
  R.shell.tooltipCounting = T.tooltips[T.tooltips.length - 1];
  log('hook', JSON.stringify(R.shell.hook));
  if (process.env.KK_PROBE === '2') { await probe2(P, stripH); return; }
  if (process.env.KK_PROBE === '3') { await probe3(); return; }

  // ---- idle: wait until 47+ sim-seconds without input, with HUD badges up like in real play
  await js(WIN, `window.KKdebug.KK.gainGold(5000, 'dev')`);
  for (let i = 0; i < 75; i++) { const a = await js(WIN, 'window.KKdebug.KK.lastInputAgo()'); if (a > 47) break; await sleep(1000); }
  await phase('idle');
  await js(WIN, `(() => { const s = document.createElement('style'); s.id = '__noanim'; s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'; document.head.appendChild(s); })()`);
  await phase('idle_cssAnimationsOff_control');
  await js(WIN, `document.getElementById('__noanim').remove()`);

  // ---- active typing (~5.5 counted keys/s, simulated in-page)
  await js(WIN, `window.__typer = setInterval(() => window.KKdebug.KK.input.event('key'), 180)`);
  await sleep(2500);
  await phase('active_typing');
  // ---- muted while typing
  await js(WIN, `window.KKdebug.KK.ui.setSetting('sound', false)`); await sleep(500);
  await phase('muted_typing');
  await js(WIN, `window.KKdebug.KK.ui.setSetting('sound', true)`);
  await js(WIN, `clearInterval(window.__typer)`);
  await sleep(1000);

  // ---- hidden through the real tray/hotkey path (toggleVisible), incl. first-hide balloon
  const balloons0 = T.balloons.length;
  P.toggleVisible(); await sleep(700);
  R.shell.firstHideBalloon = T.balloons.slice(balloons0);
  R.shell.tooltipHidden = T.tooltips[T.tooltips.length - 1];
  await phase('hidden_tray');
  powerMonitor.emit('lock-screen'); await sleep(300); powerMonitor.emit('unlock-screen'); await sleep(800);
  await phase('hidden_after_lock_unlock');
  P.toggleVisible(); await sleep(400); P.toggleVisible(); await sleep(400);
  R.shell.secondHideBalloons = T.balloons.length - balloons0; // must stay 1
  P.toggleVisible(); await sleep(1500);
  // ---- locked while shown (simulated powerMonitor event)
  powerMonitor.emit('lock-screen'); await sleep(800);
  await phase('locked_visible');
  powerMonitor.emit('unlock-screen'); await sleep(1500);
  R.shell.powerSequence = sent.power.slice();

  // ---- fullscreen auto-hide
  const ds = screen.getAllDisplays(); const sd = screen.getDisplayMatching(WIN.getBounds()); const other = ds.find((d) => d.id !== sd.id);
  R.fullscreen.stripDisplay = sd.id; R.fullscreen.quunsIdleNow = quns(); R.fullscreen.fgIdle = winInfo(W32.fg());
  await fsScenario('own_process_electron', fsOwnProcess(sd), P, stripH);
  await fsScenario('separate_process_electron_setFullScreen', fsElectronExternal(sd, '#00ff00'), P, stripH);
  await fsScenario('separate_process_borderless_winforms', fsWinForms(), P, stripH);
  if (other) await fsScenario('separate_process_fullscreen_on_OTHER_display', fsElectronExternal(other, '#00ffff'), P, stripH);

  R.console = con.filter((c) => /error|warn|KK/i.test(c)).slice(0, 40);
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(R, null, 2));
  log('done');
  app.exit(0);
})().catch((e) => { console.error('[probe] FAILED', e); try { fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(Object.assign(R, { fatal: String(e && e.stack) }), null, 2)); } catch (x) { /* ignore */ } app.exit(2); });
