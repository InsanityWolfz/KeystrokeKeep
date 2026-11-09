// Round 08 auditor: headless loader = tools/headless.js + js/fx.js (banners/alerts) driven by a sim clock.
// performance.now() and setTimeout run on sim time, so banner-gated signature moves, the glimpse alert
// (setTimeout 2.6 s) and FX.moveAlert caps behave like the real game. Nothing in js/ is touched.
// load({ seed, demo, fx: true, calm: true }) -> KK with KK.__tick(dt) to call instead of KK.world.update(dt).
const fs = require('fs'), path = require('path'), vm = require('vm');
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
module.exports = function load(opts = {}) {
  const src = process.env.KK_SRC || path.join(__dirname, '..', '..', '..', 'js');
  const clock = { t: 0 }, timers = [];
  const ctx = { console, Math: Object.create(Math), Date, JSON, Object, Array, Set, Map, String, Number, Infinity, NaN, isFinite, parseInt, parseFloat,
    performance: { now: () => clock.t * 1000 },
    setTimeout: (fn, ms) => { const h = { at: clock.t + (ms || 0) / 1000, fn }; timers.push(h); return h; },
    clearTimeout: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
  };
  if (opts.seed !== undefined) ctx.Math.random = mulberry32(opts.seed >>> 0);
  ctx.globalThis = ctx;
  if (opts.fx !== false) ctx.window = ctx;
  if (opts.demo) ctx.KK_DEMO_CAP = 40;
  vm.createContext(ctx);
  const files = ['util', 'data', 'state', 'world', 'achievements'];
  if (opts.fx !== false) files.push('fx');
  ctx.__preFx = () => { ctx.KK.SPR = ctx.KK.SPR || { frame: () => null }; };
  for (const f of files) { if (f === 'fx') ctx.__preFx(); vm.runInContext(fs.readFileSync(path.join(src, f + '.js'), 'utf8'), ctx, { filename: f + '.js' }); }
  const KK = ctx.KK;
  KK.rng = ctx.Math.random;
  if (opts.calm !== false) KK.S.settings.calm = true; // desktop default
  KK.__clock = clock;
  KK.__pre = (dt) => {
    clock.t += dt;
    for (let i = 0; i < timers.length; i++) if (timers[i].at <= clock.t) { const h = timers.splice(i--, 1)[0]; try { h.fn(); } catch (e) { /* DOM-only callbacks */ } }
    if (KK.fx) KK.fx.update(dt);
  };
  KK.__tick = (dt) => { KK.__pre(dt); KK.world.update(dt); };
  return KK;
};
