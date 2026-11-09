// T1 economist, round 05: scenarios on the real sim (read-only).
// node docs/playtest/round-05/econ5.js <scenario> [--profile typist|idle|burst] [--hours 8] [--seeds 3] [...]
//   base     full telemetry for one profile (achievements, trophies, void slam, Sanctuary)
//   variants --v base,noVoid,noVigil,noTrophy,noSanct   same, side by side
//   omens    one omen forced on every delve (--omens none,deep,...)
//   choose   rational best-of-3 by --rank, vs none / random
//   sw       Second Wind on/off
//   muster   implementation check of Veterans' Muster (keep Forge)
const { load, makePlayer, hm, avg, rg, SEEDS } = require('./econ5lib');
const args = { _: process.argv[2] || 'base' };
for (let i = 3; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } } }
const PROF = args.profile || 'typist', H = +(args.hours || 8), N = +(args.seeds || 3), RET = args.retire || 'nudge';
const OMEN_POL = args.omen || 'random';

function variantOpts(v) {
  const o = { profile: PROF, retire: RET, omen: OMEN_POL };
  if (OMEN_POL === 'none') o.forceOmen = 'none';
  if (args.healcap) o.healCap = +args.healcap;
  if (v === 'noVoid') o.noVoid = true;
  if (v === 'noVigil') o.noVigil = true;
  if (v === 'noSanct') o.noSanct = true;
  const hc = /^heal(\d+)(noArmor)?$/.exec(v); if (hc) { o.healCap = +hc[1] / 100; if (hc[2]) o.skipForge = ['armor']; }
  if (v === 'noArmor') o.skipForge = ['armor'];
  if (v === 'noStatic') o.workshop = (KK) => { for (let k = 0; k < 50; k++) { let did = false; for (const d of KK.DATA.WORKSHOP) if (d.id !== 'static' && KK.actions.buyWorkshop(d.id)) did = true; if (!did) break; } };
  return o;
}
function runOne(seed, v, cps, extra = {}) {
  const KK = load({ seed }); KK.world.reset();
  if (v === 'noTrophy') KK.DATA.TROPHIES.splice(0);
  // test-only idle Workshop item (in memory): Dynamo, +X idle power per level while not typing
  const dy = /^dynamo(\d+)$/.exec(v); if (dy) KK.DATA.WORKSHOP.push({ id: 'dynamo', name: 'Dynamo', icon: 'clock', base: 150, growth: 1.6, max: 10, desc: () => '', apply: (m, l) => { m.idlePow += (+dy[1] / 100) * l; } });
  if (args.patch) { const p = JSON.parse(args.patch); for (const id in p) { const om = KK.DATA.OMENS.find((x) => x.id === id); om.apply = new Function('m', p[id]); } }
  const P = makePlayer(KK, Object.assign(variantOpts(v), extra));
  P.run(H * 3600, cps);
  return { KK, P };
}
const defaultCps = () => [1, 2, 4, 8, 16, 24, 32, 40].filter((h) => h <= H).map((h) => h * 3600).concat(H * 3600).filter((v, i, a) => a.indexOf(v) === i);

function hollowReport(all) {
  const fights = all.flatMap((p) => p.hf);
  const by = {};
  for (const f of fights) { const k = f.floor >= 130 ? '130+' : f.floor >= 100 ? '100-129' : f.floor >= 80 ? '80-99' : '70'; (by[k] = by[k] || []).push(f); }
  const L = [];
  for (const k of ['70', '80-99', '100-129', '130+']) {
    const a = by[k]; if (!a) continue;
    const won = a.filter((f) => f.won), lost = a.filter((f) => !f.won);
    const durs = won.map((f) => f.dur).sort((x, y) => x - y);
    const med = durs.length ? durs[Math.floor(durs.length / 2)] : NaN;
    L.push(`  f${k.padEnd(8)} attempts ${String(a.length).padStart(4)}  won ${(won.length / a.length * 100).toFixed(0).padStart(3)}%  win dur med ${med.toFixed(0)}s p90 ${durs.length ? durs[Math.floor(durs.length * 0.9)].toFixed(0) : '-'}s  lost-fight dur med ${lost.length ? lost.map((f) => f.dur).sort((x, y) => x - y)[Math.floor(lost.length / 2)].toFixed(0) : '-'}s  slams/fight ${avg(a.map((f) => f.slams)).toFixed(1)}  Sanct/fight ${avg(a.map((f) => f.sanct)).toFixed(1)}  deaths/fight ${avg(a.map((f) => f.deaths)).toFixed(1)}`);
  }
  return L.join('\n');
}

