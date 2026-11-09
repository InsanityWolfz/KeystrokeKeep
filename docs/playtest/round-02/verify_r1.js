// Round 02 auditor: pass/fail checks for the R1 fixes + dead-content probes.
// node docs/playtest/round-02/verify_r1.js
const load = require('../../../tools/headless');
const dt = 1 / 30;
const out = [];
const log = (...a) => out.push(a.join(' '));

function typistLoop(KK, secs, opts = {}) {
  const S = KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
  let t = 0, typing = false, sw = 0, acc = 0, nextG = 0;
  const rate = opts.rate === undefined ? 4 : opts.rate;
  while (t < secs) {
    if (rate > 0) { sw -= dt; if (sw <= 0) { typing = !typing; sw = typing ? 20 + rnd() * 40 : 15 + rnd() * 40; } if (typing) { acc += dt * rate; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
    W.update(dt); t += dt;
    if (opts.each) opts.each(t);
    if (t >= nextG) {
      nextG = t + 60;
      if (S.relicOffer) { if (opts.noRelics) S.relicOffer = null; else A.pickRelic(S.relicOffer[0]); }
      for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
      if (!opts.noWorkshop) for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
      for (let i = 0; i < 400; i++) {
        let did = false;
        for (const d of D.FORGE) { const c = F.upCost(d, S.forge[d.id] || 0); if ((S.forge[d.id] || 0) < d.max && c < S.gold * 0.4) { A.buyForge(d.id); did = true; } }
        let best = null, bc = Infinity;
        for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } }
        if (best && bc <= S.gold) { A.levelHero(best, 1); did = true; }
        if (!did) break;
      }
      if (W.rat) W.catchRat();
    }
  }
}

// ---------- A. boss slam counter: every 4th boss melee swing should be a party-wide slam
{
  const KK = load({ seed: 11 }); KK.world.reset();
  const per = {};
  const W = KK.world;
  const orig = W.damageHero;
  let inSlam = false;
  KK.on('bossSlam', ({ e }) => { (per[e.def.name] = per[e.def.name] || { slam: 0, single: 0, swingsAtDeath: [] }).slam++; });
  W.damageHero = function (h, dmg, src) { if (src && src.boss && !inSlam) { const p = (per[src.def.name] = per[src.def.name] || { slam: 0, single: 0, swingsAtDeath: [] }); p.hitEvents = (p.hitEvents || 0) + 1; } return orig.call(this, h, dmg, src); };
  KK.on('kill', ({ e }) => { if (e.boss) per[e.def.name].swingsAtDeath.push(e.swings || 0); });
  typistLoop(KK, 50 * 60);
  log('A. boss slam cadence (typist 50 min): ' + Object.entries(per).map(([n, p]) => { const sw = p.swingsAtDeath.reduce((a, b) => a + b, 0); return `${n}: slams ${p.slam}, swings ${sw} (expected slams ~${Math.floor(sw / 4)}), fights ${p.swingsAtDeath.length}, swings/fight ${(sw / Math.max(1, p.swingsAtDeath.length)).toFixed(1)}`; }).join(' | '));
}

// ---------- B. Head Start applies immediately
{
  const KK = load({ seed: 3 }); const S = KK.S, A = KK.actions, W = KK.world; W.reset();
  S.renown = 1000;
  const r = [];
  A.buyLegacy('headstart'); r.push(`at floor 1 buy HS1 -> floor ${S.floor}`);
  typistLoop(KK, 90); r.push(`after 90 s floor ${S.floor}`);
  A.buyLegacy('headstart'); r.push(`buy HS2 -> floor ${S.floor} (target 11)`);
  // in transition
  let tries = 0; while (!(W.trans > 0) && tries++ < 30 * 600) { KK.addActivity('key'); W.update(dt); }
  const before = S.floor; A.buyLegacy('headstart'); for (let i = 0; i < 60; i++) W.update(dt);
  r.push(`buy HS3 during a door transition at floor ${before} -> floor ${S.floor} (target 16)`);
  log('B. Head Start immediate: ' + r.join('; '));
}

