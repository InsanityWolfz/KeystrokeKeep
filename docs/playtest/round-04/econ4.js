// T1 economist, round 04: economy scenarios on the real sim (read-only use of the game code).
// Usage (from project root): node docs/playtest/round-04/econ4.js <scenario> [--key value ...]
//   demo      --profile typist --hours 3 --seeds 5 --redelve now|stall
//   headstart                         (demo Head Start cap check)
//   muster                            (Veterans' Muster raises hero levels on pick?)
//   omens     --profile typist --hours 8 --seeds 3 [--omens none,gilded,...]   one omen forced every delve
//   choose    --profile typist --hours 8 --seeds 3 --rank deep,storm,...        rational best-of-3 (or none/random)
//   branch    --profile typist --at 2 --seeds 3                                 one-delve marginal value per omen
//   sw        --profile burst --hours 8 --seeds 4                               Second Wind on/off
//   idlews    --hours 8 --seeds 3                                               idle Workshop policies
//   long      --profile typist --hours 40 --seeds 3 --policy none|rank|deep --retire nudge|stall
const load = require('../../../tools/headless');
const args = { _: process.argv[2] || 'demo' };
for (let i = 3; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const hm = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
const avg = (a) => { const b = a.filter((x) => x === x); return b.length ? b.reduce((x, y) => x + y, 0) / b.length : NaN; };
const rg = (a, d = 0) => { const b = a.filter((x) => x === x); return b.length ? `${Math.min(...b).toFixed(d)}-${Math.max(...b).toFixed(d)}` : 'n/a'; };
const SEEDS = (n) => Array.from({ length: n }, (_, i) => i + 1);

const RELIC_RANK = {
  typist: ['echo', 'flowpend', 'glass', 'hotkey', 'lens', 'enter', 'whetstone', 'coffee', 'capslock', 'fang', 'belt', 'luckycoin', 'spacebar', 'keycap', 'map', 'oil', 'boots'],
  idle: ['echo', 'glass', 'lens', 'whetstone', 'coffee', 'enter', 'fang', 'belt', 'luckycoin', 'spacebar', 'map', 'oil', 'boots', 'capslock', 'keycap', 'flowpend', 'hotkey'],
};

// --patch '{"deep":"m.renownMult*=1.1; m.eHp*=1.3"}' replaces omen effects in memory (never on disk)
function patch(KK) {
  if (!args.patch) return;
  const p = JSON.parse(args.patch);
  for (const id in p) { const o = KK.DATA.OMENS.find((x) => x.id === id); o.apply = new Function('m', p[id]); }
}
// ---------------------------------------------------------------- player model (smart spend like tools/playtest.js)
function makePlayer(KK, o = {}) {
  const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, rnd = KK.rng;
  const prof = o.profile || 'typist';
  const rank = RELIC_RANK[prof === 'idle' ? 'idle' : 'typist'];
  const P = { t: 0, nextG: 0, typing: false, sw: 0, acc: 0, lastMax: S().maxFloorRun, lastMaxT: 0, runStart: 0, retires: [], cps: {}, omens: {}, embersEarned: 0, relicOffers: 0, swSparks: 0 };
  P.activity = (dt) => {
    if (prof === 'idle') return;
    P.sw -= dt;
    if (P.sw <= 0) { P.typing = !P.typing; P.sw = prof === 'burst' ? (P.typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (P.typing ? 20 + rnd() * 40 : 15 + rnd() * (prof === 'heavy' ? 10 : 40)); }
    if (P.typing) { P.acc += dt * (prof === 'heavy' ? 6 : 4); while (P.acc >= 1) { P.acc -= 1; const sw0 = S().secondWind; KK.addActivity('key'); if (S().secondWind < sw0) P.swSparks += 2; } }
  };
  P.pickRelic = () => {
    const s = S();
    while (s.relicOffer) {
      const off = s.relicOffer;
      const id = (o.relic || args.relic) === 'first' ? off[0] : off.slice().sort((a, b) => rank.indexOf(a) - rank.indexOf(b))[0];
      A.pickRelic(id);
    }
  };
  P.spend = () => {
    const s = S();
    P.pickRelic();
    if (KK.world.rat) KK.world.catchRat();
    for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
    if (o.legacy) o.legacy(KK); else { let ch = true; while (ch) { ch = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) ch = true; } }
    if (o.workshop) o.workshop(KK); else for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
    for (let i = 0; i < 400; i++) {
      let did = false;
      for (const d of D.FORGE) { if (o.skipForge && o.skipForge.includes(d.id)) continue; const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
      let best = null, bc = Infinity;
      for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
      if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
      if (!did) break;
    }
  };
  P.chooseOmen = () => {
    const s = S();
    if (!s.omenOffer) return;
    let id = null;
    if (o.forceOmen) { if (o.forceOmen !== 'none') { if (!s.omenOffer.includes(o.forceOmen)) s.omenOffer[0] = o.forceOmen; id = o.forceOmen; } }
    else if (o.omenRank) { const r = o.omenRank; const best = s.omenOffer.filter((x) => r.includes(x)).sort((a, b) => r.indexOf(a) - r.indexOf(b))[0]; id = best || null; }
    else if (o.omen === 'random') id = s.omenOffer[Math.floor(rnd() * 3)];
    A.pickOmen(id);
    P.omens[id || 'none'] = (P.omens[id || 'none'] || 0) + 1;
  };
  P.doRetire = (why) => {
    const s = S();
    const life0 = s.renownLifetime;
    const prev = { forge: { ...s.forge }, heroes: { ...s.heroes } };
    const g = A.retire();
    if (!g) return false;
    P.retires.push({ at: P.t, run: (P.t - P.runStart) / 60, floor: P.lastMax, gain: s.renownLifetime - life0, why, omen: P.curOmen || null, life: s.renownLifetime });
    KK.world.reset(); P.runStart = P.t; P.lastMax = s.maxFloorRun; P.lastMaxT = P.t;
    P.chooseOmen(); P.curOmen = s.omen;
    if (o.onOmen) o.onOmen(KK, prev);
    P.spend();
    return true;
  };
  P.nudge = () => {
    const s = S(), g = A.renownGain();
    if (KK.DEMO_CAP && !s.demoDone) return false;
    return g >= 30 && ((s.runTime || 0) / 60 > 25 || (s.retires === 0 && s.maxFloorRun >= 40));
  };
  P.step = (dt) => {
    P.activity(dt);
    const e0 = S().embers;
    KK.world.update(dt);
    if (o.enrage || args.enrage) { // test-only boss enrage: after G s of fighting, boss attack x(1+r)^s
      const [G, r] = String(o.enrage || args.enrage).split(':').map(Number);
      for (const e of KK.world.enemies) if (e.boss && e.active && !e.dead) { e._ft = (e._ft || 0) + dt; if (e._ft > G) { e._a0 = e._a0 || e.atk; e.atk = e._a0 * Math.pow(1 + r, e._ft - G); } }
    }
    if (S().embers > e0) P.embersEarned += S().embers - e0;
    P.t += dt;
    const s = S();
    if (s.maxFloorRun > P.lastMax) { P.lastMax = s.maxFloorRun; P.lastMaxT = P.t; }
    if (P.t >= P.nextG) {
      P.nextG = P.t + (o.glance || 60);
      if (s.relicOffer) P.relicOffers++;
      P.spend();
      if (o.retirePolicy) { if (o.retirePolicy(KK, P)) P.doRetire('policy'); }
      else {
        const stall = P.t - P.lastMaxT > (o.stuck || 8) * 60;
        if (A.canRetire() && ((o.retire === 'nudge' && P.nudge()) || stall)) P.doRetire(stall ? 'stall' : 'nudge');
      }
    }
  };
  P.run = (sec, cps = []) => {
    const want = cps.slice().sort((a, b) => a - b);
    while (P.t < sec) {
      P.step(1 / 30);
      while (want.length && P.t >= want[0]) { const c = want.shift(); P.cps[c] = P.snap(); }
    }
    return P;
  };
  P.snap = () => { const s = S(); return { floor: s.maxFloorEver, renown: s.renownLifetime, retires: s.retires, embers: P.embersEarned, oc: s.workshop.overcharge || 0, ws: { ...s.workshop }, fame: KK.mods().fame, wipes: s.stats.wipes }; };
  return P;
}

// =========================================================== demo economy end to end
function demo() {
  const prof = args.profile || 'typist', H = +(args.hours || 3), N = +(args.seeds || 5), mode = args.redelve || 'now';
  console.log(`=== DEMO ${prof}, ${H} h, ${N} seeds, re-delve ${mode} ===`);
  const agg = { card: [], first: [], laps: [], best: [], r1: [], r2: [], r3: [], nre: [], offersH: [], emb: [], unspentEmb: [], gold: [] };
  const legacyFirst = {}; const legacyLv = {};
  for (const seed of SEEDS(N)) {
    const KK = load({ seed, demo: true }); KK.world.reset();
    const S = () => KK.S, A = KK.actions;
    let card = NaN; const lapT = [];
    KK.on('demoComplete', () => { card = P.t / 60; });
    KK.on('demoSealed', ({ time }) => lapT.push(time / 60));
    const lf = {};
    KK.on('upgrade', ({ store, id }) => { if (store === 'legacy' && !(id in lf)) lf[id] = P.t / 60; });
    const pol = (KK2, P2) => {
      const s = S();
      if (!A.canRetire()) return false;
      const stall = P2.t - P2.lastMaxT > 8 * 60;
      if (s.demoDone && s.runCapCleared) return mode === 'now' ? true : stall;
      return stall; // before the card: wall-retire only (the nudge is muted until the card)
    };
    const P = makePlayer(KK, { profile: prof, retirePolicy: pol });
    const cps = [3600, 7200, 10800, 4 * 3600, 6 * 3600, 8 * 3600].filter((c) => c <= H * 3600);
    P.run(H * 3600, cps);
    if (H >= 4) console.log(`seed${seed} lifetime Renown by hour: ` + cps.map((c) => `${c / 3600}h ${P.cps[c].renown} (lineage ${P.cps[c].ws ? '' : ''})`).join(' ') + ` | fame x${KK.mods().fame.toFixed(1)} | laps last ${P.retires.slice(-3).map((x) => x.run.toFixed(1)).join('/')}m`);
    const s = S();
    agg.card.push(card); agg.first.push(P.retires[0] ? P.retires[0].at / 60 : NaN);
    agg.laps.push(avg(lapT)); agg.best.push(s.bestCapTime / 60);
    agg.r1.push(P.cps[3600] ? P.cps[3600].renown : NaN); agg.r2.push(P.cps[7200] ? P.cps[7200].renown : NaN); agg.r3.push(P.cps[10800] ? P.cps[10800].renown : NaN);
    agg.nre.push(P.retires.length); agg.offersH.push(P.relicOffers / H); agg.emb.push(P.embersEarned / H); agg.unspentEmb.push(s.embers);
    for (const d of KK.DATA.LEGACY) { (legacyFirst[d.id] = legacyFirst[d.id] || []).push(d.id in lf ? lf[d.id] : NaN); (legacyLv[d.id] = legacyLv[d.id] || []).push(s.legacy[d.id] || 0); }
    if (seed === 1) {
      console.log('seed1 retires: ' + P.retires.map((x) => `${hm(x.at)} +${x.gain} (${x.run.toFixed(0)}m)`).join(', '));
      console.log('seed1 laps to f40 (min): ' + lapT.map((x) => x.toFixed(1)).join(' '));
      console.log('seed1 end: workshop ' + JSON.stringify(s.workshop) + ' embers ' + Math.floor(s.embers) + ' heroes ' + JSON.stringify(s.heroes) + ' renown unspent ' + s.renown);
    }
  }
  console.log(`card (f40 boss) ${rg(agg.card)} min | 1st retire ${rg(agg.first)} min | re-delves ${rg(agg.nre)} | mean lap ${rg(agg.laps, 1)} min | best ${rg(agg.best, 1)} min`);
  console.log(`lifetime Renown @1h ${rg(agg.r1)} @2h ${rg(agg.r2)} @3h ${rg(agg.r3)} | relic offers/h ${rg(agg.offersH)} | Embers/h ${rg(agg.emb)} | unspent Embers end ${rg(agg.unspentEmb)}`);
  console.log('Legacy first bought (min) / final level:');
  for (const d of KK0().DATA.LEGACY) console.log(`  ${d.id.padEnd(14)} ${rg(legacyFirst[d.id]).padEnd(9)} lv ${rg(legacyLv[d.id])}  (max ${d.id === 'headstart' ? 2 : d.max})`);
}
let _kk0; const KK0 = () => (_kk0 = _kk0 || load({ seed: 1, demo: true }));

// =========================================================== Head Start in the demo
function headstart() {
  const KK = load({ seed: 1, demo: true }); KK.world.reset();
  const S = KK.S, A = KK.actions, def = KK.DATA.LEGACY.find((d) => d.id === 'headstart');
  S.renown = 100; S.demoDone = true;
  for (let i = 0; i < 4; i++) { const c = A.legacyCost('headstart'); const ok = A.buyLegacy('headstart'); console.log(`buy #${i + 1}: cost ${c} ok=${ok} lvl ${S.legacy.headstart || 0} max ${def.max} desc "${def.desc(S.legacy.headstart || 0)}" startFloor ${KK.mods().startFloor}`); }
  console.log('renown left', S.renown);
  const KF = load({ seed: 1 }); KF.world.reset(); const dF = KF.DATA.LEGACY.find((d) => d.id === 'headstart'); console.log('full game max', dF.max, 'desc(8)', dF.desc(8));
}

// =========================================================== Veterans' Muster
function muster() {
  const KK = load({ seed: 1 }); KK.world.reset();
  const S = KK.S, A = KK.actions;
  S.legacy.veterans = 2; S.retires = 1; S.maxFloorRun = 60; S.renownFloor = 40; KK.dirty();
  A.retire(); KK.world.reset();
  console.log('after retire: heroes', JSON.stringify(S.heroes === KK.S.heroes ? S.heroes : KK.S.heroes), 'offer', KK.S.omenOffer);
  if (!KK.S.omenOffer.includes('muster')) KK.S.omenOffer[0] = 'muster';
  A.pickOmen('muster');
  console.log('after pickOmen(muster): heroes', JSON.stringify(KK.S.heroes), 'startLvl', KK.mods().startLvl, 'world knight lvl', KK.world.heroes.map((h) => h.id + ':' + (h.lvl || '?')).join(','));
  KK.S.gold = 1e6; A.recruit('archer');
  console.log('recruit archer after muster:', KK.S.heroes.archer);
  // Is the world hero refreshed? check maxHp
  const k = KK.world.heroes.find((h) => h.id === 'knight'); console.log('knight world maxHp', k && k.maxHp && k.maxHp.toFixed(0), 'expected', (KK.F.heroHp('knight', KK.S.heroes.knight) * KK.mods().hp).toFixed(0));
}

// =========================================================== omens forced for the whole session
function omens() {
  const prof = args.profile || 'typist', H = +(args.hours || 8), N = +(args.seeds || 3), ret = args.retire || 'nudge';
  const list = (args.omens || 'none,' + KK0().DATA.OMENS.map((o) => o.id).join(',')).split(',');
  const cps = [6 * 3600, H * 3600].filter((v, i, a) => a.indexOf(v) === i && v <= H * 3600);
  console.log(`=== omens forced, ${prof}, ${H} h, ${N} seeds, retire ${ret} (relic pick: smart) ===`);
  const base = {};
  for (const om of list) {
    const r = cps.map(() => ({ f: [], R: [], e: [], oc: [], ret: [], w: [] }));
    for (const seed of SEEDS(N)) {
      const KK = load({ seed }); patch(KK); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retire: ret, forceOmen: om, relic: args.relic });
      P.run(H * 3600, cps);
      cps.forEach((c, i) => { const p = P.cps[c]; r[i].f.push(p.floor); r[i].R.push(p.renown); r[i].e.push(p.embers); r[i].oc.push(p.oc); r[i].ret.push(p.retires); r[i].w.push(p.wipes); });
    }
    if (om === 'none') cps.forEach((c, i) => (base[c] = { f: avg(r[i].f), R: avg(r[i].R) }));
    console.log(om.padEnd(10) + cps.map((c, i) => `| ${hm(c)} f${avg(r[i].f).toFixed(1)} (${rg(r[i].f)}) ${base[c] ? '(' + (avg(r[i].f) - base[c].f >= 0 ? '+' : '') + (avg(r[i].f) - base[c].f).toFixed(1) + ')' : ''} R${avg(r[i].R).toFixed(0)} ${base[c] ? '(' + ((avg(r[i].R) / base[c].R - 1) * 100).toFixed(0) + '%)' : ''} emb ${(avg(r[i].e) / 1000).toFixed(1)}k oc${avg(r[i].oc).toFixed(1)} ret ${avg(r[i].ret).toFixed(1)} wipes ${avg(r[i].w).toFixed(0)}`).join(' '));
  }
}

