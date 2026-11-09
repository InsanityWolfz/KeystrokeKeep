// R5 economist: demo Renown cap + demo->full import through the real KK.load path.
// node docs/playtest/round-05/econ5_demo.js [--hours 3] [--seeds 3]
const { load, makePlayer, hm, avg, rg, SEEDS } = require('./econ5lib');
const args = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; } }
const H = +(args.hours || 3), N = +(args.seeds || 3);

const pol = (KK, P) => { const s = KK.S; if (!KK.actions.canRetire()) return false; if (s.demoDone && s.runCapCleared) return true; return P.t - P.lastMaxT > 8 * 60; };
const saves = {};
for (const prof of ['typist', 'idle', 'burst']) {
  const capT = [], life = [], laps = [], best = [], ach = {}, card = [], lifeAt = { 1: [], 2: [], 3: [] };
  for (const seed of SEEDS(N)) {
    const KK = load({ seed, demo: true }); KK.world.reset();
    let cT = NaN, cardT = NaN;
    KK.on('demoComplete', () => { cardT = P.t / 60; });
    KK.on('retired', () => { if (KK.S.renownLifetime >= 48 && cT !== cT) cT = P.t / 60; });
    const P = makePlayer(KK, { profile: prof, retirePolicy: pol });
    P.run(H * 3600, [3600, 7200, 10800]);
    capT.push(cT); life.push(KK.S.renownLifetime); laps.push(KK.S.demoLaps); best.push(KK.S.bestCapTime / 60); card.push(cardT);
    for (const h of [1, 2, 3]) if (P.cps[h * 3600]) lifeAt[h].push(P.cps[h * 3600].renown);
    for (const id in P.ach) (ach[id] = ach[id] || []).push(P.ach[id] / 60);
    KK.save(); // sets demoSave
    if (seed === 1) saves[prof] = JSON.stringify(KK.S);
    if (seed === 1) console.log(`${prof} seed1 retires: ` + P.retires.map((r) => `${hm(r.at)}+${r.gain}`).join(' ') + ` | legacy ${JSON.stringify(KK.S.legacy)}`);
  }
  console.log(`DEMO ${prof} ${H}h x${N}: card ${rg(card)} min | lifetime Renown @1h ${rg(lifeAt[1])} @2h ${rg(lifeAt[2])} @3h ${rg(lifeAt[3])} end ${rg(life)} | cap 48 reached at ${rg(capT)} min | laps ${rg(laps)} | best f40 ${rg(best, 1)} min`);
  console.log(`  achievements (min, ${N} seeds): ` + Object.entries(ach).sort((a, b) => avg(a[1]) - avg(b[1])).map(([k, v]) => `${k} ${avg(v).toFixed(0)}${v.length < N ? '(' + v.length + '/' + N + ')' : ''}`).join(', '));
}

// ---------------------------------------------------- import: the real KK.load path with a fake file store
for (const prof of ['typist', 'idle']) {
  const raw = saves[prof];
  const d = JSON.parse(raw);
  const KF = load({ seed: 77, native: { saveFile() {}, saveFileSync() {}, loadFile: () => raw, wipeFile() {} } });
  const ok = KF.load();
  const s = KF.S;
  console.log(`\nIMPORT ${prof}: load ok=${ok} demoSave ${d.demoSave}->${s.demoSave} lifetime ${s.renownLifetime} renown ${s.renown} renownFloor ${d.renownFloor}->${s.renownFloor} (renownFor ${KF.F.renownFor(s.renownFloor)}) floor ${s.floor} maxRun ${s.maxFloorRun} demoDone ${s.demoDone} headstart ${s.legacy.headstart || 0} (max ${KF.DATA.LEGACY.find((x) => x.id === 'headstart').max}) ach ${Object.keys(s.ach).length}`);
  console.log(`  retireTarget ${KF.actions.retireTarget()} renownGain now ${KF.actions.renownGain()}`);
  // re-load the converted save again: must not convert twice
  const raw2 = JSON.stringify(s);
  const KF2 = load({ seed: 78, native: { saveFile() {}, saveFileSync() {}, loadFile: () => raw2, wipeFile() {} } }); KF2.load();
  console.log(`  second load renownFloor ${KF2.S.renownFloor} (unchanged = ${KF2.S.renownFloor === s.renownFloor})`);
  // play the full game 4 h from the import, vs a fresh full-game player (same profile)
  KF.world.reset();
  const PF = makePlayer(KF, { profile: prof, retire: 'nudge', omen: 'random' });
  PF.run(4 * 3600, [3600, 7200, 4 * 3600]);
  const fresh = [];
  for (const seed of [1, 2, 3]) {
    const K = load({ seed }); K.world.reset();
    const P = makePlayer(K, { profile: prof, retire: 'nudge', omen: 'random' });
    P.run((4 + H) * 3600, [H * 3600, (1 + H) * 3600, (2 + H) * 3600, (4 + H) * 3600]);
    fresh.push(P.cps);
  }
  console.log(`  importer full-game: ` + [1, 2, 4].map((h) => `+${h}h f${PF.cps[h * 3600].floor} R${PF.cps[h * 3600].renown}`).join(' | ') + ` | first full retire ${PF.retires[0] ? hm(PF.retires[0].at) + ' f' + PF.retires[0].floor + ' +' + PF.retires[0].gain : '-'}`);
  console.log(`  full-only same total time (${H}h demo-equivalent + Xh): ` + [1, 2, 4].map((h) => `+${h}h f${avg(fresh.map((c) => c[(h + H) * 3600].floor)).toFixed(0)} R${avg(fresh.map((c) => c[(h + H) * 3600].renown)).toFixed(0)}`).join(' | ') + ` ; full-only at ${H}h: f${avg(fresh.map((c) => c[H * 3600].floor)).toFixed(0)} R${avg(fresh.map((c) => c[H * 3600].renown)).toFixed(0)}`);
  // a fresh full player starting from zero, for the "same hours played" comparison of the import itself
}
// edge: a save with lifetime above the cap (older builds) is converted too
{
  const d = JSON.parse(saves.typist); d.renownLifetime = 400; d.demoSave = true; const raw = JSON.stringify(d);
  const KF = load({ seed: 9, native: { saveFile() {}, saveFileSync() {}, loadFile: () => raw, wipeFile() {} } }); KF.load();
  console.log(`\nEDGE lifetime 400 -> renownFloor ${KF.S.renownFloor} (renownFor ${KF.F.renownFor(KF.S.renownFloor)})`);
}
