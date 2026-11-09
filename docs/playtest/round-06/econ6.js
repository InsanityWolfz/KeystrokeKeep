// T1 economist, round 06: scenarios on the real sim (read-only).
// node docs/playtest/round-06/econ6.js base|variants [--profile typist|idle|burst] [--hours 8] [--seeds 3] [--v base,noEnrage,...] [--omen random|none]
// variants: base, noEnrage, enrageNNN (enrage after NNN s), noCodex, codexNNN (x1.NNN per rank, e.g. codex105),
//           noDynamo, noWarCharge, noReassemble, noSanct, heal100 (no heal cap)
const { load, makePlayer, hm, avg, rg, SEEDS } = require('./econ6lib');
const args = { _: process.argv[2] || 'base' };
for (let i = 3; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'typist', H = +(args.hours || 8), N = +(args.seeds || 3), RET = args.retire || 'nudge';
const OMEN_POL = args.omen || 'random';

const wsSkip = (skip) => (KK) => { for (let k = 0; k < 50; k++) { let did = false; for (const d of KK.DATA.WORKSHOP) if (!skip.includes(d.id) && KK.actions.buyWorkshop(d.id)) did = true; if (!did) break; } };
function variantOpts(v) {
  const o = { profile: PROF, retire: RET, omen: OMEN_POL };
  if (OMEN_POL === 'none') o.forceOmen = 'none';
  if (args.forceOmen) { o.forceOmen = args.forceOmen; o.omen = undefined; }
  if (v.includes('noEnrage')) o.noEnrage = true;
  if (v.includes('fix')) o.fixEnrage = true;
  const en = /enrage(\d+)/.exec(v); if (en) o.enrageAt = +en[1];
  const cx = /codex(\d+)/.exec(v); if (cx) o.codexMult = 1 + (+cx[1] - 100) / 100;
  if (v.includes('noDynamo')) o.workshop = wsSkip(['dynamo']);
  if (v.includes('noWarCharge')) o.noWarCharge = true;
  if (v.includes('noReassemble')) o.noReassemble = true;
  if (v.includes('noSanct')) o.noSanct = true;
  const wd = /wounds(\d+)/.exec(v); if (wd) o.wounds = +wd[1] / 100; // retried boss keeps its wounds, healing back wounds% of the missing HP
  const se = /soft(\d+)/.exec(v); if (se) o.softEnrage = +se[1]; // no wipe; after N s the boss's attack grows 2%/s
  if (v.includes('wsSmart')) o.workshop = wsSkip(['kindling', 'static']); // an idle player who skips the NEEDS TYPING items
  if (v.includes('heal100')) o.healCap = 1e9; // test hook can only lower; the game cap (25%) still applies -> unused
  return o;
}
function runOne(seed, v, cps, extra = {}) {
  const KK = load({ seed }); KK.world.reset();
  if (v.includes('noCodex')) KK.DATA.CODEX_RANKS.splice(0);
  const dyn = /dyn(\d+)/.exec(v); if (dyn) KK.DATA.WORKSHOP.find((d) => d.id === 'dynamo').apply = (m, l) => { m.dynamo += (+dyn[1] / 100) * l; };
  if (v.includes('dynCheap')) { const d = KK.DATA.WORKSHOP.find((x) => x.id === 'dynamo'); d.base = 80; d.growth = 1.5; }
  const di = /dynIdle(\d+)/.exec(v); if (di) { const pm = KK.powerMult; KK.powerMult = () => { if (KK.lastInputAgo() < +di[1]) { const m = KK.mods(), d = m.dynamo; m.dynamo = 0; const x = pm(); m.dynamo = d; return x; } return pm(); }; }
  const P = makePlayer(KK, Object.assign(variantOpts(v), extra));
  P.run(H * 3600, cps);
  P.flushStreak();
  return { KK, P };
}
const defaultCps = () => [1, 2, 4, 8, 16, 24, 32, 40].filter((h) => h <= H).map((h) => h * 3600).concat(H * 3600).filter((v, i, a) => a.indexOf(v) === i);
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const p90 = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length * 0.9)] : NaN; };

