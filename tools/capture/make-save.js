// Builds a staged save for capture mode with the headless sim, so nobody grinds for a shot.
// node tools/capture/make-save.js --floor 19 --levels 40,35,30,20 --relics 3 --renown 0 --omen gilded --out tools/capture/f19_party.json
// Then: KK_CAPTURE=1 KK_CAPTURE_SAVE=tools/capture/f19_party.json [KK_CAPTURE_SCRIPT=tools/capture/<shot>.json] npx electron .
const fs = require('fs');
const path = require('path');
const load = require('../headless');

const args = {};
for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1];
const KK = load({ seed: +(args.seed || 1) });
KK.world.reset();
const S = KK.S, D = KK.DATA;
const floor = +(args.floor || 1);
S.floor = floor; S.maxFloorRun = floor; S.maxFloorEver = Math.max(floor, +(args.ever || floor));
const lv = String(args.levels || '1').split(',').map(Number);
D.PARTY_ORDER.forEach((id, i) => { if (lv[i]) S.heroes[id] = lv[i]; });
const nRel = +(args.relics || 0);
const pool = D.RELICS.map((r) => r.id);
for (let i = 0; i < nRel; i++) S.relics.push(pool[(i * 5) % pool.length]);
S.renown = +(args.renown || 0); S.renownLifetime = +(args.lifetime || S.renown); S.retires = +(args.retires || (S.renownLifetime ? 2 : 0));
S.renownFloor = Math.max(0, floor - 5);
if (args.omen) S.omen = args.omen;
S.gold = +(args.gold || 0);
S.stats.keys = +(args.keys || 2500); S.stats.playTime = +(args.minutes || 30) * 60;
S.tutorial = { sparks: 1, ult: 1, flow: 1, rat: 1, lvl: 1, retire: 1 };
S.settings.lowGpuMigrated = true; S.settings.calmMigrated = true;
S.v = 1; S.lastSave = Date.now();
const out = args.out || path.join(__dirname, `f${floor}_party.json`);
fs.writeFileSync(out, JSON.stringify(S));
console.log('wrote', out);
