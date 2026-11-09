// Playtest telemetry: plays the real sim as a scripted player and reports what a designer needs:
// pacing, decision droughts, dead content, wasted resources, stalls, prestige loop health.
// Usage: node tools/playtest.js [--min 120] [--profile typist|idle|heavy|burst|afk] [--glance 60]
//        [--strategy smart|greedy|random] [--stuck 8] [--seed 1] [--sessions 1] [--offline 0]
//        [--json out.json] [--bal '{"eHpG":1.27}']
// --sessions N with --offline H: plays N sessions of --min minutes with H hours offline between them.
const load = require('./headless');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } }
}
const MIN = +args.min || 120, PROFILE = args.profile || 'typist', GLANCE = +args.glance || 60;
const STRAT = args.strategy || 'smart', STUCK = (+args.stuck || 8) * 60, SEED = +args.seed || 1;
const SESSIONS = +args.sessions || 1, OFFLINE_H = +args.offline || 0;
const RETIRE = args.retire || 'stall'; // stall: after --stuck min without a new record; nudge: like the in-game nudge (gain>=30 after 25 min) or stall
const OMEN = args.omen || 'first'; // first | none | random
const KK = load({ seed: SEED, bal: args.bal ? JSON.parse(args.bal) : undefined, demo: !!args.demo });
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, U = KK.U;
KK.world.reset();
const rnd = KK.rng; // seeded: same --seed, same run

let t = 0; // total active seconds
const fmtT = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;
const events = [];
const ev = (msg) => events.push(`${fmtT(t)}  ${msg}`);

// ------------------------------------------------------------- telemetry state
const content = {};
const touch = (key) => (content[key] = content[key] || { firstAffordable: null, firstBought: null, buys: 0 });
for (const d of D.FORGE) touch('forge:' + d.id);
for (const d of D.WORKSHOP) touch('workshop:' + d.id);
for (const d of D.LEGACY) touch('legacy:' + d.id);
for (const id of Object.keys(D.HEROES)) touch('recruit:' + id);
const relicStats = Object.fromEntries(D.RELICS.map((r) => [r.id, { offered: 0, picked: 0 }]));
const biomeReached = {}, bossKills = {}, seen = {};
const tierTime = [0, 0, 0, 0];
let sparkCapTime = 0, sparksWasted = 0, glances = 0, emptyGlances = 0, curDrought = 0, maxDrought = 0;
const buysPer10 = [];
let lastMax = 1, lastMaxT = 0, longestStall = 0, stallStart = 0;
const retires = [];
let runStart = 0, wipes = 0, rats = 0, ratSpawns = 0, chests = 0, ults = 0;
const timeline = [];

KK.on('recruit', ({ id }) => ev(`recruit ${id}`));
KK.on('kill', ({ e }) => {
  seen[e.def.name] = (seen[e.def.name] || 0) + 1;
  if (e.boss) { bossKills[e.def.name] = (bossKills[e.def.name] || 0) + 1; ev(`BOSS ${e.def.name} down (floor ${S().floor})`); }
});
KK.on('wipe', ({ floor }) => { wipes++; });
const ultBy = {};
KK.on('ult', ({ id }) => { ults++; ultBy[id] = (ultBy[id] || 0) + 1; });
KK.on('chest', () => chests++);
KK.on('ratSpawn', () => ratSpawns++);
KK.on('floor', ({ floor }) => {
  const b = F.biomeOf(floor).name;
  if (!biomeReached[b]) { biomeReached[b] = t; ev(`>> reached biome ${b} (floor ${floor})`); }
});
KK.on('relicOffer', ({ ids }) => ids.forEach((id) => relicStats[id].offered++));
KK.on('relicPicked', ({ id }) => { relicStats[id].picked++; ev(`relic picked: ${id}`); });
KK.on('upgrade', ({ store, id, lvl }) => {
  const c = touch(store + ':' + id); c.buys++; if (c.firstBought === null) { c.firstBought = t; ev(`first buy ${store}:${id}`); }
  bucketBuy();
});
KK.on('levelUp', () => bucketBuy());
KK.on('recruit', ({ id }) => { const c = touch('recruit:' + id); c.buys++; if (c.firstBought === null) c.firstBought = t; bucketBuy(); });
function bucketBuy() { const b = Math.floor(t / 600); buysPer10[b] = (buysPer10[b] || 0) + 1; }

