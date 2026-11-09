// Round 03 auditor: minute-by-minute map of the real demo build (KK_DEMO_CAP = 40).
// A "nudge" player: glances every 60 s, buys smart, retires when the in-game nudge fires (gain >= 30 at first f40,
// or after a 25-min run) or when stuck 8 min, catches rats on glances. Prints what is NEW each minute and what happens after the cap.
// node docs/playtest/round-03/demo_map.js [--profile typist|idle|burst] [--min 120] [--seed 1] [--step 1]
const load = require('../../../tools/headless');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; } }
const PROFILE = args.profile || 'typist', MIN = +args.min || 120, SEED = +args.seed || 1, STEP = +args.step || 1;
const KK = load({ seed: SEED, demo: true });
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
W.reset();
const dt = 1 / 30;
let t = 0;
const fm = (s) => `${String(Math.floor(s / 60)).padStart(3)}m`;
const seen = new Set();
const minute = {}; // minute -> list of notes
const note = (txt) => { const k = Math.floor(t / 60 / STEP) * STEP; (minute[k] = minute[k] || []).push(txt); };
const first = (key, txt) => { if (seen.has(key)) return; seen.add(key); note('NEW ' + txt); };
let demoDoneT = null;
const after = { firsts: 0, relicOffers: 0, bosses: 0, renown: 0, levels: 0, forge: 0, workshop: 0, legacy: 0, retires: 0, rats: 0, ults: 0, sanct: 0 };
const pre = { sanct: 0, ultBy: {} };
const origFirst = first;
KK.on('wave', () => { for (const e of W.enemies) if (!e.boss) first('mon:' + e.key, 'monster ' + e.def.name); });
KK.on('bossSpawn', ({ boss }) => { first('boss:' + boss.def.name, `boss ${boss.def.name} f${S().floor}`); if (demoDoneT !== null) after.bosses++; });
KK.on('kill', ({ e }) => { if (e.boss) note(`boss down ${e.def.name} f${S().floor}`); });
KK.on('floor', ({ floor }) => { first('biome:' + F.biomeOf(floor).id, 'biome ' + F.biomeOf(floor).name); if (floor === 20) first('retire', 'retire unlocked (f20)'); });
KK.on('recruit', ({ id }) => { first('recruit:' + id, 'hero ' + D.HEROES[id].name); });
KK.on('ult', ({ id }) => { first('ult:' + id, 'ultimate ' + D.HEROES[id].ult.name); if (demoDoneT !== null) after.ults++; if (id === 'cleric') { if (demoDoneT !== null) after.sanct++; else pre.sanct++; } pre.ultBy[id] = (pre.ultBy[id] || 0) + (demoDoneT === null ? 1 : 0); });
KK.on('revive', () => first('revive', 'first REVIVE (Sanctuary)'));
KK.on('relicOffer', ({ ids }) => {
  first('relicOffer', 'relic chest'); if (demoDoneT !== null) after.relicOffers++;
  for (const id of ids) { const r = D.RELICS.find((x) => x.id === id); if (r.rar === 'epic') first('epic', 'EPIC offered ' + r.name); }
});
KK.on('relicPicked', ({ id }) => note('pick ' + id));
KK.on('fervorTier', ({ to }) => { if (to >= 1) first('tier' + to, D.FERVOR_TIERS[to].name); });
KK.on('ratSpawn', () => first('rat', 'golden rat'));
KK.on('ratCaught', () => { if (demoDoneT !== null) after.rats++; });
KK.on('chest', () => first('chest', 'treasure chest'));
KK.on('wipe', ({ floor }) => note('WIPE f' + floor));
KK.on('levelUp', () => { if (demoDoneT !== null) after.levels++; });
KK.on('upgrade', ({ store, id, lvl }) => { first(`up:${store}:${id}`, `buy ${store}:${id}`); if (demoDoneT !== null) after[store]++; });
KK.on('retired', ({ gain }) => { note(`RETIRE +${gain} Renown (lifetime ${S().renownLifetime})`); first('retired', 'first retire'); if (demoDoneT !== null) { after.retires++; after.renown += gain; } });
KK.on('demoComplete', () => { demoDoneT = t; note('*** DEMO COMPLETE card ***'); });

let typing = false, sw = 0, acc = 0, nextG = 0, lastMax = 1, lastMaxT = 0, runStart = 0, nudged = {};
function smartSpend() {
  const s = S();
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
  let changed = true; while (changed) { changed = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) changed = true; }
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
const rows = [];
while (t < MIN * 60) {
  if (PROFILE !== 'idle') { sw -= dt; if (sw <= 0) { typing = !typing; sw = PROFILE === 'burst' ? (typing ? 5 + rnd() * 10 : 60 + rnd() * 120) : (typing ? 20 + rnd() * 40 : 15 + rnd() * 40); } if (typing) { acc += dt * 4; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
  W.update(dt); t += dt;
  const s = S();
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  if (t >= nextG) {
    nextG = t + 60;
    if (s.relicOffer) A.pickRelic(s.relicOffer[Math.floor(rnd() * s.relicOffer.length)]);
    smartSpend();
    if (W.rat) W.catchRat();
    const g = A.renownGain(), key = 'n' + s.retires;
    const nudge = g >= 30 && !nudged[key] && (t - runStart > 25 * 60 || (s.retires === 0 && s.maxFloorRun >= 40));
    if (nudge) { nudged[key] = 1; note(`(retire nudge: +${g})`); }
    if ((nudge || t - lastMaxT > 8 * 60) && A.canRetire()) { A.retire(); W.reset(); smartSpend(); runStart = t; lastMax = S().maxFloorRun; lastMaxT = t; }
    if (Math.floor(t / 60) % (5 * STEP) === 0) rows.push(`${fm(t)}  f${s.floor} max${s.maxFloorRun} heroes ${D.PARTY_ORDER.filter((id) => s.heroes[id]).length} relics ${s.relics.length} renown ${s.renown}/${s.renownLifetime} embers ${Math.floor(s.embers)} retireBtn ${A.canRetire() ? '+' + A.renownGain() : 'REACH FLOOR ' + A.retireTarget()}`);
  }
}
const L = [`=== DEMO MAP profile=${PROFILE} seed=${SEED} ${MIN} min (cap ${KK.DEMO_CAP})`];
for (const k of Object.keys(minute).map(Number).sort((a, b) => a - b)) L.push(`${fm(k * 60)}  ${minute[k].join('; ')}`);
L.push('', '--- every 5 min ---', ...rows);
L.push('', `DEMO COMPLETE at ${demoDoneT === null ? 'never' : fm(demoDoneT)}; after it (${demoDoneT === null ? 0 : ((t - demoDoneT) / 60).toFixed(0)} min): ` + JSON.stringify(after));
L.push(`Sanctuary casts before the card: ${pre.sanct}; ults by hero before the card: ${JSON.stringify(pre.ultBy)}`);
const s = S();
L.push(`final: legacy ${JSON.stringify(s.legacy)} workshop ${JSON.stringify(s.workshop)} renown ${s.renown}/${s.renownLifetime}`);
L.push('legacy rows never bought: ' + D.LEGACY.filter((d) => !s.legacy[d.id]).map((d) => `${d.id}(${d.cost(0)})`).join(', '));
L.push('content never seen: ' + [...Object.keys(D.MONSTERS).map((k) => (D.MONSTERS[k].boss ? 'boss:' + D.MONSTERS[k].name : 'mon:' + k)), ...D.RELICS.filter((r) => r.rar === 'epic').map(() => null)].filter((k) => k && !seen.has(k)).join(', '));
console.log(L.join('\n'));