// =========================================================== rational choice among the 3 offered
function choose() {
  const prof = args.profile || 'typist', H = +(args.hours || 8), N = +(args.seeds || 3), ret = args.retire || 'nudge';
  const pols = (args.pols || 'none,random,rank').split(',');
  const rank = (args.rank || 'deep,storm,glass,embertide,march,gilded,muster,hoard,fever,quiet').split(',');
  const cps = [2 * 3600, 4 * 3600, 6 * 3600, H * 3600].filter((v, i, a) => a.indexOf(v) === i && v <= H * 3600);
  console.log(`=== omen choice, ${prof}, ${H} h, ${N} seeds; rank = ${rank.join('>')} ===`);
  for (const pol of pols) {
    const r = cps.map(() => ({ f: [], R: [] })); const cnt = {};
    for (const seed of SEEDS(N)) {
      const KK = load({ seed }); patch(KK); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retire: ret, forceOmen: pol === 'none' ? 'none' : undefined, omen: pol === 'random' ? 'random' : undefined, omenRank: pol === 'rank' ? rank : undefined });
      P.run(H * 3600, cps);
      cps.forEach((c, i) => { r[i].f.push(P.cps[c].floor); r[i].R.push(P.cps[c].renown); });
      for (const k in P.omens) cnt[k] = (cnt[k] || 0) + P.omens[k];
    }
    console.log(pol.padEnd(7) + cps.map((c, i) => `| ${hm(c)} f${avg(r[i].f).toFixed(1)} R${avg(r[i].R).toFixed(0)}`).join(' ') + ' | picks ' + JSON.stringify(cnt));
  }
}

