// R9 market: one capture take through the SAFE launcher (secondary display only, no hook, no tray/hotkeys, muted).
// node run_shot.js <g1|g2|s3|s4|g5> <take-name> [--det] [--audio off] [--seed N] [--lastsave old]
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const SH = path.join(ROOT, 'tools', 'capture', 'shots');
const DISPLAY = 2904106817; // right-hand 1920x1080, NOT primary (checked again inside the launcher)
const SHOTS = {
  g1: { save: 'g1_f16_flow.json', script: 'g1_flow_meteor.json', secs: 14 },
  g2: { save: 'g2_f56_ember.json', script: 'g2_ember_shell.json', secs: 46 },
  s3: { save: 's3_f29_relic.json', script: 's3_relic_pick.json', secs: 13 },
  s4: { save: 's4_omen_offer.json', script: 's4_omen_choice.json', secs: 15 },
  g5: { save: 'g5_demo_f38.json', script: 'g5_demo_glimpse.json', secs: 66, env: { KK_DEMO: '1' } },
};
const a = process.argv.slice(2); const [shot, take] = a; const has = (k) => a.includes('--' + k); const val = (k) => { const i = a.indexOf('--' + k); return i < 0 ? null : a[i + 1]; };
const sh = SHOTS[shot]; if (!sh) throw new Error('shot?');
const OUT = path.join(__dirname, 'out', 'shots'); fs.mkdirSync(OUT, { recursive: true });
const save = JSON.parse(fs.readFileSync(path.join(SH, 'saves', sh.save), 'utf8'));
save.settings = Object.assign(save.settings || {}, { displayId: DISPLAY, countInput: false });
if (val('lastsave') === 'old') save.lastSave = Date.now() - 3600 * 1000;
const saveP = path.join(OUT, `${shot}_${take}_save.json`); fs.writeFileSync(saveP, JSON.stringify(save));
const scriptP = path.join(SH, sh.script);
const secs = +(val('secs') || sh.secs);
const shotsAt = []; for (let f = 60; f <= secs * 60; f += 120) shotsAt.push(f);
const cfg = { name: `${shot}_${take}`, secs, displayId: DISPLAY, det: has('det'), shotsAt, pngAt: (val('png') || '').split(',').filter(Boolean).map(Number), out: path.join(OUT, `${shot}_${take}.json`) };
const cfgP = path.join(OUT, `${shot}_${take}_cfg.json`); fs.writeFileSync(cfgP, JSON.stringify(cfg));
const env = Object.assign({}, process.env, { KK9_CFG: cfgP, KK_CAPTURE: '1', KK_CAPTURE_SAVE: saveP, KK_CAPTURE_SCRIPT: scriptP }, sh.env || {});
if (val('audio')) env.KK_CAPTURE_AUDIO = val('audio');
if (val('seed')) env.KK_CAPTURE_SEED = val('seed');
for (const k of ['KK_SNAPSHOT', 'ELECTRON_RUN_AS_NODE']) delete env[k];
// pre-flight: a syntax error in the launcher would make Electron show an error dialog on the PRIMARY display
for (const f of ['main.js', 'pre.js']) { const c = spawnSync(process.execPath, ['--check', path.join(__dirname, 'safe', f)], { encoding: 'utf8' }); if (c.status !== 0 && f === 'main.js') { console.log('launcher syntax error, not starting: ' + c.stderr); process.exit(2); } }
const t0 = Date.now();
const r = spawnSync(path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), [path.join(__dirname, 'safe')], { cwd: ROOT, env, encoding: 'utf8', timeout: (secs + 15) * 1000 });
console.log('status', r.status, r.signal, r.error && r.error.message, (Date.now() - t0) + 'ms');
fs.writeFileSync(path.join(OUT, `${shot}_${take}_stdout.txt`), (r.stdout || '') + '\n--stderr--\n' + (r.stderr || ''));
const o = JSON.parse(fs.readFileSync(cfg.out, 'utf8'));
const p = o.page || {};
console.log(`${cfg.name}: abort=${o.abortReason} hookStart=${o.recorded.hookStart} shortcuts=${o.recorded.shortcuts.length} userData=${o.userData} frames=${p.f} t0f=${p.t0f} ev=${(p.ev || []).length} fpsReal=${JSON.stringify((p.fpsReal || []).slice(1, 6))}`);
console.log(o.log.filter((l) => /shown at|ABORT|blocked|error/i.test(l)).slice(0, 6).join('\n'));
