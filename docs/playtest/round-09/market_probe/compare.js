// R9 market: reproducibility across takes. node compare.js
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'out', 'shots');
const KEY = /^(BANNER|ALERT|MODAL|bossSpawn|magmaShell|shellCrack|kill BOSS|meteorLand|fervorTier|relicOffer|relicPicked|glimpse|glimpseDoor|demoComplete|floor|ult|TOAST)/;
const rows = [];
for (const shot of ['g1', 's3', 's4', 'g2', 'g5']) for (const mode of ['wall', 'det', 'detq', 'new', 'newb']) {
  const takes = [1, 2, 3].map((i) => { try { return JSON.parse(fs.readFileSync(path.join(D, `${shot}_${mode}${i}.json`), 'utf8')); } catch (e) { return null; } }).filter(Boolean);
  if (!takes.length) continue;
  const pages = takes.map((t) => t.page || { ev: [], dig: [], hashes: [] });
  // key events: first occurrence of each event label (with nth index)
  const occ = pages.map((p) => { const c = {}; const m = new Map(); for (const e of p.ev) { if (!KEY.test(e.e) || /^cue/.test(e.e)) continue; const k = e.e + ' #' + (c[e.e] = (c[e.e] || 0) + 1); m.set(k, e); } return m; });
  const all = new Set(); occ.forEach((m) => m.forEach((_v, k) => all.add(k)));
  let inAll = 0, maxSpreadMs = 0, maxSpreadF = 0; const spreads = [];
  for (const k of all) {
    const es = occ.map((m) => m.get(k)); if (es.some((e) => !e)) continue; inAll++;
    const rs = es.map((e) => e.r), fs_ = es.map((e) => e.f);
    const sr = Math.max(...rs) - Math.min(...rs), sf = Math.max(...fs_) - Math.min(...fs_);
    spreads.push([k, sr, sf, rs]); maxSpreadMs = Math.max(maxSpreadMs, sr); maxSpreadF = Math.max(maxSpreadF, sf);
  }
  const notInAll = [...all].filter((k) => occ.some((m) => !m.get(k)));
  const digEq = (() => { const a = pages.map((p) => p.dig || []); const n = Math.min(...a.map((x) => x.length)); let eq = 0; let firstDiff = null; for (let i = 0; i < n; i++) { if (a.every((x) => x[i] === a[0][i])) eq++; else if (firstDiff === null) firstDiff = a[0][i].split('|')[0]; } return `${eq}/${n}` + (firstDiff !== null ? ` (first diff @frame ${firstDiff})` : ''); })();
  const hashEq = (() => { const a = pages.map((p) => p.hashes || []); const n = Math.min(...a.map((x) => x.length)); let eq = 0; for (let i = 0; i < n; i++) if (a.every((x) => x[i] && x[i][1] === a[0][i][1])) eq++; return `${eq}/${n}`; })();
  const offers = pages.map((p) => (p.ev.find((e) => /^relicOffer/.test(e.e)) || {}).e || '').join(' ; ');
  const fps = pages.map((p) => { const f = (p.fpsReal || []).slice(1); return f.length ? Math.min(...f) + '-' + Math.max(...f) : '?'; }).join(',');
  rows.push({ shot, mode, takes: takes.length, aborts: takes.map((t) => t.abortReason).filter(Boolean).length, keyEventsInAll: inAll, onlyInSome: notInAll.length, maxSpreadMs, maxSpreadFrames: maxSpreadF, stateDigestsEqual: digEq, canvasHashesEqual: hashEq, fpsReal: fps, offers: shot === 's3' ? offers : '' });
  if (process.argv[2] === shot + mode) { spreads.sort((x, y) => y[1] - x[1]); console.log(spreads.slice(0, 25).map((s) => `${s[0]}: spread ${s[1]} ms / ${s[2]} f  ${JSON.stringify(s[3])}`).join('\n')); console.log('only in some:', notInAll.slice(0, 20)); }
}
console.table(rows);
