// Round 01 auditor: novelty cadence + first-appearance map.
// node docs/playtest/round-01/novelty.js [--min 300] [--profile typist|idle|burst|heavy] [--seed 1] [--stuck 8] [--glance 60] [--quiet]
// Plays the real sim with the same smart player as tools/playtest.js and logs the FIRST time each piece of
// content appears (major = new hero/biome/boss/mechanic, minor = new monster/relic/upgrade), then reports gaps.
const load = require('../../../tools/headless');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } }
}
const MIN = +args.min || 300, PROFILE = args.profile || 'typist', SEED = +args.seed || 1, STUCK = (+args.stuck || 8) * 60, GLANCE = +args.glance || 60;
const KK = load({ seed: SEED });
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world;
W.reset();
let t = 0;
const fmtT = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}m${String(Math.floor(s) % 60).padStart(2, '0')}s`;
const nov = [];
const seenKeys = new Set();
const first = (key, kind, label) => { if (seenKeys.has(key)) return; seenKeys.add(key); nov.push({ t, kind, label }); };
const recurring = []; // glance-worthy recurring moments (boss fights, relic offers, rats, recruits, milestones)
const rec = (label) => recurring.push({ t, label });

KK.on('wave', () => { for (const e of W.enemies) if (!e.boss) first('mon:' + e.key, 'minor', 'monster ' + e.def.name); });
KK.on('bossSpawn', ({ boss }) => { first('boss:' + boss.key, 'MAJOR', 'boss ' + boss.def.name + ' (floor ' + S().floor + ')'); rec('boss'); });
KK.on('kill', ({ e }) => { if (e.boss) first('bosskill:' + e.key, 'minor', 'boss kill ' + e.def.name); });
KK.on('floor', ({ floor }) => {
  first('biome:' + F.biomeOf(floor).id, 'MAJOR', 'biome ' + F.biomeOf(floor).name + ' (floor ' + floor + ')');
  for (const id of D.PARTY_ORDER) if (D.HEROES[id].unlockFloor <= floor && id !== 'knight') first('avail:' + id, 'minor', 'hero available ' + id);
  if (floor >= 20) first('retireUnlock', 'MAJOR', 'retire unlocked');
});
KK.on('recruit', ({ id }) => { first('recruit:' + id, 'MAJOR', 'recruit ' + D.HEROES[id].name + ' (' + id + ')'); rec('recruit'); });
KK.on('ult', ({ id }) => first('ult:' + id, 'minor', 'first ultimate ' + D.HEROES[id].ult.name));
KK.on('relicOffer', ({ ids }) => {
  first('relicOffer', 'MAJOR', 'first relic offer');
  rec('relicOffer');
  for (const id of ids) {
    const r = D.RELICS.find((x) => x.id === id);
    first('relic:' + id, 'minor', `relic seen ${r.name} [${r.rar}]`);
    if (r.rar === 'epic') first('epic', 'MAJOR', 'first EPIC relic offered (' + r.name + ')');
  }
});
KK.on('fervorTier', ({ to }) => { if (to === 3) first('flow', 'MAJOR', 'first FLOW STATE'); if (to === 2) first('zone', 'minor', 'first IN THE ZONE'); });
KK.on('ratSpawn', () => { first('rat', 'MAJOR', 'first golden rat'); rec('rat'); });
KK.on('chest', () => first('chest', 'minor', 'first treasure chest'));
KK.on('wipe', () => first('wipe', 'minor', 'first wipe (RETREAT)'));
KK.on('echo', () => first('echo', 'minor', 'first ECHO cast'));
KK.on('hotkey', () => first('hotkey', 'minor', 'first Hotkey Ring proc'));
KK.on('keycoin', () => first('keycoin', 'minor', 'first keystroke coin'));
KK.on('levelUp', ({ id, from, to }) => {
  if (Math.floor(to / 10) > Math.floor(from / 10)) { const tier = Math.floor(to / 10) * 10; if (tier <= 30) first(`mile:${id}:${tier}`, 'minor', `${id} LV${tier} milestone`); rec('milestone'); }
});
KK.on('upgrade', ({ store, id }) => first(`up:${store}:${id}`, store === 'legacy' ? 'minor' : 'minor', `first buy ${store}:${id}`));
const maxed = [];
KK.on('upgrade', ({ store, id, lvl }) => { const list = store === 'legacy' ? D.LEGACY : store === 'workshop' ? D.WORKSHOP : null; if (list) { const d = list.find((x) => x.id === id); if (d.max < 999 && lvl >= d.max && !maxed.some((m) => m.id === id)) maxed.push({ id, t }); } });
KK.on('retired', () => { first('retire', 'MAJOR', 'first RETIRE + Hall of Legends'); rec('retire'); });

// --- player model (mirrors tools/playtest.js smart strategy)
let typing = false, typeSwitch = 0, keyAcc = 0;
function activity(dt) {
  if (PROFILE === 'idle') return;
  typeSwitch -= dt;
  if (typeSwitch <= 0) {
    typing = !typing;
    if (PROFILE === 'burst') typeSwitch = typing ? 5 + Math.random() * 10 : 60 + Math.random() * 120;
    else typeSwitch = typing ? 20 + Math.random() * 40 : 15 + Math.random() * (PROFILE === 'heavy' ? 10 : 40);
  }
  if (typing) { keyAcc += dt * (PROFILE === 'heavy' ? 6 : 4); while (keyAcc >= 1) { keyAcc -= 1; KK.addActivity('key'); } }
}
function smartSpend() {
  const s = S();
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
  let changed = true;
  while (changed) { changed = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) changed = true; }
  for (const d of D.WORKSHOP) { const c = F.upCost(d, s.workshop[d.id] || 0); if (s.sparks - c > 60) A.buyWorkshop(d.id); }
  for (let i = 0; i < 400; i++) {
    let did = false;
    for (const d of D.FORGE) { const c = F.upCost(d, s.forge[d.id] || 0); if ((s.forge[d.id] || 0) < d.max && c < s.gold * 0.4) { A.buyForge(d.id); did = true; } }
    let best = null, bc = Infinity;
    for (const id of D.PARTY_ORDER) { if (!s.heroes[id]) continue; const c = F.levelCost(id, s.heroes[id]); if (c < bc) { bc = c; best = id; } }
    if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
    if (!did) break;
  }
}
const dt = 1 / 30;
let nextGlance = 0, lastMax = 1, lastMaxT = 0, maxSparks = 0, walkT = 0, fightT = 0, px = W.partyX;
const ultBy = { knight: 0, archer: 0, mage: 0, cleric: 0 }, ownT = { knight: 0, archer: 0, mage: 0, cleric: 0 };
KK.on('ult', ({ id }) => ultBy[id]++);
const end = MIN * 60;
while (t < end) {
  activity(dt); W.update(dt); t += dt;
  const s = S();
  maxSparks = Math.max(maxSparks, s.sparks);
  if (W.partyX > px + 1e-6) walkT += dt; else fightT += dt; px = W.partyX;
  for (const id in ownT) if (s.heroes[id]) ownT[id] += dt;
  if (t >= nextGlance) {
    nextGlance = t + GLANCE;
    if (s.relicOffer) A.pickRelic(s.relicOffer[Math.floor(Math.random() * s.relicOffer.length)]);
    smartSpend();
    if (W.rat) W.catchRat();
  }
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  if (t - lastMaxT > STUCK && A.canRetire()) { A.retire(); W.reset(); lastMax = S().maxFloorRun; lastMaxT = t; }
}

// --- report
const out = [];
out.push(`=== NOVELTY  profile=${PROFILE} seed=${SEED} ${MIN}m stuck=${STUCK / 60}m  maxFloorEver=${S().maxFloorEver} retires=${S().retires}  maxSparks=${Math.floor(maxSparks)}  walking ${(100 * walkT / t).toFixed(0)}% of time`);
if (!args.quiet) for (const n of nov) out.push(`${fmtT(n.t)}  ${n.kind.padEnd(5)}  ${n.label}`);
function gaps(list, from, to) {
  const ts = [from, ...list.filter((n) => n.t >= from && n.t < to).map((n) => n.t), to];
  let g = 0, at = from;
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > g) { g = ts[i] - ts[i - 1]; at = ts[i - 1]; }
  return { g, at };
}
const major = nov.filter((n) => n.kind === 'MAJOR');
const buckets = (list, size, from, to) => { const r = []; for (let a = from; a < to; a += size) r.push(list.filter((n) => n.t >= a && n.t < a + size).length); return r.join(' '); };
out.push('ults per owned-minute: ' + Object.keys(ultBy).map((id) => id + ' ' + (ultBy[id] / Math.max(1, ownT[id] / 60)).toFixed(2) + ' (' + ultBy[id] + ')').join('  '));
out.push('');
out.push(`novelty (any)   per 10 min, hour 1:  ${buckets(nov, 600, 0, 3600)}`);
out.push(`novelty (MAJOR) per 10 min, hour 1:  ${buckets(major, 600, 0, 3600)}`);
out.push(`novelty (any)   per 30 min, h1-h${Math.ceil(MIN / 60)}: ${buckets(nov, 1800, 3600, end)}`);
out.push(`novelty (MAJOR) per 30 min, h1-h${Math.ceil(MIN / 60)}: ${buckets(major, 1800, 3600, end)}`);
const g1 = gaps(nov, 0, Math.min(end, 3600)), g2 = gaps(nov, 3600, end), gm1 = gaps(major, 0, Math.min(end, 3600)), gm2 = gaps(major, 3600, end);
out.push(`longest gap with NO novelty: hour 1 ${(g1.g / 60).toFixed(1)} min (from ${fmtT(g1.at)}), after hour 1 ${(g2.g / 60).toFixed(1)} min (from ${fmtT(g2.at)})`);
out.push(`longest gap with no MAJOR novelty: hour 1 ${(gm1.g / 60).toFixed(1)} min (from ${fmtT(gm1.at)}), after hour 1 ${(gm2.g / 60).toFixed(1)} min (from ${fmtT(gm2.at)})`);
const lastNov = nov[nov.length - 1];
out.push(`last novelty of any kind: ${fmtT(lastNov.t)} (${lastNov.label}); total ${nov.length} firsts, ${major.length} major`);
out.push(`recurring glance moments per 30 min (boss/offer/rat/recruit/milestone/retire): ${buckets(recurring, 1800, 0, end)}`);
const allContent = [...Object.keys(D.MONSTERS).filter((k) => !D.MONSTERS[k].boss).map((k) => 'mon:' + k), ...Object.keys(D.MONSTERS).filter((k) => D.MONSTERS[k].boss).map((k) => 'boss:' + k),
  ...D.RELICS.map((r) => 'relic:' + r.id), ...D.FORGE.map((d) => 'up:forge:' + d.id), ...D.WORKSHOP.map((d) => 'up:workshop:' + d.id), ...D.LEGACY.map((d) => 'up:legacy:' + d.id),
  ...D.BIOMES.map((b) => 'biome:' + b.id), 'echo', 'hotkey', 'keycoin'];
out.push(`never appeared: ${allContent.filter((k) => !seenKeys.has(k)).join(', ') || 'none'}`);
out.push('legacy fully maxed: ' + (maxed.map((m) => m.id + '@' + fmtT(m.t)).join(', ') || 'none') + ' (of ' + D.LEGACY.filter((d) => d.max < 999).length + ' capped rows)');
console.log(out.join('\n'));
