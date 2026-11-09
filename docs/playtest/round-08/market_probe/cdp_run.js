// R8 market: drive one capture-mode run of the dev shell over the Chrome DevTools Protocol (no key injection, no desktop
// screenshots): renderer probe + Page.captureScreenshot of the strip, main-process checks over the node inspector.
// Uses the capture profile (<userData>-capture) like any KK_CAPTURE run; never the real save.
// node cdp_run.js --name t2 --save <save.json> --script <cues.json> --secs 20 [--env KK_DEMO=1,KK_CAPTURE_BG=#00ff00]
//                 [--shots 3,6.5] [--eval "4:KK.S.floor"] [--main "5:require('electron').globalShortcut.isRegistered('Control+Shift+Alt+8')"]
//                 [--hot "8:8,11:8"]   (sends kk:capture <digit> from the main process = what the global hotkey does)
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..', '..');
const OUT = path.join(__dirname, 'out');
const a = process.argv.slice(2); const arg = (k, d) => { const i = a.indexOf('--' + k); return i < 0 ? d : a[i + 1]; };
const name = arg('name', 'run'), secs = +arg('secs', 20);
const env = Object.assign({}, process.env, { KK_CAPTURE: '1', KK_CAPTURE_SAVE: arg('save', ''), KK_CAPTURE_SCRIPT: arg('script', '') });
for (const kv of (arg('env', '') || '').split(',').filter(Boolean)) { const i = kv.indexOf('='); env[kv.slice(0, i)] = kv.slice(i + 1); }
const list = (k) => (arg(k, '') || '').split(/,(?=\d)/).filter(Boolean).map((x) => { const i = x.indexOf(':'); return i < 0 ? { t: +x } : { t: +x.slice(0, i), v: x.slice(i + 1) }; });
const shots = list('shots'), evals = list('eval'), mains = list('main'), hots = list('hot');
const log = []; const L = (m) => { const s = `${((Date.now() - T0) / 1000).toFixed(1).padStart(5)}s ${m}`; log.push(s); };
const PROBE = fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8');
let T0 = Date.now();
const child = spawn(path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'), ['--inspect=9230', '--remote-debugging-port=9231', '.'], { cwd: ROOT, env });
child.stdout.on('data', (d) => String(d).split(/\r?\n/).filter(Boolean).forEach((l) => L('[main] ' + l)));
child.stderr.on('data', (d) => String(d).split(/\r?\n/).filter((l) => l && !/Debugger listening|For help|deprecated|DevTools listening/.test(l)).forEach((l) => L('[stderr] ' + l)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect(port, pick) {
  for (let i = 0; i < 80; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const t = j.find(pick); if (t) return client(t.webSocketDebuggerUrl); } catch (e) { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('no target on ' + port);
}
function client(url) {
  const ws = new WebSocket(url); let id = 0; const pend = {}; const on = {};
  ws.onmessage = (m) => { const o = JSON.parse(m.data); if (o.id && pend[o.id]) { pend[o.id](o); delete pend[o.id]; } else if (o.method && on[o.method]) on[o.method](o.params); };
  const c = { send: (method, params = {}) => new Promise((r) => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); }), on: (m, f) => { on[m] = f; }, close: () => ws.close() };
  return new Promise((r) => { ws.onopen = () => r(c); });
}
const evalIn = async (c, expr) => { const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? JSON.stringify(r.result.result.value) : JSON.stringify(r.result || r.error); };
(async () => {
  const main = await connect(9230, () => true).catch((e) => { L('main inspector: ' + e.message); return null; });
  if (main) await main.send('Runtime.enable');
  const page = await connect(9231, (t) => t.type === 'page');
  await page.send('Runtime.enable');
  page.on('Runtime.consoleAPICalled', (p) => { const s = p.args.map((x) => x.value !== undefined ? x.value : x.description).join(' '); if (!/^\[capture\]/.test(s)) L('[console.' + p.type + '] ' + s); });
  page.on('Runtime.exceptionThrown', (p) => L('[exception] ' + JSON.stringify(p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text)));
  // wait for boot, then install the probe
  for (let i = 0; i < 100; i++) { const b = await evalIn(page, 'typeof KK !== "undefined" && !!KK.booted'); if (b === 'true') break; await sleep(100); }
  L('booted; probe: ' + await evalIn(page, PROBE));
  const jobs = [
    ...shots.map((s) => ({ t: s.t, f: async () => { const r = await page.send('Page.captureScreenshot', { format: 'png' }); const f = path.join(OUT, `${name}_${s.t}.png`); fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); L('shot ' + path.basename(f)); } })),
    ...evals.map((e) => ({ t: e.t, f: async () => L('eval ' + e.v + ' => ' + await evalIn(page, e.v)) })),
    ...mains.map((e) => ({ t: e.t, f: async () => L('main ' + e.v + ' => ' + (main ? await evalIn(main, e.v) : 'n/a')) })),
    ...hots.map((h) => ({ t: h.t, f: async () => L('hotkey ' + h.v + ' (main send kk:capture) => ' + (main ? await evalIn(main, `(()=>{const w=process.mainModule.require('electron').BrowserWindow.getAllWindows()[0]; w.webContents.send('kk:capture', ${+h.v}); return true})()`) : 'n/a')) })),
  ].sort((x, y) => x.t - y.t);
  for (const j of jobs) { const w = j.t * 1000 - (Date.now() - T0); if (w > 0) await sleep(w); try { await j.f(); } catch (e) { L('job error ' + e.message); } }
  const rest = secs * 1000 - (Date.now() - T0); if (rest > 0) await sleep(rest);
  try { if (main) await evalIn(main, "process.mainModule.require('electron').app.exit(0)"); } catch (e) { /* closing */ }
  await sleep(800); try { child.kill(); } catch (e) { /* gone */ }
  fs.writeFileSync(path.join(OUT, name + '.log.txt'), log.join('\n'));
  console.log(log.join('\n'));
  process.exit(0);
})().catch((e) => { L('FATAL ' + e.stack); try { child.kill(); } catch (x) { /* */ } fs.writeFileSync(path.join(OUT, name + '.log.txt'), log.join('\n')); console.log(log.join('\n')); process.exit(1); });
