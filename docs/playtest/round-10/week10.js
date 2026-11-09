// T1 economist, round 10: calendar model (week9.js + real dates + KK.dayTick + depth telemetry) on the real, unedited sim.
// Day 1: --d1 hours; then 4 h/day with 16 h offline before each (paid like main.js awayCheck, capped 12 h, spent on return).
// KK.today = zero-padded date of the model day; KK.dayTick() runs at each day start (main.js runs it every minute).
// node week10.js --profile typist --seed 1 [--old] [--days 9 --glance 60 --omen star|random|none --rw mid|first|never]
const L = require('./econ10lib');
const args = L.args();
const PROF = args.profile || 'typist', SEED = +(args.seed || 1), DAYS = +(args.days || 9), D1 = +(args.d1 || 8), SESS = +(args.sess || 4), OFF = +(args.off || 16);
L.setRank(args.rw || 'mid');
const KK = L.load({ seed: SEED, old: !!args.old });
const W = KK.world, A = KK.actions, D = KK.DATA, F = KK.F;
let day = 1;
KK.today = () => L.dateOf(day);
const P = L.makePlayer(KK, { profile: PROF, retire: 'nudge', glance: +(args.glance || 60), stuck: +(args.stuck || 8) });
const omenPol = args.omen || 'star';
const seenOmen = {};
P.chooseOmen = () => {
  const s = KK.S; if (!s.omenOffer) return;
  let id = omenPol === 'none' ? null : s.omenOffer[Math.floor(KK.rng() * 3)];
  if (omenPol === 'star' && s.omenStar) id = s.omenStar;
  if (omenPol === 'deep' && s.omenOffer.includes('deep')) id = 'deep';
  if (omenPol === 'nostar') { const o = s.omenOffer.filter((x) => x !== s.omenStar); id = o[Math.floor(KK.rng() * o.length)]; }
  A.pickOmen(id);
};
const H = () => +(P.t / 3600).toFixed(2);
// ------------------------------------------------ per-day telemetry (as week9)
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
const codexT = [];
KK.on('trophy', ({ floor }) => mark('trophy', floor));
KK.on('codex', ({ rank }) => { mark('codex', rank); codexT[rank] = H(); });
KK.on('achievement', ({ id }) => mark('ach', id));
const sealLog = [];
KK.on('seal', ({ n, v }) => { mark('seal', v); sealLog.push({ d: day, v, star: KK.S.omen === KK.S.omenStar }); if (cur) cur.sealMin = +((KK.S.runTime || 0) / 60).toFixed(1); });
KK.on('omenPicked', ({ id }) => { if (!id || !cur) return; cur.omens.push(id + (KK.S.omenStar === id ? '*' : '')); if (!seenOmen[id]) { seenOmen[id] = 1; mark('newOmen', id); } });
KK.on('kill', ({ e }) => {
  const k = e.def && e.def.name; if (k && !seenMon[k]) { seenMon[k] = 1; if (!e.boss) mark('newMonster', k); }
  if (e.boss) { const key = (e.hollowed ? 'H:' : '') + e.key + (e.heart ? ':heart' : ''); if (!seenBoss[key]) { seenBoss[key] = 1; mark('newBoss', key); } }
});
KK.on('floor', ({ floor }) => { if (KK.S.glimpse) return; const b = F.biomeOf(floor); const id = b.echo ? 'E:' + b.id : b.id; if (!seenBiome[id]) { seenBiome[id] = 1; mark('biome', id, !b.echo || true); } });
KK.on('relicPicked', ({ id }) => { if (!seenRelic[id]) { seenRelic[id] = 1; mark('newRelic', id, false); } });
KK.on('upgrade', ({ store, id, lvl }) => {
  if (store === 'legacy') { const d = D.LEGACY.find((x) => x.id === id); if (d.max < 999 && lvl >= d.max) mark('legacyMax', id); }
  if (store === 'workshop') { const d = D.WORKSHOP.find((x) => x.id === id); if (lvl >= d.max && d.max < 999) mark('wsMax', id); }
});
KK.on('retired', ({ gain }) => { if (cur) { cur.retires++; cur.renownRet += gain || 0; } });
// ------------------------------------------------ depth telemetry
const reach = {}; // floor -> [hours, renownLifetime] when maxFloorEver first got there
const band = {}; // 10-floor band (by S.floor) -> {t, wipes, kills}
const bkey = (f) => Math.floor((f - 1) / 10) * 10 + 1;
const mech = { overgrowth: 0, lockdown: 0, warded: 0, guardUlt: 0, guardWorn: 0, rooted: 0, webbed: 0, bloat: 0, wardRelicT: 0 };
KK.on('overgrowth', () => mech.overgrowth++);
KK.on('lockdown', () => mech.lockdown++);
KK.on('warded', () => mech.warded++);
KK.on('guardBreak', ({ worn }) => (worn ? mech.guardWorn++ : mech.guardUlt++));
KK.on('webbed', ({ root }) => (root ? mech.rooted++ : mech.webbed++));
KK.on('bloatBurst', () => mech.bloat++);
KK.on('wipe', ({ floor }) => { const k = bkey(floor); (band[k] = band[k] || { t: 0, wipes: 0 }).wipes++; });
{ const on = W.nextFloor; let lastRec = 0; W.nextFloor = function () { const r = on.apply(this, arguments); const S = KK.S; if (S.maxFloorEver > lastRec) { for (let f = lastRec + 1; f <= S.maxFloorEver; f++) reach[f] = [H(), S.renownLifetime]; lastRec = S.maxFloorEver; mark('record', lastRec, false); } return r; }; }
let lastDay = 0;
function startDay(hours) {
  KK.dayTick && KK.dayTick();
  cur = { day, hours, t0: sim(), floor0: KK.S.maxFloorEver, ren0: KK.S.renownLifetime, retires: 0, renownRet: 0, ev: {}, omens: [], gapNew: 0, gapMile: 0 };
  lastNewT = sim(); lastMileT = sim();
}
function endDay() {
  const t = sim();
  cur.gapNew = +(Math.max(cur.gapNew, t - lastNewT) / 60).toFixed(0); cur.gapMile = +(Math.max(cur.gapMile, t - lastMileT) / 60).toFixed(0);
  cur.floor1 = KK.S.maxFloorEver; cur.ren1 = KK.S.renownLifetime; cur.achN = Object.keys(KK.S.ach).length;
  cur.codexRank = KK.mods().codexRanks; cur.trophies = KK.mods().trophies; cur.seals = KK.S.seals || 0; cur.dp = KK.S.daysPlayed;
  cur.embers = Math.floor(KK.S.embers || 0);
  delete cur.t0; days.push(cur); cur = null;
}
W.reset();
function step() {
  P.step(1 / 30);
  const S = KK.S; const k = bkey(S.floor); (band[k] = band[k] || { t: 0, wipes: 0 }).t += 1 / 30;
  if (S.relics.includes('rootward')) mech.wardRelicT += 1 / 30;
}
function play(h) { const end = P.t + h * 3600; while (P.t < end) step(); }
function offline(hours) {
  const S = KK.S, m = KK.mods();
  const secs = Math.min(12 * 3600, hours * 3600);
  const avg = S.incomeAvg || 0;
  const rate = S.incomeRate > 0 ? (avg > 0 ? Math.min(S.incomeRate, avg) : S.incomeRate) : F.enemyGold(S.floor) * 0.3;
  KK.gainGold(rate * secs * m.offline, 'offline');
  P.spend();
}
startDay(D1); play(D1); endDay();
for (day = 2; day <= DAYS; day++) { startDay(SESS); offline(OFF); play(SESS); endDay(); }
const S = KK.S;
// boss-fight aggregate by floor (f >= 100)
const bossAgg = {};
for (const b of P.bf) { if (b.floor < 100) continue; const a = (bossAgg[b.floor] = bossAgg[b.floor] || { key: b.key, n: 0, won: 0, wipe: 0, enrage: 0, fightT: 0 }); a.n++; if (b.out === 'won') { a.won++; a.fightT += b.fightT; } else if (b.out === 'enrage') a.enrage++; else if (b.out === 'wipe') a.wipe++; }
for (const a of Object.values(bossAgg)) a.fightT = a.won ? +(a.fightT / a.won).toFixed(0) : null;
for (const k in band) band[k].t = +(band[k].t / 3600).toFixed(2);
const relicPick = {}; KK.on && 0;
console.log(JSON.stringify({ prof: PROF, seed: SEED, old: !!args.old, args: process.argv.slice(2).join(' '),
  days, reach, band, bossAgg, mech, codexT, sealLog,
  retires: P.retires.map((r) => [+(r.at / 3600).toFixed(2), r.floor, r.gain]),
  final: { floor: S.maxFloorEver, renown: S.renownLifetime, achN: Object.keys(S.ach).length, achTotal: KK.ach.LIST.length, missing: KK.ach.LIST.map((x) => x.id).filter((id) => !S.ach[id]),
    seenBoss: Object.keys(seenBoss), omens: Object.keys(seenOmen).length, hours: H(), daysPlayed: S.daysPlayed, codex: KK.mods().codexRanks, codexKills: S.codexKills,
    achT: Object.fromEntries(Object.entries(P.ach).map(([k, v]) => [k, +(v / 3600).toFixed(1)])) } }));
