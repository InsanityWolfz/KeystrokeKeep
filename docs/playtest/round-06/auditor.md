# Round 06 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
The R5 week-2 work helps, but two of the new boss mechanics don't work in real play.

- **The 3-minute enrage stops working after the first wipe of a delve.** On HEAD, idle players still sit in boss fights of 22–27 minutes.
- **Reassemble is a 0.4-second flicker.** The Bone King "dies", drops a bone burst, and dies again before his stun ends.
- **The Codex roughly halves the week-2 dead time.** The longest gap after 8 h fell from 738–1,375 min (R5, no Codex) to 399–569 min for typists. Ranks still bunch up: rank 2 lands at 14–19 h and rank 3 at 30–35 h, with nothing between them.
- **My prototypes fix the rest:**
  - Four more signature moves. Each is seen in 96–100% of fights and is neutral on depth.
  - Omen of the Day, the Void Lantern and trophies past 150. Together they double the beats after 8 h, and the longest typist gap drops to 2.5–3.3 h on the working tree.

I'd keep it running tomorrow, and with F1 to F4 in I'd still have it running in week 2. **7.5/10** (R5: 7.5).

### Method
- **Code version:** every number below comes from **HEAD 89f4651**, pinned with `KK_SRC=<snapshot of git show HEAD:js/*>`. Someone started editing `js/` at 13:42, during my runs, so I pinned the version to keep results comparable. Checks on that uncommitted working tree are labelled **WIP**.
- **Scripts** (all in `docs/playtest/round-06/`):
  - `r6lib.js` / `r6probe.js`: the R5 harness plus per-fight signature telemetry. It records the events, when each first fires, Reassemble rise→death time, Warlord deaths mid-charge, enrages, Codex beats, and a hook so patches can add beats.
  - `r6proto.js`: in-memory prototypes. Options are `enrage`, `enrage2`, `reass`, `rat`, `web`, `shell`, `lava`, `omen`, `lantern` and `tro`, and the numbers can be changed from the command line.
  - `headless_src.js`: a headless loader whose `js/` folder can be pinned.
  - Batch scripts: `batch.sh`, `batch40.sh`, `matrix.sh`, `seeds40.sh` and `seeds40b.sh`.
  - Single checks: `dbg_*.js` and `wip_*.js`.
  - Output goes to `out/`. The summary tables are `compare.txt`, `matrix.txt`, `seeds40.txt` and `seeds40b.txt`.
- **Runs:**
  - 8 h: 8 profiles.
  - 40 h: typist, light and idle with **4 seeds each per configuration**. Single 40 h seeds swing by ±8 floors, so no conclusion rests on one seed.
  - 3 h demo: 4 profiles.
  - `tools/playtest.js` with seed 6, `--retire nudge --omen random`: typist 8 h, idle 8 h and `--demo` 3 h.
  - All runs use `--retire nudge --omen random` unless noted.

## Findings (ranked, max 8)