// =========================================================== one-delve marginal value per omen, from a snapshot
function branch() {
  const prof = args.profile || 'typist', AT = +(args.at || 2), N = +(args.seeds || 3), ret = args.retire || 'nudge';
  const list = ['none', ...KK0().DATA.OMENS.map((o) => o.id)];
  console.log(`=== one delve per omen from the state at the first retire after ${AT} h, ${prof}, ${N} seeds ===`);
  const res = Object.fromEntries(list.map((k) => [k, { g: [], rph: [], run: [], f: [], emb: [], g2: [] }]));
  for (const seed of SEEDS(N)) {
    // play to AT h with no omens, then stop at the next retire and snapshot the state just before the omen pick
    const KK = load({ seed }); patch(KK); KK.world.reset();
    const P = makePlayer(KK, { profile: prof, retire: ret, forceOmen: 'none' });
    let snap = null;
    const orig = P.chooseOmen;
    P.chooseOmen = () => { if (P.t >= AT * 3600 && !snap && KK.S.omenOffer) snap = JSON.stringify(KK.S); orig(); };
    while (!snap) P.step(1 / 30);
    for (const om of list) {
      const K2 = load({ seed: seed * 100 + 7 }); K2.S = JSON.parse(snap); K2.dirty(); K2.world.reset();
      const Q = makePlayer(K2, { profile: prof, retire: ret, forceOmen: om });
      Q.lastMax = K2.S.maxFloorRun;
      Q.chooseOmen(); Q.spend();
      const life0 = K2.S.renownLifetime, emb0 = Q.embersEarned;
      // delve 1 with the omen, then delve 2 with no omen (does the omen's delve set the next one up?)
      Q.o2 = true;
      while (Q.retires.length < 1 && Q.t < 6 * 3600) Q.step(1 / 30);
      const d1 = Q.retires[0];
      res[om].g.push(d1 ? d1.gain : NaN); res[om].run.push(d1 ? d1.run : NaN); res[om].rph.push(d1 ? d1.gain / (d1.run / 60) : NaN); res[om].f.push(d1 ? d1.floor : NaN); res[om].emb.push(Q.embersEarned - emb0);
    }
  }
  const b = res.none;
  for (const om of list) { const r = res[om]; console.log(`${om.padEnd(10)} gain ${avg(r.g).toFixed(1)} (${rg(r.g)}) run ${avg(r.run).toFixed(1)}m  Renown/h ${avg(r.rph).toFixed(1)} (${((avg(r.rph) / avg(b.rph) - 1) * 100).toFixed(0)}%)  floor ${avg(r.f).toFixed(1)}  Embers ${avg(r.emb).toFixed(0)}`); }
}