// ------------------------------------------------------------- player model
let typing = false, typeSwitch = 0, keyAcc = 0;
function activity(dt) {
  if (PROFILE === 'idle' || PROFILE === 'afk') return;
  typeSwitch -= dt;
  if (typeSwitch <= 0) {
    typing = !typing;
    if (PROFILE === 'burst') typeSwitch = typing ? 5 + rnd() * 10 : 60 + rnd() * 120;
    else typeSwitch = typing ? 20 + rnd() * 40 : 15 + rnd() * (PROFILE === 'heavy' ? 10 : 40);
  }
  if (typing) {
    keyAcc += dt * (PROFILE === 'heavy' ? 6 : 4);
    while (keyAcc >= 1) { keyAcc -= 1; KK.addActivity('key'); }
  }
}

function affordables() {
  const s = S(), out = [];
  for (const id of D.PARTY_ORDER) {
    if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) out.push(['recruit', id, A.recruitCost(id), 'gold']);
    if (s.heroes[id]) { const c = F.levelCost(id, s.heroes[id]); if (c <= s.gold) out.push(['level', id, c, 'gold']); }
  }
  for (const d of D.FORGE) { const l = s.forge[d.id] || 0; const c = F.upCost(d, l); if (l < d.max && c <= s.gold) out.push(['forge', d.id, c, 'gold']); }
  for (const d of D.WORKSHOP) { const l = s.workshop[d.id] || 0; const c = F.upCost(d, l); if (l < d.max && c <= (s.embers || 0)) out.push(['workshop', d.id, c, 'embers']); }
  for (const d of D.LEGACY) { const l = s.legacy[d.id] || 0; const c = d.cost(l); if (l < d.max && c <= s.renown) out.push(['legacy', d.id, c, 'renown']); }
  return out;
}
function markAffordable(list) {
  for (const [kind, id] of list) {
    const key = kind === 'level' ? null : (kind === 'recruit' ? 'recruit:' : kind + ':') + id;
    if (key && content[key] && content[key].firstAffordable === null) content[key].firstAffordable = t;
  }
}
function doBuy([kind, id]) {
  if (kind === 'recruit') return A.recruit(id);
  if (kind === 'level') return A.levelHero(id, 1);
  if (kind === 'forge') return A.buyForge(id);
  if (kind === 'workshop') return A.buyWorkshop(id);
  if (kind === 'legacy') return A.buyLegacy(id);
}

function smartSpend() {
  const s = S();
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
  let changed = true;
  while (changed) { changed = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) changed = true; }
  for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
  for (let i = 0; i < 400; i++) {
    let did = false;
    for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
    let best = null, bc = Infinity;
    for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
    if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
    if (!did) break;
  }
}
function greedySpend(random) {
  for (let i = 0; i < 2000; i++) {
    const list = affordables();
    if (!list.length) break;
    const pick = random ? list[Math.floor(rnd() * list.length)] : list.sort((a, b) => a[2] - b[2])[0];
    if (!doBuy(pick)) break;
  }
}
function pickOmen() {
  const s = S();
  if (!s.omenOffer) return;
  const id = OMEN === 'none' ? null : OMEN === 'random' ? s.omenOffer[Math.floor(rnd() * s.omenOffer.length)] : s.omenOffer[0];
  A.pickOmen(id);
  if (id) ev(`omen: ${id}`);
}
function pickRelic() {
  const s = S();
  if (!s.relicOffer) return;
  const id = STRAT === 'random' ? s.relicOffer[Math.floor(rnd() * s.relicOffer.length)] : s.relicOffer[0];
  A.pickRelic(id);
}

