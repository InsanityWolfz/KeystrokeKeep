// Round 06: tools/headless.js, but the js/ folder can be swapped with KK_SRC=<dir> (e.g. a `git show HEAD:js/*.js` snapshot),
// so results stay reproducible while the working tree is being edited.
const fs = require('fs'), path = require('path'), vm = require('vm');
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
module.exports = function load(opts = {}) {
  const src = process.env.KK_SRC || path.join(__dirname, '..', '..', '..', 'js');
  const ctx = { console, Math: Object.create(Math), Date, JSON, Object, Array, Set, Map, String, Number, Infinity, NaN, isFinite, parseInt, parseFloat };
  if (opts.seed !== undefined) ctx.Math.random = mulberry32(opts.seed >>> 0);
  ctx.globalThis = ctx;
  if (opts.bal) ctx.BAL_OVERRIDE = opts.bal;
  if (opts.demo) ctx.KK_DEMO_CAP = 40;
  vm.createContext(ctx);
  for (const f of ['util', 'data', 'state', 'world', 'achievements']) vm.runInContext(fs.readFileSync(path.join(src, f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  ctx.KK.rng = ctx.Math.random;
  return ctx.KK;
};