function base(vs) {
  const cps = defaultCps();
  console.log(`=== ${PROF} ${H}h x${N} seeds, retire ${RET}, omen ${OMEN_POL} ===`);
  for (const v of vs) {
    const res = SEEDS(N, +(args.seedoff || 0)).map((seed) => runOne(seed, v, cps));
    const Ps = res.map((r) => r.P);
    console.log(`--- ${v} ---`);
    for (const c of cps) {
      const g = (k) => Ps.map((p) => p.cps[c][k]);
      console.log(`  ${hm(c).padEnd(6)} f${avg(g('floor')).toFixed(1)} (${rg(g('floor'))}) R${avg(g('renown')).toFixed(0)} trophies ${avg(g('trophies')).toFixed(1)} fame x${avg(g('fame')).toFixed(0)} ach ${avg(g('ach')).toFixed(1)} retires ${avg(g('retires')).toFixed(1)} wipes ${avg(g('wipes')).toFixed(0)} (hollow ${avg(g('wipesHollow')).toFixed(0)}) voidSlams ${avg(g('voidSlams')).toFixed(0)} Sanct ${avg(g('sanct')).toFixed(0)} oc ${avg(g('oc')).toFixed(1)}`);
    }
    console.log(`  blocked at a Hollowed boss: ${rg(Ps.map((p) => p.blockHollowT / 60))} min total; Sanctuary casts in Hollowed fights ${avg(Ps.map((p) => p.sanctVoid)).toFixed(0)} of ${avg(Ps.map((p) => p.sanct)).toFixed(0)}`);
    console.log(hollowReport(Ps));
    if (args.retlog) for (const p of Ps.slice(0, 1)) console.log('  seed1 retires: ' + p.retires.map((r) => `${hm(r.at)} f${r.floor} +${r.gain} ${r.omen || '-'} ${r.run.toFixed(0)}m`).join(', '));
    if (v === vs[0] || args.achall) {
      const ids = res[0].KK.ach.LIST.map((a) => a.id);
      const rows = ids.map((id) => ({ id, ts: Ps.map((p) => (id in p.ach ? p.ach[id] / 60 : NaN)), fl: Ps.map((p) => (id in p.achFloor ? p.achFloor[id] : NaN)) }));
      rows.sort((a, b) => (avg(a.ts) || 1e9) - (avg(b.ts) || 1e9));
      console.log(`  achievements unlocked: ${rg(Ps.map((p) => Object.keys(p.ach).length))}/${ids.length}`);
      console.log('  ' + rows.map((r) => { const n = r.ts.filter((x) => x === x).length; return `${r.id} ${n ? avg(r.ts).toFixed(0) + 'm' : 'NEVER'}${n && n < N ? '(' + n + '/' + N + ')' : ''}`; }).join(', '));
      const tro = {}; for (const p of Ps) for (const f in p.trophyT) (tro[f] = tro[f] || []).push(p.trophyT[f] / 3600);
      console.log('  trophy first reached (h): ' + Object.keys(tro).sort((a, b) => a - b).map((f) => `f${f} ${avg(tro[f]).toFixed(1)}${tro[f].length < N ? '(' + tro[f].length + '/' + N + ')' : ''}`).join(' '));
      if (args.json) require('fs').writeFileSync(args.json, JSON.stringify(rows));
    }
  }
}

function omens() {
  const list = (args.omens || 'none,gilded,glass,storm,quiet,fever,embertide,march,hoard,muster,deep').split(',');
  const cps = [4 * 3600, H * 3600].filter((v, i, a) => a.indexOf(v) === i && v <= H * 3600);
  console.log(`=== omens forced every delve, ${PROF}, ${H}h x${N}, retire ${RET} ===`);
  let b = null;
  for (const om of list) {
    const Ps = SEEDS(N).map((seed) => runOne(seed, 'base', cps, { forceOmen: om, omen: undefined }).P);
    const r = cps.map((c) => ({ f: avg(Ps.map((p) => p.cps[c].floor)), R: avg(Ps.map((p) => p.cps[c].renown)), w: avg(Ps.map((p) => p.cps[c].wipes)) }));
    if (om === 'none') b = r;
    console.log(om.padEnd(10) + cps.map((c, i) => `| ${hm(c)} f${r[i].f.toFixed(1)} (${(r[i].f - b[i].f >= 0 ? '+' : '') + (r[i].f - b[i].f).toFixed(1)}) R${r[i].R.toFixed(0)} (${((r[i].R / b[i].R - 1) * 100).toFixed(0)}%) wipes ${r[i].w.toFixed(0)}`).join(' '));
  }
}

