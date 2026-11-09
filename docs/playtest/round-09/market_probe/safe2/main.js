// R9 market: SAFE launcher for the game's own electron/main.js (capture / self-test runs by a tester).
// Desktop-safety rules (LOOP.md) enforced here, not by convention:
//   * the strip window is created, moved and shown ONLY on the configured NON-primary display; any bounds touching the
//     primary display are refused and the run aborts
//   * no input hook (uiohook-napi is replaced by a dummy): the user's real typing never reaches the test, nothing is injected
//   * no tray icon, no balloons, no global shortcuts (calls are recorded instead, so tooltip/menu text can still be read)
//   * own profile: %APPDATA%/kk-market-r9(-capture|-selftest), never the real "Keystroke Keep*" folders
// Config: env KK9_CFG = path to JSON { name, secs, displayId, det, shotsAt: [frame...], pngAt: [frame...], out }
const Module = require('module'), path = require('path'), fs = require('fs');
try { fs.appendFileSync(__dirname + '/../out/safe_boot.txt', new Date().toISOString() + ' start ' + process.argv.join(' ') + '\n'); } catch (e) { /* */ }
const CFG = JSON.parse(fs.readFileSync(process.env.KK9_CFG, 'utf8'));
const GAME = path.resolve(__dirname, '..', '..', '..', '..', '..');
const LOG = []; const T0 = Date.now();
const log = (m) => { const l = `${((Date.now() - T0) / 1000).toFixed(2).padStart(6)} ${m}`; LOG.push(l); try { fs.appendFileSync(__dirname + '/../out/safe_boot.txt', l + '\n'); } catch (e) { /* */ } };
const within = (p, ms) => Promise.race([p, new Promise((_r, j) => setTimeout(() => j(new Error('timeout')), ms))]);
const real = require('electron');
// never let an error pop a dialog on the user's screen: log it and quit
const crash = (e) => { try { LOG.push('CRASH ' + (e && e.stack || e)); fs.writeFileSync(CFG.out, JSON.stringify({ name: CFG.name, abortReason: 'crash', log: LOG }, null, 1)); } catch (x) { /* */ } process.exit(3); };
process.on('uncaughtException', crash); process.on('unhandledRejection', crash);
real.dialog.showErrorBox = (t, c) => crash(new Error('errorbox ' + t + ' ' + c));
real.dialog.showMessageBoxSync = (o) => { crash(new Error('messagebox ' + JSON.stringify(o))); return 1; };
const recorded = { tooltip: [], menu: null, shortcuts: [], balloons: [], hookStart: 0 };
let abortReason = null;

const realLoad = Module._load;
let proxy = null;
Module._load = function (req) {
  if (req === 'uiohook-napi') return { uIOhook: { on() {}, start() { recorded.hookStart++; log('uiohook start() blocked (dummy)'); }, stop() {} } };
  if (req === 'electron' && proxy) return proxy;
  return realLoad.apply(this, arguments);
};

function target() {
  const p = real.screen.getPrimaryDisplay();
  const t = real.screen.getAllDisplays().find((d) => d.id === CFG.displayId);
  if (!t || t.id === p.id) throw new Error('target display missing or primary: refusing to run');
  return t;
}
function clamp(b) { const wa = target().workArea; const h = Math.min(Math.max(80, Math.round((b && b.height) || 192)), wa.height); return { x: wa.x, y: wa.y + wa.height - h, width: wa.width, height: h }; }
function onPrimary(b) { const p = real.screen.getPrimaryDisplay().bounds; return !(b.x + b.width <= p.x || b.x >= p.x + p.width || b.y + b.height <= p.y || b.y >= p.y + p.height); }
function abort(why) { abortReason = why; log('ABORT ' + why); try { for (const w of real.BrowserWindow.getAllWindows()) w.destroy(); } catch (e) { /* */ } finish(); }

