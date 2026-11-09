// hours-to-X for the 35-day calendar model. node aggmonth.js out/month.jsonl
const fs = require('fs');
const rows = fs.readFileSync(require('path').join(__dirname, process.argv[2]), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const f = (x) => (x == null ? 'never' : x.toFixed(1));
// hours played at the end of day d: 8 + 4(d-1)
const dayOfH = (h) => (h <= 8 ? 1 : 1 + Math.ceil((h - 8) / 4));
for (const cfg of [...new Set(rows.map((r) => r.cfg))]) for (const prof of ['typist', 'burst', 'idle']) {
  const R = rows.filter((r) => r.cfg === cfg && r.prof === prof); if (!R.length) continue;
  console.log(`\n== ${cfg}/${prof} (${R.length} seeds) final floor ${R.map((r) => r.final.floor).join(',')}  ach ${R.map((r) => r.final.achN).join(',')}/${R[0].final.achTotal}  omens ${R.map((r) => r.final.omens).join(',')}  relics ${R.map((r) => r.final.seenRelic).join(',')}`);
  const ids = R[0].final.ach.concat(R[0].final.missing);
  const all = [...new Set(R.flatMap((r) => Object.keys(r.final.achT)).concat(ids))];
  const t = all.map((id) => [id, med(R.map((r) => r.final.achT[id] ?? null)), R.filter((r) => r.final.achT[id] != null).length]).sort((a, b) => (a[1] ?? 1e9) - (b[1] ?? 1e9));
  console.log(t.map(([id, h, n]) => `${id} ${f(h)}h${n < R.length ? '(' + n + '/' + R.length + ')' : ''}`).join('  '));
  // seen everything: last new boss + all 4 biomes
  const seen = R.map((r) => { let last = 0; for (const d of r.days) if ((d.ev.newBoss || []).length || (d.ev.biome || []).length) last = d.day; return last; });
  console.log('last new boss/biome on day', seen.join(','), ' f100(Heart) h', R.map((r) => f(r.final.achT.f100)).join(','), ' hollowed6 h', R.map((r) => f(r.final.achT.hollowed6)).join(','));
  // trophies end (f200), codex end
  const trEnd = R.map((r) => { for (const d of r.days) if ((d.ev.trophy || []).includes(200)) return d.day; return null; });
  const cxEnd = R.map((r) => { for (const d of r.days) if ((d.ev.codex || []).includes(28)) return d.day; return null; });
  console.log('trophy f200 on day', trEnd.join(','), ' codex 28 on day', cxEnd.join(','));
  // per-day milestones count after day 7
  const MILE = ['trophy', 'codex', 'ach', 'newBoss', 'biome', 'newOmen', 'legacyMax', 'wsMax'];
  const row = [];
  for (let d = 1; d <= R[0].days.length; d++) { const ds = R.map((r) => r.days[d - 1]); row.push(d + ':' + (ds.reduce((a, x) => a + MILE.reduce((b, k) => b + (x.ev[k] || []).length, 0), 0) / R.length).toFixed(1) + '/f' + Math.round(ds.reduce((a, x) => a + x.floor1, 0) / R.length) + '/r' + Math.round(ds.reduce((a, x) => a + x.ren1 - x.ren0, 0) / R.length)); }
  console.log('day:milestones/floor/renown+ ', row.join(' '));
  const dead = R.map((r) => r.days.filter((x) => !MILE.some((k) => (x.ev[k] || []).length)).map((x) => x.day));
  console.log('days with no milestone (Seal excluded):', dead.map((x) => x.length + '[' + (x[0] || '-') + '..]').join(' '));
}
