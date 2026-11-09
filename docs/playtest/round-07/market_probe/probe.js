// Round 07 market probe: R6 probe + KK_FAKEUSER (os.userInfo override = another Windows user), KK_UD (own userData = that user's profile),
// KK_FAKEBATT=0|1 (hasBattery override, laptop proxy), save scenarios async-stale-quit, lowgpu-legacy-true, lowgpu-chosen-true.
// Round 06 market probe: R5 probe + R6 modes (hold/noop instance tests with KK_AUTODIALOG / KK_SLOWQUIT / KK_HIDE / KK_HOLD,
// save scenarios tmp-*, marker-then-corrupt, own-marker-corrupt-with-demo, async-lock, async-stale; KK_LOWGPU unset = auto).
// Isolation: %APPDATA%/kk-market-probe-r7 (userData-demo for KK_DEMO=1). Patch history: patch_probe.py.
// Round 05 market probe (R5 changes: main.js is compiled BEFORE app ready, because R4 main.js reads
// settings.lowGpu from the save and appends disable-direct-composition before the GPU process starts;
// saves are seeded before that; KK_LOWGPU=0|1 seeds the setting; KK_CORES=N normalises CPU to N cores
// when the probe runs under `start /affinity`; extra fullscreen and save cases).
// Round 04 market probe. Loads the REAL electron/main.js (compiled in memory with closure exports
// appended; the file on disk is untouched) with the real uiohook path.
// ISOLATION: R4 main.js writes saves to explicit %APPDATA%/Keystroke Keep[ Demo]/saves folders, so
// the R3 trick (own app name) no longer isolates. This probe redirects app 'appData' AND 'userData'
// to %APPDATA%/kk-market-probe-r7/{AppData,userData} before main.js runs. The real folders are never read or written.
// Run from the project dir:  npx electron docs/playtest/round-07/market_probe
// Modes (KK_PROBE=...):
//   perf      (default) idle / typing 24 fps / muted / 30 fps / hidden / locked  -> out/perf.json
//   exp       cost-breakdown experiments while typing (layered style, canvas vs HUD, backing size,
//             window area, opaque vs transparent window)                         -> out/exp.json
//   fs        fullscreen matrix on all displays (separate-process windows)      -> out/fs.json
//   lsseed    writes a marker save into localStorage only (for the migration test), then quits
//   save:<s>  save scenarios (seeded on disk before main.js loads)              -> out/save_<s>.json
//   R5: sprites (party visible? capturePage + screen grab), losttime (when the low-GPU canvas wipe hits;
//       uses diag_preload.js), eval (KK_EVAL=<file> runs JS in the page, e.g. diag_sprites.js / diag_bake.js)
//   R5 env: KK_LOWGPU=0|1 (seeds settings.lowGpu), KK_REBAKE=1|wrf (re-run sprites.js after boot, wrf = with
//       willReadFrequently canvases = the proposed fix), KK_AFFINITY=<hex mask> + KK_CORES=<n> (laptop proxy)
const path = require('path');
const fs = require('fs');
const Module = require('module');
const { execFile, spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MAIN = path.join(ROOT, 'electron', 'main.js');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const MODE = process.env.KK_PROBE || 'perf';

const { app, BrowserWindow, powerMonitor, screen, ipcMain, session } = require('electron');
const PROBE_ROOT = path.join(process.env.APPDATA, 'kk-market-probe-r7' + (process.env.KK_UD ? '-' + process.env.KK_UD : ''));
if (process.env.KK_FAKEUSER) { const os = require('os'); const real = os.userInfo; os.userInfo = (o) => Object.assign(real(o), { username: process.env.KK_FAKEUSER }); }
const APPDATA = path.join(PROBE_ROOT, 'AppData');
app.setPath('appData', APPDATA);
// R6: the demo build has its own userData (and single-instance lock) since 89f4651, so mirror that
app.setPath('userData', path.join(PROBE_ROOT, process.env.KK_DEMO === '1' ? 'userData-demo' : 'userData'));
const FULL_DIR = path.join(APPDATA, 'Keystroke Keep', 'saves');
const DEMO_DIR = path.join(APPDATA, 'Keystroke Keep Demo', 'saves');
const F = { main: 'keystroke-keep.json', b1: 'keystroke-keep.bak1.json', b2: 'keystroke-keep.bak2.json', b3: 'keystroke-keep.bak3.json' };

const log = (...a) => console.log('[probe]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (script) => new Promise((res) => execFile('powershell', ['-NoProfile', '-Command', script], { maxBuffer: 1 << 24 }, (e, so, se) => res((so || '') + (se ? '\nERR ' + se : ''))));
const save = (o) => JSON.stringify(Object.assign({ v: 1, lastSave: Date.now() }, o));
const floorOf = (p) => { try { const t = fs.readFileSync(p, 'utf8'); try { return JSON.parse(t).floor; } catch (e) { return 'corrupt(' + t.length + 'B)'; } } catch (e) { return 'missing'; } };
const dirState = (d) => { const o = {}; try { for (const n of fs.readdirSync(d)) o[n] = floorOf(path.join(d, n)); } catch (e) { return 'no dir'; } return o; };

// ---- win32 helpers (koffi from the game's node_modules)
const koffi = require(path.join(ROOT, 'node_modules', 'koffi'));
const u32 = koffi.load('user32.dll'), k32 = koffi.load('kernel32.dll'), sh32 = koffi.load('shell32.dll'), dwm = koffi.load('dwmapi.dll');
const RECT = koffi.struct('PRB6_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
const MONINFO = koffi.struct('PRB6_MONINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
const W32 = {
  fg: u32.func('__stdcall', 'GetForegroundWindow', 'intptr', []),
  rect: u32.func('__stdcall', 'GetWindowRect', 'int', ['intptr', koffi.out(koffi.pointer(RECT))]),
  monFromWin: u32.func('__stdcall', 'MonitorFromWindow', 'intptr', ['intptr', 'uint32']),
  monInfo: u32.func('__stdcall', 'GetMonitorInfoW', 'int', ['intptr', koffi.inout(koffi.pointer(MONINFO))]),
  tpid: u32.func('__stdcall', 'GetWindowThreadProcessId', 'uint32', ['intptr', koffi.out(koffi.pointer('uint32'))]),
  cls: u32.func('__stdcall', 'GetClassNameW', 'int', ['intptr', 'void *', 'int']),
  title: u32.func('__stdcall', 'GetWindowTextW', 'int', ['intptr', 'void *', 'int']),
  setFg: u32.func('__stdcall', 'SetForegroundWindow', 'int', ['intptr']),
  attach: u32.func('__stdcall', 'AttachThreadInput', 'int', ['uint32', 'uint32', 'int']),
  top: u32.func('__stdcall', 'GetTopWindow', 'intptr', ['intptr']),
  next: u32.func('__stdcall', 'GetWindow', 'intptr', ['intptr', 'uint32']),
  vis: u32.func('__stdcall', 'IsWindowVisible', 'int', ['intptr']),
  iconic: u32.func('__stdcall', 'IsIconic', 'int', ['intptr']),
  zoomed: u32.func('__stdcall', 'IsZoomed', 'int', ['intptr']),
  style: u32.func('__stdcall', 'GetWindowLongPtrW', 'intptr', ['intptr', 'int']),
  cloaked: dwm.func('__stdcall', 'DwmGetWindowAttribute', 'int', ['intptr', 'uint32', koffi.out(koffi.pointer('uint32')), 'uint32']),
  tid: k32.func('__stdcall', 'GetCurrentThreadId', 'uint32', []),
  quns: sh32.func('__stdcall', 'SHQueryUserNotificationState', 'int', [koffi.out(koffi.pointer('int'))]),
};
const quns = () => { const o = [0]; return W32.quns(o) === 0 ? o[0] : -1; };
const buf = Buffer.alloc(1024);
const clsOf = (h) => { const n = W32.cls(h, buf, 256); return buf.toString('utf16le', 0, n * 2); };
const titleOf = (h) => { const n = W32.title(h, buf, 256); return buf.toString('utf16le', 0, n * 2); };
const hwndOf = (w) => { const h = w.getNativeWindowHandle(); return Number(h.length >= 8 ? h.readBigUInt64LE(0) : h.readUInt32LE(0)); };
function forceFg(h) {
  if (W32.setFg(h) && String(W32.fg()) === String(h)) return 'direct';
  const fgT = W32.tpid(W32.fg(), [0]); const me = W32.tid();
  W32.attach(me, fgT, 1); const ok = W32.setFg(h); W32.attach(me, fgT, 0);
  return String(W32.fg()) === String(h) ? 'attachThreadInput' : 'failed(' + ok + ')';
}
// Same walk as electron/main.js scan(), but it reports WHICH window decided (for diagnosis).
const SHELL = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd']);
function scanExplain(selfH) {
  const myMon = W32.monFromWin(selfH, 2);
  const mi = { cbSize: koffi.sizeof(MONINFO) }; W32.monInfo(myMon, mi); const M = mi.rcMonitor;
  let h = W32.top(0), n = 0; const seen = [];
  while (h && n++ < 600) {
    if (h !== selfH && W32.vis(h) && !W32.iconic(h) && W32.monFromWin(h, 2) === myMon) {
      const ex = Number(W32.style(h, -20)); const cl = [0];
      const isCloaked = W32.cloaked(h, 14, cl, 4) === 0 && cl[0] !== 0; const c = clsOf(h);
      const overlay = (ex & 0x20) || ((ex & 8) && (ex & 0x08000000)); // main.js overlay filter (unchanged)
      if (!isCloaked && !overlay && !(ex & 0x80) && !SHELL.has(c)) {
        const r = {}; W32.rect(h, r); const pid = [0]; W32.tpid(h, pid);
        const st = Number(W32.style(h, -16)); const zoomed = !!W32.zoomed(h);
        const geomCovers = r.left <= M.left && r.top <= M.top && r.right >= M.right && r.bottom >= M.bottom;
        const covers = geomCovers && (st & 0xC00000) !== 0xC00000; // R6 main.js rule (89f4651)
        const row = { cls: c, title: titleOf(h).slice(0, 40), pid: pid[0], topmost: !!(ex & 8), layered: !!(ex & 0x80000), clickThrough: !!(ex & 0x20), style: '0x' + st.toString(16), caption: (st & 0xC00000) === 0xC00000, thickframe: !!(st & 0x40000), zoomed, rect: [r.left, r.top, r.right - r.left, r.bottom - r.top], geomCovers, covers, altRuleNoCaption: geomCovers && (st & 0xC00000) !== 0xC00000 };
        seen.push(row);
        if (covers) return { fullscreen: true, decidedBy: row, walked: n, considered: seen.length, topmostSkipped: seen.slice(0, -1) };
        if (!(ex & 8)) return { fullscreen: false, decidedBy: row, walked: n, considered: seen.length, topmostSkipped: seen.slice(0, -1) };
      }
    }
    h = W32.next(h, 2);
  }
  return { fullscreen: false, decidedBy: null, walked: n, considered: seen.length };
}
function countTopLevel() { let h = W32.top(0), n = 0, vis = 0; while (h) { n++; if (W32.vis(h)) vis++; h = W32.next(h, 2); } return { all: n, visible: vis }; }

// ---- one PowerShell sampler: GPU 3D % (our pids, DWM) + context switches/s (ours, DWM)
function sysSample(pids, secs = +process.env.KK_SAMPLES || 6) {
  // kk3d = 3D engine (Task Manager's GPU column for us), kkGpuAll = every engine type summed (3D+copy+...),
  // cpuMachinePct = Task Manager CPU % (all our processes, % of all logical cores)
  return ps(`$p=@(${pids.join(',')}); $dwm=(Get-Process dwm).Id; $ncpu=${+process.env.KK_CORES || 0}; if($ncpu -le 0){$ncpu=[Environment]::ProcessorCount};
  $s=Get-Counter -Counter '\\GPU Engine(*)\\Utilization Percentage','\\Thread(electron*)\\Context Switches/sec','\\Thread(electron*)\\ID Process','\\Thread(dwm*)\\Context Switches/sec','\\Process(electron*)\\% Processor Time','\\Process(electron*)\\ID Process','\\Process(dwm)\\% Processor Time' -SampleInterval 1 -MaxSamples ${secs} -ErrorAction SilentlyContinue;
  $o=@(); foreach($x in $s){ $kk=0; $kka=0; $tot=0; $dcpu=0; $d=0; $cs=0; $dcs=0; $own=@{}; $csv=@{}; $pown=@{}; $pcpu=@{};
    foreach($c in $x.CounterSamples){ $pth=$c.Path;
      if($pth -match 'gpu engine'){ if($c.InstanceName -match 'pid_(\\d+)_'){ $id=[int]$matches[1]; if($p -contains $id){ $kka+=$c.CookedValue; if($pth -match 'engtype_3d'){$kk+=$c.CookedValue} }; if($id -eq $dwm -and $pth -match 'engtype_3d'){$d+=$c.CookedValue}; if($pth -match 'engtype_3d'){$tot+=$c.CookedValue} } }
      elseif($pth -match 'process\\(dwm\\)'){ $dcpu=$c.CookedValue }
      elseif($pth -match 'thread\\((electron[^)]*)\\)\\\\id process'){ $own[$matches[1]]=[int]$c.CookedValue }
      elseif($pth -match 'thread\\((electron[^)]*)\\)\\\\context'){ $csv[$matches[1]]=$c.CookedValue }
      elseif($pth -match 'thread\\(dwm[^)]*\\)\\\\context'){ $dcs+=$c.CookedValue }
      elseif($pth -match 'process\\((electron[^)]*)\\)\\\\id process'){ $pown[$matches[1]]=[int]$c.CookedValue }
      elseif($pth -match 'process\\((electron[^)]*)\\)\\\\% processor'){ $pcpu[$matches[1]]=$c.CookedValue } }
    foreach($k in $csv.Keys){ if($p -contains $own[$k]){ $cs+=$csv[$k] } }
    $cpu=0; foreach($k in $pcpu.Keys){ if($p -contains $pown[$k]){ $cpu+=$pcpu[$k] } }
    $o+=('{0:F2},{1:F2},{2:F0},{3:F0},{4:F2},{5:F3},{6:F2},{7:F3},{8:F2},{9:F2}' -f $kk,$d,$cs,$dcs,$kka,($cpu/$ncpu),$tot,($dcpu/$ncpu),$cpu,$dcpu) }; $o -join ';'`).then((txt) => {
    const rows = txt.trim().split(';').map((r) => r.replace(/[^\d.,-]/g, '')).filter(Boolean).map((r) => r.split(',').map(Number)).filter((r) => r.length === 10 && r.every((v) => !isNaN(v)));
    const use = rows.length > 2 ? rows.slice(1) : rows;
    const stat = (i) => { const v = use.map((r) => r[i]); return v.length ? { avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), min: Math.min(...v), max: Math.max(...v) } : null; };
    return { kk3d: stat(0), dwm3d: stat(1), kkCtxSw: stat(2), dwmCtxSw: stat(3), kkGpuAll: stat(4), cpuMachinePct: stat(5), sys3d: stat(6), dwmCpuMachinePct: stat(7), cpuOneCorePct: stat(8), dwmCpuOneCorePct: stat(9) };
  });
}

let WIN = null, P = null;
const js = (w, code) => w.webContents.executeJavaScript(code).catch((e) => ({ err: e.message }));
const INSTR = `(() => { if (window.__m) return 'already'; window.__m = { draw: 0, to: 0, dom: 0 }; window.__oST = window.setTimeout;
  window.setTimeout = function (fn, ms, ...a) { return __oST.call(window, function () { __m.to++; return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }, ms, ...a); };
  const K = window.KKdebug.KK; const od = K.render.draw; K.render.draw = function () { __m.draw++; return od.apply(this, arguments); };
  new MutationObserver((l) => { __m.dom += l.length; }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  const go = document.querySelector('[data-x=go]'); if (go) go.click(); return 'ok'; })()`;
const MEASURE = `(async () => { const K = window.KKdebug.KK; __m.draw = 0; __m.to = 0; __m.dom = 0; const t0 = performance.now(); await new Promise(r => __oST.call(window, r, (+'${process.env.KK_SAMPLES || 6}' - 1) * 1000)); const s = (performance.now() - t0) / 1000;
  const per = (n) => +(n / s).toFixed(1); const c = document.getElementById('game');
  return { drawPerSec: per(__m.draw), timeoutsPerSec: per(__m.to), domMutationsPerSec: per(__m.dom), targetFps: K.targetFps(), kkPaused: document.documentElement.classList.contains('kk-paused'), vis: document.visibilityState,
    audio: K.audio.ctx ? K.audio.ctx.state : 'none', fervorTier: K.fervorTier(), runningAnims: document.getAnimations().filter(a => a.playState === 'running').length,
    canvas: c.width + 'x' + c.height, cssW: c.style.width, dpr: devicePixelRatio, inner: innerWidth + 'x' + innerHeight, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null }; })()`;
const pidsNow = () => app.getAppMetrics().map((m) => m.pid);
const R = { mode: MODE, phases: {} };
async function phase(name, w = WIN, extra) {
  log('phase', name);
  if (process.env.KK_AFFINITY) R.affinity = (await ps(`foreach($i in @(${pidsNow().join(',')})){ try { (Get-Process -Id $i).ProcessorAffinity = [IntPtr]${parseInt(process.env.KK_AFFINITY, 16)} } catch {} }; (Get-Process -Id ${process.pid}).ProcessorAffinity`)).trim();
  app.getAppMetrics();
  const [m, g] = await Promise.all([js(w, MEASURE), sysSample(pidsNow())]);
  const mets = app.getAppMetrics();
  const priv = mets.reduce((a, x) => a + (x.memory.privateBytes || 0), 0);
  R.phases[name] = Object.assign({ visible: w.isVisible() }, m || {}, { cpuPct: +mets.reduce((a, x) => a + x.cpu.percentCPUUsage, 0).toFixed(2), wsMB: +(mets.reduce((a, x) => a + x.memory.workingSetSize, 0) / 1024).toFixed(0), privMB: +(priv / 1024).toFixed(0) }, g, extra || {});
  log(name, JSON.stringify(R.phases[name]));
}
const typeOn = (w = WIN) => js(w, `clearInterval(window.__typer); window.__typer = setInterval(() => window.KKdebug.KK.input.event('key'), 180)`);
const typeOff = (w = WIN) => js(w, `clearInterval(window.__typer)`);
const css = (w, id, txt) => js(w, `(() => { let s = document.getElementById('${id}'); if (!s) { s = document.createElement('style'); s.id = '${id}'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(txt)}; })()`);
const exStyle = (h) => { const ex = Number(W32.style(h, -20)); return { hex: '0x' + ex.toString(16), layered: !!(ex & 0x80000), transparent: !!(ex & 0x20), noRedirBitmap: !!(ex & 0x200000), topmost: !!(ex & 8), toolwindow: !!(ex & 0x80), noActivate: !!(ex & 0x8000000) }; };
const waitIdle = async (w = WIN) => { for (let i = 0; i < 80; i++) { const a = await js(w, 'window.KKdebug.KK.lastInputAgo()'); if (a > 47) return; await sleep(1000); } };

function loadMain() {
  let raw = fs.readFileSync(MAIN, 'utf8');
  if (process.env.KK_FAKEBATT) raw = raw.replace('function hasBattery() {', "function hasBattery() { if (process.env.KK_FAKEBATT) return process.env.KK_FAKEBATT === '1';");
  const src = raw + `\n;module.exports.__probe = { toggleVisible, applyVisibility, redock, dockBounds, sys, state, readSave, writeSave, savePath, saveDir, hasBattery, IS_DEMO, flushSave, writeSaveAsync, PIPE, gen: () => saveGen };`;
  const m = new Module(MAIN, module); m.filename = MAIN; m.paths = Module._nodeModulePaths(path.dirname(MAIN)); m._compile(src, MAIN);
  return m.exports.__probe;
}
const KNIGHT_ALPHA = `(() => { const c = window.KKdebug.KK.SPR.frames.knight[0].c; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })()`;
async function bootGame() {
  // main.js was already compiled before app ready (see bottom), so its low-GPU switch applies
  for (let i = 0; i < 100 && !BrowserWindow.getAllWindows()[0]; i++) await sleep(100);
  WIN = BrowserWindow.getAllWindows()[0];
  await sleep(3500);
  R.setup = await js(WIN, INSTR);
  R.knightAlphaAtBoot = await js(WIN, KNIGHT_ALPHA);
  if (process.env.KK_REBAKE === 'wrf') {
    // the proposed fix exactly: sprite canvases created with willReadFrequently (CPU-backed, survive the GPU wipe)
    await js(WIN, `(() => { const o = HTMLCanvasElement.prototype.getContext; window.__oGC = o; HTMLCanvasElement.prototype.getContext = function (t, opt) { return o.call(this, t, t === '2d' ? Object.assign({ willReadFrequently: true }, opt || {}) : opt); }; })()`);
  }
  if (process.env.KK_REBAKE === 'nowrf') {
    // R6 A/B: the pre-89f4651 GPU-backed sprite canvases (re-baked after the low-GPU wipe so they stay visible)
    await js(WIN, `(() => { const o = HTMLCanvasElement.prototype.getContext; window.__oGC = o; HTMLCanvasElement.prototype.getContext = function (t, opt) { if (opt && opt.willReadFrequently) { opt = Object.assign({}, opt); delete opt.willReadFrequently; } return o.call(this, t, opt); }; })()`);
  }
  if (process.env.KK_REBAKE === '1' || process.env.KK_REBAKE === 'wrf' || process.env.KK_REBAKE === 'nowrf') {
    // simulates the fix: re-run sprites.js after the low-GPU canvas wipe so the party is drawn while we measure
    R.rebake = await js(WIN, `new Promise((res) => { const s = document.createElement('script'); s.src = document.querySelector('script[src*="sprites.js"]').src.split('?')[0] + '?rebake=' + Date.now(); s.onload = () => res('ok'); s.onerror = () => res('error'); document.head.appendChild(s); })`);
    R.knightAlphaAfterRebake = await js(WIN, KNIGHT_ALPHA);
    if (process.env.KK_REBAKE === 'wrf' || process.env.KK_REBAKE === 'nowrf') await js(WIN, `HTMLCanvasElement.prototype.getContext = window.__oGC`);
  }
  log('sprites', 'knightAlphaAtBoot', R.knightAlphaAtBoot, 'rebake', R.rebake, R.knightAlphaAfterRebake);
}

// ------------------------------------------------------------------ perf
async function perf() {
  R.baselineNoKK = await sysSample([process.pid]);
  await bootGame();
  R.window = { bounds: WIN.getBounds(), exStyle: exStyle(hwndOf(WIN)), displays: screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, scale: d.scaleFactor, hz: d.displayFrequency })) };
  await js(WIN, `window.KKdebug.KK.gainGold(5000, 'dev')`);
  await waitIdle();
  await phase('idle');
  await typeOn(); await sleep(3000);
  await phase('typing_24fps_default');
  await js(WIN, `window.KKdebug.KK.ui.setSetting('sound', false)`); await sleep(500);
  await phase('typing_muted');
  await js(WIN, `window.KKdebug.KK.ui.setSetting('sound', true); window.KKdebug.KK.S.settings.fps = 30`); await sleep(800);
  await phase('typing_30fps');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 24`);
  await typeOff(); await sleep(800);
  P.toggleVisible(); await sleep(800);
  await phase('hidden_tray');
  P.toggleVisible(); await sleep(1500);
  powerMonitor.emit('lock-screen'); await sleep(800);
  await phase('locked_visible');
  powerMonitor.emit('unlock-screen'); await sleep(1000);
  // scan cost (same walk as main.js)
  const h = hwndOf(WIN); const t0 = process.hrtime.bigint(); for (let i = 0; i < 50; i++) scanExplain(h); R.scanMsEach = Number(process.hrtime.bigint() - t0) / 1e6 / 50;
  R.topLevelWindows = countTopLevel();
}

// ------------------------------------------------------------------ cost breakdown experiments
async function exp() {
  await bootGame();
  const h = hwndOf(WIN);
  await typeOn(); await sleep(3000);
  R.exStyleIgnoreTrue = exStyle(h);
  await phase('A_typing24_default');
  ipcMain.emit('kk:ignoreMouse', {}, false); await sleep(600);
  R.exStyleIgnoreFalse = exStyle(h);
  await phase('B_typing24_ignoreMouseOff_noLayeredStyle');
  ipcMain.emit('kk:ignoreMouse', {}, true); await sleep(600);
  await css(WIN, '__e1', '#game { visibility: hidden !important; }'); await sleep(500);
  await phase('C_typing24_canvasHidden_HUDonly');
  await css(WIN, '__e1', '#strip > *:not(#game), #strip *:not(#game) { visibility: hidden !important; } #game { visibility: visible !important; }'); await sleep(500);
  await phase('D_typing24_HUDhidden_canvasOnly');
  await css(WIN, '__e1', ''); await sleep(300);
  await js(WIN, `(() => { window.__uiU = window.KKdebug.KK.ui.update; window.KKdebug.KK.ui.update = function () {}; })()`); await sleep(500);
  await phase('E_typing24_noPerFrameHudWrites');
  await js(WIN, `window.KKdebug.KK.ui.update = window.__uiU`);
  // backing store at buffer resolution (Wd x 64), CSS size unchanged, pixelated upscale by the compositor
  R.backing = await js(WIN, `(() => { const c = document.getElementById('game'); const before = c.width + 'x' + c.height; const ctx = c.getContext('2d'); const wd = Math.round(c.width / (c.height / 64)); c.width = wd; c.height = 64; ctx.imageSmoothingEnabled = false;
    const o = ctx.drawImage; ctx.drawImage = function (img, x, y) { return o.call(this, img, 0, 0); }; return { before, after: c.width + 'x' + c.height }; })()`);
  await sleep(500);
  await phase('F_typing24_backing1x');
  await js(WIN, `window.KKdebug.KK.render.resize()`); await sleep(300);
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 12`); await sleep(500);
  await phase('G_typing12');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 24`);
  const b = WIN.getBounds(); WIN.setBounds({ ...b, width: Math.round(b.width / 2) }); await sleep(1500);
  await phase('H_typing24_halfWidthWindow');
  P.redock(); await sleep(1500);
  await typeOff();
  // opaque vs transparent: two identical experiment windows, the real strip hidden (and asleep)
  P.toggleVisible(); await sleep(800);
  for (const transparent of [true, false]) {
    const w = new BrowserWindow({ ...P.dockBounds(192), frame: false, transparent, backgroundColor: transparent ? '#00000000' : '#000000', resizable: false, focusable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
      webPreferences: { preload: path.join(ROOT, 'electron', 'preload.js'), contextIsolation: true, backgroundThrottling: false } });
    w.loadFile(path.join(ROOT, 'index.html'));
    await new Promise((r) => w.once('ready-to-show', r)); w.showInactive(); w.setIgnoreMouseEvents(true, { forward: true }); await sleep(3000);
    await js(w, INSTR); await typeOn(w); await sleep(2500);
    R['exStyle_' + (transparent ? 'transparent' : 'opaque')] = exStyle(hwndOf(w));
    await phase(transparent ? 'I_expWindow_transparent_typing24' : 'J_expWindow_OPAQUE_typing24', w);
    await typeOff(w); w.destroy(); await sleep(1200);
  }
  P.toggleVisible();
}

// KK_SWITCHES="disable-direct-composition,disable-gpu-compositing" etc: Chromium switches before ready
for (const s of (process.env.KK_SWITCHES || '').split(',').filter(Boolean)) { const [k, v] = s.split('='); app.commandLine.appendSwitch(k, v); }
async function quick() {
  await bootGame();
  await waitIdle();
  await phase('idle');
  await typeOn(); await sleep(3000);
  await phase('typing24');
  await typeOff();
  R.gpuInfo = app.getGPUFeatureStatus();
  R.exStyle = exStyle(hwndOf(WIN));
  // transparency check: a magenta window behind the strip, a toast grows the strip upward;
  // the strip's empty (transparent) area must show magenta on the real screen
  const d = screen.getPrimaryDisplay();
  const bg = await launchElectronFs({ bounds: { x: d.workArea.x, y: d.workArea.y + d.workArea.height - 600 - 50 } }, '#ff00ff', true, 9000)();
  await sleep(800);
  await js(WIN, `window.KKdebug.KK.ui.toast('probe toast: transparency check', 'coin', 'gold', 8)`); await sleep(1500);
  const b = WIN.getBounds();
  const { desktopCapturer } = require('electron');
  const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) } });
  const src = srcs.find((s) => String(s.display_id) === String(d.id)) || srcs[0];
  const img = src.thumbnail; const sz = img.getSize(); const bmp = img.toBitmap(); const k = sz.width / d.size.width;
  const px = (x, y) => { const i = (Math.round(y * k) * sz.width + Math.round(x * k)) * 4; return [bmp[i + 2], bmp[i + 1], bmp[i]]; };
  R.transparency = { windowBounds: b, transparentAreaPixel: px(b.x + 60, b.y + 8), canvasPixel: px(b.x + 60, b.y + b.height - 20), expectTransparent: [255, 0, 255] };
  fs.writeFileSync(path.join(OUT, 'transp_' + (process.env.KK_SWITCHES || 'default').replace(/\W+/g, '_') + '.png'), img.crop({ x: 0, y: Math.round((b.y - 200) * k), width: Math.round(1400 * k), height: Math.round((b.height + 200) * k) }).toPNG());
  log('transparency', JSON.stringify(R.transparency));
  await bg.close();
}
// idle: is it the 10 fps canvas, the 250 ms `blink` class toggle on <html>, or the HUD?
async function idleExp() {
  await bootGame();
  await waitIdle();
  await phase('idle_a');
  await phase('idle_b_repeat');
  await js(WIN, `(() => { const cl = document.documentElement.classList; const o = cl.toggle.bind(cl); cl.toggle = (n, f) => n === 'blink' ? false : o(n, f); cl.remove('blink'); })()`); await sleep(500);
  await phase('idle_c_noBlinkToggle');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 8`); await sleep(500);
  await js(WIN, `(() => { const K = window.KKdebug.KK; const o = K.targetFps; K.targetFps = () => Math.min(o(), 6); })()`); await sleep(500);
  await phase('idle_d_noBlink_6fps');
  await js(WIN, `window.KKdebug.KK.S.settings.fps = 24; window.KKdebug.KK.targetFps = (() => 0)`); await sleep(1500);
  await phase('idle_e_frameLoopFrozen_windowShown');
  await typeOn(); await sleep(1500);
}

