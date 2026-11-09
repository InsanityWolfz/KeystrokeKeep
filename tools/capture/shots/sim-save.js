// Staged save from a real sim run: plays tools/playtest.js (typist, smart buys, relics, retires) until the party first
// reaches --floor, then writes KK.S as a capture save. Gives the true gear/forge/relic state of that depth, which
// make-save.js (levels only) can't: a levels-only f49 party can't scratch floor-50 monsters.
// node sim-save.js --floor 49 --out saves/x.json [--demo] [--seed 1] [--profile typist] [--min 240]
const Module = require('module'), path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..', '..', '..');
const a = process.argv.slice(2); const arg = (k, d) => { const i = a.indexOf('--' + k); return i < 0 ? d : (a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true); };
const target = +arg('floor', 20), out = path.resolve(arg('out', `saves/sim_f${target}.json`));
let K = null;
const real = Module._load;
Module._load = function (req) {
  const m = real.apply(this, arguments);
  if (!/headless$/.test(req)) return m;
  return function (opts) {
    K = m(opts);
    K.on('floor', ({ floor }) => {
      if (floor !== target) return;
      const S = JSON.parse(JSON.stringify(K.S));
      S.relicOffer = null; S.relicQueue = []; S.omenOffer = null; S.v = S.v || 1;
      fs.writeFileSync(out, JSON.stringify(S));
      process.stdout.write(`sim-save: floor ${floor} at ${(K.simTime / 60).toFixed(1)} sim-min -> ${out}\n`);
      process.exit(0);
    });
    return K;
  };
};
process.argv = [process.argv[0], path.join(ROOT, 'tools', 'playtest.js'), '--min', String(arg('min', 240)), '--profile', arg('profile', 'typist'), '--seed', String(arg('seed', 1)), '--retire', 'nudge', '--omen', 'none', ...(arg('demo', false) ? ['--demo'] : [])];
const log = console.log; console.log = () => {};
process.on('exit', (c) => { console.log = log; if (c === 0 && !fs.existsSync(out)) log('sim-save: floor ' + target + ' never reached'); });
require(path.join(ROOT, 'tools', 'playtest.js'));
