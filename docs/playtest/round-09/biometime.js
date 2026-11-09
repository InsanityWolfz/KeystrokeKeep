// Round 09 auditor: share of play time spent in each biome (and in boss fights by kind) over a long save.
// node biometime.js --profile typist --min 2400 --seed 1
const Module = require('module'); const origLoad = Module._load;
Module._load = function (req) { if (/headless_src$/.test(req)) return require('../round-08/r8load'); return origLoad.apply(this, arguments); };
const { run } = require('../round-06/r6lib');
const args = {}; for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].slice(2)] = process.argv[i + 1];
const acc = {}; const win = {}; let tot = 0;
const o = { profile: args.profile || 'typist', min: +args.min || 2400, seed: +args.seed || 1, retire: 'nudge', omen: 'random' };
o.patch = (KK, hooks) => {
  const ou = KK.world.update; KK.world.update = function (dt) { KK.__pre(dt); return ou.call(this, dt); };
  KK.today = () => 'd' + Math.floor(hooks.time() / 28800);
  hooks.tick.push((dt, t) => { const b = KK.F.biomeOf(KK.S.floor).name; acc[b] = (acc[b] || 0) + dt; tot += dt; const h = t < 3600 * 8 ? 'h0-8' : 'h8+'; (win[h] = win[h] || {})[b] = (win[h][b] || 0) + dt; });
};
run(o);
const pct = (m) => { const s = Object.values(m).reduce((a, b) => a + b, 0); return Object.entries(m).map(([k, v]) => k + ' ' + (100 * v / s).toFixed(1) + '%').join(', '); };
console.log(`${o.profile} s${o.seed} ${o.min}m | all: ${pct(acc)} | first 8h: ${pct(win['h0-8'])} | after 8h: ${win['h8+'] ? pct(win['h8+']) : '-'}`);
