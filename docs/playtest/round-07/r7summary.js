// Round 07: summary() copied from round-06/r6probe.js (that file runs on require).
const { fmtT, buckets, gap, med } = require('../round-06/r6lib');
function summary(R, o, args) {
  const L = [], H = 3600, end = R.end.t, E = R.end;
  L.push(`=== R6 probe ${o.profile} s${o.seed} ${o.min}m${o.demo ? ' DEMO' : ''}${args.proto ? ' PROTO=' + args.proto : ''}: maxEver ${E.maxEver}, retires ${E.retires}, renown life ${E.renownLife}, ach ${E.achN}/${E.achTotal}, trophies ${E.trophies}, codex ${R.codex.length}/28, wipes ${R.KK.S.stats.wipes}, fame x${E.fame.toFixed(1)}, unspent embers ${Math.round(E.embers)}`);
  const kinds = (ks) => R.nov.filter((n) => ks.includes(n.kind));
  const beats = kinds(['MAJOR', 'OMEN', 'TROPHY', 'ACH', 'CODEX', 'SEAL', 'LANTERN', 'TROPHY2']);
  if (!args.quiet) for (const n of R.nov) L.push(`  ${fmtT(n.t)}  ${n.kind.padEnd(7)} ${n.label}`);
  L.push(`beats per 30 min from h1: ${buckets(beats, 1800, H, end).join(' ')}`);
  if (end > 8 * H) {
    const after8 = beats.filter((b) => b.t >= 8 * H);
    const g = gap(beats, 8 * H, end);
    const byKind = {}; for (const b of after8) byKind[b.kind] = (byKind[b.kind] || 0) + 1;
    L.push(`AFTER 8h: ${after8.length} beats ${JSON.stringify(byKind)}; longest gap ${(g.g / 60).toFixed(0)} min (from ${fmtT(g.at)}); empty 2h windows ${buckets(beats, 7200, 8 * H, end).filter((x) => !x).length}/${Math.ceil((end - 8 * H) / 7200)}`);
    const recs = []; let best = 0, lastRecT = 0, worst = 0, worstAt = 0;
    for (const x of R.hs) { if (x.maxEver > best) { if (x.t - lastRecT > worst) { worst = x.t - lastRecT; worstAt = lastRecT; } best = x.maxEver; lastRecT = x.t; } }
    if (end - lastRecT > worst) { worst = end - lastRecT; worstAt = lastRecT; }
    L.push(`longest stretch with no new depth record (30-min snapshots): ${(worst / H).toFixed(1)} h from ${fmtT(worstAt)}`);
  } else {
    const g = gap(beats, H, end);
    L.push(`longest gap after h1: ${(g.g / 60).toFixed(0)} min (from ${fmtT(g.at)})`);
  }
  L.push(`codex: ${R.codex.map((c) => fmtT(c.t) + ' ' + c.name.replace('The Hollowed ', 'H-') + ' r' + c.rank).join(', ') || 'none'}`);
  L.push(`trophies: ${R.trophies.map((x) => 'f' + x.floor + '@' + fmtT(x.t)).join(' ')}`);
  L.push(`retires (${R.retires.length}): ${R.retires.slice(0, 40).map((r) => fmtT(r.t) + ' f' + r.from + ' +' + r.gain).join(', ')}${R.retires.length > 40 ? ' ...' : ''}`);
  L.push(`SIG totals: ${JSON.stringify(R.sigTotals)}`);
  const byKey = {};
  for (const f of R.boss) { const k = (f.heart ? 'HEART' : f.hollowed ? 'H-' : '') + (f.heart ? '' : f.key); (byKey[k] = byKey[k] || []).push(f); }
  L.push('BOSS (key: n | kills | wipes | enrage | med active-dur s | med swings | sig events per fight [median, % fights >=1] | first sig at s)');
  for (const [k, fs] of Object.entries(byKey)) {
    const kills = fs.filter((f) => f.how === 'kill');
    const sigNames = [...new Set(fs.flatMap((f) => Object.keys(f.sig)))].filter((n) => n !== 'bossEnrage');
    const sigTxt = sigNames.map((n) => `${n} ${med(fs.map((f) => f.sig[n] || 0))} [${(100 * fs.filter((f) => f.sig[n]).length / fs.length).toFixed(0)}%] @${med(fs.filter((f) => f.sigFirst[n] !== undefined).map((f) => f.sigFirst[n])).toFixed(1)}`).join('; ');
    const enr = fs.filter((f) => f.sig.bossEnrage).length;
    let extra = '';
    if (k.endsWith('boneking')) { const a = kills.filter((f) => f.afterReass !== null).map((f) => f.afterReass); extra = ` | rise->death med ${med(a).toFixed(2)}s, <0.5s ${a.filter((x) => x < 0.5).length}/${a.length}, <1.5s(still stunned) ${a.filter((x) => x < 1.5).length}/${a.length}`; }
    if (k.endsWith('warlord')) { extra = ` | died mid-charge ${kills.filter((f) => f.midCharge).length}/${kills.length}, fights with 0 charges ${fs.filter((f) => !f.sig.warCharge).length}/${fs.length}`; }
    L.push(`  ${k.padEnd(14)} ${String(fs.length).padStart(4)} | ${String(kills.length).padStart(4)} | ${String(fs.filter((f) => f.how === 'wipe').length).padStart(3)} | ${String(enr).padStart(3)} | ${med(kills.map((f) => f.adur)).toFixed(1).padStart(6)} | ${String(med(fs.map((f) => f.swings))).padStart(3)} | ${sigTxt}${extra}`);
  }
  if (o.demo) L.push(`DEMO: card ${fmtT(R.demo.cardAt)}, laps ${E.demoLaps}, re-delves ${R.demo.redelves}, lifetime ${E.renownLife}, best ${(E.bestCapTime / 60).toFixed(1)}m`);
  const achList = R.KK.ach.LIST;
  L.push('ACH: ' + achList.map((a) => `${a.id} ${R.ach[a.id] !== undefined ? fmtT(R.ach[a.id]) : 'NO'}`).join(' | '));
  if (R.proto) for (const line of R.proto) L.push('PROTO ' + line);
  return L;
}
module.exports = { summary };