// =========================================================== Second Wind for burst typists
function sw() {
  const prof = args.profile || 'burst', H = +(args.hours || 8), N = +(args.seeds || 4), ret = args.retire || 'stall';
  const cps = [3600, 4 * 3600, H * 3600];
  console.log(`=== Second Wind on/off, ${prof}, ${H} h, ${N} seeds, retire ${ret} ===`);
  const noSW = (KK) => { for (let k = 0; k < 50; k++) { let did = false; for (const d of KK.DATA.WORKSHOP) if (d.id !== 'kindling' && KK.actions.buyWorkshop(d.id)) did = true; if (!did) break; } };
  for (const [name, ws] of [['default', undefined], ['no SW', noSW]]) {
    const r = cps.map(() => ({ f: [], R: [], e: [] })); const swS = [], swLv = [];
    for (const seed of SEEDS(N)) {
      const KK = load({ seed }); patch(KK); KK.world.reset();
      const P = makePlayer(KK, { profile: prof, retire: ret, workshop: ws, omen: 'random' });
      P.run(H * 3600, cps);
      cps.forEach((c, i) => { r[i].f.push(P.cps[c].floor); r[i].R.push(P.cps[c].renown); r[i].e.push(P.cps[c].embers); });
      swS.push(P.swSparks / H); swLv.push(KK.S.workshop.kindling || 0);
    }
    console.log(name.padEnd(8) + cps.map((c, i) => `| ${hm(c)} f${avg(r[i].f).toFixed(1)} R${avg(r[i].R).toFixed(0)} emb ${(avg(r[i].e) / 1000).toFixed(1)}k`).join(' ') + ` | SW sparks/h ${avg(swS).toFixed(0)} SW lv ${avg(swLv).toFixed(1)}`);
  }
}

