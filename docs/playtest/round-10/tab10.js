// Round 10 auditor: compact per-run table from out/*.json + .txt
const fs = require('fs'); const H = 3600;
const hh = (x) => (x === undefined || x === null ? '-' : (x / H).toFixed(1));
const pctTop = (m) => { const s = Object.values(m || {}).reduce((a, b) => a + b, 0); if (!s) return '-'; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k.replace('The ', '') + ' ' + Math.round(100 * v / s)).join(', '); };
for (const f of fs.readdirSync('out').filter((x) => /^(n40|o40|n80|d40|do40)_.*\.json$/.test(x)).sort()) {
  const j = JSON.parse(fs.readFileSync('out/' + f)); const P = j.r10, txt = fs.readFileSync('out/' + f.replace('.json', '.txt'), 'utf8');
  const g = (re) => { const m = txt.match(re); return m ? m[1] : '-'; };
  const fs2 = P.firstSeen;
  const codexDone = j.ach.codex28;
  // last new visual: first sighting of any non-tinted creature or biome name
  const vis = Object.entries(fs2).filter(([k]) => !k.startsWith('H-') && !k.startsWith('E-') && k !== 'HEART').map(([, v]) => v).concat(Object.values(P.firstBiome));
  console.log(`${f.replace('.json', '').padEnd(14)} maxEver ${j.end.maxEver} | after8h ${pctTop(P.biomeW.b)} | pal ${pctTop(P.pal.b)} | lasher ${hh(fs2.lasher)} warden ${hh(fs2.warden)} rootm ${hh(fs2.rootmother)} keeper ${hh(fs2.keeper)} echo1 ${hh(P.firstBiome['Echoed Crypt'])} lastNewVisual ${hh(Math.max(...vis))} | Hw/Hb/He/Hm ${hh(fs2['H-warlord'])}/${hh(fs2['H-broodmother'])}/${hh(fs2['H-embergolem'])}/${hh(fs2['H-magmalord'])} | ach ${j.end.achN}/${j.end.achTotal} keeperA ${hh(j.ach.keeper)} f150 ${hh(j.ach.f150)} e175 ${hh(j.ach.echo175)} h6 ${hh(j.ach.hollowed6)} codex40 ${hh(codexDone)} codexN ${j.codex.length} | gap8+ ${g(/longest gap (\d+) min/)}m empty2h ${g(/empty 2h windows (\d+\/\d+)/)} norecord ${g(/no new depth record[^:]*: ([\d.]+) h/)}h`);
}
