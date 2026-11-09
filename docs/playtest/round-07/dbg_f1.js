// why does a fresh post-retire party wipe on floors 1-3? (base game, idle demo seed 2, glance 900)
const Module = require('module'); const real = Module._load;
let K;
Module._load = function (req) { const m = real.apply(this, arguments); if (/headless$/.test(req)) return (o) => { K = m(o);
  K.on('wipe', (d) => { const S = K.S; if (S.retires >= 1 && d.floor <= 5) process.stdout.write(`${(S.stats.playTime/60).toFixed(1)}m wipe f${d.floor} heroes ${JSON.stringify(S.heroes)} hp ${K.world.heroes.map(h=>h.id+':'+h.maxHp.toFixed(0)).join(',')} enemies ${K.world.enemies.filter(e=>!e.dead).map(e=>e.key+' hp'+e.hp.toFixed(0)+' atk'+e.atk.toFixed(1)).join(',')} legacy ${JSON.stringify(S.legacy)} relics ${S.relics} mods.hp ${K.mods().hp.toFixed(2)} dmg ${K.mods().dmg.toFixed(2)}\n`); });
  return K; }; return m; };
console.log = () => {};
process.argv.push('--min', '120', '--profile', 'idle', '--seed', '2', '--demo', '--retire', 'nudge', '--omen', 'random', '--glance', '900');
require('../../../tools/playtest.js');