### F1 [severity: major] The 3-minute enrage stops working after the first wipe of every delve. A naive fix costs idle players 4–10 floors at 40 h
- Evidence:
  - The check is `world.js:466 if (e.fightT > 180 && !W.wipeT)`. After a wipe, `W.wipeT -= dt` ends slightly below zero (for example −0.013), so `!W.wipeT` is false until the next `W.reset()`, which only happens on retire.
  - `dbg_heart.js`, idle 40 h: the Heart of the Keep was killed after **748 s** of fighting with `fightT` 746, and no enrage fired. A Hollowed Brood Mother took 1,064 s.
  - `dbg_long.js` (40 h, two seeds per profile):

    | Profile | Fights over 3 min | Longest fight | Hours spent in fights over 3 min | Enrages |
    |---|---|---|---|---|
    | typist | 22–26 | 9.4–16.7 min | 1.5–2.4 | 8–9 |
    | idle | 29–30 | 22.5–27.2 min | 3.5–3.7 | 16 |
    | light | 26–28 | 9.8–13.5 min | 2.1–2.2 | 8–13 |

    - 50–75% of those long fights are eventually **won**.
    - So the R5 claim ("A boss fight longer than 3 minutes counts as a wall") holds only until the first wipe.
  - **Fixing only the check** (`out/seeds40.txt`, 4 seeds, 40 h):

    | Profile | Max floor | Wipes | Beats after 8 h | Longest gap |
    |---|---|---|---|---|
    | idle | 120–124 → **110–118** | 58–113 → **222–232** | 25–28 → 18–24 | 276–442 → 350–1,006 min |
    | light | 154–158 → 140–154 | | | |
    | typist | unchanged (≈170) | | | |

    - The working enrage turns grinds that would be won into retreats: idle wins 0–2 long fights instead of 22–23.
  - **A softer rule (`enrage2`):** retreat at 180 s only if the boss is still above 50% HP, and always at 420 s.

    | Profile | Max floor | Wipes |
    |---|---|---|
    | idle | **117–123** | 106–142 |
    | typist | 170–180 | |
    | light | 154–155 | |

    - That keeps HEAD's depth and still ends the 25-minute fights.
- **WIP check.** The working tree already has `!(W.wipeT > 0)`, `W.wipeT = 0` in `recover()`, and "wounds": the boss keeps its HP for the next try. That also lands idle at 120–122. But it **introduces a bug**:
  - `spawnWave` now reads `if (wound) {…} else if (f >= 70 && key !== 'hollow') { …hollowed… }`. A wounded retry spawns as the **plain** boss: no Hollowed name or tint, no void slam, and no Codex credit.
  - `wip_check.js`: floor 90 wounded spawns "The Bone King", `hollowed: false`.
  - `wip_wounds.js`, 40 h: **26 of 27** typist wounded retries and **38 of 57** idle ones lost Hollowed status. 15–16 kills per 40 h got no Codex credit and skipped the void slam.
- Why it matters:
  - A 25-minute fight against one boss is the week-2 experience for idle players. *"Left it running, it was fighting the same boss for half an hour."*
  - The WIP bug quietly makes the wall easier and throws away Codex progress.
- Proposed fix:
  - Keep the WIP `!(W.wipeT > 0)` change.
  - **Split the chain:**
    ```js
    if (f === 100) {…heart…} else if (f >= 70 && key !== 'hollow') {…hollowed…}
    const wound = S.bossWounds && S.bossWounds[f]; if (wound) { boss.hp = boss.maxHp * wound; boss.wounded = wound; }
    ```
  - If "wounds" is dropped, use the `enrage2` rule: `if ((e.fightT > 180 && e.hp / e.maxHp > 0.5) || e.fightT > 420)`.

### F2 [severity: major] Reassemble can't be seen: the Bone King rises and dies again in 0.4 s. The WIP bone pile doesn't fix it
- Evidence (HEAD, `out/basedemo_*`):
  - Reassemble fires in 93–100% of Bone King fights.
  - For demo typists, the second death comes **0.40–0.43 s** (median) after the rise:
    - 18–19 of 24 under 0.5 s;
    - **22 of 24 while still stunned**: the stun is 1.5 s and he stays targetable.
  - In idle/burst demos the median is 0.57–0.60 s.
  - The death has no debris, so the player sees a dust puff, "REASSEMBLES!", then the real death.
  - **WIP** adds `e.pile = 1.5` and a collapse render, but:
    1. Damage isn't blocked (`damageEnemy` has no pile check).
    2. `e.pile -= dt` sits after the `if (e.stun > 0) … continue` line, so the pile lasts 1.5 s of stun **plus** 1.5 s more.

    `wip_pile.js`: he **dies as a pile in 24 of 25** typist demo fights (12 of 13 idle). The pile lasts 3.0 s and he never stands up.
