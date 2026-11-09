# R6 market: one-off patcher that turned the copied R5 probe into the R6 probe (kept for the record).
p = __import__('os').path.join(__import__('os').path.dirname(__file__), 'probe.js')
s = open(p, encoding='utf8').read()
def rep(a, b):
    global s
    assert a in s, a[:60]
    s = s.replace(a, b)

rep("  'session-end': () => { wr(FULL_DIR, F.main, save({ floor: 70 })); },",
"""  'session-end': () => { wr(FULL_DIR, F.main, save({ floor: 70 })); },
  // R6 (89f4651): newer .tmp wins, import marker after the first own save, async retries
  'tmp-newer': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); wr(FULL_DIR, F.main + '.tmp', save({ floor: 61 })); const t = Date.now() / 1000; fs.utimesSync(path.join(FULL_DIR, F.main), t - 30, t - 30); },
  'tmp-older': () => { wr(FULL_DIR, F.main + '.tmp', save({ floor: 59 })); wr(FULL_DIR, F.main, save({ floor: 60 })); const t = Date.now() / 1000; fs.utimesSync(path.join(FULL_DIR, F.main + '.tmp'), t - 60, t - 60); },
  'tmp-newer-corrupt': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); wr(FULL_DIR, F.main + '.tmp', '{"v":1,"flo'); const t = Date.now() / 1000; fs.utimesSync(path.join(FULL_DIR, F.main), t - 30, t - 30); },
  'tmp-only': () => { wr(FULL_DIR, F.main + '.tmp', save({ floor: 61 })); },
  'marker-then-corrupt': () => { wr(FULL_DIR, F.main, save({ floor: 55 })); wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'own-marker-corrupt-with-demo': () => { wr(FULL_DIR, F.main, '{"v":1,"flo'); wr(FULL_DIR, 'demo-imported.flag', 'own save 1'); wr(DEMO_DIR, F.main, save({ floor: 31, demoDone: true })); },
  'async-lock': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },
  'async-stale': () => { wr(FULL_DIR, F.main, save({ floor: 60 })); },""")

rep("  if (sc === 'corrupt-main') {",
"""  if (sc === 'marker-then-corrupt') {
    // a full-game install that has saved once, then loses main + backups: must NOT import the demo
    const mk = path.join(FULL_DIR, 'demo-imported.flag');
    R.markerAfterFirstSave = fs.existsSync(mk) ? fs.readFileSync(mk, 'utf8') : 'missing';
    for (const n of [F.main, F.b1, F.b2, F.b3]) { try { fs.unlinkSync(path.join(FULL_DIR, n)); } catch (e) { /* none */ } }
    fs.writeFileSync(path.join(FULL_DIR, F.main), '{"v":1,"flo');
    const t = P.readSave(); const e = {}; ipcMain.emit('kk:saveInfo', e);
    R.readAfterCorrupt = { returned: t ? JSON.parse(t).floor : null, source: e.returnValue };
  }
  if (sc === 'async-lock') {
    // async kk:save path: must not block the main process; retries 20/40/80/160/320 ms (620 ms window)
    const target = P.savePath(); R.asyncLocks = [];
    for (const ms of [100, 300, 600, 1000, 2000]) {
      const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds ${ms}; $f.Close()`]);
      await new Promise((r) => holder.stdout.on('data', (b) => { if (/LOCKED/.test(String(b))) r(); }));
      const want = 200 + R.asyncLocks.length;
      let maxLag = 0, last = Date.now(); const lagT = setInterval(() => { const n = Date.now(); maxLag = Math.max(maxLag, n - last - 5); last = n; }, 5);
      const t0 = Date.now(); ipcMain.emit('kk:save', {}, save({ floor: want })); const blocked = Date.now() - t0;
      let landed = null; while (Date.now() - t0 < 4000) { if (floorOf(target) === want) { landed = Date.now() - t0; break; } await sleep(10); }
      clearInterval(lagT);
      await new Promise((r) => holder.on('exit', r)); await sleep(300);
      const row = { lockMs: ms, emitBlockedMs: blocked, maxEventLoopLagMs: maxLag, landedAfterMs: landed, mainFloorNow: floorOf(target), tmpLeft: fs.existsSync(target + '.tmp'), tmpFloor: floorOf(target + '.tmp') };
      const t = P.readSave(); row.readSaveNow = t ? JSON.parse(t).floor : null; // what a reboot would load (newer .tmp wins)
      R.asyncLocks.push(row);
    }
  }
  if (sc === 'async-stale') {
    // an async save hits a lock and schedules retries; a sync save (quit path) lands meanwhile.
    // Does a pending retry later overwrite the newer sync save with the older text?
    const target = P.savePath();
    const holder = spawn('powershell', ['-NoProfile', '-Command', `$f=[IO.File]::Open('${target}','Open','Read','Read'); [Console]::Out.WriteLine('LOCKED'); [Console]::Out.Flush(); Start-Sleep -Milliseconds 250; $f.Close()`]);
    await new Promise((r) => holder.stdout.on('data', (b) => { if (/LOCKED/.test(String(b))) r(); }));
    ipcMain.emit('kk:save', {}, save({ floor: 301 })); // older, async, fails -> retry pending
    const e = {}; ipcMain.emit('kk:saveSync', e, save({ floor: 302 })); // newer, sync (blocks until the lock clears)
    R.syncOk = e.returnValue; R.afterSync = floorOf(target);
    await new Promise((r) => holder.on('exit', r)); await sleep(1500);
    R.afterRetries = floorOf(target);
    R.verdict = R.afterRetries === 302 ? 'newest kept' : 'STALE retry overwrote the newer save (' + R.afterRetries + ')';
  }
  if (sc === 'corrupt-main') {""")