// =========================================================== idle Workshop: what the tags make a player do
function idlews() {
  const H = +(args.hours || 8), N = +(args.seeds || 3), ret = args.retire || 'nudge';
  const cps = [4 * 3600, H * 3600];
  const only = (ids) => (KK) => { for (let k = 0; k < 50; k++) { let did = false; for (const d of KK.DATA.WORKSHOP) if (ids.includes(d.id) && KK.actions.buyWorkshop(d.id)) did = true; if (!did) break; } };
  const pols = [['none', () => {}], ['cheapest-all', undefined], ['skip tagged (SW)', only(['crucible', 'overcharge', 'static'])], ['oc+crucible', only(['crucible', 'overcharge'])], ['oc only', only(['overcharge'])]];
  console.log(`=== idle Workshop policies, ${H} h, ${N} seeds, retire ${ret} ===`);
  for (const [name, ws] of pols) {
    const r = cps.map(() => ({ f: [], R: [] })); const lv = [];
    for (const seed of SEEDS(N)) {
      const KK = load({ seed }); patch(KK); KK.world.reset();
      const P = makePlayer(KK, { profile: 'idle', retire: ret, workshop: ws, omen: 'random' });
      P.run(H * 3600, cps);
      cps.forEach((c, i) => { r[i].f.push(P.cps[c].floor); r[i].R.push(P.cps[c].renown); });
      lv.push(JSON.stringify(KK.S.workshop));
    }
    console.log(name.padEnd(17) + cps.map((c, i) => `| ${hm(c)} f${avg(r[i].f).toFixed(1)} R${avg(r[i].R).toFixed(0)}`).join(' ') + ' | seed1 ws ' + lv[0]);
  }
}

