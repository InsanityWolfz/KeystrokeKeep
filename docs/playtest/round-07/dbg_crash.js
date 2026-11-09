// reproduce caut50 seed 2 glance 900 crash: log floor/camp state on each floor event
const Module = require('module'); const real = Module._load; const { apply } = require('./r7patch');
let K; const log = [];
Module._load = function (req) { const m = real.apply(this, arguments); if (/headless$/.test(req)) return (o) => { K = m(o); apply(K, { caution: 0.5 }); K.on('floor', ({ floor }) => { const S = K.S; log.push(`${(S.stats.playTime/60).toFixed(1)} f${floor} camp${S.campFloor||0} until${((S.campUntil||0)-S.stats.playTime).toFixed(0)} block${S.bossBlock} lv${S.campLevels||0}`); if (log.length > 30) log.shift(); }); K.on('wipe', (d) => log.push('WIPE ' + JSON.stringify(d))); K.on('retired', () => log.push('RETIRE')); return K; }; return m; };
console.log = () => {};
process.on('uncaughtException', (e) => { process.stdout.write(log.join('\n') + '\n' + e.message + '\n'); process.exit(1); });
process.argv.push('--min', '180', '--profile', 'idle', '--seed', '2', '--demo', '--retire', 'nudge', '--omen', 'random', '--glance', '900');
require('../../../tools/playtest.js');
