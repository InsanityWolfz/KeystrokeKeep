// prints a compact table from probe stdout:  ... | node sum.js
let s = ''; process.stdin.on('data', (d) => (s += d)).on('end', () => {
  for (const l of s.split('\n')) {
    const m = /\[probe\] (\S+) (PASS|FAIL)? ?(\{.*)/.exec(l);
    if (!m) { if (/\[probe\] (done|FAILED)/.test(l)) console.log(l); continue; }
    try { const o = JSON.parse(m[3]);
      if (o.kk3d) console.log(m[1].padEnd(44), '3d', o.kk3d.avg, `(${o.kk3d.min}-${o.kk3d.max})`, 'dwm', o.dwm3d && o.dwm3d.avg, 'draws', o.drawPerSec, 'ctx', o.kkCtxSw && Math.round(o.kkCtxSw.avg), 'cpu', o.cpuPct, 'cpuTM', o.cpuMachinePct && o.cpuMachinePct.avg, 'gpuAll', o.kkGpuAll && o.kkGpuAll.avg, 'sys3d', o.sys3d && o.sys3d.avg, 'dwmCpu', o.dwmCpuMachinePct && o.dwmCpuMachinePct.avg, 'dom', o.domMutationsPerSec, 'anims', o.runningAnims, 'inner', o.inner, 'priv', o.privMB);
      else console.log(m[1].padEnd(52), m[2] || '', o.result ? `${o.expect}->${o.result} hid@${o.hiddenAfterS} back@${o.backAfterS} q${o.qunsSeen} by=${o.decidedBy ? o.decidedBy.cls + (o.decidedBy.covers ? '[covers]' : '') + (o.decidedBy.topmost ? '[top]' : '') : '-'}` : JSON.stringify(o).slice(0, 300));
    } catch (e) { console.log(l.slice(0, 200)); }
  }
});
