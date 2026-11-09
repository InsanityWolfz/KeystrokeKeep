// T1 economist, round 10: loader that can run the current js/ or the pre-Heartroot build (old/js = git show 51310be^:js/*),
// plus the round-06 player model (econ6lib.makePlayer) with Root Ward placed in the relic ranking.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lib6 = require('../round-06/econ6lib');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function load(opts = {}) {
  const dir = opts.old ? path.join(__dirname, 'old', 'js') : path.join(__dirname, '..', '..', '..', 'js');
  const ctx = { console, Math: Object.create(Math), Date, JSON, Object, Array, Set, Map, String, Number, Infinity, NaN, isFinite, parseInt, parseFloat };
  if (opts.seed !== undefined) ctx.Math.random = mulberry32(opts.seed >>> 0);
  ctx.globalThis = ctx;
  if (opts.bal) ctx.BAL_OVERRIDE = opts.bal;
  if (opts.demo) ctx.KK_DEMO_CAP = 40;
  vm.createContext(ctx);
  for (const f of ['util', 'data', 'state', 'world', 'achievements']) vm.runInContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8'), ctx, { filename: f + '.js' });
  ctx.KK.rng = ctx.Math.random;
  return ctx.KK;
}
// zero-padded calendar date for day n (day 1 = 2026-11-09), like KK.today()
function dateOf(n) { const d = new Date(Date.UTC(2026, 10, 9 + n - 1)); return d.toISOString().slice(0, 10); }
// rw: where Root Ward sits in the relic ranking: 'mid' (default: after the other epics' top picks), 'first', 'never'
function setRank(rw) {
  const R = lib6.RELIC_RANK;
  for (const k of Object.keys(R)) {
    const a = R[k].filter((x) => x !== 'rootward');
    if (rw === 'first') a.unshift('rootward');
    else if (rw === 'never') a.push('rootward');
    else a.splice(a.indexOf('lens') + 1, 0, 'rootward'); // after echo, glass/flowpend, lens: a "solid epic" pick
    R[k].length = 0; R[k].push(...a);
  }
}
function args() {
  const o = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) o[a.slice(2)] = true; else { o[a.slice(2)] = v; i++; } } }
  return o;
}
module.exports = { load, dateOf, setRank, args, makePlayer: lib6.makePlayer, RELIC_RANK: lib6.RELIC_RANK };
