// R5: buy Head Start right after a retire (the Legacy panel opens then). Heroes keep the old level; the
// party jumps to the new start floor, and a retreat never goes above... below it. Does it get stuck?
const { load, makePlayer, hm } = require('./econ5lib');
for (const [ranks, prof] of [[4, 'idle'], [4, 'typist'], [8, 'typist'], [2, 'idle']]) {
  const KK = load({ seed: 2 }); KK.world.reset();
  const P = makePlayer(KK, { profile: prof, retire: 'nudge', omen: 'random', legacy: (K) => {} }); // buys no Legacy on its own
  while (KK.S.retires < 1) P.step(1 / 30);
  const S = KK.S;
  S.renown += 200; // enough Renown for the ranks (as a later retire would give)
  for (let i = 0; i < ranks; i++) KK.actions.buyLegacy('headstart');
  console.log(`${prof} HS x${ranks} right after retire 1 @${hm(P.t)}: floor ${S.floor}, startFloor ${KK.mods().startFloor}, knight lv ${S.heroes.knight} (a delve started now would give lv ${1 + KK.mods().startLvl})`);
  const t0 = P.t, w0 = S.stats.wipes;
  for (const m of [5, 15, 30, 60]) { while (P.t < t0 + m * 60) P.step(1 / 30); console.log(`   +${m}m floor ${S.floor} max ${S.maxFloorRun} knight lv ${S.heroes.knight} gold ${Math.floor(S.gold)} wipes ${S.stats.wipes - w0} canRetire ${KK.actions.canRetire()}`); }
}