- Prototype (`reass`: damage blocked while `pile > 0`):
  - Rise to second death: median 1.60–2.13 s in the demo and 2.2–3.1 s at 8 h; **0 under 0.5 s**.
  - Depth and demo best time unchanged: typist 3.8–4.2 min (base 3.9–4.1).
- Proposed fix (world.js):
  - `damageEnemy`: `if (e.dead || e.pile > 0) return;`
  - `targetInRange` (line 399): `if (e.dead || !e.active || e.pile > 0) continue;`
  - Move `if (e.pile > 0) e.pile -= dt;` up next to the `kb` decay, above the stun `continue`, so the rise animation plays during the stun.
  - Heroes idle for 1.5 s: that pause is the readable beat.

### F3 [severity: major] The four remaining signature moves, ready to implement (prototyped; depth-neutral; seen in 96–100% of fights)
Lessons from War Charge:
- It's seen in **only 14–50%** of full-game non-Hollowed Warlord fights for typists (median fight 2.3–2.9 s; first warning 2.6–3.2 s after activation).
- In the demo it's 88–92% for typists and 100% for idle (median 1 and 3 charges per fight, 25–33% of typist Warlords die mid-charge).
- So **the new moves start their timers when the boss activates (comes on screen), not when he reaches the line**. Ranged or ambient moves allow that.

Shared engine:
- Data: `sig` on `MONSTERS` in `data.js`. Hollowed copies inherit it through `Object.assign`.
- Code: one `sigMove(e, dt, front)` call in `updateEnemies`, right after the `if (frozen || !front) {…continue;}` line (world.js:440) and before the War Charge block. Stuns pause it, as they do War Charge.
- **Void-slam dodge:** `if (e.voidT !== undefined && e.sgT <= 0 && e.voidT < 2.4) { e.sgT = e.voidT + 1.4; return; }`.
  - `FX.alert` only draws the newest alert.
  - With a 1.6 s window my prototype still had 10–26 collisions per 8 h, so use the 2.4 s window.
  - War Charge versus void already overlaps on 2–6% of Hollowed Warlord void warnings (`dbg_alerts.js`).

```js
// data.js
ratking:     { …, sig: { id: 'summons', first: 0.8, hp: [0.6, 0.3] } },
broodmother: { …, sig: { id: 'web', first: 1.0, every: 7, atk: 0.3, dur: 2.5 } },
embergolem:  { …, sig: { id: 'shell', first: 0, every: 12, dur: 4, mult: 0.5 } },
magmalord:   { …, sig: { id: 'lava', first: 1.0, every: 8, n: 3, warn: 0.9, mult: 0.5 } },
```

