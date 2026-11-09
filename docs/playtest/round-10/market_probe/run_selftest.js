// R9 market: self-test (KK_SNAPSHOT) / capture runs of the DEV build through safe2 (secondary display only).
// node run_selftest.js <name> [--fresh] [--save file] [--display id|none] [--noclamp] [--secs N] [--png 2,5] [--evals evals.json] [--env K=V,...]
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const a = process.argv.slice(2); const name = a[0]; const has = (k) => a.includes('--' + k); const val = (k) => { const i = a.indexOf('--' + k); return i < 0 ? null : a[i + 1]; };
const OUT = path.join(__dirname, 'out', 'selftest'); fs.mkdirSync(OUT, { recursive: true });
const prof = path.join(process.env.APPDATA, /KK_CAPTURE=1/.test(val('env') || '') ? 'kk-market-r10-capture' : 'kk-market-r10-selftest');
if (!/kk-market-r10-(selftest|capture)$/.test(prof)) throw new Error('profile?');
if (has('fresh')) fs.rmSync(prof, { recursive: true, force: true });
if (val('save')) { fs.mkdirSync(path.join(prof, 'saves'), { recursive: true }); fs.copyFileSync(val('save'), path.join(prof, 'saves', 'keystroke-keep.json')); }
const secs = +(val('secs') || 10);
const cfg = { name, secs, displayId: 2904106817, noclamp: has('noclamp'), det: false, shotsAt: [], pngAt: [], pngTimes: (val('png') || '').split(',').filter(Boolean).map(Number), evalAt: val('evals') ? JSON.parse(fs.readFileSync(val('evals'), 'utf8')) : [], out: path.join(OUT, name + '.json') };
const cfgP = path.join(OUT, name + '_cfg.json'); fs.writeFileSync(cfgP, JSON.stringify(cfg));
const env = Object.assign({}, process.env, { KK9_CFG: cfgP, KK_SNAPSHOT: path.join(OUT, name + '_snapshot.png'), KK_SNAPSHOT_DELAY: String((secs + 30) * 1000) });
for (const kv of (val('env') || '').split(',').filter(Boolean)) { const i = kv.indexOf('='); env[kv.slice(0, i)] = kv.slice(i + 1); }
delete env.ELECTRON_RUN_AS_NODE; if (!/KK_CAPTURE=1/.test(val('env') || '')) delete env.KK_CAPTURE; else { delete env.KK_SNAPSHOT; delete env.KK_SNAPSHOT_DELAY; }
const c = spawnSync(process.execPath, ['--check', path.join(__dirname, 'safe2', 'main.js')], { encoding: 'utf8' }); if (c.status !== 0) { console.log('syntax error, not starting ' + c.stderr); process.exit(2); }
const r = spawnSync(path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), [path.join(__dirname, 'safe2')], { cwd: ROOT, env, encoding: 'utf8', timeout: (secs + 15) * 1000 });
console.log('status', r.status, r.signal);
const o = JSON.parse(fs.readFileSync(cfg.out, 'utf8'));
console.log(JSON.stringify({ abort: o.abortReason, tooltip: o.recorded && o.recorded.tooltip.slice(-1), menu: o.recorded && o.recorded.menu, shortcuts: o.recorded && o.recorded.shortcuts, balloons: o.recorded && o.recorded.balloons }, null, 0));
console.log(o.log.join('\n'));
for (const e of (o.recorded && o.recorded.evals) || []) console.log('EVAL', e.id, '@', e.t, JSON.stringify(e.v), e.err || '');
