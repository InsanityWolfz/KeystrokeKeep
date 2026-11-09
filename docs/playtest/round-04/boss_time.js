// R4 market: what share of an IDLE player's on-screen time runs at full fps because a boss is up?
// (main.js targetFps drops to 10 only when no input for 45 s AND no boss AND fervor 0 AND no fx)
// node docs/playtest/round-04/boss_time.js
const load = require('../../../tools/headless');
for (const prof of ['idle', 'typist']) {
  const KK = load({ seed: 3 }); const W = KK.world; W.reset();
  const dt = 1 / 30; let t = 0, boss = 0, n = 0, slow = 0;
  for (let s = 0; s < 3 * 3600; s++) {
    if (s % 60 === 0) { for (let k = 0; k < 20; k++) for (const id of ['knight', 'archer', 'mage', 'cleric']) { if (KK.actions.canRecruit(id)) KK.actions.recruit(id); else if (KK.S.heroes[id]) KK.actions.levelHero(id); } }
    for (let i = 0; i < 30; i++) { if (prof === 'typist' && Math.random() < 5.5 / 30) KK.addActivity('key'); W.update(dt); }
    n++; if (W.boss) boss++;
    if (KK.lastInputAgo() > 45 && !W.boss && KK.fervorTier() === 0) slow++;
  }
  console.log(prof, '3h: floor', KK.S.floor, 'boss on screen', (100 * boss / n).toFixed(1) + '%', 'eligible for 10 fps (ignoring fx)', (100 * slow / n).toFixed(1) + '%');
}
