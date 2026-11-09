// after a wipe on floor x1, where does the party land and what spawns?
const Module = require('module'); const real = Module._load; let K;
Module._load = function (req) { const m = real.apply(this, arguments); if (/headless$/.test(req)) return (o) => { K = m(o);
  K.on('recovered', ({ floor }) => process.stdout.write(`${(K.S.stats.playTime/60).toFixed(1)}m recovered to f${floor} wave ${K.world.wave}\n`));
  K.on('bossSpawn', ({ boss }) => process.stdout.write(`${(K.S.stats.playTime/60).toFixed(1)}m bossSpawn f${K.S.floor} ${boss.key} wounded ${boss.wounded||0}\n`));
  K.on('kill', ({ e }) => { if (e.boss) process.stdout.write(`${(K.S.stats.playTime/60).toFixed(1)}m boss killed f${K.S.floor}\n`); });
  K.on('wipe', (d) => process.stdout.write(`${(K.S.stats.playTime/60).toFixed(1)}m WIPE f${d.floor}\n`));
  K.on('floor', ({ floor }) => { if (floor % 10 === 1 || floor % 10 === 0) process.stdout.write(`${(K.S.stats.playTime/60).toFixed(1)}m floor ${floor}\n`); });
  return K; }; return m; };
console.log = () => {};
process.argv.push('--min', '25', '--profile', 'idle', '--seed', '4', '--demo', '--retire', 'nudge', '--omen', 'random', '--glance', '300');
require('../../../tools/playtest.js');