function bossReport(Ps) {
  const fights = Ps.flatMap((p) => p.bf);
  const band = (f) => (f.floor >= 130 ? 'f130+' : f.floor >= 100 ? 'f100-129' : f.floor >= 70 ? 'f70-99' : f.floor >= 41 ? 'f41-69' : 'f10-40');
  const by = {};
  for (const f of fights) (by[band(f)] = by[band(f)] || []).push(f);
  const L = ['  boss fights by band (all seeds):'];
  for (const k of ['f10-40', 'f41-69', 'f70-99', 'f100-129', 'f130+']) {
    const a = by[k]; if (!a) continue;
    const c = (o) => a.filter((f) => f.out === o).length;
    const won = a.filter((f) => f.out === 'won');
    L.push(`    ${k.padEnd(9)} n ${String(a.length).padStart(5)}  won ${(c('won') / a.length * 100).toFixed(0).padStart(3)}%  enrage ${(c('enrage') / a.length * 100).toFixed(0).padStart(3)}%  wipe ${(c('wipe') / a.length * 100).toFixed(0).padStart(3)}%  win wall med ${med(won.map((f) => f.wall)).toFixed(0)}s p90 ${p90(won.map((f) => f.wall)).toFixed(0)}s max ${Math.max(0, ...won.map((f) => f.wall)).toFixed(0)}s  (fightT at win p90 ${p90(won.map((f) => f.fightT)).toFixed(0)}s)  enrage wall med ${med(a.filter((f) => f.out === 'enrage').map((f) => f.wall)).toFixed(0)}s`);
  }
  const keys = {};
  for (const f of fights.filter((x) => x.floor >= 70)) { const k = (f.hollow ? 'H:' : '') + f.key; (keys[k] = keys[k] || { n: 0, en: 0, won: 0 }); keys[k].n++; if (f.out === 'enrage') keys[k].en++; if (f.out === 'won') keys[k].won++; }
  L.push('  f70+ by boss: ' + Object.entries(keys).map(([k, v]) => `${k} n${v.n} won${(v.won / v.n * 100).toFixed(0)}% en${(v.en / v.n * 100).toFixed(0)}%`).join(' | '));
  const om = {};
  for (const f of fights.filter((x) => x.floor >= 70)) { const k = f.omen || 'none'; (om[k] = om[k] || { n: 0, en: 0 }); om[k].n++; if (f.out === 'enrage') om[k].en++; }
  L.push('  f70+ enrage rate by omen: ' + Object.entries(om).map(([k, v]) => `${k} ${(v.en / v.n * 100).toFixed(0)}% (n${v.n})`).join(' | '));
  const st = Ps.flatMap((p) => p.streaks);
  if (st.length) {
    const ends = {}; for (const s of st) ends[s.end] = (ends[s.end] || 0) + 1;
    L.push(`  enrage streaks (consecutive enrages at one floor): n ${st.length}, len med ${med(st.map((s) => s.n))} p90 ${p90(st.map((s) => s.n))} max ${Math.max(...st.map((s) => s.n))}; ended ${JSON.stringify(ends)}; streak duration med ${(med(st.filter((s) => s.dt).map((s) => s.dt)) / 60).toFixed(0)} min p90 ${(p90(st.filter((s) => s.dt).map((s) => s.dt)) / 60).toFixed(0)} max ${(Math.max(0, ...st.filter((s) => s.dt).map((s) => s.dt)) / 60).toFixed(0)} min`);
  }
  L.push(`  fights that passed 180 s without enraging (shipped guard bug): ${fights.filter((f) => f.fightT > 181).length} of ${fights.filter((f) => f.wall > 181 || f.out === 'enrage').length} long fights (won ${fights.filter((f) => f.fightT > 181 && f.out === 'won').length}, lost ${fights.filter((f) => f.fightT > 181 && f.out !== 'won').length})`);
  L.push(`  enrages/seed ${avg(Ps.map((p) => p.enrages)).toFixed(1)} (${rg(Ps.map((p) => p.enrages))}), wipes/seed ${avg(Ps.map((p) => p.bf.filter((f) => f.out === 'wipe').length)).toFixed(1)} boss + other; War Charges/seed ${avg(Ps.map((p) => p.warCharges)).toFixed(0)}, Reassembles/seed ${avg(Ps.map((p) => p.reassembles)).toFixed(0)}`);
  return L.join('\n');
}
function codexReport(Ps) {
  const marks = [1, 4, 7, 14, 21, 28];
  const L = ['  codex: ranks reached (h): ' + marks.map((m) => { const ts = Ps.map((p) => { const x = p.codexT.find((c) => c.total >= m); return x ? x.t / 3600 : NaN; }); const n = ts.filter((x) => x === x).length; return `${m}:${n ? avg(ts).toFixed(1) : '-'}${n < Ps.length ? '(' + n + '/' + Ps.length + ')' : ''}`; }).join(' ')];
  return L.join('\n');
}

