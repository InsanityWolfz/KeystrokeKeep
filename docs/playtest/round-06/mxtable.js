// prints the per-move matrix from out/mx_*.txt (maxEver / wipes / enrages per run)
const fs = require('fs'), path = require('path'); const dir = path.join(__dirname, 'out');
const cfgs = (process.argv[2] || 'fixes,rat,rathp,web,shell,shell54,lava,lava5,final').split(',');
const runs = ['typist_s1_480', 'typist_s2_480', 'idle_s1_480', 'idle_s2_480', 'light_s1_480', 'burst_s1_480', 'idle_s1_2400', 'light_s1_2400', 'typist_s1_2400'];
console.log('cfg'.padEnd(9) + runs.map((r) => r.padEnd(16)).join(''));
for (const c of cfgs) {
  let line = c.padEnd(9);
  for (const r of runs) { const f = path.join(dir, `mx_${c}_${r}.txt`); if (!fs.existsSync(f)) { line += '-'.padEnd(16); continue; } const t = fs.readFileSync(f, 'utf8');
    line += `f${t.match(/maxEver (\d+)/)[1]} w${t.match(/wipes (\d+)/)[1]} e${(t.match(/"bossEnrage":(\d+)/) || [0, '?'])[1]}`.padEnd(16); }
  console.log(line);
}