function glance() {
  glances++;
  const before = affordables();
  markAffordable(before);
  const meaningful = before.length > 0;
  if (!meaningful) { emptyGlances++; curDrought += GLANCE; maxDrought = Math.max(maxDrought, curDrought); } else curDrought = 0;
  pickRelic();
  pickOmen();
  if (STRAT === 'smart') smartSpend(); else greedySpend(STRAT === 'random');
  // golden rat: a glancing player catches it if it's on screen
  if (KK.world.rat && KK.world.catchRat) { KK.world.catchRat(); rats++; }
}

// ------------------------------------------------------------- run
const dt = 1 / 30;
let nextGlance = 0, nextSnap = 0;
function step() {
  activity(dt);
  KK.world.update(dt);
  t += dt;
  const s = S(), m = KK.mods();
  tierTime[KK.fervorTier()] += dt;
  if (s.sparks >= m.sparkCap - 0.5) { sparkCapTime += dt; }
  if (t >= nextGlance) { nextGlance = t + GLANCE; glance(); }
  if (s.maxFloorRun > lastMax) { longestStall = Math.max(longestStall, t - lastMaxT); lastMax = s.maxFloorRun; lastMaxT = t; }
  const nudge = RETIRE === 'nudge' && A.renownGain() >= 30 && (t - runStart > 25 * 60 || S().retires === 0 && s.maxFloorRun >= 40);
  if ((t - lastMaxT > STUCK || nudge) && A.renownGain() > 0) {
    const gain = A.retire();
    retires.push({ at: t, runMin: (t - runStart) / 60, maxFloor: lastMax, gain });
    ev(`>>> RETIRE #${s.retires} from floor ${lastMax} +${gain} renown (lifetime ${s.renownLifetime})`);
    KK.world.reset(); runStart = t; lastMax = S().maxFloorRun; lastMaxT = t;
  }
  if (t >= nextSnap) {
    nextSnap += 300;
    timeline.push({ t: fmtT(t), floor: s.floor, max: s.maxFloorRun, gold: U.fmt(s.gold), inc: U.fmt(s.incomeRate) + '/s', lv: D.PARTY_ORDER.map((id) => id[0] + s.heroes[id]).join(' '), relics: s.relics.length, sparks: Math.floor(s.sparks) + '/' + m.sparkCap, renown: s.renown, tier: D.FERVOR_TIERS[KK.fervorTier()].name });
  }
}
// sparks wasted: count activity events at cap
const origAdd = KK.addActivity;
KK.addActivity = function (k) { const s = S(); if (s.sparks >= KK.mods().sparkCap) sparksWasted++; return origAdd(k); };

const offlineLog = [];
for (let sess = 0; sess < SESSIONS; sess++) {
  const end = t + MIN * 60;
  while (t < end) step();
  if (sess < SESSIONS - 1 && OFFLINE_H > 0) {
    const secs = Math.min(12 * 3600, OFFLINE_H * 3600);
    const m = KK.mods();
    const s0 = S(), avg = s0.incomeAvg || 0;
    const rate = s0.incomeRate > 0 ? (avg > 0 ? Math.min(s0.incomeRate, avg) : s0.incomeRate) : F.enemyGold(s0.floor) * 0.3;
    const gold = rate * secs * m.offline;
    const goldBefore = S().gold;
    KK.gainGold(gold, 'offline');
    // what does that buy? levels on cheapest hero
    const lvBefore = D.PARTY_ORDER.map((id) => S().heroes[id]).reduce((a, b) => a + b, 0);
    glance();
    const lvAfter = D.PARTY_ORDER.map((id) => S().heroes[id]).reduce((a, b) => a + b, 0);
    offlineLog.push(`after session ${sess + 1}: ${OFFLINE_H}h away → +${U.fmt(gold)} gold (had ${U.fmt(goldBefore)}), bought ${lvAfter - lvBefore} hero levels on return`);
    ev(`(offline ${OFFLINE_H}h: +${U.fmt(gold)} gold)`);
  }
}

