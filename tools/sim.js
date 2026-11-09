// Headless balance simulator: runs the real world.js/state.js without a browser.
// Usage: node tools/sim.js [minutes=120] [profile=typist|idle|heavy] [glanceSec=60]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const minutes = +process.argv[2] || 120;
const profile = process.argv[3] || 'typist';
const glance = +process.argv[4] || 60;

global.KK = undefined;
if (process.env.BAL) global.BAL_OVERRIDE = JSON.parse(process.env.BAL);
const quiet = !!process.env.QUIET;
for (const f of ['util', 'data', 'state', 'world']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
}
const KK = globalThis.KK, S = () => KK.S, A = KK.actions, D = KK.DATA, F = KK.F;
KK.world.reset();

const dt = 1 / 30;
let t = 0, nextGlance = 0, lastMaxT = 0, lastMax = 1;
let typing = false, typeSwitch = 0, keyAcc = 0;
const log = [];
const milestones = new Set();
KK.on('recruit', ({ id }) => log.push(`${fmtT(t)}  recruit ${id}`));
KK.on('kill', ({ e }) => { if (e.boss) log.push(`${fmtT(t)}  BOSS ${e.def.name} down (floor ${S().floor})`); });
KK.on('wipe', ({ floor }) => { if (!milestones.has('wipe' + floor)) { milestones.add('wipe' + floor); log.push(`${fmtT(t)}  wipe on floor ${floor}`); } });
KK.on('retired', ({ gain }) => log.push(`${fmtT(t)}  >>> RETIRE #${S().retires} +${gain} renown (total ${S().renownLifetime})`));

function fmtT(s) { const m = Math.floor(s / 60); return `${String(Math.floor(m / 60)).padStart(1)}h${String(m % 60).padStart(2, '0')}m`; }

function spendAll() {
  const s = S();
  if (s.relicOffer) A.pickRelic(s.relicOffer[0]);
  for (const id of D.PARTY_ORDER) if (A.canRecruit(id) && s.gold >= A.recruitCost(id)) A.recruit(id);
  // legacy
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of ['quartermaster', 'lineage', 'treasury', 'veterans', 'headstart', 'recruiter']) {
      if (A.buyLegacy(id)) changed = true;
    }
  }
  // workshop with sparks above a reserve
  for (const id of ['jar', 'overcharge', 'kindling']) {
    const def = D.WORKSHOP.find((d) => d.id === id);
    const c = F.upCost(def, s.workshop[id] || 0);
    if (s.sparks - c > 60) A.buyWorkshop(id);
  }
  for (let i = 0; i < 400; i++) {
    // forge if cheap relative to gold, else cheapest hero level
    let did = false;
    for (const id of ['blades', 'armor', 'purse']) {
      const def = D.FORGE.find((d) => d.id === id);
      const c = F.upCost(def, s.forge[id] || 0);
      if (c < s.gold * 0.4) { A.buyForge(id); did = true; }
    }
    let best = null, bc = Infinity;
    for (const id of D.PARTY_ORDER) {
      if (!s.heroes[id]) continue;
      const c = F.levelCost(id, s.heroes[id]);
      if (c < bc) { bc = c; best = id; }
    }
    if (best && bc <= s.gold) { A.levelHero(best, 1); did = true; }
    if (!did) break;
  }
}

const marks = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];
while (t < minutes * 60) {
  // activity profile
  if (profile !== 'idle') {
    typeSwitch -= dt;
    if (typeSwitch <= 0) { typing = !typing; typeSwitch = typing ? 20 + Math.random() * 40 : 15 + Math.random() * (profile === 'heavy' ? 10 : 40); }
    if (typing) {
      keyAcc += dt * (profile === 'heavy' ? 6 : 4);
      while (keyAcc >= 1) { keyAcc -= 1; KK.addActivity('key'); }
    }
  }
  KK.world.update(dt);
  t += dt;
  if (t >= nextGlance) { nextGlance = t + glance; spendAll(); }
  const s = S();
  if (s.maxFloorRun > lastMax) { lastMax = s.maxFloorRun; lastMaxT = t; }
  // retire when stuck for 8 minutes
  if (t - lastMaxT > 480 && A.canRetire()) {
    A.retire(); KK.world.reset(); lastMax = S().maxFloorRun; lastMaxT = t;
  }
  for (const mk of marks) if (!milestones.has(mk) && t >= mk * 60) {
    milestones.add(mk);
    log.push(`${fmtT(t)}  -- floor ${s.floor} (max ${s.maxFloorRun}) gold ${KK.U.fmt(s.gold)} lv ${D.PARTY_ORDER.map((id) => id[0] + s.heroes[id]).join(' ')} relics ${s.relics.length} sparks ${Math.floor(s.sparks)} inc ${KK.U.fmt(s.incomeRate)}/s`);
  }
}
console.log(`profile=${profile} glance=${glance}s minutes=${minutes}`);
console.log((quiet ? log.filter((l) => l.includes('--') || l.includes('RETIRE') || l.includes('recruit')) : log).join('\n'));
const s = S();
console.log(`END floor ${s.floor} maxEver ${s.maxFloorEver} retires ${s.retires} renownLifetime ${s.renownLifetime} kills ${s.stats.kills} ults ${s.stats.ults} wipes ${s.stats.wipes} flow ${Math.round(s.stats.flowTime)}s`);
