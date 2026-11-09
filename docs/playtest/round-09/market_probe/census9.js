// R9 market: noise census on the CURRENT build (R8 caps: banner de-dup, softBoom, 10-min achievement toasts, AND move gate).
// Changes vs census8: counts the calm 'softBoom' ult variant, mirrors ui.js R8 toast rules (achievement <=1/10 min, demoSealed laps<=2 or >=60 s),
// seal banner+toast, lantern toast, and times the hero FLOW outline pulse (render.js drawHero, not calm-gated).
// Same method as round-07/market_probe/census.js: wraps tools/playtest.js (real sim, scripted player) and runs the
// REAL js/fx.js and js/audio.js in a sandbox on the same event bus, on sim time (performance.now/setTimeout = sim time),
// with a fake AudioContext that counts only sounds that create nodes (i.e. after A.play's rationing).
// Settings default to the DESKTOP defaults (state.js:23 with kkNative): calm ON, combatSfx OFF.  --full = calm off + combat on.
// ui.js toasts/modals are mirrored from the CURRENT ui.js (relic toast 0->1 + 15 min, achievement batching 600 ms,
// recruit hint once per hero, demoSealed only on a best time, demo peek card at 40 min playTime, gold pulse <= 1 per 2 s).
// Usage (from the project dir):
//   node docs/playtest/round-08/market_probe/census8.js --min 480 --profile idle --seed 6 --retire nudge --omen random [--demo] [--full] [--out file.json]
const Module = require('module'), path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const argv = process.argv.slice(2); const arg = (k) => { const i = argv.indexOf('--' + k); return i < 0 ? undefined : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const FULL = !!arg('full'); const OUT = arg('out'); const PROTO = !!arg('proto');
const H = {}; const EVER = {};
let K = null, FX = null, A = null;
const hourOf = () => Math.floor((K.simTime || 0) / 3600);
const bump = (cat, name, n = 1) => { const h = hourOf(); const o = (H[h] = H[h] || {}); const c = (o[cat] = o[cat] || {}); c[name] = (c[name] || 0) + n; };
const norm = (s) => String(s).replace(/\d[\d.,]*[KMBT]?/g, '#');
let srcCount = 0; const peaks = []; const soundSec = {};
const timers = []; const simMs = () => (K.simTime || 0) * 1000;
const firsts = []; // first time each interrupt kind happens (minute)
const seenFirst = new Set(); const first = (k) => { if (!seenFirst.has(k)) { seenFirst.add(k); firsts.push([+(K.simTime / 60).toFixed(1), k]); } };

function fakeParam(v = 0) { return { value: v, setValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }; }
const node = (o) => Object.assign({ connect() {}, disconnect() {} }, o);
function FakeAC() { this.state = 'running'; this.sampleRate = 8000; this.destination = node({}); Object.defineProperty(this, 'currentTime', { get: () => simMs() / 1000 }); }
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
    const applyDefaults = () => { K.S.settings.calm = !FULL; K.S.settings.combatSfx = FULL; K.S.settings.music = false; };
    applyDefaults();
    const P = Object.create(K);
    P.U = Object.assign({}, K.U, { rand: (a = 0, b = 1) => a + Math.random() * (b - a), pick: (arr) => arr[Math.floor(Math.random() * arr.length)] });
    P.SPR = { frame: () => null };
    Object.defineProperty(P, 'view', { get: () => ({ left: K.world.partyX - 200, right: K.world.partyX + 400, goldX: K.world.partyX - 185, goldY: 8 }) });
    const sb = {
      window: { KK: P, AudioContext: FakeAC, __src: () => srcCount, __played: null }, performance: { now: simMs }, console, Math,
      setTimeout: (fn, ms) => { timers.push({ at: simMs() + (+ms || 0), fn }); return timers.length; }, setInterval: () => 0, clearInterval: () => {}, clearTimeout: () => {},
    };
    sb.window.__played = (name, n, peak) => {
      if (!n) return; bump('sound', name);
      if (peak >= 0.1) { bump('loudSound', name); first('loud sound ' + name); }
      const h = hourOf(); (soundSec[h] = soundSec[h] || new Set()).add(Math.floor(K.simTime));
    };
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'fx.js'), 'utf8'), sb, { filename: 'fx.js' });
    let au = fs.readFileSync(path.join(ROOT, 'js', 'audio.js'), 'utf8').replace(/\r\n/g, '\n');
    const tail = '      lastLoud = now;\n    }\n    SFX[name]();\n  };';
    if (!au.includes(tail)) throw new Error('audio.js A.play changed: update census9.js');
    if (!au.includes("if (!limited('softBoom', 4000)) noise(0.25, { freq: 900, sweep: 200, vol: 0.05 }); return; }")) throw new Error('softBoom line changed');
    au = au.replace("if (!limited('softBoom', 4000)) noise(0.25, { freq: 900, sweep: 200, vol: 0.05 }); return; }", "if (!limited('softBoom', 4000)) { const b = window.__src(); noise(0.25, { freq: 900, sweep: 200, vol: 0.05 }); window.__played('softBoom', window.__src() - b, 0.05); } return; }");
    au = au.replace(tail, '      lastLoud = now;\n    }\n    { const b = window.__src(); const p0 = window.__peaks.length; SFX[name](); const pk = window.__peaks.slice(p0).reduce((a, x) => Math.max(a, x), 0); window.__peaks.length = p0; window.__played(name, window.__src() - b, pk); }\n  };');
    if (PROTO) {
      // P4: ultKnight+meteor share one 60 s 'boom' slot; boss stingers at full volume at most every 3 min each;
      //     milestone arpeggio <= 1 per 3 min; IN THE ZONE chime <= 1 per 5 min
      const a0 = au;
      au = au.replace("const LOUD = { ultKnight: 30000, meteor: 30000, slam: 8000, bossKill: 0, bossIntro: 0 };", "const LOUD = { ultKnight: 60000, meteor: 60000, slam: 8000, bossKill: 180000, bossIntro: 180000 };");
      au = au.replace("if (LOUD[name] && limited('loud_' + name, LOUD[name])) return;", "if (LOUD[name] && limited('loud_' + (name === 'meteor' || name === 'ultKnight' ? 'boom' : name), LOUD[name])) return;");
      au = au.replace("if (LOUD[name] && now - lastLoud < 20000) return;", "if (LOUD[name] && !/^boss/.test(name) && now - lastLoud < 20000) return;");
      au = au.replace("    milestone: () => {", "    milestone: () => { if (limited('mile', 180000)) return;");
      au = au.replace("    zone: () => {", "    zone: () => { if (limited('zoneChime', 300000)) return;");
      if (au === a0) throw new Error('proto audio patch failed');
    }
    sb.window.__peaks = peaks;
    vm.runInContext(au, sb, { filename: 'audio.js' });
    FX = P.fx; A = P.audio; A.init();
    FX.particle = () => ({});
    const calm = () => !!K.S.settings.calm;
    const o = { alert: FX.alert, banner: FX.banner, flash: FX.flash, shake: FX.shake, stop: FX.stop, slowmo: FX.slowmo, text: FX.text };
    FX.alert = (str, col, life) => { bump('alert', norm(str)); first('alert ' + norm(str)); return o.alert(str, col, life); };
    FX.banner = (text, sub, col, life, op = {}) => { const before = FX.banners.slice(); o.banner(text, sub, col, life, op); const added = FX.banners.find((b) => !before.includes(b)); if (added) { bump(added.big ? 'banner' : 'minorBanner', norm(text)); if (added.big) { EVER[text] = (EVER[text] || 0) + 1; bump(EVER[text] === 1 ? 'bannerFirstEver' : 'bannerRepeat', norm(text)); } if (added.big) first('banner ' + norm(text)); if (added.big && op.big !== false) {} else if (op.big !== false) bump('downgraded', norm(text)); } };
    FX.flash = (col, a = 0.6) => { const eff = calm() ? Math.min(a, 0.06) : a; bump(eff >= 0.2 ? 'flashStrong' : eff >= 0.1 ? 'flashSoft' : 'flashFaint', col); return o.flash(col, a); };
    FX.shake = (amp, dur) => { if (!calm() && amp >= 2) bump('shake', 'amp' + amp); return o.shake(amp, dur); };
    FX.stop = (s) => { if (!calm()) bump('hitstop', 's' + s); return o.stop(s); };
    FX.slowmo = (f, d) => { if (!calm()) bump('slowmo', 'x' + f); return o.slowmo(f, d); };
    if (false) {
      // P2: a signature-move plate shows only on the first cast in a fight AND at most once per 10 min per move (R7 spec)
      FX.moveAlert = (type, e, str, col, life) => { e.alerted = e.alerted || {}; const now = simMs(); FX.moveSeen = FX.moveSeen || {}; if (e.alerted[type] || now - (FX.moveSeen[type] ?? -1e9) < 600000) { e.alerted[type] = true; return; } e.alerted[type] = true; FX.moveSeen[type] = now; FX.alert(str, col, life); };
      // P1: repeat big banners (same text+sub within 20 min) and level milestones already reached earlier in this save -> minor style
      const shownAt = {}; const bestMile = {}; const keep = /^(THE )?(CRYPT|MOSSY CAVERNS|MAGMA DEPTHS|HOLLOW VOID|DEPTH TROPHY|HEART OF THE KEEP|FLOW STATE!)/;
      const ob = FX.banner;
      FX.banner = (text, sub, col, life, op = {}) => {
        if (op.big !== false && !keep.test(text)) {
          const mm = /^(.+) LV (\d+)$/.exec(text);
          if (mm) { const lv = +mm[2]; if ((bestMile[mm[1]] || 0) >= lv) { bump('protoDowngraded', 'LV milestone'); return; } bestMile[mm[1]] = lv; }
          const key = text + '|' + (sub || ''); const now = simMs();
          if (now - (shownAt[key] ?? -1e9) < 1200000) { bump('protoDowngraded', norm(text)); return ob(text, sub, col, Math.min(life || 2, 1.4), Object.assign({}, op, { big: false })); }
          shownAt[key] = now;
        }
        return ob(text, sub, col, life, op);
      };
    }
    if (arg('proto9')) {
      // P9: (a) hero LV milestone banners big only above that hero's best-ever milestone; (b) boss-name and "X JOINS!" banners
      //     big only the first time in the save (else minor); (c) move alerts at most once per 15 min per move.
      const bestMile = {}; const seen = {}; const ob = FX.banner;
      FX.banner = (text, sub, col, life, op = {}) => {
        if (op.big !== false && !op.always) {
          const mm = /^(.+) LV (\d+)$/.exec(text);
          let minor = false;
          if (mm) { const lv = +mm[2]; if ((bestMile[mm[1]] || 0) >= lv) minor = true; else bestMile[mm[1]] = lv; }
          else if (/ JOINS!$/.test(text) || / BOSS$/.test(sub || '')) { if (seen[text]) minor = true; seen[text] = 1; }
          if (minor) { bump('proto9Downgraded', norm(text)); return ob(text, sub, col, Math.min(life || 2, 1.4), Object.assign({}, op, { big: false })); }
        }
        return ob(text, sub, col, life, op);
      };
      FX.moveAlert = (type, e, str, col, life) => { e.alerted = e.alerted || {}; const now = simMs(); FX.moveSeen = FX.moveSeen || {}; if (e.alerted[type] || now - (FX.moveSeen[type] || -1e9) < 900000) return; e.alerted[type] = true; FX.moveSeen[type] = now; FX.alert(str, col, life); };
    }
    FX.text = (x, y, str, col, scale, op = {}) => { if ((op.life || 0.85) >= 1.0) bump('popup', norm(str)); return o.text(x, y, str, col, scale, op); };
    // ---- ui.js mirror (current rules)
    const T = new Set(); const once = (k, fn) => { if (!T.has(k)) { T.add(k); fn(); } };
    const toast = (name, who = 'unsolicited') => { bump(who === 'player' ? 'toastPlayer' : 'toast', name); if (who !== 'player') first('toast ' + name); };
    const D = K.DATA;
    let lastRelicToast = -1e9;
    K.on('relicOffer', () => { const S = K.S; if ((S.relicQueue || []).length) return; if (simMs() - lastRelicToast < 900000) return; lastRelicToast = simMs(); timers.push({ at: simMs() + 1400, fn: () => toast('relic dropped') }); });
    let achPending = null, lastAch = -1e9;
    // P3 (proto): at most one achievement toast per 5 min; later unlocks merge into the next one
    K.on('achievement', ({ def }) => { if (!def || (K.DEMO_CAP && !def.demo)) return; if (achPending) { achPending.at = simMs() + 600; } else { achPending = { at: simMs() + 600, fn: () => { achPending = null; if (simMs() - lastAch < 600000) { bump('suppressed', 'achievement toast held'); return; } lastAch = simMs(); toast('achievement (batched)'); } }; timers.push(achPending); } });
    K.on('trophy', ({ floor }) => { if (floor !== 100) toast('depth trophy'); });
    K.on('seal', ({ v }) => { toast('seal of the day'); const show = () => { if (K.world.boss || FX.banners.length) return timers.push({ at: simMs() + 1500, fn: show }); FX.banner('★ SEAL OF THE DAY', '+' + (v || 10) + ' RENOWN', '#ffd76a', 2.6, { subCol: '#fff' }); }; show(); });
    K.on('floor', ({ floor }) => { if (floor >= 70 && !K.DEMO_CAP) once('lantern', () => toast('lantern unlock')); });
    K.on('codex', () => toast('codex rank'));
    let prevBest = 0, laps = 0;
    // P3 (proto): sealed toast only on the first 2 re-delve laps or when the best improves by >= 60 s
    K.on('demoSealed', ({ time, prev }) => { if (time <= K.S.bestCapTime + 0.01 && ((K.S.demoLaps || 0) <= 2 || (prev || 1e9) - time >= 60)) toast('demo sealed (new best)'); });
    K.on('glimpse', () => { prevBest = K.S.bestCapTime; });
    K.on('demoComplete', (ev) => { bump('modal', ev && ev.peek ? 'demo peek card (40 min)' : 'demo complete card'); first(ev && ev.peek ? 'modal peek' : 'modal demo complete'); });
    K.on('glimpse', () => { bump('event', 'glimpse start'); first('glimpse'); });
    K.on('activity', () => { if (K.S.stats.keys + K.S.stats.clicks === 8) once('sparks', () => toast('tutorial: sparks')); });
    K.on('ult', () => once('ult', () => toast('tutorial: first ult')));
    K.on('fervorTier', ({ to }) => { if (to === 3) once('flow', () => toast('tutorial: flow')); });
    K.on('floor', ({ floor }) => {
      for (const id of D.PARTY_ORDER) if (D.HEROES[id].unlockFloor === floor && !K.S.heroes[id]) once('rec_' + id, () => toast('hero can be recruited'));
      if (floor === 20 && K.S.retires === 0) once('retire', () => toast('tutorial: retire'));
    });
    K.on('ratSpawn', () => once('rat', () => toast('tutorial: rat')));
    K.on('levelUp', () => T.add('lvl'));
    K.on('recruit', () => toast('recruit', 'player'));
    K.on('relicPicked', () => toast('relic acquired', 'player'));
    K.on('retired', () => toast('retire / omen', 'player'));
    let lastPulse = 0;
    K.on('coinArrive', () => { if (simMs() - lastPulse > 2000) { lastPulse = simMs(); bump('hud', 'gold pulse'); } });
    K.on('door', () => bump('screen', 'floor fade to black'));
    let nudgeT = 0, slowT = 0;
    const upd = K.world.update;
    K.world.update = function (dt) {
      applyDefaults();
      upd.call(this, dt);
      FX.update(dt);
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= simMs()) { const t = timers.splice(i, 1)[0]; t.fn(); }
      if (FX.alerts.length) bump('secs', 'alert plate on screen (2 Hz text blink)', dt);
      if (FX.banners.length && FX.banners[0].big) bump('secs', 'big banner on screen', dt);
      const W = K.world;
      if (W.enemies.some((e) => !e.dead && e.active && (e.windup > 0 || (e.boss && (e.fightT || 0) > 165)))) bump('secs', 'boss white flicker (2 Hz)', dt);
      const tier = K.fervorTier(); if (tier === 3) { bump('secs', calm() ? 'FLOW vignette (steady in calm)' : 'FLOW vignette (pulsing)', dt); bump('secs', 'hero FLOW outline pulse 1.3 Hz (not calm-gated)', dt); } else if (tier === 2) bump('secs', 'ZONE vignette', dt);
      if (FX.shakeT > 0 && !calm()) bump('secs', 'shaking', dt);
      if (FX.flashA >= 0.03) bump('secs', 'full-strip flash >=0.03', dt);
      if ((slowT += dt) >= 0.25) { slowT = 0; const S = K.S; if (K.DEMO_CAP && !S.demoDone && !S.demoPeek && S.stats.playTime >= 2400) { S.demoPeek = true; K.emit('demoComplete', { peek: true }); } }
      if ((nudgeT += dt) >= 3) {
        nudgeT = 0; const g = K.actions.renownGain(); const key = 'retireNudge' + K.S.retires;
        if (!(K.DEMO_CAP && !K.S.demoDone) && g >= 30 && ((K.S.runTime || 0) / 60 > 25 || (K.S.retires === 0 && K.S.maxFloorRun >= 40))) once(key, () => toast('retire nudge'));
      }
      if (!T.has('lvl') && Math.floor(K.simTime) % 2 === 0) { /* afford hint: playtest glance buys within 60 s; counted once */ }
    };
    return K;
  };
};
const origLog = console.log; console.log = () => {};
process.on('exit', () => {
  console.log = origLog;
  const hours = Object.keys(H).map(Number).sort((a, b) => a - b);
  for (const h of hours) { H[h].secs = H[h].secs || {}; H[h].secs['any sound started (seconds with >=1)'] = soundSec[h] ? soundSec[h].size : 0; }
  const res = { args: argv.join(' '), full: FULL, simHours: +((K.simTime || 0) / 3600).toFixed(2), perHour: H, firsts, final: { floor: K.S.floor, maxFloorEver: K.S.maxFloorEver, retires: K.S.retires, bossKills: K.S.stats.bossKills, wipes: K.S.stats.wipes, glimpseDone: K.S.glimpseDone, demoDone: K.S.demoDone } };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const cats = ['alert', 'banner', 'minorBanner', 'toast', 'toastPlayer', 'modal', 'flashStrong', 'flashSoft', 'flashFaint', 'shake', 'sound', 'loudSound', 'hud', 'popup'];
  origLog(res.args, JSON.stringify(res.final));
  origLog('hour ' + cats.join(' ') + ' secsWithSound');
  for (const h of hours) origLog(h + ' ' + cats.map((c) => Math.round(sum(H[h][c]))).join(' ') + ' ' + H[h].secs['any sound started (seconds with >=1)']);
});
require(path.join(ROOT, 'tools', 'playtest.js'));
