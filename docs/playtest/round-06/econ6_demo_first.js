// R6: the first floor-40 (Goblin Warlord) and floor-20 (Bone King) fights of a demo: how long, how many War Charges land, what share of party HP they take.
const { load, makePlayer, avg, SEEDS } = require('./econ6lib');
const pol = (KK, P) => { const s = KK.S; if (!KK.actions.canRetire()) return false; if (s.demoDone && s.runCapCleared) return true; return P.t - P.lastMaxT > 8 * 60; };
for (const prof of ['typist', 'idle', 'burst']) {
  const rows = [];
  for (const seed of SEEDS(6)) {
    const KK = load({ seed, demo: true }); KK.world.reset();
    const P = makePlayer(KK, { profile: prof, retirePolicy: pol });
    let cur = null; const fights = [];
    KK.on('bossSpawn', ({ boss }) => { if (boss.key === 'warlord' || boss.key === 'boneking') { cur = { key: boss.key, t0: P.t, charges: 0, chDmg: 0, partyHp: KK.world.heroes.reduce((a, h) => a + h.maxHp, 0), frontHp: 0, ra: 0, boss }; fights.push(cur); } else cur = null; });
    KK.on('heroHit', ({ h, dmg, src }) => { if (cur && src === cur.boss && src.chPhase === null && cur.boss.key === 'warlord' && Math.abs(dmg - src.atk * 2) < 1e-6) { cur.charges++; cur.chDmg += dmg / h.maxHp; } });
    KK.on('reassemble', () => { if (cur) cur.ra++; });
    KK.on('kill', ({ e }) => { if (cur && e === cur.boss) { cur.dur = P.t - cur.t0; cur.won = true; cur = null; } });
    KK.on('wipe', () => { if (cur) { cur.dur = P.t - cur.t0; cur.won = false; cur = null; } });
    while (!KK.S.demoDone && P.t < 4 * 3600) P.step(1 / 30);
    const w = fights.filter((f) => f.key === 'warlord'), b = fights.filter((f) => f.key === 'boneking');
    rows.push({ wTries: w.length, wFirstWinDur: (w.find((f) => f.won) || {}).dur, wCharges: w.reduce((a, f) => a + f.charges, 0), wChargeHp: avg(w.filter((f) => f.charges).map((f) => f.chDmg / f.charges)), bTries: b.length, bFirstWinDur: (b.find((f) => f.won) || {}).dur, bRa: b.reduce((a, f) => a + f.ra, 0), wLostDur: avg(w.filter((f) => !f.won).map((f) => f.dur)) });
  }
  const g = (k) => avg(rows.map((r) => r[k]));
  console.log(`${prof.padEnd(6)} 1st delve to card (6 seeds): Warlord tries ${g('wTries').toFixed(1)}, first win ${g('wFirstWinDur').toFixed(0)}s, lost fights ${g('wLostDur').toFixed(0)}s, War Charges landed ${g('wCharges').toFixed(1)} (each = ${(g('wChargeHp') * 100).toFixed(0)}% of the knight's max HP) | Bone King tries ${g('bTries').toFixed(1)}, first win ${g('bFirstWinDur').toFixed(0)}s, reassembles ${g('bRa').toFixed(1)}`);
}
