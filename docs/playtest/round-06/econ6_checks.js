// R6 economist: verification checks for R5 fixes.
//  1) Blitz across a restart (real KK.save/KK.load with a fake file store)  2) Head Start bought mid-delve
//  3) Blitz alternatives: first time N bosses fall within W minutes (does it coincide with Speedrunner?)
const { load, makePlayer, hm, avg, SEEDS } = require('./econ6lib');
// ---- 1) Blitz across a restart
{
  let file = null;
  const nat = () => ({ saveFile(s) { file = s; }, saveFileSync(s) { file = s; }, loadFile: () => file, wipeFile() {} });
  const K1 = load({ seed: 1, native: nat() }); K1.world.reset();
  K1.S.stats.playTime = 5000; K1.S.achP.bossTimes = [4700, 4800, 4900, 5000]; K1.save();
  const K2 = load({ seed: 2, native: nat() }); K2.load(); K2.world.reset();
  const b0 = JSON.stringify(K2.S.achP.bossTimes);
  K2.S.stats.playTime += 50 * 60; // 50 min into the new session
  K2.emit('kill', { e: { boss: true, key: 'ratking' }, gold: 0 });
  console.log(`1) Blitz restart repro: saved bossTimes ${b0}, playTime after reload ${K2.S.stats.playTime - 3000}; kill 50 min later -> blitz ${K2.S.ach.blitz ? 'UNLOCKED (bug)' : 'locked (pass)'}; bossTimes now ${JSON.stringify(K2.S.achP.bossTimes)}`);
  // and a legit fast chain after the reload still counts
  for (let i = 0; i < 4; i++) { K2.S.stats.playTime += 60; K2.emit('kill', { e: { boss: true, key: 'ratking' }, gold: 0 }); }
  console.log(`   ... then 4 more bosses 1 min apart -> blitz ${K2.S.ach.blitz ? 'unlocked (pass)' : 'locked (fail)'}`);
}
// ---- 2) Head Start bought mid-delve (right after retire 1, as the Legacy panel opens)
for (const [ranks, prof] of [[4, 'idle'], [8, 'typist']]) {
  const KK = load({ seed: 2 }); KK.world.reset();
  const P = makePlayer(KK, { profile: prof, retire: 'nudge', omen: 'random', legacy: () => {} });
  while (KK.S.retires < 1) P.step(1 / 30);
  const S = KK.S; S.renown += 200;
  for (let i = 0; i < ranks; i++) KK.actions.buyLegacy('headstart');
  const lv = JSON.stringify(S.heroes);
  const t0 = P.t, w0 = S.stats.wipes;
  while (P.t < t0 + 5 * 60) P.step(1 / 30);
  const w5 = S.stats.wipes - w0;
  console.log(`2) ${prof} HS x${ranks} mid-delve: floor ${S.floor - 0} startFloor ${KK.mods().startFloor}, heroes ${lv} (expected >= ${1 + KK.mods().startLvl}); wipes in next 5 min ${w5}`);
}
// ---- 3) Blitz alternatives vs Speedrunner
const combos = [[5, 10], [5, 5], [5, 3], [8, 10], [10, 10]];
for (const prof of ['typist', 'idle', 'burst']) {
  const res = SEEDS(3).map((seed) => {
    const KK = load({ seed }); KK.world.reset();
    const P = makePlayer(KK, { profile: prof, retire: 'nudge', omen: 'random' });
    const kills = []; KK.on('kill', ({ e }) => { if (e.boss) kills.push(KK.S.stats.playTime); });
    const first = {}; let sp = NaN; KK.on('achievement', ({ id }) => { if (id === 'speed60') sp = P.t / 60; });
    KK.on('kill', ({ e }) => { if (!e.boss) return; const now = KK.S.stats.playTime; for (const [n, w] of combos) { const k = n + '/' + w; if (first[k] === undefined && kills.filter((x) => now - x < w * 60).length >= n) first[k] = P.t / 60; } });
    P.run(8 * 3600);
    return { first, sp };
  });
  console.log(`3) ${prof}: speed60 ${avg(res.map((r) => r.sp)).toFixed(0)}m | first time N bosses within W min: ` + combos.map(([n, w]) => { const a = res.map((r) => r.first[n + '/' + w]).filter((x) => x !== undefined); return `${n} in ${w}m: ${a.length ? avg(a).toFixed(0) + 'm' : 'never'}${a.length < 3 ? '(' + a.length + '/3)' : ''}`; }).join(', '));
}
