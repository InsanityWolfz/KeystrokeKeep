// Headless loader: runs the real game sim (util/data/state/world) in node, no browser.
// const KK = require('./headless')({ seed: 1, bal: { eHpG: 1.27 } });
// Then: KK.world.reset(); loop KK.world.update(1/30); call KK.addActivity('key'), KK.actions.*, read KK.S.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = function load(opts = {}) {
  const ctx = { console, Math: Object.create(Math), Date, JSON, Object, Array, Set, Map, String, Number, Infinity, NaN, isFinite, parseInt, parseFloat };
  if (opts.seed !== undefined) ctx.Math.random = mulberry32(opts.seed >>> 0);
  ctx.globalThis = ctx;
  if (opts.bal) ctx.BAL_OVERRIDE = opts.bal;
  if (opts.demo) ctx.KK_DEMO_CAP = 40;
  vm.createContext(ctx);
  for (const f of ['util', 'data', 'state', 'world']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  }
  ctx.KK.rng = ctx.Math.random; // seeded generator for harness-side randomness
  return ctx.KK;
};