// mouse: the hook is a WH_MOUSE_LL hook too, so every mouse MOVE (which the game ignores) still crosses
// into the main process. Inject ~1 kHz relative moves and compare hook on vs hook removed (counting paused).
async function mouse() {
  await bootGame();
  const { uIOhook } = require(path.join(ROOT, 'node_modules', 'uiohook-napi'));
  let moves = 0; uIOhook.on('mousemove', () => { moves++; });
  const jig = () => new Promise((res) => { const cp = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'mouse.ps1'), '-Secs', String((+process.env.KK_SAMPLES || 6) + 2)]); let o = ''; cp.stdout.on('data', (b) => (o += b)); cp.on('exit', () => res(o.trim())); });
  await waitIdle();
  await phase('idle_hookOn_noMouse');
  for (const on of [true, false]) {
    if (!on) { await js(WIN, `window.KKdebug.KK.ui.setSetting('countInput', false)`); await sleep(1000); }
    moves = 0; const j = jig(); await sleep(800);
    await phase(on ? 'mouseMoving_hookOn' : 'mouseMoving_hookRemoved_countingPaused');
    R.phases[on ? 'mouseMoving_hookOn' : 'mouseMoving_hookRemoved_countingPaused'].jsMouseMoveEvents = moves; R['jig_' + on] = await j;
    await sleep(1000);
  }
  await js(WIN, `window.KKdebug.KK.ui.setSetting('countInput', true)`);
}

