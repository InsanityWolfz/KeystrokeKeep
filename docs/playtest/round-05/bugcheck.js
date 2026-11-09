// Round 05 auditor: targeted checks of achievement triggers and feedback values (no game file touched).
const load = require('../../../tools/headless');
const out = [];
// 1) Blitz after an app restart: achP.bossTimes is saved, KK.simTime is not.
{
  const KK = load({ seed: 1 }); KK.world.reset();
  const S = KK.S; S.achP = { bossTimes: [5000, 5100, 5200, 5300] }; // 4 boss kills in the last session (simTime ~5300)
  KK.simTime = 12; // fresh launch: simTime restarts near 0
  const boss = { boss: true, key: 'ratking', def: {}, uid: 1 };
  KK.emit('kill', { e: boss, gold: 0 });
  out.push(`Blitz after restart with 4 stale boss kills + 1 new kill: unlocked=${!!S.ach.blitz} (bossTimes now ${JSON.stringify(S.achP.bossTimes)})`);
}
// 2) Hands Off: one click (rat catch, buy button, omen card) in the delve breaks it.
{
  const KK = load({ seed: 1 }); KK.world.reset();
  const S = KK.S; S.retires = 1; S.runInputs = 0;
  KK.addActivity('click');
  KK.emit('floor', { floor: 50 });
  out.push(`Hands Off after a single click this delve: unlocked=${!!S.ach.idle50} (runInputs ${S.runInputs})`);
  S.settings.countInput = false; S.runInputs = 0; KK.addActivity('click'); KK.emit('floor', { floor: 50 });
  out.push(`Hands Off with input counting PAUSED and a click: unlocked=${!!S.ach.idle50}`);
}
// 3) Ember floaters: '+10 EMBERS' / '+25 EMBERS' are hard-coded; real gain is x emberGain.
{
  const KK = load({ seed: 1 }); KK.world.reset();
  const S = KK.S; S.workshop.crucible = 10; S.omen = 'embertide'; KK.dirty();
  const e0 = S.embers; KK.gainEmbers(10); const boss = S.embers - e0;
  const e1 = S.embers; KK.gainEmbers(25); const rat = S.embers - e1;
  out.push(`Crucible 10 + Ember Tide: boss kill pays ${boss} Embers (floater says +10), rat pays ${rat} (floater says +25)`);
}
// 4) Demo re-delve return value used by the retire banner ('+' + g + ' RENOWN')
{
  const KK = load({ seed: 1, demo: true }); KK.world.reset();
  const S = KK.S; S.demoDone = true; S.maxFloorRun = 38; S.renownLifetime = 48; S.renownFloor = 40;
  const g = KK.actions.retire();
  out.push(`Demo re-delve at the Renown cap: retire() returned ${JSON.stringify(g)} -> banner text "+${g} RENOWN"`);
}
// 5) Speedrunner trigger vs Head Start: a delve that starts on floor 41 can never fight the floor-40 boss.
{
  const KK = load({ seed: 1 }); KK.world.reset();
  const S = KK.S; S.legacy.headstart = 8; KK.dirty();
  out.push(`Head Start 8 start floor: ${KK.mods().startFloor} (Speedrunner and Gatekeeper need the floor-40 boss)`);
}
console.log(out.join('\n'));
