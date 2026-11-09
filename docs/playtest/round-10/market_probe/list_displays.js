// R10 market: list displays via Electron with NO window and without loading the game (safe launcher, listOnly)
const { spawnSync } = require('child_process'); const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'out', 'displays.json'); const cfgP = path.join(__dirname, 'out', 'displays_cfg.json');
fs.writeFileSync(cfgP, JSON.stringify({ name: 'displays', listOnly: true, out: OUT }));
const c = spawnSync(process.execPath, ['--check', path.join(__dirname, 'safe', 'main.js')], { encoding: 'utf8' }); if (c.status !== 0) { console.log('syntax error, not starting ' + c.stderr); process.exit(2); }
const env = Object.assign({}, process.env, { KK9_CFG: cfgP }); for (const k of Object.keys(env)) if (/^KK_|ELECTRON_RUN_AS_NODE/.test(k)) delete env[k];
const r = spawnSync(path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), [path.join(__dirname, 'safe')], { cwd: ROOT, env, encoding: 'utf8', timeout: 20000 });
console.log('status', r.status, r.signal); console.log(fs.readFileSync(OUT, 'utf8'));
