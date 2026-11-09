// R5 market: table of out/perf_<tag>.json runs.  node docs/playtest/round-06/market_probe/perf_table.js
const fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'out');
const files = fs.readdirSync(OUT).filter((f) => /^perf_.+\.json$/.test(f)).sort();
const f2 = (v) => (v === undefined || v === null ? '-' : typeof v === 'number' ? v.toFixed(2) : v);
console.log(['run', 'phase', 'kk3d', '(min-max)', 'dwm3d', 'sys3d', 'cpu1core%', 'cpuTM%', 'dwmCpu1core%', 'ctxsw/s', 'draws/s', 'fps', 'privMB', 'switch', 'knight'].join('\t'));
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  const knight = r.knightAlphaAfterRebake !== undefined ? r.knightAlphaAfterRebake : r.knightAlphaAtBoot;
  for (const [ph, o] of Object.entries(r.phases || {})) {
    console.log([f.replace(/^perf_|\.json$/g, ''), ph, f2(o.kk3d && o.kk3d.avg), o.kk3d ? `${o.kk3d.min}-${o.kk3d.max}` : '-', f2(o.dwm3d && o.dwm3d.avg), f2(o.sys3d && o.sys3d.avg), f2(o.cpuOneCorePct && o.cpuOneCorePct.avg), f2(o.cpuMachinePct && o.cpuMachinePct.avg), f2(o.dwmCpuOneCorePct && o.dwmCpuOneCorePct.avg), o.kkCtxSw ? Math.round(o.kkCtxSw.avg) : '-', o.drawPerSec, o.targetFps, o.privMB, r.lowGpuSwitch, knight].join('\t'));
  }
}