// ---------- C. Veterans applies immediately
{
  const KK = load({ seed: 3 }); const S = KK.S, A = KK.actions, W = KK.world; W.reset();
  S.heroes.archer = 3; S.heroes.knight = 30; S.renown = 1000; KK.dirty();
  A.buyLegacy('veterans');
  log(`C. Veterans immediate: knight 30 -> ${S.heroes.knight}, archer 3 -> ${S.heroes.archer} (expect 6), mage unowned -> ${S.heroes.mage}`);
}

// ---------- D. Idle Battery vs Fervor tiers (power multiplier)
{
  const KK = load({ seed: 1 }); const S = KK.S, D = KK.DATA;
  const rows = [];
  for (let b = 0; b <= 5; b++) {
    S.legacy.battery = b; KK.dirty();
    const vals = D.FERVOR_TIERS.map((tier) => { S.fervor = tier.at + 1; return KK.powerMult().toFixed(2); });
    rows.push(`rank ${b}: ${vals.join('/')}`);
    for (let i = 0; i < 3; i++) { S.fervor = 0; KK.fervorTier(); }
  }
  log('D. powerMult IDLE/FOCUSED/ZONE/FLOW by Idle Battery rank: ' + rows.join(' | '));
}

// ---------- E. offline % with Campfire + Midnight Oil
{
  const KK = load({ seed: 1 }); const S = KK.S;
  const rows = [];
  for (let c = 0; c <= 4; c++) { S.legacy.campfire = c; S.relics = []; KK.dirty(); const a = KK.mods().offline; S.relics = ['oil']; KK.dirty(); const b = KK.mods().offline; rows.push(`campfire ${c}: ${Math.round(a * 100)}% -> with Oil ${Math.round(b * 100)}%`); }
  log('E. offline share: ' + rows.join(' | '));
}

// ---------- F. Workshop value: 60-min typist from fresh, Embers given up front so each row is maxed vs none
{
  const res = {};
  const configs = { none: {}, jar10: { jar: 10 }, overcharge8: { overcharge: 8 }, kindling10: { kindling: 10 }, static8: { static: 8 } };
  for (const [name, ws] of Object.entries(configs)) {
    let f = 0, u = 0, wasted = 0, f40 = 0;
    for (let s = 1; s <= 4; s++) {
      const KK = load({ seed: 300 + s }); const S = KK.S; S.workshop = Object.assign({}, ws); KK.dirty(); KK.world.reset();
      let ults = 0; KK.on('ult', () => ults++);
      const orig = KK.addActivity; let w = 0;
      KK.addActivity = function (k) { if (S.sparks >= KK.mods().sparkCap) w++; return orig(k); };
      let t40 = null;
      typistLoop(KK, 45 * 60, { noWorkshop: true, noRelics: true, each: (t) => { if (t40 === null && S.maxFloorRun >= 35) t40 = t; } });
      f += S.maxFloorRun; u += ults; wasted += w; f40 += (t40 || 2700) / 60;
    }
    res[name] = `floor ${(f / 4).toFixed(1)}, min-to-F35 ${(f40 / 4).toFixed(1)}, ults ${(u / 4).toFixed(0)}, sparks wasted at cap ${(wasted / 4).toFixed(0)}`;
  }
  log('F. Workshop row value (typist 45 min, 4 seeds, row given maxed): ' + Object.entries(res).map(([k, v]) => k + ': ' + v).join(' | '));
}

// ---------- G. Ember income per hour, and Workshop total price
{
  const KK0 = load({}); const D = KK0.DATA, F = KK0.F;
  const tot = D.WORKSHOP.map((d) => { let c = 0; for (let l = 0; l < Math.min(d.max, 40); l++) c += F.upCost(d, l); return `${d.id} ${d.max < 999 ? 'all ' + d.max : 'first 40'}: ${KK0.U.fmt(c)}`; });
  log('G. Workshop prices: ' + tot.join(' | '));
}
console.log(out.join('\n'));
