// Round 05 auditor: in-memory prototype of a minimal week-2 layer (no game file touched).
//  W1 Trophies keep coming: every 10 floors past 150 (160..300), x1.03 each.
//  W2 Wall stipend: a delve that spent >= 40 min and got within 3 floors of the record pays +5 Renown
//     even when the record didn't move (today it pays 0 and the Retire button is disabled).
//  W3 Legacy tier 2 ("Ascendant Hall"), unlocked when every capped tier-1 row is maxed:
//     Deep Roots (Head Start +5 floors/+10 levels per rank, 3 ranks, 30/45/60),
//     Polished Trophies (+1% per trophy per rank, 3 ranks, 35/50/65),
//     Hollow Bounty (Hollowed bosses +1 relic choice, 1 rank, 30), Omen Seer (4 omen cards, 1 rank, 40).
// node docs/playtest/round-05/week2_test.js [min] > out/week2_test.txt
const { run, fmtT, gap } = require('./r5lib');
const MIN = +process.argv[2] || 2400;

function patch(opts) {
  return (KK) => {
    const D = KK.DATA, A = KK.actions, F = KK.F;
    const tier1Done = () => D.LEGACY.filter((d) => !d.tier2 && d.max < 999).every((d) => (KK.S.legacy[d.id] || 0) >= d.max);
    if (opts.trophies) for (let f = 160; f <= 300; f += 10) D.TROPHIES.push(f);
    if (opts.trophies) {
      // the x1.03 tail: undo x1.05 for trophies past 150 and apply x1.03 instead (applied via an extra hidden legacy row)
      D.LEGACY.push({ id: '_tail', tier2: true, max: 0, cost: () => 1e9, desc: () => '', apply: () => {} });
    }
    if (opts.stipend) {
      const orig = A.renownGain;
      A.renownGain = () => { const g = orig(); const S = KK.S; if (g > 0) return g; return (S.runTime || 0) >= 2400 && S.maxFloorRun >= (S.renownFloor || 0) - 3 && S.renownFloor >= 100 ? 5 : 0; };
      A.canRetire = () => A.renownGain() > 0;
    }
    if (opts.tier2) {
      const row = (r) => Object.assign({ tier2: true, get max() { return tier1Done() ? r.cap : 0; } }, r);
      D.LEGACY.push(row({ id: 'deeproots', cap: 3, cost: (l) => [30, 45, 60][l], desc: () => '', apply: (m, l) => { m.startFloor += 5 * l; m.startLvl += 10 * l; } }));
      D.LEGACY.push(row({ id: 'polish', cap: 3, cost: (l) => [35, 50, 65][l], desc: () => '', apply: (m, l) => { const n = D.TROPHIES.filter((f) => KK.S.maxFloorEver >= f).length; m.dmg *= Math.pow(1 + 0.01 * l / 1.05, n); m.gold *= Math.pow(1 + 0.01 * l / 1.05, n); } }));
      D.LEGACY.push(row({ id: 'bounty', cap: 1, cost: () => 30, desc: () => '', apply: () => {} }));
      D.LEGACY.push(row({ id: 'seer', cap: 1, cost: () => 40, desc: () => '', apply: () => {} }));
      const origRoll = A.rollRelics;
      A.rollRelics = () => { const m = KK.mods(); const b = KK.world.boss; const add = (KK.S.legacy.bounty || 0) && KK.S.floor >= 80 ? 1 : 0; m.relicChoices += add; origRoll(); m.relicChoices -= add; };
    }
    if (opts.trophies) {
      // correct the tail multiplier: mods() applies 1.05^n to all n trophies; scale back those past 150 to 1.03
      const origMods = KK.mods;
      let cacheKey = null, cache = null;
      KK.mods = function () {
        const m = origMods();
        const tail = D.TROPHIES.filter((f) => f > 150 && KK.S.maxFloorEver >= f).length;
        if (tail && !m._tailFixed) { const k = Math.pow(1.03 / 1.05, tail); m.dmg *= k; m.gold *= k; m._tailFixed = true; }
        return m;
      };
    }
  };
}

const variants = [['base', {}], ['week2', { trophies: true, stipend: true, tier2: true }], ['stipend only', { stipend: true }]];
const configs = [{ profile: 'typist', seed: 1 }, { profile: 'typist', seed: 2 }, { profile: 'light', seed: 1 }, { profile: 'idle', seed: 1 }];
const L = [];
for (const c of configs) {
  L.push(`=== ${c.profile} s${c.seed} ${MIN}m`);
  for (const [name, opts] of variants) {
    const R = run(Object.assign({ min: MIN, retire: 'nudge', omen: 'random', patch: patch(opts) }, c));
    const E = R.end, end = E.t, H = 3600;
    const beats = R.nov.filter((n) => n.kind !== 'minor');
    const buys = [];
    // goals: new records of maxEver per hour after h8, wall lengths
    const walls = []; let last = null;
    for (const x of R.hs) { if (last && x.maxEver === last.maxEver) { /* still walled */ } last = x; }
    const recs = R.hs.map((x) => x.maxEver);
    let wl = 0, maxWall = 0; for (let i = 1; i < recs.length; i++) { if (recs[i] === recs[i - 1]) { wl += 0.5; maxWall = Math.max(maxWall, wl); } else wl = 0; }
    const g8 = gap(beats, 8 * H, end), g16 = gap(beats, 16 * H, end);
    const t2 = Object.entries(E.legacy).filter(([k]) => ['deeproots', 'polish', 'bounty', 'seer'].includes(k)).map(([k, v]) => k + v).join(' ');
    const after8 = beats.filter((n) => n.t >= 8 * H).length;
    L.push(`  ${name.padEnd(13)} maxEver@8h ${R.hs[16] ? R.hs[16].maxEver : '-'} @16h ${R.hs[32] ? R.hs[32].maxEver : '-'} @end ${E.maxEver}; retires ${E.retires} (after 8h: ${R.retires.filter((r) => r.t >= 8 * H).length}); renown ${E.renownLife}; trophies ${E.trophies}; ach ${E.achN}; beats after 8h ${after8}; longest beat gap after 8h ${(g8.g / 60).toFixed(0)}m (from ${fmtT(g8.at)}), after 16h ${(g16.g / 60).toFixed(0)}m; longest no-record wall ${maxWall}h; tier2 ${t2 || '-'}; legacy ${JSON.stringify(E.legacy)}`);
  }
}
console.log(L.join('\n'));
