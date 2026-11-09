// R6: checks against the WORKING TREE (uncommitted R6 edits seen at 13:42): wounded Hollowed boss + Codex toast text
const KK = require('../../../tools/headless')({ seed: 1 });
const W = KK.world, S = KK.S;
W.reset();
S.floor = 90; S.maxFloorRun = 90; S.retires = 3;
S.bossWounds = { 90: 0.4 };
W.wave = W.waves - 1; W.spawnWave();
const b = W.boss;
console.log('floor 90 boss key', b.key, '| name:', b.def.name, '| hollowed:', !!b.hollowed, '| wounded:', b.wounded, '| hp%', Math.round(100 * b.hp / b.maxHp));
S.bossWounds = {}; W.enemies = []; W.wave = W.waves - 1; W.spawnWave();
console.log('same floor unwounded | name:', W.boss.def.name, '| hollowed:', !!W.boss.hollowed);
let toast = null; KK.on('codex', ({ name, rank }) => { toast = `Hollow Codex: ${name} rank ${rank}/4. x1.03 damage & gold forever.`; });
S.codexKills = 95; W.boss.hp = 1; W.damageEnemy(W.boss, 10); W.boss.hp = 1; W.damageEnemy(W.boss, 1e9); // second hit: past Reassemble
console.log('ui.js toast text for the 96th Hollowed kill:', toast);