rep("// ---- R5: seed the probe's save, then compile main.js BEFORE ready",
"""// ---- R6: instance tests (same-build relaunch, demo<->full pipe dialog, slow owner quit)
const ILOG = path.join(OUT, 'instance_log.jsonl');
const ilog = (ev, extra) => { try { fs.appendFileSync(ILOG, JSON.stringify(Object.assign({ t: Date.now(), pid: process.pid, mode: MODE, demo: process.env.KK_DEMO === '1', tag: process.env.KK_TAG || '', ev }, extra || {})) + '\\n'); } catch (e) { /* ignore */ } };
const INSTANCE = ['hold', 'noop'].includes(MODE);
if (INSTANCE) {
  ilog('start', { userData: app.getPath('userData') });
  process.on('exit', (c) => ilog('exit', { code: c, uptimeMs: Math.round(process.uptime() * 1000) }));
  app.on('will-quit', () => ilog('will-quit'));
  app.on('second-instance', () => setTimeout(() => ilog('second-instance', { visibleAfter: !!(WIN && !WIN.isDestroyed() && WIN.isVisible()), userShown: P && P.sys.userShown }), 600));
  if (process.env.KK_SLOWQUIT) app.on('before-quit', () => { const t = Date.now(); ilog('slow-quit-begin'); while (Date.now() - t < +process.env.KK_SLOWQUIT) { /* busy */ } });
  if (process.env.KK_AUTODIALOG !== undefined) {
    const { dialog } = require('electron');
    dialog.showMessageBoxSync = (a, b) => {
      const o = b || a; let n = 0; try { n = fs.readFileSync(ILOG, 'utf8').split('\\n').filter((l) => l.includes('"ev":"dialog"')).length; } catch (e) { /* none */ }
      const pick = n >= 4 ? 1 : +process.env.KK_AUTODIALOG; // loop guard: cancel after 4 dialogs
      ilog('dialog', { message: o.message, detail: o.detail, buttons: o.buttons, picked: pick });
      return pick;
    };
  }
}
async function hold() {
  for (let i = 0; i < 80 && !BrowserWindow.getAllWindows()[0]; i++) await sleep(100);
  WIN = BrowserWindow.getAllWindows()[0];
  if (!WIN) { ilog('no-window'); return; }
  ilog('window', { lowGpuSwitch: app.commandLine.hasSwitch('disable-direct-composition') });
  await sleep(3500);
  const live = process.env.KK_DEMO === '1' ? 33 : 77;
  await js(WIN, `window.KKdebug.KK.S.floor = ${live}`); // live, unsaved: does the quit path save it?
  if (process.env.KK_HIDE === '1') { P.toggleVisible(); await sleep(500); }
  ilog('ready', { knight: await js(WIN, KNIGHT_ALPHA), visible: WIN.isVisible(), liveFloor: live });
  await sleep((+process.env.KK_HOLD || 20) * 1000);
  ilog('hold-expired', { visible: !WIN.isDestroyed() && WIN.isVisible() });
}

// ---- R5: seed the probe's save, then compile main.js BEFORE ready""")

rep("""else if (MODE !== 'lsseed') {
  fs.rmSync(path.join(APPDATA, 'Keystroke Keep'), { recursive: true, force: true });
  const lg = process.env.KK_LOWGPU;
  wr(FULL_DIR, F.main, save({ floor: 1, settings: lg === undefined ? {} : { lowGpu: lg !== '0' } }));
}""", """else if (MODE !== 'lsseed' && MODE !== 'noop') {
  // R6: seed only this build's folder (instance tests run a full and a demo probe side by side)
  const demo = process.env.KK_DEMO === '1';
  fs.rmSync(path.join(APPDATA, demo ? 'Keystroke Keep Demo' : 'Keystroke Keep'), { recursive: true, force: true });
  const lg = process.env.KK_LOWGPU; // unset = no lowGpu key = 'auto'
  wr(demo ? DEMO_DIR : FULL_DIR, F.main, save({ floor: 1, demoSave: demo || undefined, settings: lg === undefined ? {} : { lowGpu: lg === 'auto' ? 'auto' : lg !== '0' } }));
}""")

rep("  if (MODE === 'perf') await perf();",
    "  R.hasBattery = P && P.hasBattery ? P.hasBattery() : 'n/a';\n  if (INSTANCE) { if (MODE === 'hold') await hold(); app.exit(0); return; }\n  if (MODE === 'perf') await perf();")
open(p, 'w', encoding='utf8').write(s)
print('patched')