// ------------------------------------------------------------- report
const s = S();
const pct = (x) => Math.round((x / t) * 100) + '%';
const L = [];
L.push(`=== KEYSTROKE KEEP PLAYTEST  profile=${PROFILE} strategy=${STRAT} glance=${GLANCE}s stuck=${STUCK / 60}m seed=${SEED} sessions=${SESSIONS}x${MIN}m offline=${OFFLINE_H}h ===`);
L.push('', '--- timeline (every 5 min) ---');
for (const r of timeline) L.push(`${r.t}  floor ${r.floor} (max ${r.max})  gold ${r.gold}  inc ${r.inc}  lv ${r.lv}  relics ${r.relics}  sparks ${r.sparks}  renown ${r.renown}  ${r.tier}`);
L.push('', '--- key events ---', ...events);
if (offlineLog.length) L.push('', '--- offline ---', ...offlineLog);
L.push('', '--- prestige ---');
for (const r of retires) L.push(`retire at ${fmtT(r.at)}: run ${r.runMin.toFixed(1)} min, max floor ${r.maxFloor}, +${r.gain} renown`);
if (!retires.length) L.push('never retired');
L.push('', '--- pacing ---');
L.push(`longest stall (no new max floor): ${(Math.max(longestStall, t - lastMaxT) / 60).toFixed(1)} min`);
L.push(`glances with NOTHING affordable: ${emptyGlances}/${glances}  longest drought: ${(maxDrought / 60).toFixed(1)} min`);
L.push(`purchases per 10 min: ${buysPer10.map((x) => x || 0).join(', ')}`);
L.push(`wipes ${wipes}  chests ${chests}  rats ${rats}/${ratSpawns} spawned  ults ${ults} (${(ults / (t / 60)).toFixed(1)}/min)`);
L.push(`fervor time: IDLE ${pct(tierTime[0])}  FOCUSED ${pct(tierTime[1])}  ZONE ${pct(tierTime[2])}  FLOW ${pct(tierTime[3])}`);
L.push(`sparks at cap ${pct(sparkCapTime)} of the time; ${sparksWasted} sparks wasted of ${s.stats.keys + s.stats.clicks} inputs; embers banked ${Math.floor(s.embers || 0)} (unspent)`);
L.push(`ults by hero: ${Object.entries(ultBy).map(([k, v]) => k + ' ' + v).join(', ')}`);
L.push('', '--- content coverage (first affordable / first bought / buys) ---');
for (const [k, c] of Object.entries(content)) {
  const fa = c.firstAffordable === null ? 'never' : fmtT(c.firstAffordable), fb = c.firstBought === null ? 'NEVER' : fmtT(c.firstBought);
  L.push(`${k.padEnd(24)} ${fa.padEnd(7)} ${fb.padEnd(7)} ${c.buys}`);
}
L.push('', '--- relics (offered / picked) ---');
L.push(Object.entries(relicStats).map(([id, r]) => `${id} ${r.offered}/${r.picked}`).join('  '));
L.push('', '--- world ---');
L.push(`biomes reached: ${Object.entries(biomeReached).map(([b, at]) => `${b}@${fmtT(at)}`).join(', ') || 'only the first'}`);
L.push(`bosses killed: ${Object.entries(bossKills).map(([b, n]) => `${b} x${n}`).join(', ') || 'none'}`);
L.push(`monsters never seen: ${Object.values(D.MONSTERS).filter((m) => !seen[m.name]).map((m) => m.name).join(', ') || 'none'}`);
L.push(`END ${fmtT(t)}: floor ${s.floor} maxEver ${s.maxFloorEver} retires ${s.retires} renownLifetime ${s.renownLifetime} kills ${s.stats.kills}`);
console.log(L.join('\n'));
if (args.json) require('fs').writeFileSync(args.json, JSON.stringify({ timeline, events, retires, content, relicStats, biomeReached, bossKills, tierTime, emptyGlances, glances, maxDrought, longestStall }, null, 1));
