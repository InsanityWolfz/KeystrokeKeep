// T1 economist, round 09: calendar model of the first week(s) on the real, unedited sim.
// Day 1: one session of --d1 hours; then --days-1 days of --sess hours, with --off hours offline before each
// (offline pay = main.js awayCheck: min(incomeRate, incomeAvg) x min(off, 12 h) x mods.offline, spent on return).
// KK.today is patched to the session's calendar day. Prints one JSON line with per-day "what was new".
// node week9.js --profile typist --seed 1 [--days 7 --d1 8 --sess 4 --off 16 --glance 60 --omen star|random|none]
const { load, makePlayer } = require('../round-06/econ6lib');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'typist', SEED = +(args.seed || 1), DAYS = +(args.days || 7), D1 = +(args.d1 || 8), SESS = +(args.sess || 4), OFF = +(args.off || 16);
const KK = load({ seed: SEED });
const W = KK.world, A = KK.actions, D = KK.DATA, F = KK.F;
let day = 1;
KK.today = () => 'd' + day;
if (args.clockfarm) { /* handled below */ }
const P = makePlayer(KK, { profile: PROF, retire: 'nudge', glance: +(args.glance || 60) });
const omenPol = args.omen || 'star';
const seenOmen = {};
P.chooseOmen = () => {
  const s = KK.S; if (!s.omenOffer) return;
  let id = omenPol === 'none' ? null : s.omenOffer[Math.floor(KK.rng() * 3)];
  if (omenPol === 'star' && s.omenStar) id = s.omenStar;
  A.pickOmen(id);
};
// ------------------------------------------------ per-day telemetry
const days = [];
let cur = null, lastNewT = 0, lastMileT = 0;
const seenBoss = {}, seenBiome = {}, seenRelic = {}, seenMon = {};
const sim = () => KK.S.stats.playTime;
function mark(kind, what, mile = true) {
  if (!cur) return;
  (cur.ev[kind] = cur.ev[kind] || []).push(what);
  const t = sim();
  cur.gapNew = Math.max(cur.gapNew, t - lastNewT); lastNewT = t;
  if (mile) { cur.gapMile = Math.max(cur.gapMile, t - lastMileT); lastMileT = t; }
}
KK.on('trophy', ({ floor }) => mark('trophy', floor));
KK.on('codex', ({ rank }) => mark('codex', rank));
KK.on('achievement', ({ id }) => mark('ach', id));
KK.on('seal', ({ n, v }) => { mark('seal', v); if (cur) cur.sealMin = +((KK.S.runTime || 0) / 60).toFixed(1); cur.sealSess = +((sim() - cur.t0) / 60).toFixed(1); });
KK.on('omenPicked', ({ id }) => { if (!id || !cur) return; cur.omens.push(id + (KK.S.omenStar === id ? '*' : '')); if (!seenOmen[id]) { seenOmen[id] = 1; mark('newOmen', id); } });
KK.on('kill', ({ e }) => {
  const k = e.def && e.def.name; if (k && !seenMon[k]) { seenMon[k] = 1; if (!e.boss) mark('newMonster', k); }
  if (e.boss) { const key = (e.hollowed ? 'H:' : '') + e.key + (e.heart ? ':heart' : ''); if (!seenBoss[key]) { seenBoss[key] = 1; mark('newBoss', key); } }
});
KK.on('floor', ({ floor }) => { if (KK.S.glimpse) return; const b = F.biomeOf(floor).id; if (!seenBiome[b]) { seenBiome[b] = 1; mark('biome', b); } });
KK.on('relicPicked', ({ id }) => { if (!seenRelic[id]) { seenRelic[id] = 1; mark('newRelic', id, false); } });
KK.on('upgrade', ({ store, id, lvl }) => {
  if (store === 'legacy') { const d = D.LEGACY.find((x) => x.id === id); if (d.max < 999 && lvl >= d.max) mark('legacyMax', id); }
  if (store === 'workshop') { const d = D.WORKSHOP.find((x) => x.id === id); if (lvl === 1) mark('wsFirst', id, false); if (lvl >= d.max && d.max < 999) mark('wsMax', id); }
});
{ const or = A.retire; A.retire = function () { const f = KK.S.maxFloorRun, rt = (KK.S.runTime || 0) / 60; const r = or.apply(this, arguments); if (r && cur && cur.firstRet === undefined) cur.firstRet = { floor: f, min: +((sim() - cur.t0) / 60).toFixed(0), runMin: +rt.toFixed(0) }; return r; }; }
KK.on('retired', ({ gain }) => { if (cur) { cur.retires++; cur.renownRet += gain || 0; } });
let lastRec = 0;
let sessE0 = 0, sessT0 = 0;
function startDay(hours, offlineInfo) {
  sessE0 = P.embersEarned; sessT0 = sim();
  cur = { day, hours, t0: sim(), floor0: KK.S.maxFloorEver, ren0: KK.S.renownLifetime, retires: 0, renownRet: 0, ev: {}, omens: [], gapNew: 0, gapMile: 0, offline: offlineInfo || null,
    ach0: Object.keys(KK.S.ach).length };
  lastNewT = sim(); lastMileT = sim();
}
function endDay() {
  const t = sim();
  cur.gapNew = Math.max(cur.gapNew, t - lastNewT); cur.gapMile = Math.max(cur.gapMile, t - lastMileT);
  cur.gapNew = +(cur.gapNew / 60).toFixed(0); cur.gapMile = +(cur.gapMile / 60).toFixed(0);
  cur.floor1 = KK.S.maxFloorEver; cur.ren1 = KK.S.renownLifetime; cur.achN = Object.keys(KK.S.ach).length;
  cur.codexRank = KK.mods().codexRanks; cur.trophies = KK.mods().trophies; cur.seals = KK.S.seals || 0;
  cur.legacy = Object.assign({}, KK.S.legacy); cur.ws = Object.assign({}, KK.S.workshop); cur.embers = Math.floor(KK.S.embers || 0);
  cur.flowH = +(KK.S.stats.flowTime / 3600).toFixed(2); cur.keys = KK.S.stats.keys;
  days.push(cur); cur = null;
}
// record floors as "new" (not milestones) each time maxFloorEver rises
{ const on = W.nextFloor; W.nextFloor = function () { const r = on.apply(this, arguments); if (KK.S.maxFloorEver > lastRec) { lastRec = KK.S.maxFloorEver; mark('record', lastRec, false); } return r; }; }
W.reset();
function play(h) { const end = P.t + h * 3600; while (P.t < end) P.step(1 / 30); }
function offline(hours) {
  const S = KK.S, m = KK.mods();
  const secs = Math.min(12 * 3600, hours * 3600);
  const avg = S.incomeAvg || 0;
  const rate = S.incomeRate > 0 ? (avg > 0 ? Math.min(S.incomeRate, avg) : S.incomeRate) : F.enemyGold(S.floor) * 0.3;
  const gold = rate * secs * m.offline;
  const g0 = S.gold, lv0 = D.PARTY_ORDER.reduce((a, id) => a + (S.heroes[id] || 0), 0), f0 = S.floor;
  // how long would the run have taken to earn it online (at the closing smoothed rate)?
  const onlineMin = S.incomeRate > 0 ? gold / S.incomeRate / 60 : null;
  // cost of the next 10 levels on the cheapest hero, for scale
  KK.gainGold(gold, 'offline');
  let emb = 0;
  if (args.offember) { const er = (P.embersEarned - sessE0) / Math.max(1, sim() - sessT0); emb = er * secs * m.offline * +args.offember; S.embers = (S.embers || 0) + emb; }
  P.spend();
  const lv1 = D.PARTY_ORDER.reduce((a, id) => a + (S.heroes[id] || 0), 0);
  return { emb: Math.round(emb), gold: +gold.toPrecision(3), goldBefore: +g0.toPrecision(3), ratio: g0 > 0 ? +(gold / g0).toFixed(1) : null, onlineMin: onlineMin && +onlineMin.toFixed(0), offlinePct: +(m.offline * 100).toFixed(0), levels: lv1 - lv0, floor: f0, runMin: +((S.runTime || 0) / 60).toFixed(0), retireGain: A.renownGain() };
}
const offLog = [];
startDay(D1); play(D1); endDay();
for (day = 2; day <= DAYS; day++) {
  // the day starts on the return, so purchases made with the offline gold count for the new day
  startDay(SESS, null);
  const off = offline(OFF); cur.offline = off;
  // floors gained in the first 15 min after the return
  const f0 = KK.S.maxFloorRun, mx0 = KK.S.maxFloorEver;
  let pk = 0; const end15 = P.t + 900; while (P.t < end15) { P.step(1 / 30); if (cur.firstRet === undefined) pk = Math.max(pk, KK.S.maxFloorRun); }
  off.peak15 = pk - f0; off.runFloor = f0; off.retiredIn15 = cur.retires;
  play(SESS - 0.25); endDay();
}
const S = KK.S;
console.log(JSON.stringify({ prof: PROF, seed: SEED, args: process.argv.slice(2).join(' '), days: days.map((d) => { delete d.t0; return d; }),
  final: { floor: S.maxFloorEver, renown: S.renownLifetime, ach: Object.keys(S.ach), achN: Object.keys(S.ach).length, achTotal: KK.ach.LIST.length, missing: KK.ach.LIST.map((x) => x.id).filter((id) => !S.ach[id]),
    seenMon: Object.keys(seenMon).length, seenBoss: Object.keys(seenBoss), seenRelic: Object.keys(seenRelic).length, omens: Object.keys(seenOmen).length, hours: +(P.t / 3600).toFixed(1),
    achT: Object.fromEntries(Object.entries(P.ach).map(([k, v]) => [k, +(v / 3600).toFixed(1)])) } }));