// ------------------------------------------------------------------ fullscreen matrix
const physOf = (d) => screen.dipToScreenRect(null, d.bounds);
const launchElectronFs = (d, color, windowed, ms = 9000) => async () => {
  const cp = spawn(process.execPath, [path.join(__dirname, 'fsapp'), '--x', d.bounds.x + 50, '--y', d.bounds.y + 50, '--w', 800, '--h', 600, '--ms', ms, '--color', color, '--windowed', windowed ? '1' : '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let hwnd = null; cp.stdout.on('data', (b) => { const m = /HWND (\d+)/.exec(String(b)); if (m) hwnd = Number(m[1]); });
  for (let i = 0; i < 50 && !hwnd; i++) await sleep(100);
  await sleep(300);
  return { pid: cp.pid, hwnd, close: async () => { try { cp.kill(); } catch (e) { /* gone */ } await sleep(400); } };
};
const launchForm = (d, mode, ms = 9000) => async () => {
  const r = physOf(d);
  const cp = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'form.ps1'), '-X', r.x, '-Y', r.y, '-W', r.width, '-H', r.height, '-Mode', mode, '-Ms', ms], { stdio: ['ignore', 'pipe', 'pipe'] });
  let hwnd = null; cp.stdout.on('data', (b) => { const m = /HWND (\d+)/.exec(String(b)); if (m) hwnd = Number(m[1]); });
  for (let i = 0; i < 100 && !hwnd; i++) await sleep(100);
  await sleep(500);
  return { pid: cp.pid, hwnd, close: async () => { try { cp.kill(); } catch (e) { /* gone */ } await sleep(400); } };
};
async function fsCase(name, stripD, launch, expectHidden, secs = 6, mid) {
  P.state.displayId = stripD.id; P.redock(); await sleep(1600);
  const selfH = hwndOf(WIN);
  const ctl = await launch();
  if (ctl.hwnd && !/overlay/.test(name)) forceFg(ctl.hwnd);
  const tl = []; const t0 = Date.now(); let did = false, explain = null;
  while (Date.now() - t0 < secs * 1000) {
    if (mid && !did && Date.now() - t0 > mid.at * 1000) { did = true; await mid.fn(); }
    tl.push({ t: +((Date.now() - t0) / 1000).toFixed(1), vis: WIN.isVisible(), q: quns() });
    if (!explain && Date.now() - t0 > 3500) explain = scanExplain(selfH);
    await sleep(250);
  }
  await ctl.close(); if (mid && mid.close) await mid.close();
  const t1 = Date.now(); let back = null;
  while (Date.now() - t1 < 5000) { if (WIN.isVisible()) { back = +((Date.now() - t1) / 1000).toFixed(2); break; } await sleep(100); }
  const late = tl.filter((x) => x.t >= 3);
  const hiddenLate = late.length && late.every((x) => !x.vis);
  const everHidden = tl.some((x) => !x.vis);
  const pass = expectHidden ? hiddenLate : !everHidden;
  const hid = tl.find((x) => !x.vis);
  R.fs[name] = { strip: stripD.label || stripD.id, expect: expectHidden ? 'hidden' : 'visible', result: hiddenLate ? 'hidden' : everHidden ? 'flicker' : 'visible', pass, hiddenAfterS: hid ? hid.t : null, backAfterS: back, qunsSeen: [...new Set(tl.map((x) => x.q))], decidedBy: explain && explain.decidedBy, topmostSkipped: explain && explain.topmostSkipped };
  log(name, pass ? 'PASS' : 'FAIL', JSON.stringify(R.fs[name]));
  await sleep(1200);
}
async function fsMatrix() {
  await bootGame();
  R.fs = {};
  const ds = screen.getAllDisplays();
  R.displays = ds.map((d) => ({ id: d.id, label: d.label, bounds: d.bounds, phys: physOf(d), workArea: d.workArea, primary: d.id === screen.getPrimaryDisplay().id }));
  // what decides on each monitor right now (idle desktop)
  R.idleDecision = {};
  for (const d of ds) { P.state.displayId = d.id; P.redock(); await sleep(1200); R.idleDecision[d.label || d.id] = scanExplain(hwndOf(WIN)); }
  R.topLevelWindows = countTopLevel();
  for (const d of ds) {
    const o = ds.find((x) => x.id !== d.id);
    const tag = (d.label || String(d.id)).replace(/\W+/g, '');
    await fsCase(`${tag}__electronFs_same`, d, launchElectronFs(d, '#00ff00'), true);
    await fsCase(`${tag}__electronFs_other`, d, launchElectronFs(o, '#00ffff'), false);
    await fsCase(`${tag}__borderless_same`, d, launchForm(d, 'borderless'), true);
    await fsCase(`${tag}__maximized_same`, d, launchForm(d, 'maximized'), false);
    await fsCase(`${tag}__bigframe_same(maximized,no-taskbar)`, d, launchForm(d, 'bigframe'), false);
    await fsCase(`${tag}__topmostOverlay_same`, d, launchForm(d, 'overlay'), false);
    await fsCase(`${tag}__topmostBorderless_same(game)`, d, launchForm(d, 'topborderless'), true);
    await fsCase(`${tag}__borderlessMaximized_same(kiosk)`, d, launchForm(d, 'borderlessmax'), true);
    await fsCase(`${tag}__thickBorderless_same(WPF)`, d, launchForm(d, 'thickborderless'), true);
  }
  // fullscreen on the strip's monitor, then the user clicks a window on another monitor: must stay hidden
  for (const d of ds) {
    const o = ds.find((x) => x.id !== d.id); let w2 = null;
    await fsCase(`${(d.label || d.id)}__fs_then_focus_other`.replace(/\W+/g, '_'), d, launchElectronFs(d, '#00ff00', false, 12000), true, 8,
      { at: 2.5, fn: async () => { w2 = await launchElectronFs(o, '#ff8800', true, 9000)(); if (w2.hwnd) forceFg(w2.hwnd); }, close: async () => { if (w2) await w2.close(); } });
  }
  P.state.displayId = screen.getPrimaryDisplay().id; P.redock();
}