function choose() {
  const rank = (args.rank || 'deep,glass,storm,embertide,muster,march,gilded,hoard,quiet,fever').split(',');
  const cps = [2, 4, 8].filter((h) => h <= H).map((h) => h * 3600).concat(H * 3600).filter((v, i, a) => a.indexOf(v) === i);
  console.log(`=== omen choice ${PROF} ${H}h x${N}; rank ${rank.join('>')} ===`);
  for (const pol of (args.pols || 'none,random,rank').split(',')) {
    const extra = pol === 'none' ? { forceOmen: 'none', omen: undefined } : pol === 'random' ? { omen: 'random' } : { omen: undefined, omenRank: rank };
    const Ps = SEEDS(N).map((seed) => runOne(seed, 'base', cps, extra).P);
    const cnt = {}; for (const p of Ps) for (const k in p.omens) cnt[k] = (cnt[k] || 0) + p.omens[k];
    console.log(pol.padEnd(7) + cps.map((c) => `| ${hm(c)} f${avg(Ps.map((p) => p.cps[c].floor)).toFixed(1)} R${avg(Ps.map((p) => p.cps[c].renown)).toFixed(0)}`).join(' ') + ' | picks ' + JSON.stringify(cnt));
  }
}

function sw() {
  const cps = [3600, 4 * 3600, H * 3600].filter((v, i, a) => a.indexOf(v) === i && v <= H * 3600);
  const noSW = (KK) => { for (let k = 0; k < 50; k++) { let did = false; for (const d of KK.DATA.WORKSHOP) if (d.id !== 'kindling' && KK.actions.buyWorkshop(d.id)) did = true; if (!did) break; } };
  console.log(`=== Second Wind on/off, ${PROF}, ${H}h x${N}, retire ${RET}, omen ${OMEN_POL} ===`);
  for (const [name, ws] of [['default', undefined], ['no SW', noSW]]) {
    const res = SEEDS(N).map((seed) => runOne(seed, 'base', cps, { workshop: ws }));
    const Ps = res.map((r) => r.P);
    console.log(name.padEnd(8) + cps.map((c) => `| ${hm(c)} f${avg(Ps.map((p) => p.cps[c].floor)).toFixed(1)} R${avg(Ps.map((p) => p.cps[c].renown)).toFixed(0)} emb ${(avg(Ps.map((p) => p.cps[c].embers)) / 1000).toFixed(1)}k oc${avg(Ps.map((p) => p.cps[c].oc)).toFixed(1)}`).join(' ') + ` | SW triggers/h ${avg(Ps.map((p) => p.swTrig / H)).toFixed(1)} SW sparks/h ${avg(Ps.map((p) => p.swSparks / H)).toFixed(0)} SW lv ${avg(res.map((r) => r.KK.S.workshop.kindling || 0)).toFixed(1)} | first SW buy ${rg(res.map((r) => NaN))}`);
  }
}

function muster() {
  const KK = load({ seed: 3 }); KK.world.reset();
  const S = () => KK.S, A = KK.actions;
  KK.S.retires = 1; KK.S.maxFloorRun = 60; KK.S.renownFloor = 40; KK.S.gold = 1e9; KK.dirty();
  for (let i = 0; i < 12; i++) { A.buyForge('blades'); A.buyForge('armor'); A.buyForge('purse'); }
  const before = JSON.stringify(S().forge);
  A.retire(); KK.world.reset();
  console.log('forge before retire', before, '| after retire', JSON.stringify(S().forge), '| lastForge', JSON.stringify(S().lastForge), '| offer', S().omenOffer);
  if (!S().omenOffer.includes('muster')) S().omenOffer[0] = 'muster';
  const off = S().omenOffer.slice();
  A.pickOmen('muster');
  console.log('after pick muster: forge', JSON.stringify(S().forge), 'gold mult', KK.mods().gold.toFixed(3), 'dmg mult', KK.mods().dmg.toFixed(2));
  // next retire: is muster excluded from the following offer?
  S().maxFloorRun = 80; A.retire();
  console.log('next offer', S().omenOffer, 'prev', off, 'repeat?', S().omenOffer.some((x) => off.includes(x)));
  // How often is muster offered back-to-back? (never)  How often is any omen offered in consecutive offers over 1000 retires?
  let rep = 0, last = S().omenOffer;
  for (let i = 0; i < 1000; i++) { S().maxFloorRun = S().renownFloor + 5; A.retire(); if (S().omenOffer.some((x) => last.includes(x))) rep++; last = S().omenOffer; A.pickOmen(null); }
  console.log('consecutive repeats in 1000 offers:', rep);
}

({ base: () => base(['base']), variants: () => base((args.v || 'base,noVoid').split(',')), omens, choose, sw, muster })[args._]();
