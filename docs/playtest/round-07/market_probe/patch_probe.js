// R7 market: one-off patcher that turns the copied R6 probe into the R7 probe (kept for the record).
// node docs/playtest/round-07/market_probe/patch_probe.js
const fs = require('fs'), path = require('path');
const p = path.join(__dirname, 'probe.js');
let s = fs.readFileSync(p, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); s = s.split(a).join(b); };

rep("kk-market-probe-r6", "kk-market-probe-r7");
rep("Run from the project dir:  npx electron docs/playtest/round-06/market_probe", "Run from the project dir:  npx electron docs/playtest/round-07/market_probe");
rep("// Round 06 market probe:", "// Round 07 market probe: R6 probe + KK_FAKEUSER (os.userInfo override = another Windows user), KK_UD (own userData = that user's profile),\n// KK_FAKEBATT=0|1 (hasBattery override, laptop proxy), save scenarios async-stale-quit, lowgpu-legacy-true, lowgpu-chosen-true.\n// Round 06 market probe:");
// a different Windows user: os.userInfo() is read once at the top of main.js
rep("const PROBE_ROOT = path.join(process.env.APPDATA, 'kk-market-probe-r7');",
  "const PROBE_ROOT = path.join(process.env.APPDATA, 'kk-market-probe-r7' + (process.env.KK_UD ? '-' + process.env.KK_UD : ''));\nif (process.env.KK_FAKEUSER) { const os = require('os'); const real = os.userInfo; os.userInfo = (o) => Object.assign(real(o), { username: process.env.KK_FAKEUSER }); }");
// compile main.js with more closure exports and an optional battery override (in memory only; the file on disk is untouched)
rep("const src = fs.readFileSync(MAIN, 'utf8') + `\\n;module.exports.__probe = { toggleVisible, applyVisibility, redock, dockBounds, sys, state, readSave, writeSave, savePath, saveDir, hasBattery, IS_DEMO, flushSave, writeSaveAsync };`;",
  "let raw = fs.readFileSync(MAIN, 'utf8');\n  if (process.env.KK_FAKEBATT) raw = raw.replace('function hasBattery() {', \"function hasBattery() { if (process.env.KK_FAKEBATT) return process.env.KK_FAKEBATT === '1';\");\n  const src = raw + `\\n;module.exports.__probe = { toggleVisible, applyVisibility, redock, dockBounds, sys, state, readSave, writeSave, savePath, saveDir, hasBattery, IS_DEMO, flushSave, writeSaveAsync, PIPE, gen: () => saveGen };`;");
// log the pipe name in instance runs
rep("ilog('start', { userData: app.getPath('userData') });", "ilog('start', { userData: app.getPath('userData'), fakeUser: process.env.KK_FAKEUSER || '' });");
rep("ilog('window', { lowGpuSwitch: app.commandLine.hasSwitch('disable-direct-composition') });", "ilog('window', { lowGpuSwitch: app.commandLine.hasSwitch('disable-direct-composition'), pipe: P && P.PIPE });");
// new save scenarios
rep("  'lowgpu-corrupt': () => { wr(FULL_DIR, F.main, '{\"v\":1,\"settings\":{\"lowGpu\":false'); },",
  "  'lowgpu-corrupt': () => { wr(FULL_DIR, F.main, '{\"v\":1,\"settings\":{\"lowGpu\":false'); },\n" +
  "  // R7: a R4/R5 save stuck on the old default (lowGpu true, never migrated) vs a player who chose ON\n" +
  "  'lowgpu-legacy-true': () => { wr(FULL_DIR, F.main, save({ floor: 3, settings: { lowGpu: true } })); },\n" +
  "  'lowgpu-chosen-true': () => { wr(FULL_DIR, F.main, save({ floor: 3, settings: { lowGpu: true, lowGpuMigrated: true } })); },\n" +
  "  'async-stale-quit': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },");
rep("  if (sc === 'corrupt-main') {",
  "  if (sc === 'async-stale-quit') {\n" +
  "    // the real quit order: async save hits a lock (retry pending) -> before-quit flushSave -> beforeunload saveSync\n" +
  "    const target = P.savePath();\n" +
  "    const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds 250; $f.Close()`]);\n" +
  "    await new Promise((r) => holder.stdout.on('data', (b) => { if (/LOCKED/.test(String(b))) r(); }));\n" +
  "    ipcMain.emit('kk:save', {}, save({ floor: 401 })); R.genAfterAsync = P.gen();\n" +
  "    P.flushSave(); R.genAfterFlush = P.gen();\n" +
  "    const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: 402 })); R.genAfterSync = P.gen();\n" +
  "    R.syncOk = e.returnValue; R.afterSync = floorOf(target);\n" +
  "    await new Promise((r) => holder.on('exit', r)); await sleep(1500);\n" +
  "    R.afterRetries = floorOf(target);\n" +
  "    R.verdict = R.afterRetries === 402 ? 'newest kept' : 'STALE retry overwrote the newer save (' + R.afterRetries + ')';\n" +
  "  }\n" +
  "  if (/^lowgpu-/.test(sc)) {\n" +
  "    R.rendererSettings = await js(WIN, `(() => { const s = window.KKdebug.KK.S.settings; return { lowGpu: s.lowGpu, lowGpuMigrated: s.lowGpuMigrated, volume: s.volume }; })()`);\n" +
  "    await js(WIN, `window.KKdebug.KK.save(true)`); await sleep(300);\n" +
  "    try { const o = JSON.parse(fs.readFileSync(P.savePath(), 'utf8')).settings; R.savedSettings = { lowGpu: o.lowGpu, lowGpuMigrated: o.lowGpuMigrated }; } catch (e) { R.savedSettings = 'unreadable'; }\n" +
  "  }\n" +
  "  if (sc === 'corrupt-main') {");
fs.writeFileSync(p, s);
fs.writeFileSync(path.join(__dirname, 'package.json'), JSON.stringify({ name: 'kk-market-probe-r7', version: '0.0.7', private: true, main: 'probe.js' }, null, 2) + '\n');
console.log('patched', s.length);