| Boss | Behaviour (exact) | Code |
|---|---|---|
| **Rat King: Royal Summons** "SQUEAK!" | **Bounded:** an opener at 0.8 s, then one wave at 60% and one at 30% HP. Each wave is 2 Cellar Rats with `makeEnemy('rat', Math.max(front.x+20+12*i, e.x-12-12*i), S.floor, { hpMult: 0.35 })`, then `active = true`, `atk *= 0.6`, `gold *= 0.5`, `summon = true`. Max 4 alive. The rats stand in front, so single-target attacks hit them first. | about 15 lines in `sigMove` |
| **Brood Mother: Web Shot** "WEB!" | First at 1.0 s, then every 7 s. A homing enemy shot at the back-most living hero: `{ type: 'web', target: h, dmg: e.atk*0.3, speed: 90, enemy: true, web: 2.5 }`. On hit (`updateShots` enemy branch): `t.webbed = s.web`. In the hero loop, just before `h.atkT -= …` (world.js:352): `if (h.webbed > 0) { h.webbed -= dt; h.atkT = Math.max(h.atkT, 0.1); }`. That blocks attacks and heals; ultimates still fire. Optional: `castUlt` clears `h.webbed`, so typing breaks the web. | 10 lines plus a `drawShot` case and a net drawn on the hero |
| **Ember Colossus: Magma Shell** "SHELL!" | Arrives shelled (`first: 0`), then every 12 s, each for up to **4 s**. At the top of `damageEnemy`: `if (e.shell > 0) { if (opts.ult) { e.shell = 0; e.stun = Math.max(e.stun, 1); KK.emit('shellCrack',{e}); } else dmg *= 0.5; }`. Decay `e.shell` next to `kb`. Render: `stoneTint()` (a copy of `hollowTint`, `#8a8a8a` at 0.6) while `shell > 0`. | 8 lines plus 6 render lines |
| **Magma Lord: Lava Rain** "LAVA RAIN!" | First at 1.0 s, then every 8 s. Three marks on random living heroes, 0.12 s apart, each landing after a **0.9 s** warning for **0.5x** atk. New shot `{ type: 'lava', target: h, tx: h.x, t: 0.9 + 0.12*i, dmg, src: e, enemy: true }`. In `updateShots`, before the homing branch: count down `t`; on 0, hit the hero if he and the source are still alive, then `emit('lavaLand')`. `drawShot`: a ground glow at `tx` that grows while `t` falls, and a drop in the last 0.25 s. | about 15 lines plus a render case |