// ------------------------------------------------------------------ saves
const wr = (d, n, t) => { fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, n), t); };
const SAVE_SEED = {
  'ls-migrate': () => {},
  'corrupt-main': () => { wr(FULL_DIR, F.main, '{"v":1,"floor":5'); wr(FULL_DIR, F.b1, save({ floor: 23 })); wr(FULL_DIR, F.b2, save({ floor: 21 })); },
  'zero-main': () => { wr(FULL_DIR, F.main, ''); wr(FULL_DIR, F.b1, save({ floor: 23 })); },
  'all-corrupt-with-demo': () => { wr(FULL_DIR, F.main, '{"v":1,"flo'); wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'demo-import': () => { wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'wipe-then-reload': () => { wr(FULL_DIR, F.main, save({ floor: 55 })); wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'demo-build': () => { wr(FULL_DIR, F.main, save({ floor: 55 })); wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'rotation': () => { wr(FULL_DIR, F.main, save({ floor: 100 })); },
  'rename-locked': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },
  'lock-short': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },
  'imported-then-deleted': () => { wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); wr(FULL_DIR, 'demo-imported.flag', '1'); },
  'session-end': () => { wr(FULL_DIR, F.main, save({ floor: 70 })); },
  // R6 (89f4651): newer .tmp wins, import marker after the first own save, async retries
  'tmp-newer': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); wr(FULL_DIR, F.main + '.tmp', save({ floor: 61 })); const t = Date.now() / 1000; fs.utimesSync(path.join(FULL_DIR, F.main), t - 30, t - 30); },
  'tmp-older': () => { wr(FULL_DIR, F.main + '.tmp', save({ floor: 59 })); wr(FULL_DIR, F.main, save({ floor: 60 })); const t = Date.now() / 1000; fs.utimesSync(path.join(FULL_DIR, F.main + '.tmp'), t - 60, t - 60); },
  'tmp-newer-corrupt': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); wr(FULL_DIR, F.main + '.tmp', '{"v":1,"flo'); const t = Date.now() / 1000; fs.utimesSync(path.join(FULL_DIR, F.main), t - 30, t - 30); },
  'tmp-only': () => { wr(FULL_DIR, F.main + '.tmp', save({ floor: 61 })); },
  'marker-then-corrupt': () => { wr(FULL_DIR, F.main, save({ floor: 55 })); wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'own-marker-corrupt-with-demo': () => { wr(FULL_DIR, F.main, '{"v":1,"flo'); wr(FULL_DIR, 'demo-imported.flag', 'own save 1'); wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'async-lock': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },
  'async-stale': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },
  'lowgpu-off': () => { wr(FULL_DIR, F.main, save({ floor: 3, settings: { lowGpu: false } })); },
  'lowgpu-on': () => { wr(FULL_DIR, F.main, save({ floor: 3, settings: { lowGpu: true } })); },
  'lowgpu-auto': () => { wr(FULL_DIR, F.main, save({ floor: 3, settings: { lowGpu: 'auto' } })); },
  'lowgpu-nosettings': () => { wr(FULL_DIR, F.main, save({ floor: 3 })); },
  'lowgpu-corrupt': () => { wr(FULL_DIR, F.main, '{"v":1,"settings":{"lowGpu":false'); },
  // R7: a R4/R5 save stuck on the old default (lowGpu true, never migrated) vs a player who chose ON
  'lowgpu-legacy-true': () => { wr(FULL_DIR, F.main, save({ floor: 3, settings: { lowGpu: true } })); },
  'lowgpu-chosen-true': () => { wr(FULL_DIR, F.main, save({ floor: 3, settings: { lowGpu: true, lowGpuMigrated: true } })); },
  'async-stale-quit': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },
};
function seedSaves(sc) {
  if (sc === 'relaunch') return; // keep whatever the previous scenario left
  fs.rmSync(path.join(APPDATA, 'Keystroke Keep'), { recursive: true, force: true });
  fs.rmSync(path.join(APPDATA, 'Keystroke Keep Demo'), { recursive: true, force: true });
  // userData (localStorage) is cleared by run_saves.sh between runs: it is locked while we run
  SAVE_SEED[sc]();
}
async function saves(sc) {
  R.before = { full: dirState(FULL_DIR), demo: dirState(DEMO_DIR) };
  if (/^tmp-/.test(sc)) { const t = P.readSave(); R.readSaveAtStart = t ? JSON.parse(t).floor : null; } // what main.js hands the renderer
  await bootGame();
  await sleep(2500); // the restore / import toast fires 2 s after boot
  R.saveInfo = await js(WIN, `window.kkNative.saveInfo()`);
  R.toasts = await js(WIN, `[...document.querySelectorAll('#toasts .toast')].map(t => t.textContent)`);
  const g = async () => js(WIN, `(() => { const K = window.KKdebug.KK; return { floor: K.S.floor, demoCap: K.DEMO_CAP, ls: (() => { try { const r = localStorage.getItem('keystroke-keep-save-v1'); return r ? JSON.parse(r).floor : null; } catch (e) { return 'err'; } })() }; })()`);
  R.loaded = await g();
  R.savePath = P.savePath();
  await js(WIN, `window.KKdebug.KK.save(true)`); await sleep(300);
  R.afterFirstSave = { full: dirState(FULL_DIR), demo: dirState(DEMO_DIR) };
  if (sc === 'wipe-then-reload') {
    // exactly what Settings > Reset does (ui.js:472)
    await js(WIN, `(() => { const K = window.KKdebug.KK; K.resetting = true; K.wipeSave(); location.reload(); })()`);
    await sleep(4500); await js(WIN, INSTR);
    R.afterResetReload = await g();
    R.afterResetFiles = { full: dirState(FULL_DIR), demo: dirState(DEMO_DIR) };
  }
  if (sc === 'rotation') {
    const realNow = Date.now; let off = 0; Date.now = () => realNow() + off;
    R.rotation = [];
    for (const f of [101, 102, 103, 104, 105]) {
      off += 11 * 60 * 1000;
      const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: f })); // a save every "11 minutes"
      const e2 = {}; ipcMain.emit('kk:saveSync', e2, save({ floor: f + 0.5 })); // and one 10 s later (no rotation)
      R.rotation.push({ wrote: [f, f + 0.5], ok: [e.returnValue, e2.returnValue], files: dirState(FULL_DIR) });
    }
    Date.now = realNow;
  }
  if (sc === 'rename-locked') {
    const target = P.savePath();
    // hold the save open WITHOUT FILE_SHARE_DELETE (what AV scanners, backup and sync tools do)
    const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); Start-Sleep -Seconds 5; $f.Close()`]);
    await sleep(1500);
    const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: 61 }));
    R.lockedWrite = { returnValue: e.returnValue, mainFloorNow: floorOf(target), tmpLeft: fs.existsSync(target + '.tmp') };
    await new Promise((r) => holder.on('exit', r)); await sleep(300);
    const e2 = {}; ipcMain.emit('kk:saveSync', e2, save({ floor: 62 }));
    R.afterUnlockWrite = { returnValue: e2.returnValue, mainFloorNow: floorOf(target), tmpLeft: fs.existsSync(target + '.tmp') };
  }
  if (sc === 'lock-short') {
    // locks of different lengths: the rename retries for 20+40+80+160 ms
    const target = P.savePath(); R.locks = [];
    for (const ms of [100, 250, 600, 2000]) {
      const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds ${ms}; $f.Close()`]);
      await new Promise((r) => holder.stdout.on('data', (b) => { if (/LOCKED/.test(String(b))) r(); }));
      const t0 = Date.now(); const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: 61 + R.locks.length }));
      R.locks.push({ lockMs: ms, ok: e.returnValue, blockedMainMs: Date.now() - t0, mainFloorNow: floorOf(target), tmpLeft: fs.existsSync(target + '.tmp') });
      await new Promise((r) => holder.on('exit', r)); await sleep(300);
    }
  }
  if (sc === 'session-end') {
    // the renderer saves every 10 s; session-end flushes the LAST TEXT IT SENT (not the live state)
    await js(WIN, `window.KKdebug.KK.S.floor = 71; window.KKdebug.KK.save(true)`); await sleep(300);
    await js(WIN, `window.KKdebug.KK.S.floor = 72`); // live state the renderer has not saved yet
    fs.writeFileSync(P.savePath(), save({ floor: 1 })); // pretend the file is stale
    WIN.emit('session-end', { preventDefault() {} });
    R.afterSessionEnd = { mainFloor: floorOf(P.savePath()), liveFloor: await js(WIN, `window.KKdebug.KK.S.floor`) };
  }
  if (sc === 'marker-then-corrupt') {
    // a full-game install that has saved once, then loses main + backups: must NOT import the demo
    const mk = path.join(FULL_DIR, 'demo-imported.flag');
    R.markerAfterFirstSave = fs.existsSync(mk) ? fs.readFileSync(mk, 'utf8') : 'missing';
    for (const n of [F.main, F.b1, F.b2, F.b3]) { try { fs.unlinkSync(path.join(FULL_DIR, n)); } catch (e) { /* none */ } }
    fs.writeFileSync(path.join(FULL_DIR, F.main), '{"v":1,"flo');
    const t = P.readSave(); const e = {}; ipcMain.emit('kk:saveInfo', e);
    R.readAfterCorrupt = { returned: t ? JSON.parse(t).floor : null, source: e.returnValue };
  }
  if (sc === 'async-lock') {
    // async kk:save path: must not block the main process; retries 20/40/80/160/320 ms (620 ms window)
    const target = P.savePath(); R.asyncLocks = [];
    for (const ms of [100, 300, 600, 1000, 2000]) {
      const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds ${ms}; $f.Close()`]);
      const exited = new Promise((r) => holder.on('exit', r));
      await new Promise((r) => holder.stdout.on('data', (b) => { if (/LOCKED/.test(String(b))) r(); }));
      const want = 200 + R.asyncLocks.length;
      let maxLag = 0, last = Date.now(); const lagT = setInterval(() => { const n = Date.now(); maxLag = Math.max(maxLag, n - last - 5); last = n; }, 5);
      const t0 = Date.now(); ipcMain.emit('kk:save', {}, save({ floor: want })); const blocked = Date.now() - t0;
      let landed = null; while (Date.now() - t0 < 4000) { if (floorOf(target) === want) { landed = Date.now() - t0; break; } await sleep(10); }
      clearInterval(lagT);
      await exited; await sleep(300);
      const row = { lockMs: ms, emitBlockedMs: blocked, maxEventLoopLagMs: maxLag, landedAfterMs: landed, mainFloorNow: floorOf(target), tmpLeft: fs.existsSync(target + '.tmp'), tmpFloor: floorOf(target + '.tmp') };
      const t = P.readSave(); row.readSaveNow = t ? JSON.parse(t).floor : null; // what a reboot would load (newer .tmp wins)
      R.asyncLocks.push(row);
    }
  }
  if (sc === 'async-stale') {
    // an async save hits a lock and schedules retries; a sync save (quit path) lands meanwhile.
    // Does a pending retry later overwrite the newer sync save with the older text?
    const target = P.savePath();
    const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds 250; $f.Close()`]);
    await new Promise((r) => holder.stdout.on('data', (b) => { if (/LOCKED/.test(String(b))) r(); }));
    ipcMain.emit('kk:save', {}, save({ floor: 301 })); // older, async, fails -> retry pending
    const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: 302 })); // newer, sync (blocks until the lock clears)
    R.syncOk = e.returnValue; R.afterSync = floorOf(target);
    await new Promise((r) => holder.on('exit', r)); await sleep(1500);
    R.afterRetries = floorOf(target);
    R.verdict = R.afterRetries === 302 ? 'newest kept' : 'STALE retry overwrote the newer save (' + R.afterRetries + ')';
  }
  if (sc === 'async-stale-quit') {
    // the real quit order: async save hits a lock (retry pending) -> before-quit flushSave -> beforeunload saveSync
    const target = P.savePath();
    const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds 250; $f.Close()`]);
    await new Promise((r) => holder.stdout.on('data', (b) => { if (/LOCKED/.test(String(b))) r(); }));
    ipcMain.emit('kk:save', {}, save({ floor: 401 })); R.genAfterAsync = P.gen();
    P.flushSave(); R.genAfterFlush = P.gen();
    const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: 402 })); R.genAfterSync = P.gen();
    R.syncOk = e.returnValue; R.afterSync = floorOf(target);
    await new Promise((r) => holder.on('exit', r)); await sleep(1500);
    R.afterRetries = floorOf(target);
    R.verdict = R.afterRetries === 402 ? 'newest kept' : 'STALE retry overwrote the newer save (' + R.afterRetries + ')';
  }
  if (/^lowgpu-|^relaunch$/.test(sc)) {
    R.rendererSettings = await js(WIN, `(() => { const s = window.KKdebug.KK.S.settings; return { lowGpu: s.lowGpu, lowGpuMigrated: s.lowGpuMigrated, volume: s.volume }; })()`);
    await js(WIN, `window.KKdebug.KK.save(true)`); await sleep(300);
    try { const o = JSON.parse(fs.readFileSync(P.savePath(), 'utf8')).settings; R.savedSettings = { lowGpu: o.lowGpu, lowGpuMigrated: o.lowGpuMigrated }; } catch (e) { R.savedSettings = 'unreadable'; }
  }
  if (sc === 'corrupt-main') {
    // 11 "minutes" later the ring must hold only good saves
    const realNow = Date.now; Date.now = () => realNow() + 11 * 60 * 1000;
    const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: 24 })); Date.now = realNow;
    R.after11min = dirState(FULL_DIR);
  }
  R.lowGpu = { switch: app.commandLine.hasSwitch('disable-direct-composition'), gpu: app.getGPUFeatureStatus().gpu_compositing };
  R.files = { full: dirState(FULL_DIR), demo: dirState(DEMO_DIR) };
  try { R.mainBytes = fs.statSync(P.savePath()).size; } catch (e) { /* none */ }
}
// sprites: does the party render? capturePage + a real screen grab of the strip, plus a pixel census
async function sprites() {
  await bootGame();
  await sleep(4000);
  R.gpuInfo = app.getGPUFeatureStatus();
  const tag = (process.env.KK_TAG || '') + (process.env.KK_LOWGPU === '0' ? 'lowgpu_off' : 'lowgpu_on');
  const img = await WIN.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, `sprites_${tag}_capturePage.png`), img.toPNG());
  const b = WIN.getBounds();
  const d = screen.getDisplayNearestPoint({ x: b.x + 10, y: b.y + 10 });
  const { desktopCapturer } = require('electron');
  const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: Math.round(d.size.width * d.scaleFactor), height: Math.round(d.size.height * d.scaleFactor) } });
  const src = srcs.find((x) => String(x.display_id) === String(d.id)) || srcs[0];
  const k = d.scaleFactor;
  const crop = src.thumbnail.crop({ x: Math.round((b.x - d.bounds.x) * k), y: Math.round((b.y - d.bounds.y) * k), width: Math.round(b.width * k), height: Math.round(b.height * k) });
  fs.writeFileSync(path.join(OUT, `sprites_${tag}_screen.png`), crop.toPNG());
  // canvas-side truth: what the page itself drew (no compositor involved)
  R.canvasCensus = await js(WIN, `(() => { const c = document.getElementById('game'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4) set.add((d[i] >> 3) << 10 | (d[i+1] >> 3) << 5 | (d[i+2] >> 3)); return { colours: set.size, heroes: window.KKdebug.W.heroes.map(h => ({ id: h.id, x: Math.round(h.x), dead: !!h.dead })) }; })()`);
  const bmp = crop.toBitmap(); const set = new Set(); for (let i = 0; i < bmp.length; i += 4) set.add((bmp[i] >> 3) << 10 | (bmp[i + 1] >> 3) << 5 | (bmp[i + 2] >> 3));
  R.screenColours = set.size;
}
// losttime: when do baked canvases go blank in low-GPU mode, and which canvas kinds survive?
async function lostTime() {
  for (let i = 0; i < 200 && !BrowserWindow.getAllWindows()[0]; i++) await sleep(25);
  WIN = BrowserWindow.getAllWindows()[0];
  await new Promise((r) => WIN.webContents.once('dom-ready', r));
  const t0 = Date.now();
  await js(WIN, `(() => { window.__lostLog = []; const mk = (opts) => { const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d', opts); g.fillStyle = '#f00'; g.fillRect(2, 2, 8, 8); c.addEventListener('contextlost', () => __lostLog.push('lost ' + JSON.stringify(opts) + ' ' + Math.round(performance.now()))); c.addEventListener('contextrestored', () => __lostLog.push('restored ' + JSON.stringify(opts) + ' ' + Math.round(performance.now()))); return c; };
    window.__A = mk({}); window.__B = mk({ willReadFrequently: true }); window.__C = mk({}); __C.getContext('2d').getImageData(0, 0, 1, 1); return 'ok'; })()`);
  const probeJs = `(() => { const a = (c) => { if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; }; const K = window.KK; const k = K && K.SPR && K.SPR.frames.knight ? K.SPR.frames.knight[0].c : null; return { t: Math.round(performance.now()), plain: a(__A), wrf: a(__B), readOnce: a(__C), knight: a(k), log: __lostLog.slice() }; })()`;
  R.timeline = [];
  while (Date.now() - t0 < 9000) { R.timeline.push(Object.assign({ ms: Date.now() - t0 }, await js(WIN, probeJs))); await sleep(250); }
  R.preloadLog = await js(WIN, `document.documentElement.dataset.kkdiag || null`);
  log('preload', R.preloadLog);
  log('timeline', JSON.stringify(R.timeline.filter((x, i, a) => i === 0 || JSON.stringify([x.plain, x.wrf, x.readOnce, x.knight, x.log.length]) !== JSON.stringify([a[i - 1].plain, a[i - 1].wrf, a[i - 1].readOnce, a[i - 1].knight, a[i - 1].log.length]))));
}
async function lsSeed() {
  const w = new BrowserWindow({ show: false });
  await w.loadFile(path.join(__dirname, 'blank.html'));
  R.seeded = await js(w, `(() => { localStorage.setItem('keystroke-keep-save-v1', ${JSON.stringify(save({ floor: 17 }))}); return localStorage.getItem('keystroke-keep-save-v1').length; })()`);
  await session.defaultSession.flushStorageData(); await sleep(800);
}

// ---- R6: instance tests (same-build relaunch, demo<->full pipe dialog, slow owner quit)
const ILOG = path.join(OUT, 'instance_log.jsonl');
const ilog = (ev, extra) => { try { fs.appendFileSync(ILOG, JSON.stringify(Object.assign({ t: Date.now(), pid: process.pid, mode: MODE, demo: process.env.KK_DEMO === '1', tag: process.env.KK_TAG || '', ev }, extra || {})) + '\n'); } catch (e) { /* ignore */ } };
const INSTANCE = ['hold', 'noop'].includes(MODE);
if (INSTANCE) {
  ilog('start', { userData: app.getPath('userData'), fakeUser: process.env.KK_FAKEUSER || '' });
  process.on('exit', (c) => ilog('exit', { code: c, uptimeMs: Math.round(process.uptime() * 1000) }));
  app.on('will-quit', () => ilog('will-quit'));
  app.on('second-instance', () => setTimeout(() => ilog('second-instance', { visibleAfter: !!(WIN && !WIN.isDestroyed() && WIN.isVisible()), userShown: P && P.sys.userShown }), 600));
  if (process.env.KK_SLOWQUIT) app.on('before-quit', () => { const t = Date.now(); ilog('slow-quit-begin'); while (Date.now() - t < +process.env.KK_SLOWQUIT) { /* busy */ } });
  if (process.env.KK_AUTODIALOG !== undefined) {
    const { dialog } = require('electron');
    dialog.showMessageBoxSync = (a, b) => {
      const o = b || a; let n = 0; try { n = fs.readFileSync(ILOG, 'utf8').split('\n').filter((l) => l.includes('"ev":"dialog"')).length; } catch (e) { /* none */ }
      const pick = n >= 4 ? 1 : +process.env.KK_AUTODIALOG; // loop guard: cancel after 4 dialogs
      ilog('dialog', { message: o.message, detail: o.detail, buttons: o.buttons, picked: pick });
      return pick;
    };
  }
}
async function hold() {
  for (let i = 0; i < (+process.env.KK_WINWAIT || 80) && !BrowserWindow.getAllWindows()[0]; i++) await sleep(100);
  WIN = BrowserWindow.getAllWindows()[0];
  if (!WIN) { ilog('no-window'); return; }
  ilog('window', { lowGpuSwitch: app.commandLine.hasSwitch('disable-direct-composition'), pipe: P && P.PIPE });
  await sleep(3500);
  const live = process.env.KK_DEMO === '1' ? 33 : 77;
  await js(WIN, `window.KKdebug.KK.S.floor = ${live}`); // live, unsaved: does the quit path save it?
  if (process.env.KK_HIDE === '1') { P.toggleVisible(); await sleep(500); }
  ilog('ready', { knight: await js(WIN, KNIGHT_ALPHA), visible: WIN.isVisible(), liveFloor: live });
  await sleep((+process.env.KK_HOLD || 20) * 1000);
  ilog('hold-expired', { visible: !WIN.isDestroyed() && WIN.isVisible() });
}

// ---- R5: seed the probe's save, then compile main.js BEFORE ready (its low-GPU switch must precede the GPU process)
if (MODE.startsWith('save:')) seedSaves(MODE.slice(5));
else if (MODE !== 'lsseed' && MODE !== 'noop') {
  // R6: seed only this build's folder (instance tests run a full and a demo probe side by side)
  const demo = process.env.KK_DEMO === '1';
  fs.rmSync(path.join(APPDATA, demo ? 'Keystroke Keep Demo' : 'Keystroke Keep'), { recursive: true, force: true });
  const lg = process.env.KK_LOWGPU; // unset = no lowGpu key = 'auto'
  wr(demo ? DEMO_DIR : FULL_DIR, F.main, save({ floor: 1, demoSave: demo || undefined, settings: lg === undefined ? {} : { lowGpu: lg === 'auto' ? 'auto' : lg !== '0' } }));
}
if (MODE !== 'lsseed') P = loadMain();
if (MODE === 'losttime') app.on('session-created', (ses) => { try { ses.registerPreloadScript({ type: 'frame', filePath: path.join(__dirname, 'diag_preload.js') }); } catch (e) { ses.setPreloads([path.join(__dirname, 'diag_preload.js')]); } });
R.childGone = []; app.on('child-process-gone', (_e, d) => { R.childGone.push(Object.assign({ atMs: Math.round(process.uptime() * 1000) }, d)); log('child-process-gone', JSON.stringify(d)); });
app.on('gpu-info-update', () => { R.gpuInfoUpdates = (R.gpuInfoUpdates || 0) + 1; });
(async () => {
  await app.whenReady();
  R.lowGpuSwitch = app.commandLine.hasSwitch('disable-direct-composition');
  R.cores = +process.env.KK_CORES || require('os').cpus().length;
  R.switches = process.env.KK_SWITCHES || '';
  R.hasBattery = P && P.hasBattery ? P.hasBattery() : 'n/a';
  if (INSTANCE) { if (MODE === 'hold') await hold(); app.exit(0); return; }
  if (MODE === 'perf') await perf();
  else if (MODE === 'quick') await quick();
  else if (MODE === 'idleexp') await idleExp();
  else if (MODE === 'mouse') await mouse();
  else if (MODE === 'exp') await exp();
  else if (MODE === 'fs') await fsMatrix();
  else if (MODE === 'lsseed') await lsSeed();
  else if (MODE === 'sprites') await sprites();
  else if (MODE === 'losttime') await lostTime();
  else if (MODE === 'eval') { await bootGame(); await sleep(1500); R.gpuInfo = app.getGPUFeatureStatus(); R.eval = await js(WIN, fs.readFileSync(process.env.KK_EVAL, 'utf8')); log('eval', JSON.stringify(R.eval)); }
  else if (MODE.startsWith('save:')) await saves(MODE.slice(5));
  const name = MODE.replace(/[^a-z0-9-]/gi, '_');
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(R, null, 2));
  log('done', name);
  app.exit(0);
})().catch((e) => { console.error('[probe] FAILED', e); try { fs.writeFileSync(path.join(OUT, 'fatal_' + MODE.replace(/\W/g, '_') + '.json'), JSON.stringify(Object.assign(R, { fatal: String(e && e.stack) }), null, 2)); } catch (x) { /* ignore */ } app.exit(2); });
