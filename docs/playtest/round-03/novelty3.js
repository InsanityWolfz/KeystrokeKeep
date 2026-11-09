// Round 03 auditor: novelty2.js + --nudge (retire when the in-game nudge fires: gain>=30 at first f40, or after a 25-min run) + --demo.
// node docs/playtest/round-02/novelty2.js [--min 480] [--profile typist|idle|burst|heavy] [--seed 1] [--stuck 8] [--glance 60] [--quiet]
// major = new hero/biome/boss (Hollowed X counts as a new boss)/mechanic; minor = new monster/relic/upgrade.
const load = require('../../../tools/headless');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } }
}
const MIN = +args.min || 480, PROFILE = args.profile || 'typist', SEED = +args.seed || 1, STUCK = (+args.stuck || 8) * 60, GLANCE = +args.glance || 60;
const NUDGE = !!args.nudge; const KK = load({ seed: SEED, demo: !!args.demo }); let runStartT = 0; const firstVoidBoss = [];
const rnd = KK.rng;
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world;
W.reset();
let t = 0;
const fmtT = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`;
const nov = [];
const seenKeys = new Set();
const first = (key, kind, label) => { if (seenKeys.has(key)) return; seenKeys.add(key); nov.push({ t, kind, label }); };
const recurring = [];
const rec = (label) => recurring.push({ t, label });

KK.on('wave', () => { for (const e of W.enemies) if (!e.boss) first('mon:' + e.key, 'minor', 'monster ' + e.def.name); });
const bossLog = [];
KK.on('bossSpawn', ({ boss }) => { first('bossname:' + boss.def.name, 'MAJOR', 'boss ' + boss.def.name + ' (floor ' + S().floor + ')'); first('boss:' + boss.key, 'minor', 'sprite ' + boss.key); rec('boss'); bossLog.push({ t, f: S().floor, n: boss.def.name, r: S().retires }); });
KK.on('floor', ({ floor }) => {
  first('biome:' + F.biomeOf(floor).id, 'MAJOR', 'biome ' + F.biomeOf(floor).name + ' (floor ' + floor + ')');
  if (floor >= 20) first('retireUnlock', 'MAJOR', 'retire unlocked');
  for (const ms of [50, 75, 100, 125, 150]) if (floor >= ms) first('depth' + ms, 'depth', 'reached floor ' + ms);
});
KK.on('recruit', ({ id }) => { first('recruit:' + id, 'MAJOR', 'recruit ' + id); rec('recruit'); });
KK.on('ult', ({ id }) => first('ult:' + id, 'minor', 'first ultimate ' + D.HEROES[id].ult.name));
KK.on('relicOffer', ({ ids }) => {
  first('relicOffer', 'MAJOR', 'first relic offer'); rec('relicOffer');
  for (const id of ids) { const r = D.RELICS.find((x) => x.id === id); first('relic:' + id, 'minor', `relic seen ${r.name} [${r.rar}]`); if (r.rar === 'epic') first('epic', 'MAJOR', 'first EPIC offered (' + r.name + ')'); }
});
KK.on('fervorTier', ({ to }) => { if (to === 3) first('flow', 'MAJOR', 'first FLOW STATE'); });
KK.on('ratSpawn', () => { first('rat', 'MAJOR', 'first golden rat'); rec('rat'); });
KK.on('chest', () => first('chest', 'minor', 'first chest'));
KK.on('echo', () => first('echo', 'minor', 'first ECHO'));
KK.on('hotkey', () => first('hotkey', 'minor', 'first Hotkey proc'));
KK.on('keycoin', () => first('keycoin', 'minor', 'first key coin'));
KK.on('upgrade', ({ store, id }) => first(`up:${store}:${id}`, 'minor', `first buy ${store}:${id}`));
const maxed = [];
KK.on('upgrade', ({ store, id, lvl }) => { const list = store === 'legacy' ? D.LEGACY : store === 'workshop' ? D.WORKSHOP : null; if (list) { const d = list.find((x) => x.id === id); if (d.max < 999 && lvl >= d.max && !maxed.some((m) => m.id === id)) maxed.push({ id, t }); } });
KK.on('retired', () => { first('retire', 'MAJOR', 'first RETIRE'); rec('retire'); });

let typing = false, typeSwitch = 0, keyAcc = 0;
function activity(dt) {
  if (PROFILE === 'idle') return;
  typeSwitch -= dt;
  if (typeSwitch <= 0) {
    typing = !typing;
    if (PROFILE === 'burst') typeSwitch = typing ? 5 + rnd() * 10 : 60 + rnd() * 120;
    else typeSwitch = typing ? 20 + rnd() * 40 : 15 + rnd() * (PROFILE === 'heavy' ? 10 : 40);
  }
  if (typing) { keyAcc += dt * (PROFILE === 'heavy' ? 6 : 4); while (keyAcc >= 1) { keyAcc -= 1; KK.addActivity('key'); } }
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
const dt = 1 / 30;
let nextGlance = 0, lastMax = 1, lastMaxT = 0, maxSparks = 0, capT = 0, combatCapT = 0, combatT = 0;
const ultBy = { knight: 0, archer: 0, mage: 0, cleric: 0 }, ownT = { knight: 0, archer: 0, mage: 0, cleric: 0 };
KK.on('ult', ({ id }) => ultBy[id]++);
const firstUltAfterRecruit = {};
const recruitT = {};
KK.on('recruit', ({ id }) => { if (recruitT[id] === undefined) recruitT[id] = t; });
KK.on('ult', ({ id }) => { if (recruitT[id] !== undefined && firstUltAfterRecruit[id] === undefined) firstUltAfterRecruit[id] = t - recruitT[id]; });
const emberLog = [];
const end = MIN * 60;
let nextSnap = 0;
while (t < end) {
  activity(dt); W.update(dt); t += dt;
  const s = S(), m = KK.mods();
  maxSparks = Math.max(maxSparks, s.sparks);
  const inCombat = W.enemies.some((e) => !e.dead && e.active);
  if (s.sparks >= m.sparkCap - 0.5) { capT += dt; if (inCombat) combatCapT += dt; }
  if (inCombat) combatT += dt;
  for (const id in ownT) if (s.heroes[id]) ownT[id] += dt;
  if (t >= nextSnap) { nextSnap += 1800; emberLog.push(`${fmtT(t)} f${s.floor} emb${Math.floor(s.embers)} ws[${D.WORKSHOP.map((d) => d.id + (s.workshop[d.id] || 0)).join(' ')}] ren${s.renown}/${s.renownLifetime}`); }
  if (t >= nextGlance) {
    nextGlance = t + GLANCE;
    if (s.relicOffer) A.pickRelic(s.relicOffer[Math.floor(rnd() * s.relicOffer.length)]);
    smartSpend();
    if (W.rat) W.catchRat();
  }
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  const nudgeNow = NUDGE && A.renownGain() >= 30 && (S().retires === 0 ? S().maxFloorRun >= 40 : t - runStartT > 1500); if ((t - lastMaxT > STUCK || nudgeNow) && A.canRetire()) { A.retire(); W.reset(); lastMax = S().maxFloorRun; lastMaxT = t; runStartT = t; }
}
const out = [];
out.push(`=== NOVELTY2 profile=${PROFILE} seed=${SEED} ${MIN}m stuck=${STUCK / 60}m  maxFloorEver=${S().maxFloorEver} retires=${S().retires} renownLife=${S().renownLifetime} maxSparks=${Math.floor(maxSparks)} sparksAtCap ${(100 * capT / t).toFixed(1)}% (in combat ${(100 * combatCapT / Math.max(1, combatT)).toFixed(1)}% of combat)`);
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
out.push('first ult after recruit (s): ' + Object.entries(firstUltAfterRecruit).map(([k, v]) => k + ' ' + v.toFixed(0)).join('  '));
out.push(`novelty (any)   per 10 min, hour 1:  ${buckets(nov, 600, 0, 3600)}`);
out.push(`novelty (MAJOR) per 10 min, hour 1:  ${buckets(major, 600, 0, 3600)}`);
out.push(`novelty (any)   per 30 min, h1-end: ${buckets(nov, 1800, 3600, end)}`);
out.push(`novelty (MAJOR) per 30 min, h1-end: ${buckets(major, 1800, 3600, end)}`);
const g2 = gaps(nov, 3600, end), gm2 = gaps(major, 3600, end), gm25 = gaps(major, 3600, Math.min(end, 5 * 3600));
out.push(`longest gap NO novelty after h1: ${(g2.g / 60).toFixed(0)} min (from ${fmtT(g2.at)}); no MAJOR after h1: ${(gm2.g / 60).toFixed(0)} min (from ${fmtT(gm2.at)}); no MAJOR in h1-h5: ${(gm25.g / 60).toFixed(0)} min`);
const lastMaj = major[major.length - 1];
out.push(`last MAJOR: ${fmtT(lastMaj.t)} (${lastMaj.label}); total ${nov.length} firsts, ${major.length} major`);
out.push(`recurring moments per 30 min: ${buckets(recurring, 1800, 0, end)}`);
const allContent = [...Object.keys(D.MONSTERS).filter((k) => !D.MONSTERS[k].boss).map((k) => 'mon:' + k), ...Object.keys(D.MONSTERS).filter((k) => D.MONSTERS[k].boss).map((k) => 'boss:' + k),
  ...D.RELICS.map((r) => 'relic:' + r.id), ...D.FORGE.map((d) => 'up:forge:' + d.id), ...D.WORKSHOP.map((d) => 'up:workshop:' + d.id), ...D.LEGACY.map((d) => 'up:legacy:' + d.id),
  ...D.BIOMES.map((b) => 'biome:' + b.id), 'echo', 'hotkey', 'keycoin'];
out.push(`never appeared: ${allContent.filter((k) => !seenKeys.has(k)).join(', ') || 'none'}`);
out.push('maxed: ' + (maxed.map((m) => m.id + '@' + fmtT(m.t)).join(', ') || 'none'));
out.push('bosses after floor 60: ' + bossLog.filter((b) => b.f > 60).map((b) => `${fmtT(b.t)} f${b.f} r${b.r} ${b.n}`).join(' | ')); const fh = bossLog.find((b) => b.n === 'The Hollow'); out.push('first f70 boss: ' + (bossLog.find((b) => b.f === 70) ? JSON.stringify(bossLog.find((b) => b.f === 70)) : 'none') + '; first The Hollow: ' + (fh ? fmtT(fh.t) + ' f' + fh.f + ' r' + fh.r : 'never'));
out.push('embers/workshop: ' + emberLog.join(' || '));
out.push('final legacy: ' + JSON.stringify(S().legacy) + ' workshop: ' + JSON.stringify(S().workshop));
console.log(out.join('\n'));