// =========================================================== long tail with omen policies
function long() {
  const prof = args.profile || 'typist', H = +(args.hours || 40), N = +(args.seeds || 3), ret = args.retire || 'nudge', pol = args.policy || 'none';
  const rank = (args.rank || 'deep,storm,glass,embertide,march,gilded,muster,hoard,fever,quiet').split(',');
  const cps = []; for (let h = 4; h <= H; h += 4) cps.push(h * 3600);
  console.log(`=== long ${prof}, ${H} h, ${N} seeds, retire ${ret}, omens ${pol} ===`);
  const rows = cps.map(() => ({ f: [], R: [], fame: [], gain: [], run: [], oc: [] }));
  for (const seed of SEEDS(N)) {
    const KK = load({ seed }); patch(KK); KK.world.reset();
    const o = { profile: prof, retire: ret };
    if (pol === 'none') o.forceOmen = 'none'; else if (pol === 'rank') o.omenRank = rank; else if (pol === 'random') o.omen = 'random'; else o.forceOmen = pol;
    const P = makePlayer(KK, o);
    P.run(H * 3600, cps);
    cps.forEach((c, i) => {
      const p = P.cps[c]; rows[i].f.push(p.floor); rows[i].R.push(p.renown); rows[i].fame.push(p.fame); rows[i].oc.push(p.oc);
      const win = P.retires.filter((x) => x.at > c - 4 * 3600 && x.at <= c);
      rows[i].gain.push(win.length ? avg(win.map((x) => x.gain)) : 0); rows[i].run.push(win.length ? avg(win.map((x) => x.run)) : NaN);
    });
    if (seed === 1) console.log('seed1 omens ' + JSON.stringify(P.omens) + ' last retires: ' + P.retires.slice(-6).map((x) => `${hm(x.at)} f${x.floor} +${x.gain} ${x.omen || '-'} (${x.run.toFixed(0)}m)`).join(', '));
  }
  cps.forEach((c, i) => { const r = rows[i]; console.log(`${hm(c).padEnd(6)} f${avg(r.f).toFixed(0)} (${rg(r.f)}) R${avg(r.R).toFixed(0)} fame x${avg(r.fame).toFixed(0)} oc${avg(r.oc).toFixed(1)} | last 4h: +${avg(r.gain).toFixed(0)}/retire, runs ${avg(r.run).toFixed(0)}m`); });
}

