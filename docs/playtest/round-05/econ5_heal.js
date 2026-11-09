// R5: how big is one Cleric heal (scales with m.dmg incl. Fame/trophies) vs. hero max HP? And boss hit vs max HP.
const { load, makePlayer, hm } = require('./econ5lib');
for (const prof of ['typist', 'idle']) {
  const KK = load({ seed: 1 }); KK.world.reset();
  const P = makePlayer(KK, { profile: prof, retire: 'nudge', omen: 'random' });
  const rows = [];
  for (const h of [1, 2, 4, 8, 16]) {
    P.run(h * 3600);
    const S = KK.S, m = KK.mods(), F = KK.F, W = KK.world;
    if (!S.heroes.cleric) { rows.push(`${h}h no cleric`); continue; }
    const heal = F.heroDmg('cleric', S.heroes.cleric) * 3.2 * m.dmg * 1; // at IDLE power
    const hp = W.heroes.map((x) => x.id + ' ' + (heal / x.maxHp).toFixed(1) + 'x').join(', ');
    const f = S.maxFloorRun; const bossAtk = F.enemyAtk(f) * 1.1 * 2.4 * m.eAtk; const k = W.heroes.find((x) => x.id === 'knight');
    rows.push(`${h}h floor ${S.floor} (run max ${f}) cleric lv${S.heroes.cleric}: one heal = ${hp} of max HP | boss hit at run max = ${(bossAtk / k.maxHp * 100).toFixed(0)}% of knight HP, slam ${(bossAtk * 0.6 / k.maxHp * 100).toFixed(0)}%`);
  }
  console.log(prof + '\n  ' + rows.join('\n  '));
}
