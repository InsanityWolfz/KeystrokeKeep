// Round 06 auditor: side-by-side table of the batch outputs in out/ (base, fixes, sig, week2, all).
// node docs/playtest/round-06/compare.js [tags...]
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'out');
const tags = process.argv.slice(2).length ? process.argv.slice(2) : ['base', 'fixes', 'sig', 'week2', 'all'];
const runs = ['typist_s1_480', 'typist_s2_480', 'typist_s3_480', 'idle_s1_480', 'idle_s2_480', 'burst_s1_480', 'heavy_s1_480', 'light_s1_480', 'typist_s1_2400', 'typist_s2_2400', 'idle_s1_2400', 'light_s1_2400'];
const demos = ['typist_s1_180', 'typist_s2_180', 'idle_s1_180', 'burst_s1_180'];
const get = (txt, re) => { const m = txt.match(re); return m ? m[1] : '-'; };
const rows = [];
for (const r of runs) {
  const cells = [r.padEnd(15)];
  for (const tag of tags) {
    const f = path.join(dir, `${tag}_${r}.txt`);
    if (!fs.existsSync(f)) { cells.push('n/a'.padEnd(34)); continue; }
    const t = fs.readFileSync(f, 'utf8');
    const max = get(t, /maxEver (\d+)/), wipes = get(t, /wipes (\d+)/), ach = get(t, /ach (\d+)\//), enr = get(t, /"bossEnrage":(\d+)/);
    let w2 = '';
    if (r.endsWith('2400')) w2 = ` b8+ ${get(t, /AFTER 8h: (\d+) beats/)} gap ${get(t, /longest gap (\d+) min/)}m`;
    cells.push(`f${max} w${wipes} e${enr} a${ach}${w2}`.padEnd(34));
  }
  rows.push(cells.join('| '));
}
for (const r of demos) {
  const cells = [('demo ' + r).padEnd(15)];
  for (const tag of tags) {
    const f = path.join(dir, `${tag}demo_${r}.txt`);
    if (!fs.existsSync(f)) { cells.push('n/a'.padEnd(34)); continue; }
    const t = fs.readFileSync(f, 'utf8');
    cells.push(`best ${get(t, /best ([\d.]+)m/)}m card ${get(t, /card (\S+),/)} laps ${get(t, /laps (\d+)/)} w${get(t, /wipes (\d+)/)}`.padEnd(34));
  }
  rows.push(cells.join('| '));
}
console.log(''.padEnd(15) + '| ' + tags.map((x) => x.padEnd(34)).join('| '));
console.log(rows.join('\n'));
