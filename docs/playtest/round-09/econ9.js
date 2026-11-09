// T1 economist, round 09 (copy of round-08/econ8.js; premium = KK.powerMult()/power floor): one seeded long run of the R6/R7 smart-spend player (round-06/econ6lib.js) on the real,
// unedited sim, with calendar days modelled by patching KK.today. Prints one JSON line. econ8batch.js runs many.
// node econ8.js --profile idle --hours 40 --seed 1 [--day 8] [--week2 off] [--omen star|random] [--caution off]
//               [--mouse 20] [--clicks] [--lantern off] [--dyn 10] [--glance 60] [--seal 25 | --seal 0.04 --sealpct]
const { load, makePlayer } = require('../round-06/econ6lib');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'typist', H = +(args.hours || 8), SEED = +(args.seed || 1), DAY = +(args.day || 8) * 3600;
const KK = load({ seed: SEED });
const W = KK.world, A = KK.actions, D = KK.DATA, F = KK.F;
// one calendar day = DAY seconds of active play (the sim has no wall clock)
KK.today = () => 'd' + Math.floor((KK.S.stats.playTime || 0) / DAY);
if (args.week2 === 'off') A.dailyOpen = () => false;
if (args.lanfree) KK.S.workshop.lantern = +args.lanfree;
if (args.novoid) { const om = KK.mods; KK.mods = function () { const m = om(); m.voidDmg = 0; return m; }; }
if (args.sealoff) A.sealFloor = () => Math.max(40, (KK.S.renownFloor || 0) - +args.sealoff);
if (args.lanprice) { const [b, g] = args.lanprice.split(',').map(Number); const l = D.WORKSHOP.find((d) => d.id === 'lantern'); l.base = b; l.growth = g; }
if (args.laneff) D.WORKSHOP.find((d) => d.id === 'lantern').apply = (m, l) => { m.voidDmg *= 1 - +args.laneff * l; };
if (args.pm) {
  // power-floor variants: 'stack5' = max(tier, floor) x (1 + 0.05 x tier index); 'half' = floor + 0.5 x (tier mult - 1)
  KK.powerMult = function () { const m = KK.mods(), t = KK.fervorTier(); let mult = D.FERVOR_TIERS[t].mult; if (t === 3) mult += m.flowBonus; const fl = 1 + m.idlePow + m.dynamo;
    if (args.pm === 'stack5') return Math.max(mult, fl) * (1 + 0.05 * t); if (args.pm === 'half') return Math.max(mult, fl + 0.5 * (mult - 1)); return Math.max(mult, fl); };
}
if (args.lantern === 'off') D.WORKSHOP.find((d) => d.id === 'lantern').max = 0;
if (args.dyn) D.WORKSHOP.find((d) => d.id === 'dynamo').max = +args.dyn;
if (args.seal) {
  const n = +args.seal;
  A.claimSeal = () => { const S = KK.S; S.sealDay = KK.today(); S.seals = (S.seals || 0) + 1; const g = args.sealpct ? Math.max(10, Math.round(F.renownFor(S.renownFloor || 0) * n)) : n; S.renown += g; S.renownLifetime += g; KK.dirty(); KK.emit('seal', { n: S.seals }); };
}
let inUpd = false;
{
  const ou = W.update; let mAcc = 0, mNext = +args.mouse || 0, mr = 777;
  const mrand = () => { mr = (mr * 1103515245 + 12345) & 0x7fffffff; return mr / 0x7fffffff; };
  W.update = function (dt) {
    if (args.mouse) { mAcc += dt; if (mAcc >= mNext) { mAcc = 0; mNext = +args.mouse * (0.3 + 1.4 * mrand()); KK.addActivity('click'); } }
    inUpd = true; try { return ou.call(this, dt); } finally { inUpd = false; }
  };
}
if (args.clicks) {
  let last = -1;
  for (const fn of ['recruit', 'levelHero', 'buyForge', 'buyWorkshop', 'buyLegacy', 'pickRelic']) {
    const of = A[fn];
    A[fn] = function () { const r = of.apply(this, arguments); if (r && !inUpd && (KK.simTime || 0) - last > 0.5) { last = KK.simTime || 0; KK.addActivity('click'); } return r; };
  }
}
let lastKeyT = 0; { const oa = KK.addActivity; KK.addActivity = function (k) { if (k === 'key') lastKeyT = KK.simTime || 0; return oa.apply(this, arguments); }; }
if (['always', 'keys', 'hybrid'].includes(args.caution)) {
  // 'hybrid': only keystrokes count; typing skips the 60% replay but the 35% step-back and 85% pre-boss check apply to everyone
  const on = W.nextFloor; W.nextFloor = function () {
    const l = KK.lastInputAgo, low = W.floorLow === undefined ? 1 : W.floorLow, f = KK.S.floor; let ago;
    if (args.caution === 'always') ago = 999; else if (args.caution === 'keys') ago = (KK.simTime || 0) - lastKeyT;
    else { const typing = (KK.simTime || 0) - lastKeyT < 30; ago = !typing || low < 0.35 || (F.isBossFloor(f + 1) && low < 0.85) ? 999 : 0; }
    KK.lastInputAgo = () => ago; try { return on.call(this); } finally { KK.lastInputAgo = l; }
  };
}
if (args.caution === 'off') { const on = W.nextFloor; W.nextFloor = function () { const l = KK.lastInputAgo; KK.lastInputAgo = () => 0; try { return on.call(this); } finally { KK.lastInputAgo = l; } }; }
const T = { seals: [], redelves: 0, staleSeals: 0, caut: 0, trophyT: {}, lanternT: {}, dynBind: 0, flowT: 0, samples: 0, premium: 0, regroupEarly: 0, regroups: 0, repeatBoss: 0, starPicked: 0, starOffered: 0, runStartT: 0, sealRun: [], omenOfSeal: {} };
{ const on = W.nextFloor; W.nextFloor = function () { const r = on.call(this); if (W.cautious) T.caut++; return r; }; }
let killed = {}, rg = null; const WT = {};
KK.on('wipe', (d) => { const h = KK.S.stats.playTime / 3600, b = h < 1 ? 'h1' : h < 8 ? 'h1-8' : 'h8+'; const k = b + (d.reason === 'enrage' ? 'E' : F.isBossFloor(d.floor) ? 'B' : 'N'); WT[k] = (WT[k] || 0) + 1; });
KK.on('seal', () => { const S = KK.S; T.seals.push(+(S.stats.playTime / 3600).toFixed(2)); T.sealRun.push(+((S.stats.playTime - T.runStartT) / 60).toFixed(1)); if (S.omenStar !== A.starOmen()) T.staleSeals++; T.omenOfSeal[S.omen] = (T.omenOfSeal[S.omen] || 0) + 1; });
KK.on('retired', ({ gain }) => { T.runStartT = KK.S.stats.playTime; if (!gain) T.redelves++; killed = {}; rg = null; });
KK.on('trophy', ({ floor }) => { T.trophyT[floor] = +(KK.S.stats.playTime / 3600).toFixed(1); });
KK.on('upgrade', ({ store, id, lvl }) => { if (store === 'workshop' && id === 'lantern') T.lanternT[lvl] = +(KK.S.stats.playTime / 3600).toFixed(1); });
KK.on('kill', ({ e }) => { if (e.boss) { if (killed[KK.S.floor]) T.repeatBoss++; killed[KK.S.floor] = 1; } });
KK.on('regroup', ({ floor }) => { T.regroups++; rg = { t: KK.S.stats.playTime, floor }; });
KK.on('bossSpawn', () => { if (rg && KK.S.floor === rg.floor) { if (KK.S.stats.playTime - rg.t < 590) T.regroupEarly++; rg = null; } });
W.reset();
const po = { profile: PROF, retire: 'nudge', omen: 'random', glance: +(args.glance || 60) };
// --ws smart: an idle player who skips typing-only items and Overcharge (no Sparks, no ultimates) and saves for the Lantern once it shows
if (args.ws === 'smart' || args.ws === 'smart2') po.workshop = (K) => {
  const s = K.S, order = args.ws === 'smart2' ? ['dynamo', 'lantern', 'crucible'] : ['lantern', 'dynamo', 'crucible'];
  for (let k = 0; k < 50; k++) {
    let did = false;
    for (const id of order) { const d = D.WORKSHOP.find((x) => x.id === id); if (d.max === 0 || (d.minFloor && s.maxFloorEver < d.minFloor)) continue; if (A.buyWorkshop(id)) { did = true; break; } if (id === 'lantern' && (s.workshop.lantern || 0) < d.max) break; }
    if (!did) break;
  }
};
const P = makePlayer(KK, po);
const omenPol = args.omen || 'star';
P.chooseOmen = () => {
  const s = KK.S; if (!s.omenOffer) return;
  let id = s.omenOffer[Math.floor(KK.rng() * 3)];
  if (s.omenStar) { T.starOffered++; if (omenPol === 'star') { id = s.omenStar; T.starPicked++; } }
  A.pickOmen(id); P.omens[id] = (P.omens[id] || 0) + 1;
};
const cps = [1, 2, 4, 8, 16, 24, 40, 56, 80].filter((x) => x <= H).map((x) => x * 3600);
let acc = 0; const want = cps.slice();
while (P.t < H * 3600) {
  P.step(1 / 30); acc += 1 / 30;
  if (acc >= 1) {
    acc = 0; const m = KK.mods(), t = KK.fervorTier(); let tm = D.FERVOR_TIERS[t].mult; if (t === 3) tm += m.flowBonus;
    const fl = 1 + m.idlePow + m.dynamo; T.samples++; if (fl >= tm) T.dynBind++; if (t === 3) T.flowT++; T.premium += KK.powerMult() / fl; T.tier = T.tier || [0,0,0,0]; T.tier[t]++; if (P.t > 7200) { T.pl = (T.pl || 0) + KK.powerMult() / fl; T.nl = (T.nl || 0) + 1; }
  }
  while (want.length && P.t >= want[0]) { const c = want.shift(); P.cps[c] = P.snap(); }
}
const S = KK.S;
console.log(JSON.stringify({
  prof: PROF, h: H, seed: SEED, args: process.argv.slice(2).join(' '),
  cps: Object.fromEntries(Object.entries(P.cps).map(([k, c]) => [k / 3600, { floor: c.floor, renown: c.renown, retires: c.retires, wipes: c.wipes, trophies: c.trophies, codex: c.codex, dyn: c.ws.dynamo || 0, oc: c.ws.overcharge || 0, lan: c.ws.lantern || 0, fame: +c.fame.toFixed(1) }])),
  floor: S.maxFloorEver, renown: S.renownLifetime, retires: S.retires, wipes: S.stats.wipes, seals: S.seals || 0, sealT: T.seals, sealRun: T.sealRun, staleSeals: T.staleSeals, omenOfSeal: T.omenOfSeal, redelves: T.redelves,
  starOffered: T.starOffered, starPicked: T.starPicked, caut: T.caut, trophyT: T.trophyT, lanternT: T.lanternT, embersLeft: Math.floor(S.embers || 0), ws: S.workshop, legacy: S.legacy,
  dynBind: +(T.dynBind / T.samples).toFixed(3), flow: +(T.flowT / T.samples).toFixed(3), premium: +(T.premium / T.samples).toFixed(3), premLate: T.nl ? +(T.pl / T.nl).toFixed(3) : null, tierPct: T.tier.map((x) => +(x / T.samples).toFixed(3)), wt: WT, regroups: T.regroups, regroupEarly: T.regroupEarly, repeatBoss: T.repeatBoss, enrages: P.enrages,
  retireLog: P.retires.slice(-6).map((r) => `${(r.at / 3600).toFixed(1)}h f${r.floor} +${r.gain} ${r.why} ${r.omen || '-'}`),
}));
