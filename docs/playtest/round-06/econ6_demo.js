// R6 economist: demo (cap 40, Renown cap 120) with War Charge / Reassemble on and off (test-only toggles in econ6lib).
// node docs/playtest/round-06/econ6_demo.js [--hours 3] [--seeds 4] [--v base,noWarCharge,noReassemble,noWarCharge+noReassemble]
const { load, makePlayer, hm, avg, rg, SEEDS } = require('./econ6lib');
const args = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; } }
const H = +(args.hours || 3), N = +(args.seeds || 4);
const VS = (args.v || 'base,noWarCharge,noReassemble,noWarCharge+noReassemble').split(',');
const pol = (KK, P) => { const s = KK.S; if (!KK.actions.canRetire()) return false; if (s.demoDone && s.runCapCleared) return true; return P.t - P.lastMaxT > 8 * 60; };
const med = (a) => { const b = a.filter((x) => x === x).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };

for (const prof of (args.profiles || 'typist,idle,burst').split(',')) {
  for (const v of VS) {
    const R = { card: [], capT: [], best: [], laps: [], life1: [], life2: [], wipes: [], wipesD1: [], enr: [], wc: [], ra: [], f20: [], f40: [], f20w: [], f40w: [], f40att1: [], lapMed: [] };
    for (const seed of SEEDS(N)) {
      const KK = load({ seed, demo: true }); KK.world.reset();
      let cardT = NaN, capT = NaN, wD1 = NaN; const lapT = [];
      const P = makePlayer(KK, { profile: prof, retirePolicy: pol, noWarCharge: v.includes('noWarCharge'), noReassemble: v.includes('noReassemble'), fixEnrage: v.includes('fix') });
      KK.on('demoComplete', () => { cardT = P.t / 60; wD1 = KK.S.stats.wipes; });
      KK.on('demoSealed', ({ time }) => lapT.push(time / 60));
      KK.on('retired', () => { if (KK.S.renownLifetime >= KK.DEMO_RENOWN_CAP && capT !== capT) capT = P.t / 60; });
      P.run(H * 3600, [3600, 7200]);
      R.card.push(cardT); R.capT.push(capT); R.best.push(KK.S.bestCapTime / 60); R.laps.push(KK.S.demoLaps);
      R.life1.push(P.cps[3600].renown); R.life2.push(P.cps[7200] ? P.cps[7200].renown : NaN);
      R.wipes.push(KK.S.stats.wipes); R.wipesD1.push(wD1); R.enr.push(P.enrages); R.wc.push(P.warCharges); R.ra.push(P.reassembles);
      const f20 = P.bf.filter((f) => f.key === 'boneking'), f40 = P.bf.filter((f) => f.key === 'warlord');
      R.f20.push(med(f20.filter((f) => f.out === 'won').map((f) => f.wall))); R.f40.push(med(f40.filter((f) => f.out === 'won').map((f) => f.wall)));
      R.f20w.push(f20.length ? f20.filter((f) => f.out !== 'won').length / f20.length * 100 : NaN); R.f40w.push(f40.length ? f40.filter((f) => f.out !== 'won').length / f40.length * 100 : NaN);
      const firstWin = f40.findIndex((f) => f.out === 'won'); R.f40att1.push(firstWin + 1);
      R.lapMed.push(med(lapT));
    }
    console.log(`DEMO ${prof.padEnd(6)} ${v.padEnd(26)} card ${avg(R.card).toFixed(1)}m (${rg(R.card, 0)}) wipes to card ${avg(R.wipesD1).toFixed(1)} | f40 tries to 1st win ${avg(R.f40att1).toFixed(1)} f40 loss% ${avg(R.f40w).toFixed(0)} f40 win ${avg(R.f40).toFixed(0)}s | f20 loss% ${avg(R.f20w).toFixed(0)} f20 win ${avg(R.f20).toFixed(0)}s | best lap ${avg(R.best).toFixed(2)}m lap med ${avg(R.lapMed).toFixed(2)}m laps ${avg(R.laps).toFixed(1)} | R@1h ${avg(R.life1).toFixed(0)} R@2h ${avg(R.life2).toFixed(0)} cap120 @${avg(R.capT).toFixed(0)}m (${R.capT.filter((x) => x === x).length}/${N}) | wipes ${avg(R.wipes).toFixed(0)} enrages ${avg(R.enr).toFixed(1)} charges ${avg(R.wc).toFixed(0)} reassembles ${avg(R.ra).toFixed(0)}`);
  }
}
