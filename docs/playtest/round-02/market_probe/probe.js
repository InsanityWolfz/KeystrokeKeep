// Round 02 market probe: loads the REAL electron/main.js under a separate app name
// (userData = %APPDATA%/kk-market-probe, so the player's real save is never touched),
// in snapshot mode (no global input hook), then measures the shell's desktop behaviour.
// Run from the project dir:  npx electron docs/playtest/round-02/market_probe
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
process.env.KK_SNAPSHOT = path.join(OUT, 'final.png');
process.env.KK_SNAPSHOT_DELAY = '400000'; // we quit ourselves long before this
require(path.join(__dirname, '..', '..', '..', '..', 'electron', 'main.js'));

const { app, BrowserWindow, powerMonitor, globalShortcut, desktopCapturer, screen } = require('electron');
const R = { phases: {} };
const log = (...a) => console.log('[probe]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ps = (script) => new Promise((res) => execFile('powershell', ['-NoProfile', '-Command', script], { maxBuffer: 1 << 24 }, (e, so, se) => res((so || '') + (se ? '\nERR ' + se : ''))));

function gpuSample(pids, secs = 5) {
  const list = pids.join(',');
  return ps(`$p=@(${list}); $dwm=(Get-Process dwm).Id; $s=Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -SampleInterval 1 -MaxSamples ${secs};
  $o=@(); foreach($x in $s){ $kk=0; $d=0; foreach($c in $x.CounterSamples){ if($c.InstanceName -match 'pid_(\\d+)_'){ $id=[int]$matches[1]; if($p -contains $id){$kk+=$c.CookedValue}; if($id -eq $dwm){$d+=$c.CookedValue} } }; $o+=('{0:N2}/{1:N2}' -f $kk,$d) }; 'kk/dwm ' + ($o -join ' ')`);
}
const js = (win, code) => win.webContents.executeJavaScript(code).catch((e) => ({ err: e.message }));
const MEASURE = `(async () => { const K = window.KKdebug.KK; __m.raf = 0; __m.draw = 0; const t0 = performance.now(); await new Promise(r => setTimeout(r, 5000)); const s = (performance.now() - t0) / 1000;
  return { rafPerSec: +(__m.raf / s).toFixed(1), drawPerSec: +(__m.draw / s).toFixed(1), targetFps: K.targetFps(), hidden: document.hidden, vis: document.visibilityState, power: K.powerState || 'on', battery: !!K.onBattery,
    audio: K.audio.ctx ? K.audio.ctx.state : 'none', nodesRun: __a.run, nodesSusp: __a.susp, lastInputAgo: +K.lastInputAgo().toFixed(1), fervorTier: K.fervorTier(), boss: !!window.KKdebug.W.boss, fxBusy: K.fx.busy(),
    infiniteAnims: document.getAnimations().filter(a => a.effect && a.effect.getTiming().iterations === Infinity).map(a => (a.animationName || '?') + '@' + (a.effect.target && (a.effect.target.className || a.effect.target.id))) }; })()`;

async function phase(win, name, pids, gpu = true) {
  log('phase', name);
  const [m, g] = await Promise.all([js(win, MEASURE), gpu ? gpuSample(pids) : Promise.resolve('')]);
  R.phases[name] = Object.assign(m || {}, { gpu: g.trim() });
  log(name, JSON.stringify(R.phases[name]));
}

app.whenReady().then(async () => {
  await sleep(3500);
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) { log('no window'); app.exit(1); return; }
  const pids = () => app.getAppMetrics().map((m) => m.pid);
  R.metrics = app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, cpu: m.cpu.percentCPUUsage, memKB: m.memory.workingSetSize }));

  // ---- window flags
  const hwnd = win.getNativeWindowHandle();
  const h = hwnd.length >= 8 ? hwnd.readBigUInt64LE(0).toString() : hwnd.readUInt32LE(0).toString();
  R.window = { bounds: win.getBounds(), isAlwaysOnTop: win.isAlwaysOnTop(), isFocusable: win.isFocusable(), hotkeyRegistered: globalShortcut.isRegistered('Control+Alt+K'), displays: screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor })) };
  R.window.exstyle = (await ps(`Add-Type -Name W -Namespace K -MemberDefinition '[DllImport("user32.dll")] public static extern System.IntPtr GetWindowLongPtr(System.IntPtr h, int i);';
    $v=[K.W]::GetWindowLongPtr([System.IntPtr]${h}, -20).ToInt64(); 'exstyle=0x{0:X} TOPMOST={1} NOACTIVATE={2} TOOLWINDOW={3} LAYERED={4} APPWINDOW={5}' -f $v, (($v -band 0x8) -ne 0), (($v -band 0x08000000) -ne 0), (($v -band 0x80) -ne 0), (($v -band 0x80000) -ne 0), (($v -band 0x40000) -ne 0)`)).trim();
  log('window', JSON.stringify(R.window));

  // ---- instrument the page, then dismiss the welcome modal (this boots audio, as a real first launch does)
  R.setup = await js(win, `(() => { window.__m = { raf: 0, draw: 0 }; window.__a = { run: 0, susp: 0 };
    const oR = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { return oR.call(window, (t) => { __m.raf++; cb(t); }); };
    const K = window.KKdebug.KK; const od = K.render.draw; K.render.draw = function () { __m.draw++; return od.apply(this, arguments); };
    for (const n of ['createOscillator', 'createBufferSource']) { const o = BaseAudioContext.prototype[n]; AudioContext.prototype[n] = function () { if (this.state === 'running') __a.run++; else __a.susp++; return o.apply(this, arguments); }; }
    const go = document.querySelector('[data-x=go]'); if (go) go.click();
    const fonts = [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status);
    return { welcomeClicked: !!go, settings: K.S.settings, fonts, csp: document.querySelector('meta[http-equiv]').content }; })()`);
  log('setup', JSON.stringify(R.setup));
  // network probe: an external image must fail (CSP + main-process block)
  R.net = await js(win, `new Promise(r => { const i = new Image(); i.onload = () => r('LOADED (bad)'); i.onerror = () => r('blocked'); i.src = 'https://www.google.com/favicon.ico?kk=' + Date.now(); setTimeout(() => r('timeout'), 4000); })`);
  R.tcp = (await ps(`$p=@(${pids().join(',')}); $c=Get-NetTCPConnection -ErrorAction SilentlyContinue | ? { $p -contains $_.OwningProcess }; if($c){ $c | % { '{0}:{1} -> {2}:{3} {4}' -f $_.LocalAddress,$_.LocalPort,$_.RemoteAddress,$_.RemotePort,$_.State } } else { 'no TCP connections owned by electron pids' }; $u=Get-NetUDPEndpoint -ErrorAction SilentlyContinue | ? { $p -contains $_.OwningProcess }; 'udp endpoints: ' + @($u).Count`)).trim();
  log('net', R.net, R.tcp);

  // ---- idle: wait until 45+ sim-seconds without input
  await js(win, `window.KKdebug.KK.gainGold(5000, 'dev')`); // makes an upgrade affordable, so HUD badges appear like in real play
  for (let i = 0; i < 60; i++) { const a = await js(win, 'window.KKdebug.KK.lastInputAgo()'); if (a > 47) break; await sleep(1000); }
  await phase(win, 'idle_default', pids());
  await js(win, `(() => { const s = document.createElement('style'); s.id = '__noanim'; s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}'; document.head.appendChild(s); })()`);
  await phase(win, 'idle_cssAnimationsOff', pids());
  await js(win, `document.getElementById('__noanim').remove()`);

  // ---- active typing (~5.5 counted keys/s)
  await js(win, `window.__typer = setInterval(() => window.KKdebug.KK.input.event('key'), 180)`);
  await sleep(2500);
  await phase(win, 'active_typing_30', pids());
  win.webContents.send('kk:battery', true);
  await sleep(500);
  await phase(win, 'active_onBattery', pids(), false);
  win.webContents.send('kk:battery', false);

  // ---- muted: does the audio graph keep creating nodes while the context is suspended?
  await js(win, `(() => { window.KKdebug.KK.ui.setSetting('sound', false); __a.run = 0; __a.susp = 0; window.KKdebug.KK.warp = 5; })()`);
  await phase(win, 'muted_typing_warp5', pids(), false);
  R.audioAfterMute = await js(win, `(() => { const K = window.KKdebug.KK; K.warp = 1; return { state: K.audio.ctx.state, susp: __a.susp }; })()`);
  await js(win, `window.KKdebug.KK.ui.setSetting('sound', true)`);
  await sleep(800);
  R.audioAfterUnmute = await js(win, `({ state: window.KKdebug.KK.audio.ctx.state, t: window.KKdebug.KK.audio.ctx.currentTime })`);

  // ---- hidden from the tray / hotkey (same calls as toggleVisible)
  await js(win, `clearInterval(window.__typer)`);
  win.hide(); win.webContents.send('kk:power', 'off');
  await sleep(600);
  await phase(win, 'hidden', pids());
  // lock + unlock while the strip is still hidden
  powerMonitor.emit('lock-screen'); await sleep(300); powerMonitor.emit('unlock-screen');
  await sleep(800);
  await phase(win, 'hidden_after_lock_unlock', pids());
  win.showInactive(); win.webContents.send('kk:power', 'on');
  await sleep(1500);

  // ---- a fullscreen (non-topmost) window, like browser-fullscreen video or a borderless game
  const d = screen.getDisplayNearestPoint({ x: win.getBounds().x + 10, y: win.getBounds().y + 10 });
  const fsw = new BrowserWindow({ x: d.bounds.x, y: d.bounds.y, width: d.bounds.width, height: d.bounds.height, frame: false, backgroundColor: '#00ff00', show: false });
  fsw.loadURL('data:text/html,<body style="background:#0f0;margin:0"></body>');
  fsw.once('ready-to-show', () => { fsw.show(); fsw.setFullScreen(true); fsw.focus(); });
  await sleep(2500);
  try {
    const srcs = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: d.size.width, height: d.size.height } });
    const src = srcs.find((s) => String(s.display_id) === String(d.id)) || srcs[0];
    const img = src.thumbnail; const sz = img.getSize(); const bmp = img.toBitmap();
    const px = (x, y) => { const i = (y * sz.width + x) * 4; return [bmp[i + 2], bmp[i + 1], bmp[i]]; }; // BGRA
    const sh = Math.round(win.getBounds().height * sz.height / d.size.height);
    R.fullscreen = { fsIsFullScreen: fsw.isFullScreen(), fsIsAlwaysOnTop: fsw.isAlwaysOnTop(), capture: sz, topCenter: px(sz.width >> 1, 20), stripRow: px(sz.width >> 1, sz.height - Math.max(4, sh >> 1)), stripLeft: px(40, sz.height - Math.max(4, sh >> 1)) };
    fs.writeFileSync(path.join(OUT, 'fullscreen_test.png'), img.resize({ width: Math.round(sz.width / 3) }).toPNG());
  } catch (e) { R.fullscreen = { err: e.message }; }
  fsw.close();
  log('fullscreen', JSON.stringify(R.fullscreen));
  await sleep(800);

  // ---- returning after 3 h: toast or modal? does the window grow?
  await js(win, `(() => { const K = window.KKdebug.KK; K.resetting = true; const s = JSON.parse(JSON.stringify(K.S)); s.lastSave = Date.now() - 3 * 3600 * 1000; localStorage.setItem('keystroke-keep-save-v1', JSON.stringify(s)); })()`);
  win.webContents.reload();
  await sleep(4000);
  R.offline = await js(win, `({ modal: !!document.querySelector('#modal-root .modal'), toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent.trim()) })`);
  R.offline.windowBounds = win.getBounds();
  fs.writeFileSync(path.join(OUT, 'offline_return.png'), (await win.webContents.capturePage()).toPNG());
  log('offline', JSON.stringify(R.offline));

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(R, null, 2));
  log('done');
  app.exit(0);
});