// =========================================================== Muster redesigns (tested by hooking the retire, no game edit)
function musterx() {
  const prof = args.profile || 'typist', H = +(args.hours || 8), N = +(args.seeds || 4), ret = args.retire || 'nudge';
  const variants = {
    none: { force: 'none' },
    now: { force: 'muster' },
    keepForge: { force: 'muster', on: (KK, prev) => { if (KK.S.omen === 'muster') { KK.S.forge = prev.forge; KK.dirty(); } } },
    halfLevels: { force: 'muster', on: (KK, prev) => {
      if (KK.S.omen !== 'muster') return;
      KK._musterPrev = prev.heroes;
      for (const h in KK.S.heroes) if (KK.S.heroes[h]) KK.S.heroes[h] = Math.max(KK.S.heroes[h], Math.floor(prev.heroes[h] * 0.5));
      KK.dirty();
    } },
  };
  const cps = [6 * 3600, H * 3600];
  console.log(`=== Muster variants forced every delve, ${prof}, ${H} h, ${N} seeds ===`);
  for (const name of (args.v || 'none,now,keepForge,halfLevels').split(',')) {
    const v = variants[name]; const r = cps.map(() => ({ f: [], R: [] }));
    for (const seed of SEEDS(N)) {
      const KK = load({ seed }); patch(KK); KK.world.reset();
      if (name === 'halfLevels') KK.on('recruit', ({ id }) => { if (KK.S.omen === 'muster' && KK._musterPrev) KK.S.heroes[id] = Math.max(KK.S.heroes[id], Math.floor((KK._musterPrev[id] || 0) * 0.5)); KK.dirty(); });
      const P = makePlayer(KK, { profile: prof, retire: ret, forceOmen: v.force, onOmen: v.on });
      P.run(H * 3600, cps);
      cps.forEach((c, i) => { r[i].f.push(P.cps[c].floor); r[i].R.push(P.cps[c].renown); });
    }
    console.log(name.padEnd(11) + cps.map((c, i) => `| ${hm(c)} f${avg(r[i].f).toFixed(1)} R${avg(r[i].R).toFixed(0)}`).join(' '));
  }
}

