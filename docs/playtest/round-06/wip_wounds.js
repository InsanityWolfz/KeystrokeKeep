// R6, WORKING TREE: how often does a wounded retry spawn without its Hollowed status (else-if chain bug in spawnWave)?
const { run } = require('./r6lib');
for (const p of ['typist', 'idle']) {
  let wounded = 0, lost = 0, lostKills = 0;
  run({ profile: p, seed: 1, min: 2400, patch: (KK) => {
    KK.on('bossSpawn', ({ boss }) => { const f = KK.S.floor; if (boss.wounded) { wounded++; if (f >= 70 && boss.key !== 'hollow' && !boss.hollowed) lost++; } });
    KK.on('kill', ({ e }) => { if (e.boss && e.wounded && KK.S.floor >= 70 && e.key !== 'hollow' && !e.hollowed) lostKills++; });
  } });
  console.log(`${p} s1 40h (working tree): wounded boss spawns ${wounded}, of them spawned WITHOUT Hollowed status ${lost}; such kills (no Codex credit, no void slam fight) ${lostKills}`);
}
