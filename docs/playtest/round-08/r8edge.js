// Round 08 auditor: Glimpse of the Depths edge cases on the CURRENT js/ (read-only).
// node r8edge.js  -> runs each scenario from a typist demo delve that reaches the glimpse floor.
const load = require('./r8load');
const dt = 1 / 30;
function typistTo(KK, cond, maxMin = 120) {
  const A = KK.actions, D = KK.DATA, W = KK.world; let t = 0, k = 0, glance = 0;
  while (t < maxMin * 60 && !cond(t)) {
    k += dt * 4; while (k >= 1) { k--; KK.addActivity('key'); }
    KK.__tick(dt); t += dt;
    if ((glance -= dt) <= 0) { glance = 60; spend(KK); }
  }
  return t;
}
function spend(KK) {
  const A = KK.actions, D = KK.DATA, S = KK.S, F = KK.F;
  if (S.relicOffer) A.pickRelic(S.relicOffer[0]);
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id);
  for (let c = true; c;) { c = false; for (const d of D.LEGACY) if (A.buyLegacy(d.id)) c = true; }
  for (let k = 0; k < 50; k++) { let did = false; for (const d of D.WORKSHOP) if (A.buyWorkshop(d.id)) did = true; if (!did) break; }
  for (let i = 0; i < 400; i++) { let best = null, bc = Infinity; for (const id of D.PARTY_ORDER) { if (!S.heroes[id]) continue; const c = F.levelCost(id, S.heroes[id]); if (c < bc) { bc = c; best = id; } } if (best && bc <= S.gold) A.levelHero(best, 1); else break; }
}
function fresh(seed) { const KK = load({ seed, demo: true }); KK.world.reset(); return KK; }
const out = [];
const st = (KK) => { const S = KK.S; return `floor ${S.floor} maxRun ${S.maxFloorRun} glimpse ${S.glimpse} glimpseDone ${S.glimpseDone} demoDone ${S.demoDone} retires ${S.retires} wipes ${S.stats.wipes} canRetire ${KK.actions.canRetire()} gain ${KK.actions.renownGain()}`; };

// 1. retire while standing on the sealed floor (Legacy -> RETIRE FOR RENOWN is enabled: gain 30)
for (const seed of [1, 2, 3]) {
  const KK = fresh(seed), A = KK.actions, W = KK.world;
  let cards = 0; KK.on('demoComplete', () => cards++);
  typistTo(KK, () => KK.S.glimpse);
  const before = st(KK);
  const g = A.retire(); W.reset();
  const t0 = KK.S.stats.playTime;
  let lastFloor = KK.S.floor, maxF = 0;
  typistTo(KK, (t) => { maxF = Math.max(maxF, KK.S.floor); return t > 15 * 60; });
  out.push(`[retire-in-glimpse s${seed}] before: ${before}\n   retire() -> ${g}; after 15 min of typing: ${st(KK)}; max floor seen ${maxF}; demo cards ${cards}`);
}
// 2. party wipes on the sealed floor
{
  const KK = fresh(1), W = KK.world;
  typistTo(KK, () => KK.S.glimpse && KK.world.wave >= 1);
  for (const h of W.heroes) W.damageHero(h, 1e12, null);
  const a = st(KK);
  typistTo(KK, (t) => t > 60);
  out.push(`[wipe-in-glimpse] right after: ${a}\n   60 s later: ${st(KK)}`);
}
// 3. quit + reload on the sealed floor (save is JSON of S; the world is rebuilt by W.reset)
{
  const KK = fresh(1), W = KK.world;
  typistTo(KK, () => KK.S.glimpse && KK.world.wave >= 1);
  const json = JSON.stringify(KK.S);
  const K2 = fresh(1); K2.S = Object.assign(K2.newState(), JSON.parse(json)); K2.dirty(); K2.world.reset();
  let card = null; K2.on('demoComplete', () => { card = K2.S.floor; });
  const sealedX = K2.world.sealedX;
  typistTo(K2, () => card !== null, 5);
  out.push(`[reload-in-glimpse] after load: S.glimpse ${JSON.parse(json).glimpse}, W.sealedX ${sealedX} (statue drawn only if truthy); card fired -> floor ${card}; ${st(K2)}`);
}
// 4. retire button / nudge state while on the sealed floor
{
  const KK = fresh(2);
  typistTo(KK, () => KK.S.glimpse);
  out.push(`[ui-state-in-glimpse] canRetire ${KK.actions.canRetire()} gain ${KK.actions.renownGain()} (Legacy badge '♛' shows when canRetire && retires==0: retires ${KK.S.retires}); HUD floor ${KK.S.floor} biome ${KK.F.biomeOf(KK.S.floor).name}; achievements so far ${Object.keys(KK.S.ach).join(',')}`);
}
// 5. 40-min peek vs glimpse overlap: a delve that reaches floor 40 right around minute 40
{
  const KK = fresh(4); let peekWhileGlimpse = false;
  // play idle-ish (no typing) to push the first floor-40 clear late
  let t = 0, glance = 0;
  while (t < 200 * 60 && !KK.S.demoDone) {
    KK.__tick(dt); t += dt; if ((glance -= dt) <= 0) { glance = 60; spend(KK); }
    if (KK.S.glimpse && KK.S.stats.playTime >= 2400 && !KK.S.demoPeek) peekWhileGlimpse = true;
  }
  out.push(`[peek-vs-glimpse idle s4] first f40 clear at ${(t / 60).toFixed(1)} min; the peek condition (!demoDone && playTime>=2400) is ALSO true during the glimpse floor -> would stack 2 cards if f40 falls at 40:00-40:13: ${peekWhileGlimpse ? 'happened' : 'not in this seed (code path open)'}`);
}
console.log(out.join('\n'));