function base(vs) {
  const cps = defaultCps();
  console.log(`=== ${PROF} ${H}h x${N} seeds, retire ${RET}, omen ${OMEN_POL} ===`);
  for (const v of vs) {
    const t0 = Date.now();
    const res = SEEDS(N, +(args.seedoff || 0)).map((seed) => runOne(seed, v, cps));
    const Ps = res.map((r) => r.P);
    console.log(`--- ${v} --- (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    for (const c of cps) {
      const g = (k) => Ps.map((p) => p.cps[c][k]);
      console.log(`  ${hm(c).padEnd(6)} f${avg(g('floor')).toFixed(1)} (${rg(g('floor'))}) R${avg(g('renown')).toFixed(0)} trophies ${avg(g('trophies')).toFixed(1)} codex ${avg(g('codex')).toFixed(1)} fame x${avg(g('fame')).toFixed(0)} ach ${avg(g('ach')).toFixed(1)} retires ${avg(g('retires')).toFixed(1)} wipes ${avg(g('wipes')).toFixed(0)} (hollow ${avg(g('wipesHollow')).toFixed(0)}) enrages ${avg(g('enrages')).toFixed(0)} Sanct ${avg(g('sanct')).toFixed(0)} dyn ${avg(Ps.map((p) => p.cps[c].ws.dynamo || 0)).toFixed(1)}`);
    }
    console.log(`  blocked at a Hollowed boss: ${rg(Ps.map((p) => p.blockHollowT / 60))} min total`);
    console.log(bossReport(Ps));
    console.log(codexReport(Ps));
    if (args.retlog) for (const p of Ps.slice(0, 1)) console.log('  seed1 retires: ' + p.retires.map((r) => `${hm(r.at)} f${r.floor} +${r.gain} ${r.omen || '-'} ${r.run.toFixed(0)}m ${r.why}`).join(', '));
    if (v === vs[0] || args.achall) {
      const ids = res[0].KK.ach.LIST.map((a) => a.id);
      const rows = ids.map((id) => ({ id, ts: Ps.map((p) => (id in p.ach ? p.ach[id] / 60 : NaN)) }));
      rows.sort((a, b) => (avg(a.ts) || 1e9) - (avg(b.ts) || 1e9));
      console.log(`  achievements unlocked: ${rg(Ps.map((p) => Object.keys(p.ach).length))}/${ids.length}`);
      console.log('  ' + rows.map((r) => { const n = r.ts.filter((x) => x === x).length; return `${r.id} ${n ? avg(r.ts).toFixed(0) + 'm' : 'NEVER'}${n && n < N ? '(' + n + '/' + N + ')' : ''}`; }).join(', '));
      const tro = {}; for (const p of Ps) for (const f in p.trophyT) (tro[f] = tro[f] || []).push(p.trophyT[f] / 3600);
      console.log('  trophy first reached (h): ' + Object.keys(tro).sort((a, b) => a - b).map((f) => `f${f} ${avg(tro[f]).toFixed(1)}${tro[f].length < N ? '(' + tro[f].length + '/' + N + ')' : ''}`).join(' '));
    }
    if (args.dump) require('fs').writeFileSync(`${args.dump}_${v}.json`, JSON.stringify(Ps.map((p) => ({ cps: p.cps, bf: p.bf.filter((f) => f.floor >= 60), streaks: p.streaks, codexT: p.codexT, enrageByFloor: p.enrageByFloor, retires: p.retires }))));
  }
}

({ base: () => base(['base']), variants: () => base((args.v || 'base,noEnrage').split(',')) })[args._]();
