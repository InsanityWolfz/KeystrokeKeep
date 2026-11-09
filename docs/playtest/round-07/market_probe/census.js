// R7 market: "how loud is the always-on strip?" census. Wraps tools/playtest.js (real sim, scripted player) and
// additionally runs the REAL js/fx.js and js/audio.js in a sandbox on the same event bus, on sim time:
//   - performance.now() and setTimeout run on sim time, so every limiter (slam 8 s, wipe 5 min, flow 10 min) is exercised
//   - a fake AudioContext counts every SFX that actually produces nodes (after limiters) and its peak gain
//   - FX.alert / banner / flash / shake / hitstop / slowmo are counted where they really take effect
//   - ui.js toasts/modals are mirrored from ui.js:48,532-536,566-589 (unsolicited) vs player-initiated (recruit, relic, retire)
// fx/audio get their own unseeded U.rand/pick, so the sim's seeded stream is untouched.
// Usage (from the project dir):
//   node docs/playtest/round-07/market_probe/census.js --min 480 --profile idle --seed 6 --retire nudge --omen random [--demo] [--calm] [--out file.json]
const Module = require('module'), path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const argv = process.argv.slice(2); const arg = (k) => { const i = argv.indexOf('--' + k); return i < 0 ? undefined : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const CALM = !!arg('calm'); const OUT = arg('out');
const H = {}; // H[hour][cat][name] = n
let K = null, FX = null, A = null;
const hourOf = () => Math.floor((K.simTime || 0) / 3600);
const bump = (cat, name, n = 1) => { const h = hourOf(); const o = (H[h] = H[h] || {}); const c = (o[cat] = o[cat] || {}); c[name] = (c[name] || 0) + n; };
const norm = (s) => String(s).replace(/\d[\d.,]*[KMBT]?/g, '#').replace(/THE HOLLOWED |THE HEART OF THE KEEP/g, (m) => m);
let srcCount = 0; const peaks = []; const soundSec = {}; // hour -> Set of whole seconds with a sound start
const timers = []; const simMs = () => (K.simTime || 0) * 1000;

function fakeParam(v = 0) { return { value: v, setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; }
const node = (o) => Object.assign({ connect() {}, disconnect() {} }, o);
function FakeAC() {
  this.state = 'running'; this.sampleRate = 8000; this.destination = node({});
  Object.defineProperty(this, 'currentTime', { get: () => simMs() / 1000 });
}
FakeAC.prototype = {
  resume() { this.state = 'running'; }, suspend() { this.state = 'suspended'; },
  createDynamicsCompressor: () => node({ threshold: fakeParam(), ratio: fakeParam() }),
  createGain: () => node({ gain: { value: 1, setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}, exponentialRampToValueAtTime(x) { peaks.push(x); } } }),
  createBuffer: (c, len) => ({ getChannelData: () => new Float32Array(len) }),
  createOscillator: () => { srcCount++; return node({ type: '', frequency: fakeParam(), detune: { value: 0 }, start() {}, stop() {} }); },
  createBiquadFilter: () => node({ type: '', frequency: fakeParam(), Q: { value: 0 } }),
  createBufferSource: () => { srcCount++; return node({ buffer: null, start() {}, stop() {} }); },
};

const real = Module._load;
Module._load = function (req) {
  const m = real.apply(this, arguments);
  if (!/headless$/.test(req)) return m;
  return function (opts) {
    K = m(opts);
    if (CALM) K.S.settings.calm = true;
    const P = Object.create(K);
    P.U = Object.assign({}, K.U, { rand: (a = 0, b = 1) => a + Math.random() * (b - a), pick: (arr) => arr[Math.floor(Math.random() * arr.length)] });
    P.SPR = { frame: () => null };
    Object.defineProperty(P, 'view', { get: () => ({ left: K.world.partyX - 200, right: K.world.partyX + 400, goldX: K.world.partyX - 185, goldY: 8 }) });
    const sb = {
      window: { KK: P, AudioContext: FakeAC, __src: () => srcCount, __played: null }, performance: { now: simMs }, console, Math,
      setTimeout: (fn, ms) => { timers.push({ at: simMs() + (+ms || 0), fn }); return timers.length; }, setInterval: () => 0, clearInterval: () => {},
    };
    sb.window.__played = (name, n, peak) => {
      if (!n) return; bump('sound', name);
      if (peak >= 0.1) bump('loudSound', name);
      const h = hourOf(); (soundSec[h] = soundSec[h] || new Set()).add(Math.floor(K.simTime));
    };
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'fx.js'), 'utf8'), sb, { filename: 'fx.js' });
    let au = fs.readFileSync(path.join(ROOT, 'js', 'audio.js'), 'utf8');
    const playSrc = "A.play = (name) => { if (A.ready && A.ctx.state === 'running' && SFX[name]) SFX[name](); };";
    if (!au.includes(playSrc)) throw new Error('audio.js A.play changed: update census.js');
    au = au.replace(playSrc, "A.play = (name) => { if (A.ready && A.ctx.state === 'running' && SFX[name]) { const b = window.__src(); window.__pk = 0; const p0 = window.__peaks.length; SFX[name](); const pk = window.__peaks.slice(p0).reduce((a, x) => Math.max(a, x), 0); window.__peaks.length = p0; window.__played(name, window.__src() - b, pk); } };");
    sb.window.__peaks = peaks;
    vm.runInContext(au, sb, { filename: 'audio.js' });
    FX = P.fx; A = P.audio; A.init();
    // count what really takes effect on screen
    FX.particle = () => ({}); // particles only cost time here; they never change what we count
    const o = { alert: FX.alert, banner: FX.banner, flash: FX.flash, shake: FX.shake, stop: FX.stop, slowmo: FX.slowmo };
    FX.alert = (str, col, life) => { bump('alert', norm(str)); return o.alert(str, col, life); };
    FX.banner = (text, sub, col, life, op = {}) => { const n = FX.banners.length; o.banner(text, sub, col, life, op); if (FX.banners.length > n || (n >= 5 && FX.banners.length === 5)) bump(op.big === false ? 'minorBanner' : 'banner', norm(text)); };
    FX.flash = (col, a = 0.6) => { const eff = K.S.settings.calm ? Math.min(a, 0.06) : a; if (eff >= 0.2) bump('flashStrong', col); else if (eff >= 0.1) bump('flashSoft', col); else bump('flashFaint', col); return o.flash(col, a); };
    FX.shake = (amp, dur) => { if (!K.S.settings.calm && amp >= 2) bump('shake', 'amp' + amp); return o.shake(amp, dur); };
    FX.stop = (s) => { if (!K.S.settings.calm) bump('hitstop', 's' + s); return o.stop(s); };
    FX.slowmo = (f, d) => { if (!K.S.settings.calm) bump('slowmo', 'x' + f); return o.slowmo(f, d); };
    // ui.js mirror (toasts / modals / HUD pulse)
    const once = new Set(); const tut = (k, fn) => { if (!once.has(k)) { once.add(k); fn(); } };
    const toast = (name, who = 'unsolicited') => bump(who === 'player' ? 'toastPlayer' : 'toast', name);
    const D = K.DATA;
    K.on('relicOffer', () => timers.push({ at: simMs() + 1400, fn: () => toast('relic dropped') }));
    K.on('achievement', ({ def }) => { if (def && (!K.DEMO_CAP || def.demo)) toast('achievement'); });
    K.on('trophy', ({ floor }) => { if (floor !== 100) toast('depth trophy'); });
    K.on('codex', () => toast('codex rank'));
    K.on('demoSealed', () => toast('demo sealed (re-delve)'));
    K.on('demoComplete', () => bump('modal', 'demo complete'));
    let inputs = 0;
    K.on('activity', () => { if (++inputs === 8) tut('sparks', () => toast('tutorial: sparks')); });
    K.on('ult', () => tut('ult', () => toast('tutorial: first ult')));
    K.on('fervorTier', ({ to }) => { if (to === 3) tut('flow', () => toast('tutorial: flow')); });
    K.on('floor', ({ floor }) => {
      for (const id of D.PARTY_ORDER) if (D.HEROES[id].unlockFloor === floor && !K.S.heroes[id]) toast('hero can be recruited');
      if (floor === 20 && K.S.retires === 0) tut('retire', () => toast('tutorial: retire'));
    });
    K.on('ratSpawn', () => tut('rat', () => toast('tutorial: rat')));
    K.on('recruit', () => toast('recruit', 'player'));
    K.on('relicPicked', () => toast('relic acquired', 'player'));
    K.on('retired', () => toast('retire / omen', 'player'));
    K.on('coinArrive', () => bump('hud', 'gold pulse'));
    K.on('door', () => bump('screen', 'floor fade to black'));
    let nudgeT = 0;
    // retire nudge (ui.js:578, checked every 3 s)
    // and per-tick states: alert plate on screen, big banner on screen, boss flicker, FLOW vignette
    const upd = K.world.update;
    K.world.update = function (dt) {
      upd.call(this, dt);
      FX.update(dt);
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= simMs()) { const t = timers.splice(i, 1)[0]; t.fn(); }
      if (FX.alerts.length) bump('secs', 'alert plate on screen (4 Hz blink)', dt);
      if (FX.banners.length && FX.banners[0].big) bump('secs', 'big banner on screen', dt);
      const W = K.world;
      if (W.enemies.some((e) => !e.dead && e.active && (e.windup > 0 || (e.boss && (e.fightT || 0) > 165)))) bump('secs', 'boss white flicker (4 Hz)', dt);
      if (W.boss && !W.boss.dead && (W.boss.fightT || 0) > 60) bump('secs', 'enrage fuse visible', dt);
      const tier = K.fervorTier(); if (tier === 3) bump('secs', 'FLOW vignette (pulsing)', dt); else if (tier === 2) bump('secs', 'ZONE vignette', dt);
      if (FX.shakeT > 0 && !K.S.settings.calm) bump('secs', 'shaking', dt);
      if ((nudgeT += dt) >= 3) {
        nudgeT = 0; const g = K.actions.renownGain(); const key = 'retireNudge' + K.S.retires;
        if (!(K.DEMO_CAP && !K.S.demoDone) && g >= 30 && !once.has(key) && ((K.S.runTime || 0) / 60 > 25 || (K.S.retires === 0 && K.S.maxFloorRun >= 40))) tut(key, () => toast('retire nudge'));
      }
    };
    return K;
  };
};
const origLog = console.log; console.log = () => {};
process.on('exit', () => {
  console.log = origLog;
  const hours = Object.keys(H).map(Number).sort((a, b) => a - b);
  for (const h of hours) { H[h].secs = H[h].secs || {}; H[h].secs['any sound started (seconds with >=1)'] = soundSec[h] ? soundSec[h].size : 0; }
  const res = { args: argv.join(' '), calm: CALM, simHours: +((K.simTime || 0) / 3600).toFixed(2), perHour: H, final: { floor: K.S.floor, maxFloorEver: K.S.maxFloorEver, retires: K.S.retires, bossKills: K.S.stats.bossKills, wipes: K.S.stats.wipes } };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  // compact summary: per hour, totals per category
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const cats = ['alert', 'banner', 'minorBanner', 'toast', 'toastPlayer', 'modal', 'flashStrong', 'flashSoft', 'shake', 'hitstop', 'slowmo', 'sound', 'loudSound', 'hud', 'screen'];
  origLog(res.args, JSON.stringify(res.final));
  origLog('hour ' + cats.join(' '));
  for (const h of hours) origLog(h + ' ' + cats.map((c) => Math.round(sum(H[h][c]))).join(' '));
});
require(path.join(ROOT, 'tools', 'playtest.js'));
