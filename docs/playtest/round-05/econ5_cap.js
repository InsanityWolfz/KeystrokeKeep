// R5: would a higher demo Renown cap break the full game now that the import converts? (cap patched in memory)
const { load, makePlayer, hm, avg } = require('./econ5lib');
const cap = +(process.argv[2] || 120), prof = process.argv[3] || 'typist', DH = +(process.argv[4] || 4);
const pol = (KK, P) => { const s = KK.S; if (!KK.actions.canRetire()) return false; if (s.demoDone && s.runCapCleared) return true; return P.t - P.lastMaxT > 8 * 60; };
const KD = load({ seed: 1, demo: true }); KD.DEMO_RENOWN_CAP = cap; KD.world.reset();
let capT = NaN; KD.on('retired', () => { if (KD.S.renownLifetime >= cap && capT !== capT) capT = PD.t; });
const PD = makePlayer(KD, { profile: prof, retirePolicy: pol }); PD.run(DH * 3600);
KD.save();
const raw = JSON.stringify(KD.S);
console.log(`demo cap ${cap} ${prof}: reached at ${hm(capT)}; after ${DH}h lifetime ${KD.S.renownLifetime} legacy ${JSON.stringify(KD.S.legacy)}`);
const KF = load({ seed: 77, native: { saveFile() {}, saveFileSync() {}, loadFile: () => raw, wipeFile() {} } }); KF.load(); KF.world.reset();
console.log(`  import: renownFloor ${KF.S.renownFloor}`);
const PF = makePlayer(KF, { profile: prof, retire: 'nudge', omen: 'random' }); PF.run(4 * 3600, [3600, 7200, 4 * 3600]);
console.log('  importer full game: ' + [1, 2, 4].map((h) => `+${h}h f${PF.cps[h * 3600].floor} R${PF.cps[h * 3600].renown}`).join(' | '));
const fr = [1, 2, 3].map((seed) => { const K = load({ seed }); K.world.reset(); const P = makePlayer(K, { profile: prof, retire: 'nudge', omen: 'random' }); P.run(4 * 3600, [3600, 7200, 4 * 3600]); return P.cps; });
console.log('  fresh full game:    ' + [1, 2, 4].map((h) => `${h}h f${avg(fr.map((c) => c[h * 3600].floor)).toFixed(0)} R${avg(fr.map((c) => c[h * 3600].renown)).toFixed(0)}`).join(' | '));
