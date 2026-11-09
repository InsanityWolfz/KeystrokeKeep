// Round 05 auditor: one r5lib run with a readable summary.
// node docs/playtest/round-05/r5probe.js [--profile typist|idle|burst|heavy|light] [--min 480] [--seed 1] [--retire nudge|stall] [--omen random|first|none|new] [--demo] [--quiet]
const { run, fmtT, buckets, gap, med } = require('./r5lib');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } } }
const o = { profile: args.profile || 'typist', min: +args.min || 480, seed: +args.seed || 1, retire: args.retire || 'nudge', omen: args.omen || 'random', demo: !!args.demo };
const R = run(o);
const L = [], H = 3600, end = R.end.t, E = R.end;
L.push(`=== R5 probe ${o.profile} s${o.seed} ${o.min}m retire=${o.retire} omen=${o.omen}${o.demo ? ' DEMO' : ''}: maxEver ${E.maxEver}, retires ${E.retires}, renown life ${E.renownLife} (unspent ${E.renown}), keys ${E.keys}, FLOW ${(E.flow / 60).toFixed(0)}m, ults ${E.ults}, trophies ${E.trophies}, ach ${E.achN}/${E.achTotal}, fame x${E.fame.toFixed(1)}`);
const major = R.nov.filter((n) => n.kind === 'MAJOR'), omenN = R.nov.filter((n) => n.kind === 'OMEN'), tro = R.nov.filter((n) => n.kind === 'TROPHY'), ach = R.nov.filter((n) => n.kind === 'ACH');
if (!args.quiet) for (const n of R.nov) L.push(`  ${fmtT(n.t)}  ${n.kind.padEnd(6)} ${n.label}`);
const all3 = [...major, ...omenN, ...tro];
L.push(`per 30 min from h1: MAJOR            ${buckets(major, 1800, H, end).join(' ')}`);
L.push(`per 30 min from h1: +OMEN+TROPHY     ${buckets(all3, 1800, H, end).join(' ')}`);
L.push(`per 30 min from h1: +ACH             ${buckets([...all3, ...ach], 1800, H, end).join(' ')}`);
const emptyWin = (list, a, b) => buckets(list, 1800, a * H, Math.min(end, b * H)).filter((x) => x === 0).length;
L.push(`empty 30-min windows h2-5 / h5-8 / h8-end: no ACH ${emptyWin(all3, 1, 5)}/8 ${emptyWin(all3, 5, 8)}/6 ${end > 8 * H ? emptyWin(all3, 8, end / H) : '-'} | with ACH ${emptyWin([...all3, ...ach], 1, 5)}/8 ${emptyWin([...all3, ...ach], 5, 8)}/6 ${end > 8 * H ? emptyWin([...all3, ...ach], 8, end / H) + '/' + Math.ceil((end - 8 * H) / 1800) : '-'}`);
const g2 = gap(all3, H, end), g3 = gap([...all3, ...ach], H, end);
L.push(`longest gap after h1: maj+omen+trophy ${(g2.g / 60).toFixed(0)}m (from ${fmtT(g2.at)}) | +ach ${(g3.g / 60).toFixed(0)}m (from ${fmtT(g3.at)})`);
L.push(`last MAJOR ${fmtT(major.length ? major[major.length - 1].t : null)}; last new OMEN ${omenN.length ? fmtT(omenN[omenN.length - 1].t) : '—'} (${omenN.length}); trophies ${R.trophies.map((x) => 'f' + x.floor + '@' + fmtT(x.t)).join(' ')}`);
L.push(`retires (${R.retires.length}): ${R.retires.map((r) => fmtT(r.t) + ' f' + r.from + ' +' + r.gain).join(', ')}`);
const sc = R.sanct;
L.push(`SANCTUARY: casts ${sc.casts} (${(sc.casts / (end / H)).toFixed(1)}/h; boss fights ${sc.bossCasts}), revives ${sc.revives}; fights with Pell ${sc.fights}, with a cast ${sc.fightsCast} (${(100 * sc.fightsCast / Math.max(1, sc.fights)).toFixed(0)}%), reaching 4 swings ${sc.fightsReach4}`);
L.push(`SECOND WIND: lvl ${E.workshop.kindling || 0}, triggers ${R.sw.triggers}, bonus Sparks ${R.sw.bonusSparks} of ${R.sw.sparksTotal} (${(100 * R.sw.bonusSparks / Math.max(1, R.sw.sparksTotal)).toFixed(1)}%)`);
L.push(`EMBERS: ult ${R.embers.ult.toFixed(0)}, boss ${R.embers.boss.toFixed(0)}, rat ${R.embers.rat.toFixed(0)}, unspent ${E.embers.toFixed(0)}`);
L.push(`SATURATION: capped Legacy all max ${fmtT(R.sat.legacyCappedAll)}, Workshop capped all max ${fmtT(R.sat.workshopCappedAll)}, Head Start 8 ${fmtT(R.sat.hsMax)}`);
// boss telemetry
const byKey = {};
for (const f of R.boss) { const k = (f.hollowed ? 'H-' : '') + f.key; (byKey[k] = byKey[k] || []).push(f); }
L.push('BOSS FIGHTS (key: n | kills | wipes | median dur s | median swings | % reaching swing 4 | n per hour bucket h0..):');
for (const [k, fs] of Object.entries(byKey)) {
  const kills = fs.filter((f) => f.how === 'kill');
  const hb = []; for (let h = 0; h < Math.ceil(end / H); h++) hb.push(fs.filter((f) => f.t0 >= h * H && f.t0 < (h + 1) * H).length);
  L.push(`  ${k.padEnd(14)} ${String(fs.length).padStart(4)} | ${String(kills.length).padStart(4)} | ${String(fs.filter((f) => f.how === 'wipe').length).padStart(3)} | ${med(kills.map((f) => f.dur)).toFixed(1).padStart(6)} | ${String(med(fs.map((f) => f.swings))).padStart(3)} | ${(100 * fs.filter((f) => f.swings >= 4).length / fs.length).toFixed(0).padStart(3)}% | ${hb.join(' ')}`);
}
L.push('per 30 min snapshot (t hs startFloor maxEver renown life ach trophies): ' + R.hs.map((x) => `${fmtT(x.t)} hs${x.hs} f${x.start} max${x.maxEver} r${x.renown}/${x.life} a${x.ach} t${x.tro}`).join(' | '));
if (o.demo) L.push(`DEMO: card ${fmtT(R.demo.cardAt)}, laps ${E.demoLaps}, sealed ${R.demo.sealed.length}, re-delves ${R.demo.redelves}, Renown after card +${R.demo.renownAfter}, lifetime ${E.renownLife}, best ${(E.bestCapTime / 60).toFixed(1)}m; retire() return values: ${JSON.stringify(R.demo.retireReturns)}`);
const achList = R.KK.ach.LIST;
L.push('ACH: ' + achList.map((a) => `${a.id} ${R.ach[a.id] !== undefined ? fmtT(R.ach[a.id]) : 'NO'}`).join(' | '));
L.push(`end heroes ${JSON.stringify(E.heroes)} workshop ${JSON.stringify(E.workshop)} legacy ${JSON.stringify(E.legacy)}`);
console.log(L.join('\n'));
if (args.json) { const out = Object.assign({}, R); delete out.KK; require('fs').writeFileSync(args.json, JSON.stringify(out)); }
