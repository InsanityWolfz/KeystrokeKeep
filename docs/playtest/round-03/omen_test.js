// Round 03 auditor: balance probe for the proposed Delve Omens. One omen held for the whole session (worst case for
// "is it too strong/weak"), nudge-following smart player, compares depth/renown against no omen.
// node docs/playtest/round-03/omen_test.js --omen gilded [--profile typist|idle] [--min 360] [--seed 1]
const load = require('../../../tools/headless');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { args[a.slice(2)] = process.argv[i + 1]; i++; } }
const OMEN = args.omen || 'none', PROFILE = args.profile || 'typist', MIN = +args.min || 360, SEED = +args.seed || 1;
// boon / bane, using only existing mods fields + eHp/eAtk (enemy multipliers) + renownMult
const OMENS = {
  none: {},
  gilded: { mods: (m) => { m.gold *= 2; }, eHp: 1.4 },
  glass: { mods: (m) => { m.dmg *= 1.6; m.hp *= 0.65; } },
  storm: { mods: (m) => { m.ultCost *= 0.6; m.ultPow *= 1.5; m.fervDecay *= 2; } },
  quiet: { mods: (m) => { m.idlePow = Math.max(m.idlePow, 0.35); m.fervGain *= 0.5; } },
  fever: { mods: (m) => { m.chest *= 3; }, eAtk: 1.25 },
  embertide: { mods: (m) => { m.emberGain *= 2; m.gold *= 0.75; } },
  march: { mods: (m) => { m.walk *= 1.5; m.aspd *= 1.15; m.hp *= 0.85; } },
  hoard: { mods: (m) => { m.relicChoices += 1; }, eHp: 1.2 },
  veteran: { mods: (m) => { m.startLvl += 15; m.gold *= 0.8; } },
  deep: { renown: 1.25, eHp: 1.3, eAtk: 1.3 },
};
const O = OMENS[OMEN];
const KK = load({ seed: SEED });
const S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F, W = KK.world, rnd = KK.rng;
if (O.eHp) KK.BAL.eHp *= O.eHp;
if (O.eAtk) KK.BAL.eAtk *= O.eAtk;
const origMods = KK.mods;
KK.mods = function () { const m = origMods(); if (!m._omen) { m._omen = true; if (O.mods) O.mods(m); } return m; };
if (O.renown) { const og = A.renownGain; A.renownGain = () => Math.floor(og() * O.renown); }
W.reset();
const dt = 1 / 30;
let t = 0, typing = false, sw = 0, acc = 0, nextG = 0, lastMax = 1, lastMaxT = 0, runStart = 0;
const marks = {};
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
let at3 = 0;
while (t < MIN * 60) {
  if (PROFILE !== 'idle') { sw -= dt; if (sw <= 0) { typing = !typing; sw = typing ? 20 + rnd() * 40 : 15 + rnd() * 40; } if (typing) { acc += dt * 4; while (acc >= 1) { acc--; KK.addActivity('key'); } } }
  W.update(dt); t += dt;
  const s = S();
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  for (const f of [50, 75, 100, 110, 120]) if (!marks[f] && s.maxFloorEver >= f) marks[f] = (t / 3600).toFixed(2) + 'h';
  if (!at3 && t >= 3 * 3600) at3 = s.maxFloorEver;
  if (t >= nextG) {
    nextG = t + 60;
    if (s.relicOffer) A.pickRelic(s.relicOffer[Math.floor(rnd() * s.relicOffer.length)]);
    smartSpend();
    if (W.rat) W.catchRat();
    const g = A.renownGain();
    const nudge = g >= 30 && (s.retires === 0 ? s.maxFloorRun >= 40 : t - runStart > 25 * 60);
    if ((nudge || t - lastMaxT > 8 * 60) && A.canRetire()) { A.retire(); W.reset(); smartSpend(); runStart = t; lastMax = S().maxFloorRun; lastMaxT = t; }
  }
}
const s = S();
console.log(`${OMEN.padEnd(10)} ${PROFILE} s${SEED}: floor@3h ${at3} floor@${MIN / 60}h ${s.maxFloorEver} renownLife ${s.renownLifetime} embers+ws ${Math.floor(s.embers)} ${D.WORKSHOP.map((d) => s.workshop[d.id] || 0).join('/')} wipes ${s.stats.wipes} marks ${JSON.stringify(marks)}`);
