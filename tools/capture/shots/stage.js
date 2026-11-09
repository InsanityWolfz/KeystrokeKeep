// Staged saves for the R8 capture cues.
// node tools/capture/shots/stage.js <all|g1|g2|s3|s4|g5> [--display <electronDisplayId>]
//   --display: dock the strip on that monitor (Electron display id, e.g. from screen.getAllDisplays()). Default: primary.
// g1/s4 come from tools/capture/make-save.js (levels only is enough there); g2/s3/g5 from sim-save.js (a real typist
// run up to that floor, so forge/legacy/relics match the depth). Patches applied to every save:
//   lastSave = 2100-01-01 -> no "Welcome back! While you were away" toast + offline gold on boot (capture doesn't stop it)
//   demoPeek = true       -> the demo's 40-minute "WHAT WAITS BELOW" card never pops mid-take
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const OUT = path.join(__dirname, 'saves');
const a = process.argv.slice(2); const which = a[0] || 'all';
const di = a.indexOf('--display'); const display = di >= 0 ? +a[di + 1] : null;
fs.mkdirSync(OUT, { recursive: true });
const make = (args) => [path.join(ROOT, 'tools', 'capture', 'make-save.js'), ...args];
const sim = (args) => [path.join(__dirname, 'sim-save.js'), ...args];
// make-save --levels order is PARTY_ORDER: knight, archer, cleric, mage
const SHOTS = {
  g1: { file: 'g1_f16_flow.json', cmd: make(['--floor', '16', '--levels', '26,22,14,20', '--relics', '2', '--minutes', '20', '--keys', '1800']), patch: (s) => { s.fervor = 80; } },
  g2: { file: 'g2_f56_ember.json', cmd: sim(['--floor', '56', '--seed', '1']), patch: (s) => { s.fervor = 0; s.gold = 0; } },
  s3: { file: 's3_f29_relic.json', cmd: sim(['--floor', '29', '--seed', '1']), patch: () => {} },
  s4: { file: 's4_omen_offer.json', cmd: make(['--floor', '1', '--ever', '76', '--levels', '11,11,11,11', '--renown', '14', '--lifetime', '40', '--retires', '3', '--minutes', '190', '--keys', '31000']), patch: (s) => {
    s.omenOffer = ['gilded', 'storm', 'quiet']; s.lastOmenOffer = s.omenOffer.slice(); s.omenStar = 'gilded'; s.renownFloor = 76; s.maxFloorRun = 1; s.sealDay = ''; s.achP = { omens: ['quiet'] };
  } },
  g5: { file: 'g5_demo_f38.json', cmd: sim(['--floor', '38', '--seed', '1', '--demo']), patch: (s) => { s.heroes = { knight: 72, archer: 62, cleric: 36, mage: 52 }; s.glimpse = false; s.glimpseDone = false; s.demoDone = false; s.runCapCleared = false; s.fervor = 0; } },
};
const D = require(path.join(ROOT, 'tools', 'headless'))({ seed: 1 }).DATA;
for (const [k, sh] of Object.entries(SHOTS)) {
  if (which !== 'all' && which !== k) continue;
  const out = path.join(OUT, sh.file);
  execFileSync(process.execPath, [...sh.cmd, '--out', out], { stdio: 'inherit' });
  const s = JSON.parse(fs.readFileSync(out, 'utf8'));
  sh.patch(s);
  if (s.omenOffer) for (const id of s.omenOffer) if (!D.OMENS.find((o) => o.id === id)) throw new Error('unknown omen ' + id);
  s.lastSave = Date.UTC(2100, 0, 1); s.demoPeek = true;
  s.settings = Object.assign(s.settings || {}, { lowGpuMigrated: true, calmMigrated: true });
  if (display) s.settings.displayId = display;
  fs.writeFileSync(out, JSON.stringify(s));
  console.log('staged', path.relative(ROOT, out));
}
