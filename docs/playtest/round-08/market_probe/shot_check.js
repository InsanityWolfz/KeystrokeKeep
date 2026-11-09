// R8 market: dry-run a staged capture save + cue script in the headless sim (no Electron), so cue timings can be
// tuned before recording. Applies the cue ops that touch the sim (warp, floor, sparks, autotype, flow, relicOffer,
// pickRelic, retire, omen, js is skipped) and prints the game events with their wall-clock time.
// node shot_check.js <save.json> <cues.json> [--demo] [--secs 40] [--keys 5.5]
const load = require('../../../../tools/headless');
const fs = require('fs');
const a = process.argv.slice(2); const flag = (k, d) => { const i = a.indexOf('--' + k); return i < 0 ? d : (a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true); };
const save = JSON.parse(fs.readFileSync(a[0], 'utf8')); const script = JSON.parse(fs.readFileSync(a[1], 'utf8'));
const KK = load({ seed: script.seed || 1, demo: !!flag('demo', false) });
const fresh = KK.newState(); for (const k in fresh) { if (save[k] === undefined) continue; if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k])) fresh[k] = Object.assign(fresh[k], save[k]); else fresh[k] = save[k]; }
KK.S = fresh; const S = KK.S, W = KK.world; W.reset();
let warp = 1, auto = false, t = 0, keyAcc = 0; const SECS = +flag('secs', 40), KPS = +flag('keys', 5.5);
const out = []; const log = (m) => out.push(`${t.toFixed(1).padStart(5)}s  ${m}`);
const W_ = () => { W.enemies = []; W.shots = []; W.wave = 0; W.door = null; W.boss = null; };
const ops = {
  warp: (v) => { warp = +v || 1; }, floor: (v) => { S.floor = +v; S.maxFloorRun = Math.max(S.maxFloorRun, S.floor); S.maxFloorEver = Math.max(S.maxFloorEver, S.floor); W_(); },
  sparks: (v) => { S.sparks = v === 'full' ? KK.mods().sparkCap : +v; }, autotype: (v) => { auto = !!v; }, flow: () => { S.fervor = 100; },
  relicOffer: () => KK.actions.rollRelics(), pickRelic: (v) => { if (S.relicOffer) KK.actions.pickRelic(S.relicOffer[+v || 0]); },
  retire: () => { if (KK.actions.retire()) W.reset(); }, omen: (v) => { S.omenOffer = S.omenOffer || [v]; KK.actions.pickOmen(v); },
  rat: () => W.spawnRat(), mark: (v) => log('MARK ' + v),
};
const cues = (script.cues || []).slice().sort((x, y) => x.t - y.t); let ci = 0;
const T0 = 0.6; // capture.js starts the script 600 ms after boot
['floor', 'bossSpawn', 'kill', 'ult', 'meteorLand', 'fervorTier', 'magmaShell', 'shellCrack', 'chargeWarn', 'warCharge', 'webShot', 'reassemble', 'lavaRain', 'voidWarn', 'relicOffer', 'relicPicked', 'retired', 'omenPicked', 'glimpse', 'demoComplete', 'wipe', 'heroDown', 'bossEnrage', 'ratSpawn', 'levelUp'].forEach((n) => KK.on(n, (p = {}) => {
  if (n === 'levelUp') return; if (n === 'kill' && !p.e.boss) return;
  log(n + ' ' + (n === 'floor' ? p.floor + (p.biomeChange ? ' (biome)' : '') : n === 'kill' ? p.e.def.name : n === 'ult' ? p.id : n === 'fervorTier' ? `${p.from}->${p.to}` : n === 'bossSpawn' ? p.boss.def.name : (p.e && p.e.def ? p.e.def.name : '')));
}));
const dt = 1 / 60;
while (t < SECS) {
  while (ci < cues.length && cues[ci].t + T0 <= t) { const c = cues[ci++]; if (c.do === 'js') { log('js (skipped in dry run): ' + String(c.v).slice(0, 60)); continue; } const f = ops[c.do]; if (f) { f(c.v); log(`cue ${c.do} ${c.v === undefined ? '' : c.v}`); } }
  if (auto) { keyAcc += dt * KPS; while (keyAcc >= 1) { keyAcc--; KK.addActivity('key'); } }
  const sim = dt * warp; const n = Math.max(1, Math.ceil(sim / (1 / 30))); for (let i = 0; i < n; i++) W.update(sim / n);
  t += dt;
}
log(`END floor ${S.floor} fervor ${Math.round(S.fervor)} tier ${KK.fervorTier()} sparks ${Math.round(S.sparks)} heroes ${JSON.stringify(S.heroes)} relics ${S.relics.length} omen ${S.omen} glimpse ${S.glimpse}/${S.glimpseDone} demoDone ${S.demoDone}`);
console.log(out.join('\n'));
