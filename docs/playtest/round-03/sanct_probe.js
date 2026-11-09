// Round 03 auditor: why is Sanctuary still rare? Per boss fight with the Cleric owned: did she cast, how much of the
// fight had someone below 80%, and how often did her ult turn come up at all.
// node docs/playtest/round-03/sanct_probe.js [--profile typist|idle] [--min 180] [--seed 1]
const load = require('../../../tools/headless');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; } }
const PROFILE = args.profile || 'typist', MIN = +args.min || 180, SEED = +args.seed || 1;
const KK = load({ seed: SEED });
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
W.reset();
const dt = 1 / 30;
let t = 0, typing = false, sw = 0, acc = 0, nextG = 0, lastMax = 1, lastMaxT = 0;
let fights = 0, fightsCast = 0, fightT = 0, lowT = 0, turnT = 0, turnFrames = 0, inFight = false, castThis = false, slams = 0, slamWithSparks = 0, sanctAll = 0, sanctBoss = 0;
let sparksAtSlam = 0;
KK.on('ult', ({ id }) => { if (id === 'cleric') { sanctAll++; if (W.boss && !W.boss.dead) { sanctBoss++; castThis = true; } } });
KK.on('bossSlam', () => { if (S().heroes.cleric) { slams++; sparksAtSlam += S().sparks; if (S().sparks >= 40) slamWithSparks++; } });
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
while (t < MIN * 60) {
  if (PROFILE !== 'idle') { sw -= dt; if (sw <= 0) { typing = !typing; sw = typing ? 20 + rnd() * 40 : 15 + rnd() * 40; } if (typing) { acc += dt * 4; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
  W.update(dt); t += dt;
  const s = S();
  const bossOn = !!(W.boss && !W.boss.dead && W.boss.active) && !!s.heroes.cleric;
  if (bossOn && !inFight) { inFight = true; castThis = false; fights++; }
  if (!bossOn && inFight) { inFight = false; if (castThis) fightsCast++; }
  if (bossOn) {
    fightT += dt;
    if (W.heroes.some((o) => o.dead || o.hp / o.maxHp < 0.8)) lowT += dt;
    if (W.ultTurn === 'cleric') { turnT += dt; turnFrames++; }
  }
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  if (t >= nextG) {
    nextG = t + 60;
    if (s.relicOffer) A.pickRelic(s.relicOffer[Math.floor(rnd() * s.relicOffer.length)]);
    smartSpend(); if (W.rat) W.catchRat();
    if (t - lastMaxT > 8 * 60 && A.canRetire()) { A.retire(); W.reset(); lastMax = S().maxFloorRun; lastMaxT = t; }
  }
}
console.log(`${PROFILE} s${SEED} ${MIN}m: boss fights with Cleric ${fights}, with a Sanctuary ${fightsCast} (${(100 * fightsCast / Math.max(1, fights)).toFixed(0)}%); boss-fight time ${(fightT / 60).toFixed(1)} min, someone <80% ${(100 * lowT / Math.max(1, fightT)).toFixed(0)}% of it; Cleric holds the ult turn ${(100 * turnT / Math.max(1, fightT)).toFixed(1)}% of boss time (${turnFrames} frames); boss slams ${slams}, avg Sparks at slam ${(sparksAtSlam / Math.max(1, slams)).toFixed(0)}, slams with >=40 Sparks ${slamWithSparks}; Sanctuary total ${sanctAll} (in boss fights ${sanctBoss})`);
