// Round 04 auditor: one run of r4lib with a readable summary.
// node docs/playtest/round-04/r4probe.js [--profile typist|idle|burst|heavy|light] [--min 480] [--seed 1] [--retire nudge|stall] [--omen random|first|none|new] [--demo] [--quiet] [--json out.json]
const { run, ACH, fmtT, buckets, gap } = require('./r4lib');
const args = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[k] = true; else { args[k] = v; i++; } } }
const o = { profile: args.profile || 'typist', min: +args.min || 480, seed: +args.seed || 1, retire: args.retire || 'nudge', omen: args.omen || 'random', demo: !!args.demo };
const R = run(o);
const L = [];
const end = R.end.t;
L.push(`=== R4 probe ${o.profile} s${o.seed} ${o.min}m retire=${o.retire} omen=${o.omen}${o.demo ? ' DEMO' : ''}: maxEver ${R.end.maxEver}, retires ${R.end.retires}, renown ${R.end.renownLife}, keys ${R.end.keys}, FLOW ${(R.end.flow / 60).toFixed(0)}m, ults ${R.end.ults}, kills ${R.end.kills}, gold ${R.end.gold.toExponential(2)}, fame x${R.end.fame.toFixed(1)}`);
const major = R.nov.filter((n) => n.kind === 'MAJOR'), omenN = R.nov.filter((n) => n.kind === 'OMEN');
const achEv = Object.entries(R.ach).map(([id, at]) => ({ t: at, id }));
if (!args.quiet) for (const n of R.nov.filter((n) => n.kind !== 'minor')) L.push(`  ${fmtT(n.t)}  ${n.kind.padEnd(5)} ${n.label}`);
const H = 3600;
L.push(`MAJOR per 30 min h1-end:           ${buckets(major, 1800, H, end).join(' ')}`);
L.push(`MAJOR+OMEN per 30 min h1-end:      ${buckets([...major, ...omenN], 1800, H, end).join(' ')}`);
L.push(`MAJOR+OMEN+ACH per 30 min h1-end:  ${buckets([...major, ...omenN, ...achEv], 1800, H, end).join(' ')}`);
const g1 = gap(major, H, end), g2 = gap([...major, ...omenN], H, end), g3 = gap([...major, ...omenN, ...achEv], H, end);
L.push(`longest gap after h1: MAJOR ${(g1.g / 60).toFixed(0)}m (from ${fmtT(g1.at)}) | +OMEN ${(g2.g / 60).toFixed(0)}m (from ${fmtT(g2.at)}) | +ACH ${(g3.g / 60).toFixed(0)}m (from ${fmtT(g3.at)})`);
L.push(`last MAJOR ${fmtT(major[major.length - 1].t)}; last new OMEN ${omenN.length ? fmtT(omenN[omenN.length - 1].t) : '—'} (${omenN.length} distinct omens picked)`);
L.push(`retires: ${R.retires.map((r) => fmtT(r.t) + ' f' + r.from + ' +' + r.gain).join(', ')}`);
L.push(`floors first reached: ${Object.entries(R.floorsFirst).map(([f, at]) => f + '@' + fmtT(at)).join(' ')}`);
L.push(`f70 bosses: ${R.f70.map((b) => fmtT(b.t) + ' r' + b.r + ' ' + b.n).join(' | ')}`);
const s = R.sanct;
L.push(`SANCTUARY: casts ${s.casts} (in boss fights ${s.bossCasts}), revives ${s.revives}; boss fights with Pell ${s.fights}, with a cast ${s.fightsCast}; hard fights (KO/wipe/slam<50%) ${s.hardFights}, with a cast ${s.hardCast}; heroDowns with Pell ${s.heroDownWithPell}, slams leaving <50% ${s.slamsUnder50}, wipes with Pell ${s.wipesWithPell}; fights where nobody dropped below 50%: ${s.noTouch}/${s.fights}; party min HP when boss crosses 50%: median ${s.at50.length ? s.at50.slice().sort((a, b) => a - b)[Math.floor(s.at50.length / 2)].toFixed(2) : '—'}, <0.9 in ${s.at50.filter((x) => x < 0.9).length}/${s.at50.length}`);
const u = R.ult, nonC = u.knight + u.archer + u.mage;
L.push(`ULTS: knight ${u.knight} (${(100 * u.knight / nonC).toFixed(0)}%), archer ${u.archer} (${(100 * u.archer / nonC).toFixed(0)}%), mage ${u.mage} (${(100 * u.mage / nonC).toFixed(0)}%), cleric ${u.cleric}`);
L.push(`SECOND WIND: lvl ${R.end.workshop.kindling || 0}, triggers ${R.sw.triggers}, bonus keys ${R.sw.bonusKeys}, bonus Sparks ${R.sw.bonusSparks} of ${R.sw.sparksTotal} total (${(100 * R.sw.bonusSparks / Math.max(1, R.sw.sparksTotal)).toFixed(1)}%)`);
L.push(`HOTKEY: procs ${R.hk.procs}, free casts ${R.hk.casts}, banked ${R.hk.banked}, released from bank ${R.hk.fromBank}, overflow(lost) ${R.hk.overflow}`);
L.push(`EPIC@f30 (first kill with epicGiven=false): ${R.epic.map((e) => fmtT(e.t) + ' r' + e.r + ' epic=' + e.hadEpic).join(', ') || 'none'}`);
L.push(`longest continuous FLOW: ${(R.maxFlowRun / 60).toFixed(1)} min`);
if (o.demo) L.push(`DEMO: card at ${fmtT(R.demo.cardAt)}, sealed toasts ${R.demo.sealed.length} (${R.demo.sealed.map((x) => fmtT(x.t) + ' run ' + (x.time / 60).toFixed(1) + 'm').join(', ')}), re-delves ${R.demo.redelves}, Renown after card +${R.demo.renownAfter}, bestCapTime ${(R.end.bestCapTime / 60).toFixed(1)}m; legacy ${JSON.stringify(R.end.legacy)}`);
L.push('ACH: ' + ACH.map((a) => `${a.id} ${R.ach[a.id] !== undefined ? fmtT(R.ach[a.id]) : 'NO'}`).join(' | '));
L.push(`end heroes ${JSON.stringify(R.end.heroes)} workshop ${JSON.stringify(R.end.workshop)} legacy ${JSON.stringify(R.end.legacy)}`);
console.log(L.join('\n'));
if (args.json) { delete R.KK; require('fs').writeFileSync(args.json, JSON.stringify(R)); }