// =========================================================== does party HP / enemy attack matter after run 1?
function hp() {
  const prof = args.profile || 'idle', H = +(args.hours || 8), N = +(args.seeds || 4);
  const cps = [2 * 3600, 4 * 3600, H * 3600];
  console.log(`=== HP sensitivity, ${prof}, ${H} h, ${N} seeds, nudge, no omens ===`);
  const vs = [['default', {}, null], ['no Rivet Armor', {}, ['armor']], ['enemy atk x2', { eAtk: 4.4 }, null], ['enemy atk x3', { eAtk: 6.6 }, null]];
  for (const [name, bal, skip] of vs) {
    const r = cps.map(() => ({ f: [], R: [] })); const w = [], wl = [];
    for (const seed of SEEDS(N)) {
      const KK = load({ seed, bal }); KK.world.reset();
      let late = 0; KK.on('wipe', () => { if (KK.S.retires >= 2) late++; });
      const P = makePlayer(KK, { profile: prof, retire: 'nudge', forceOmen: 'none', skipForge: skip });
      P.run(H * 3600, cps);
      cps.forEach((c, i) => { r[i].f.push(P.cps[c].floor); r[i].R.push(P.cps[c].renown); });
      w.push(KK.S.stats.wipes); wl.push(late);
    }
    console.log(name.padEnd(15) + cps.map((c, i) => `| ${hm(c)} f${avg(r[i].f).toFixed(1)} R${avg(r[i].R).toFixed(0)}`).join(' ') + ` | wipes ${avg(w).toFixed(0)} (after retire 2: ${avg(wl).toFixed(1)})`);
  }
}

// =========================================================== demo save imported into the full game
function importsave() {
  const prof = args.profile || 'idle', DH = +(args.demoh || 8), FH = +(args.fullh || 2), seed = +(args.seed || 1);
  const KD = load({ seed, demo: true }); KD.world.reset();
  const pol = (KK, P) => { const s = KK.S; if (!KK.actions.canRetire()) return false; if (s.demoDone && s.runCapCleared) return true; return P.t - P.lastMaxT > 8 * 60; };
  const PD = makePlayer(KD, { profile: prof, retirePolicy: pol }); PD.run(DH * 3600);
  const snap = JSON.stringify(KD.S);
  console.log(`demo ${prof} ${DH} h: lifetime Renown ${KD.S.renownLifetime}, renownFloor ${KD.S.renownFloor}, fame x${KD.mods().fame.toFixed(1)}`);
  const KF = load({ seed: seed + 50 }); KF.S = JSON.parse(snap); KF.dirty();
  // full game starts a fresh delve with the imported save (as after a retire)
  KF.S.floor = KF.mods().startFloor; KF.S.maxFloorRun = KF.S.floor; KF.world.reset();
  const PF = makePlayer(KF, { profile: prof, retire: 'nudge', omen: 'random' });
  const cps = [3600, FH * 3600].filter((v, i, a) => a.indexOf(v) === i);
  PF.run(FH * 3600, cps);
  console.log(`then full game ${FH} h: ` + cps.map((c) => `${hm(c)} f${PF.cps[c].floor} R${PF.cps[c].renown}`).join(' | ') + ` | first full retire ${PF.retires[0] ? hm(PF.retires[0].at) + ' f' + PF.retires[0].floor + ' +' + PF.retires[0].gain : '-'}`);
}

({ importsave, hp, musterx, demo, headstart, muster, omens, choose, branch, sw, idlews, long })[args._]();