let theWin = null;
class SafeBW extends real.BrowserWindow {
  constructor(o) {
    const b = CFG.noclamp ? { x: o.x, y: o.y, width: o.width, height: o.height } : clamp(o); // noclamp: game's own docking, still never SHOWN on primary
    super(Object.assign({}, o, b, { show: false }));
    theWin = this;
    this.webContents.setAudioMuted(true); // sounds still run (same RNG use as a real take) but nothing reaches the speakers
    const sb = this.setBounds.bind(this);
    this.setBounds = (nb) => { if (CFG.noclamp) { log('setBounds (game) ' + JSON.stringify(nb)); if (this.isVisible() && onPrimary(nb)) return abort('game moved visible strip onto primary'); return sb(nb); } return sb(clamp(nb)); };
    const guard = (fn) => () => { const gb = this.getBounds(); if (onPrimary(gb)) return abort('show refused, bounds on primary ' + JSON.stringify(gb)); fn(); log('shown at ' + JSON.stringify(this.getBounds())); };
    this.showInactive = guard(super.showInactive.bind(this));
    this.show = guard(super.showInactive.bind(this)); // never take focus either
    this.focus = () => {};
    // install the probe before any page script runs
    const dbg = this.webContents.debugger;
    const PRE = fs.readFileSync(path.join(__dirname, 'pre.js'), 'utf8').replace('__CFG__', JSON.stringify({ det: !!CFG.det, shotsAt: CFG.shotsAt || [], fps: 60, capture: process.env.KK_CAPTURE === '1' }));
    const lu = super.loadURL.bind(this);
    this._ready = within(lu('about:blank').then(() => { dbg.attach('1.3'); return dbg.sendCommand('Page.enable'); }).then(() => dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: PRE })), 5000).then((r) => log('pre installed ' + JSON.stringify(r)), (e) => log('pre install failed ' + e.message));
    const lf = super.loadFile.bind(this);
    this.loadFile = (...a) => this._ready.then(() => { log('loadFile'); return lf(...a); });
    this.webContents.on('console-message', (e, _l, msg) => { const m = e && e.message !== undefined ? e.message : msg; if (/^\[(capture|KK|kk9)\]/.test(String(m)) || /error/i.test(String(m))) log('[page] ' + m); });
  }
}
class FakeTray {
  constructor() { log('tray: fake (no icon shown)'); }
  setToolTip(t) { recorded.tooltip.push(t); }
  setContextMenu(m) { recorded.menu = (m && m.items || []).map((i) => i.label || i.type); }
  on() {} displayBalloon(o) { recorded.balloons.push(o); log('balloon blocked: ' + JSON.stringify(o)); } destroy() {}
}
const fakeShortcut = { register: (acc) => { recorded.shortcuts.push(acc); return true; }, isRegistered: () => true, unregisterAll() {}, unregister() {} };
proxy = new Proxy(real, { get: (t, k) => (k === 'BrowserWindow' ? SafeBW : k === 'Tray' ? FakeTray : k === 'globalShortcut' ? fakeShortcut : t[k]) });

// own profile name (the game's main appends -capture / -selftest to it)
real.app.setName('kk-market-r9');
real.app.setPath('userData', path.join(real.app.getPath('appData'), 'kk-market-r9'));

let done = false;
async function finish() {
  if (done) return; done = true; log('finish');
  let page = null;
  try { if (theWin && !theWin.isDestroyed()) { const r = await within(theWin.webContents.debugger.sendCommand('Runtime.evaluate', { expression: 'JSON.stringify(window.__kk9 || null)', returnByValue: true }), 3000); page = JSON.parse(r.value !== undefined ? r.value : r.result.value); } } catch (e) { log('collect failed ' + e.message); }
  const out = { name: CFG.name, abortReason, recorded, userData: real.app.getPath('userData'), log: LOG, page };
  fs.writeFileSync(CFG.out, JSON.stringify(out, null, 1));
  real.app.exit(0);
}

real.app.whenReady().then(() => {
  try { target(); } catch (e) { return abort(e.message); }
  setInterval(() => { if (theWin && !theWin.isDestroyed() && theWin.isVisible() && onPrimary(theWin.getBounds())) abort('window drifted onto primary ' + JSON.stringify(theWin.getBounds())); }, 250);
  // PNG stills of the strip window only (webContents.capturePage, never the desktop)
  const pngs = CFG.pngAt || [];
  let next = 0;
  const poll = setInterval(async () => {
    if (!theWin || theWin.isDestroyed() || next >= pngs.length) return;
    try {
      const r0 = await within(theWin.webContents.debugger.sendCommand('Runtime.evaluate', { expression: 'window.__kk9 ? window.__kk9.f : -1', returnByValue: true }), 1000); const fv = r0.result.value;
      if (fv >= pngs[next]) { const f = pngs[next++]; const img = await theWin.webContents.capturePage(); fs.writeFileSync(CFG.out.replace(/\.json$/, `_f${f}.png`), img.toPNG()); log('png at frame ' + fv + ' (asked ' + f + ')'); }
    } catch (e) { /* page busy */ }
  }, 30);
  for (const e of CFG.evalAt || []) setTimeout(async () => { try { const r = await within(theWin.webContents.debugger.sendCommand('Runtime.evaluate', { expression: e.expr, returnByValue: true, awaitPromise: true }), 4000); (recorded.evals = recorded.evals || []).push({ t: e.t, id: e.id, v: r.result.value, err: r.exceptionDetails && r.exceptionDetails.text }); } catch (x) { log('eval failed ' + e.id + ' ' + x.message); } }, e.t * 1000);
  for (const e of CFG.pngTimes || []) setTimeout(async () => { try { const img = await theWin.webContents.capturePage(); fs.writeFileSync(CFG.out.replace(/\.json$/, `_${e}s.png`), img.toPNG()); log('png ' + e + 's ' + JSON.stringify(img.getSize())); } catch (x) { log('png failed ' + x.message); } }, e * 1000);
  setTimeout(() => { clearInterval(poll); finish(); }, (CFG.secs || 20) * 1000);
});
process.chdir(GAME);
require(path.join(GAME, 'electron', 'main.js'));