FX and audio:
- `FX.alert` texts: 'SQUEAK! ROYAL SUMMONS' (#ffd76a), 'WEB SHOT!' (#e8e2d0), 'MAGMA SHELL: ULTIMATES CRACK IT' (#c9b8a0), 'LAVA RAIN!' (#ffb347). On a crack: burst plus 'CRACKED!' text.
- Audio: summons → rat, web → shoot, shellUp → deny, crack → crit, lavaWarn → zone, lavaLand → explode.

Measured with these final numbers on HEAD plus `reass` and `enrage2` (`out/final2_*`, `finaldemo_*`, `seeds40b.txt`):
- **Seen:** the opener appears in **96–100%** of fights (8 h typist and the demo). Openers start at 0.1–1.0 s after activation; typist non-Hollowed fights last 1.8–4.2 s.
  - Per 3 h demo: Web Shot 31–56 times, Royal Summons 3 waves at f10.
  - Per 8 h typist: Magma Shell 41–43 shells, **32–47% cracked by ultimates** (idle: 4%).
- **Depth:**
  - 8 h: typist 127 / 125 (fixes-only 125 / 120), idle 90 (90), burst 94 (97).
  - 40 h, 4 seeds: typist 170–177 (fixes2 170–180), light 150–157 (154–155), idle **118–120** (117–123).
- **Wipes:** idle 40 h +20% (129–174 vs 106–142). Typist unchanged.
- **Demo:**
  - Best floor-40 time: typist 3.8–4.2 min (base 3.9–4.1), idle 5.7–6.3 (5.6–5.9).
  - Idle demo wipes +1 to +3 boss wipes per 3 h.
- **Numbers I rejected:**
  - **Timer summons** (2 rats every 9 s): Hollowed Rat King fights spiral for idle (11 of 12 fights became enrage retreats, `sig_idle_s1_480`). Extra effective HP grows with fight length, so use the HP thresholds.
  - **Shell at x0.3 for 5 s:** idle cracks only 1% (no Sparks); 6 of 7 Hollowed Ember Colossus fights retreated.
  - **Lava at 0.8x:** +60% Lava damage, light 40 h 154 → 150. Use 0.5x.

### F4 [severity: major] Week 2: the Codex roughly halved the empty stretches, but ranks bunch up. Omen of the Day + Void Lantern + trophies 160–200 double the beats
- Evidence (beats = new major, omen, trophy, achievement, Codex rank, Seal or Lantern level; 40 h, 4 seeds):

  | | typist | light | idle |
  |---|---|---|---|
  | HEAD beats after 8 h | 20–25 | 29–34 | 25–28 |
  | HEAD longest gap after 8 h (min) | **399–569** | 217–359 | 276–442 |
  | HEAD empty 2 h windows (of 17) | 6–7 | 3–6 | 4–8 |
  | + omen + lantern + tro (on HEAD + enrage2 + sigs) beats / gap | **33–42 / 366–436** | 33–47 / 181–288 | 29–34 / 251–458 |
  | **WIP** (Codex every 8 kills) beats / gap | 22–28 / 215–442 | 28 / 283 | 21–26 / 390–398 |
  | **WIP + omen + lantern + tro** beats / gap / empty 2 h | **40–45 / 151–196 / 2 of 17** | 41 / 148 / 1 of 17 | 31 / 266–305 / 3 of 17 |

  - **Why the HEAD Codex bunches up:** the six Hollowed bosses rotate evenly, so every rank 2 lands at 14–19 h and every rank 3 at 30–35 h, with an 8–9.5 h gap between.
  - The WIP global "one rank per 8 kills" spaces them out. Keep it.
  - Depth also rises: WIP plus the week-2 layer adds **+8 to +11 floors** at 40 h (typist 169–170 → 178–180, idle 120–122 → 128–130).
- **Omen of the Day.** One day was modelled as 8 h of play:
  - 5 Seals per 40 h, reached **11–29 min** into the delve (idle 11–17).
  - 4 free daily re-delves were used.
  - +10 Renown per day is small next to 700–800 lifetime. It's a daily ritual, not a power spike.
  - Exact code:
    - state.js:
      ```js
      newState: seals: 0, sealDay: '', freeDelveDay: '', omenStar: null,
      KK.today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
      A.starOmen = () => { let h = 0; for (const c of KK.today()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return D.OMENS[h % D.OMENS.length].id; };
      A.dailyOpen = () => !KK.DEMO_CAP && KK.S.retires >= 2 && KK.S.sealDay !== KK.today();
      // A.retire, after S.omenOffer is built (state.js:313):
      S.omenStar = null;
      if (S.omenOffer && A.dailyOpen()) { const st = A.starOmen(); if (!S.omenOffer.includes(st)) S.omenOffer[0] = st; S.omenStar = st; }
      if (gain <= 0 && !KK.DEMO_CAP) S.freeDelveDay = KK.today();
      // A.canRedelve (state.js:298): || (A.dailyOpen() && S.freeDelveDay !== KK.today() && A.renownGain() <= 0)
      A.claimSeal = () => { const S = KK.S; S.sealDay = KK.today(); S.seals++; S.renown += 10; S.renownLifetime += 10; KK.dirty(); KK.emit('seal', { n: S.seals }); };
      ```
    - world.js `nextFloor`, after the `maxFloorRun` line:
      ```js
      if (S.omen && S.omen === S.omenStar && KK.actions.dailyOpen() && S.floor >= Math.max(40, (S.renownFloor || 0) - 15)) KK.actions.claimSeal();
      ```
    - ui.js:
      - omen `card()`: `id === S.omenStar ? '<i class="star">★ OMEN OF THE DAY: floor ' + target + ' = +10 RENOWN</i>'`;
      - toast on `seal`;
      - retire button `'FREE DAILY RE-DELVE (★ OMEN OF THE DAY)'`;
      - pill prefix `★`.
    - achievements.js: `seals7` "Faithful" (7 Seals) and `seals30` "Devout" (30 Seals), `on: 'seal'`. That makes 38 achievements; update the demo card's "36".
- **Void Lantern:**
  - data.js WORKSHOP:
    ```js
    { id: 'lantern', name: 'Void Lantern', icon: 'candle', base: 4000, growth: 1.8, max: 5, desc: (l) => `Void slams deal 8% less damage per level (now -${8 * l}%)`, apply: (m, l) => { m.voidDmg *= 1 - 0.08 * l; } }
    ```
  - state.js mods: `voidDmg: 1`.
  - world.js:473: `h.maxHp * 0.55 * KK.mods().voidDmg`.
  - Measured purchases:
    - typist: L1 at 6.8–8.6 h, L5 at 31.6–34.2 h;
    - light: L1 at 11.9–15.3 h, L4 at 36.7–38.3 h.
  - **Idle never buys it in the sim.** Idle earns ~730 Embers/h (29k per 40 h). The sim's buyer spends them on Static Coins and Second Wind, which do nothing for an idle player. A real idle player could have L1 at about 5.5 h. Consider showing the card only from `maxFloorEver >= 70`.
- **Trophies 160, 170, 180, 190, 200** (data-only, x1.05 each): typist f160 at 20–27 h, f170 at 26–40 h; light f160 at 34 h.

### F5 [severity: minor] War Charge leftovers: damage numbers hidden 2.1 s per charge, and the Hollowed Warlord's void timer pauses
- Evidence:
  - `fx.js:320` sets `e.windup = 1.0`. The decrement (`world.js` after the charge branch) is skipped by the `continue` in the 'back', 'wind' and 'go' phases.
  - `dbg_charge.js` (with the fx line mirrored): numbers are hidden a **median 2.10 s** per charge (max 3.13), not 1.0.
  - `voidT`, `atkT` and `flashCool` freeze for **1.07 s** per charge, about 10% fewer void slams on the Hollowed Warlord. The WIP already fixed `fightT`.
  - The WIP opener of 0.5 s is good. It should lift the full-game 14–50% visibility.
- Proposed fix: move `if (e.windup > 0) e.windup -= dt; if (e.flashCool > 0) e.flashCool -= dt;` and the void-timer block above the War Charge branch.

### F6 [severity: minor] The omen pill tooltip can't show: the pill never receives the mouse
- Evidence:
  - `#hud > div { pointer-events: none; }` (style.css:126) is inherited by `#hud-demo`.
  - `.demo-pill` never sets `pointer-events: auto`. `.farm-tag` does.
  - So `pill.title = om.desc` (ui.js:92) is never hovered. In Electron the canvas gets the hover, so the strip doesn't pass the click through either.
- Proposed fix: `.demo-pill.omen { pointer-events: auto; cursor: help; }`. The `native.js` passThrough logic already handles non-transparent targets.

### F7 [severity: minor] Codex and demo text are wrong or invisible
- **Codex toast:**
  - HEAD: the Hollow line is announced as **"The Heart of the Keep rank 2/4"**, because a floor-100 kill uses `e.def.name`.
  - WIP: the toast still says `rank ${rank}/4` while ranks now run 1–28 ("rank 12/4", `wip_check.js`).
  - Fix: `Hollow Codex rank ${rank}/${D.CODEX_MAX}: x1.03 damage & gold forever (${8 - kills % 8} Hollowed kills to the next)`.
- **No Codex progress anywhere** except "Hollow Codex N/28" in the retire box.
  - The week-2 spine needs a "next rank in N Hollowed kills" line, or a 28-pip bar, in Legacy.
- **Demo `demoSealed` toast** (ui.js:530) always says "re-delve in ♛ Legacy for **+6 Renown**". That's false once Renown reaches 120, which a typist does after about 16 laps, around 2 h. The last 8 of 24 laps per 3 h promise Renown that never comes.
  - Fix: `S.renownLifetime >= KK.DEMO_RENOWN_CAP ? 're-delve and beat your best time' : 're-delve in ♛ Legacy for +6 Renown'`.

### F8 [severity: minor] Wired but dead or invisible (leftovers, still open after R5)
- **Alert channel:** only the newest alert is drawn (render.js:322). With five timed moves plus the void slam, add `FX.alert(str, col, life, prio)` and draw the highest priority, void slam = 2. Or use the 2.4 s dodge from F3.
- **Unused cleric cooldown:** `HEROES.cleric.ult.cd: 25` is never read; `sanctuaryReact` hard-codes 25.
- **Dead code:**
  - `UI.offlineModal` is never called.
  - `upCard`'s `tooBig` is always false.
  - `S.runInputs = (S.runInputs || 0);` in `addActivity` is a no-op.
  - `KK.on('echo', () => {})` is empty.
- **Spark cap "/150":** reached 0% of the time (`pt_typist_s6_480`: 0 of 61,597 inputs wasted). Show "⚡ 87".
- **No progress counters for achievements**, and the stat box has no Chests or Wipes (R5 F4/F6, still open).
- **Hollow Scholar** (codex28) isn't reached in 40 h (HEAD max 22/28). That's fine as a week-3 goal, but the player can't see it coming (F7).

## Verified fixes from last round (pass/fail, one line each)
- **Week-2 empty stretches: PARTIAL.**
  - 40 h typist longest gap after 8 h: 399–569 min (R5: 738–1,375). Light 217–359 (R5: 474). Idle 276–442 (R5: 273).
  - Beats after 8 h: typist 20–25 (R5: 9–13).
  - The Codex bunching leaves a gap of about 8–9 h (F4).
- **Re-delve banner: PASS.** "A NEW DELVE BEGINS · BEAT 4:05" (ui.js:452). The `demoSealed` toast is stale (F7).
- **War Charge frequency: PASS, readability PARTIAL.**
  - Demo: 30–31 charges per 3 h (typist), 68–70 (idle/burst). The warning shows in 88–92% of typist and 100% of idle Warlord fights.
  - Full game, typist, non-Hollowed: 14–50%. Hollowed: 93–100%, median 2–22 per fight.
  - Damage numbers are hidden 2.1 s per charge (F5).
- **Reassemble frequency: PASS (93–100% of fights). Readability: FAIL.** He dies again 0.4 s after rising (F2).
- **Ember floaters: PASS.** `'+' + Math.round(10 * emberGain)` and `25 *` match `gainEmbers` (fx.js:351–352).
- **Speedrunner: PASS.** Typist 1h24–1h27, now apart from Gatekeeper (0h34–0h38). Idle 2h36–3h50. Heavy lands in the same minute as Blitz (0h52).
- **Hands Off: PASS.** Idle 1h15–1h24. It counts keys only and resets on retire or omen pick.
- **Blitz: PASS.** It uses `stats.playTime`. Unlocks at 1h04–4h25. WIP raises the requirement to 8 bosses.
- **Omen pill tooltip: FAIL.** The title is set but can never be hovered (F6).
- **Pell card text: PASS.** "FREE Sanctuary: Answers the first boss slam…". The `ult.cd` value is still unused.
- **Heart of the Keep: PASS** for spawn, toast and Codex credit. Its toast name is wrong (F7), and idle fights against it lasted up to 12.5 min on HEAD (F1).
- **Pacing sanity (HEAD):**
  - First boss: typist 0h03, idle 0h07.
  - First retire: typist 0h28, idle 0h59.
  - No monsters are left unseen at 8 h.
  - Demo: typist best 3.9–4.1 min, Renown 120 by 3 h. Idle and burst reach 96.

## Ideas (optional, max 3)
1. **"Type to break free":** an ultimate cast by a webbed hero tears the web, and an ultimate cracks the Magma Shell. Two of the four new moves then show the typing hook on the strip, while idle players still get through at x0.5 / 4 s.
2. **The Omen of the Day ★ in the Steam rich-presence line** ("★ Glass Delve · floor 142/153"), plus a "Seals" counter in the stat box. It's the one daily reason to glance at the strip.
3. **Name the boss move in the boss bar** ("GOBLIN WARLORD · CHARGING", "EMBER COLOSSUS · SHELLED") instead of only the alert plate. It's readable at size S and never collides with the void alert.
