# Round 05 — T1 economist (Incentive & Economy Designer)

## Verdict
**Full game: 8/10 (unchanged).** I would keep it running tomorrow, and nothing here would make me refund.

What R4 fixed holds:
- **Omens have no dominant pick any more.** A rational best-of-3 picker ends 8 h at R536, the same as a random picker (R537).
- **The demo→full import can no longer break the full game.**
- **Depth trophies are a bounded bonus, not a snowball.**

**But the new late-game "danger" isn't real for most players.** Sister Pell's normal heal scales with every damage multiplier (Fame, trophies, Lineage, Forge). At 8 h one heal is **6× (idle) to 300× (typist)** the target's max HP, so:
- The 45% void slam is cosmetic for idle and burst: 0 Hollowed wipes in 8 h, even with Sanctuary switched off.
- It only taxes the typist who is pushing the frontier.

**The typist/idle gap at 8 h widened from 1.32–1.35× to 1.39×,** driven by trophies, Second Wind and Static Coins.

**Demo: 7.5/10.** The cap and import work. But a typist's Renown stops at minute 51, and the demo's Legacy freezes at 7 cheap ranks.

Method:
- About 250 seeded headless runs (3–4 seeds each) on the real sim, using the R4 smart-spend player:
  - Smart relic ranking, 60 s glance.
  - In-game nudge retire with an 8-min stall fallback.
  - Random omen pick unless stated.
- Runs covered 8 h, 24 h and 40 h.
- Scripts are in `docs/playtest/round-05/econ5*.js`:
  - `econ5lib.js` is the player plus telemetry for achievements, trophies, Hollowed fights and Sanctuary.
  - `econ5_demo.js` runs the import through the real `KK.load` with a fake `kkNative` file store.
  - Test-only variants are applied in memory: `noVoid`, `noVigil`, `noSanct`, `noTrophy`, `noArmor`, `noStatic`, `heal25/40` (Cleric heal cap), `dynamo4/6` (idle Workshop item).
- Raw output is in `out_*.txt`. `tools/playtest.js` reference runs are in `out_pt_*.txt`.
- No game file was edited.

## Findings (ranked, max 8)

### F1 [severity: major] Cleric heals scale with damage, so the void slam, HP banes and Sanctuary only matter to the typist at the frontier
- Evidence:
  - **Heal size** (`econ5_heal.js`, seed 1): one regular Pell heal (`world.js:344`, `heroDmg * 3.2 * m.dmg * pm`) compared with the target's max HP.

    | Profile | Time | Heal vs knight max HP | Heal vs mage max HP |
    |---|---|---|---|
    | Idle | 8 h | 6.3× | 115× |
    | Idle | 16 h | 75× | |
    | Typist | 8 h | 303× | |
    | Typist | 16 h | 4,682× | |

    - `m.dmg` includes Fame, trophies, Lineage, Blades, Whetstone and Glass. HP only gets Armor and HP relics.
    - So one heal resets any hero, and a 45% slam is undone within one Cleric cooldown.
  - **Void slam on/off, 8 h, 3–4 seeds** (`out_void_*.txt`, `out_heal_burst.txt`):

    | Profile | Base | No void slam | No Sanctuary at all | Hollowed fights | Wipes at Hollowed bosses | Time blocked |
    |---|---|---|---|---|---|---|
    | Idle | f105.3 | f108.3 | **f106.7** | 100% won (26 slams per fight at f100+) | 0 | 0 min |
    | Burst | f113.0 | f112.0 | | 100% won | 0 | |
    | Typist | f146.8 | f149.0 | | f130+: 35% won (49% without the slam) | 15 (8 without) | |

  - **Typist at 24 h:** f169.0 with the slam, f171.3 without. The f130+ wall exists without the slam too (15% won); it's boss attack against the frontier party's HP.
  - **Without Sanctuary, the typist is blocked 81–114 min** instead of 20–55, but loses only 1.5 floors. So Sanctuary matters only to typists, and only a little.
  - **Vigil changes nothing** (`noVigil` gives the same numbers as base, ±0.5 floors).
  - **This turns the R4 rule upside down** ("a bane meant to cost idle should hit HP or gold"). The new danger hits the active player and skips the idle one.
  - **Partial good news:** Rivet Armor now matters for idle. Without it, idle loses 8.6 floors at 8 h (f98.7, 106 wipes; R4: −0.3). Typist without it: −16 floors.
- **Tested fix, regular heal capped at 25% of the target's max HP** (`heal25`; Sanctuary's full heal is unchanged):

  | Effect at 8 h | Idle | Typist | Burst |
  |---|---|---|---|
  | Depth | f106.0 (+0.7) | f144.7 (−2.1) | f110.0 (−3) |
  | Wipes at Hollowed bosses | 0 → 21 | | |
  | Time blocked at Hollowed bosses | 0 → 26–69 min | | |
  | Sanctuary off as well | +10 wipes, f105.0 | f141.7 | |
  | Glass Delve (wipes vs none: 36 vs 12) | +5% → +2% | | |

  - Heals capped at 40% of max HP are almost a no-op for idle (2 wipes).
  - So the cap creates retries and Sanctuary moments without walling anyone: Hollowed fights at f80–99 are still won 43–97% of the time.
- Why it matters:
  - R4 sold the void slam as "the late game now has danger and Sanctuary moments". For idle and burst players, who are most of a desktop-strip audience, it's a purple flash and a number.
  - The HP halves of Glass, March and Fever, Spacebar Shield and Vampire Fang stay cosmetic for anyone with Pell.
  - A min-maxer will post "HP doesn't matter once Pell is out". Within a week, the omen banes read as fake.
- Proposed fix:
  1. In `world.js:344`: `const amt = Math.min(F.heroDmg('cleric', S.heroes.cleric) * 3.2 * m.dmg * pm, low.maxHp * 0.25);`
  2. Keep the void slam at 45% and every 8 s, and keep Vigil. Re-run the f130+ typist wall after the change: it currently costs about 2 floors.
  3. If you'd rather not touch heals, at least don't describe the slam as danger. Measured, it's flavour.

### F2 [severity: major] The 8 h typist/idle gap widened to 1.39×. Trophies are fine on their own, but trophies, Second Wind and Static Coins all pay the typist
- Evidence:
  - **Profiles at 8 h, 4 seeds:**

    | Profile | Depth | Renown | Trophies | Achievements |
    |---|---|---|---|---|
    | Typist | f146.8 | R537 | 13 | 29.3 |
    | Burst | f113.0 | R311 | 8.3 | 24.0 |
    | Idle | f105.3 | R266 | 7.0 | 23.5 |

  - **Typist/idle depth ratio over time:** 1.9× at 1 h, 1.67× at 2 h, 1.43× at 4 h, **1.39× at 8 h**, 1.33× at 24 h, 1.33× at 40 h. R4 had 1.32–1.35× at 8 h.
  - **Renown ratio at 8 h is 2.0×.** Burst/idle depth is still only 1.07×. Burst never reaches FLOW: a 5–15 s burst at 4 keys/s tops out at 72 Fervor.
  - **Trophies on/off** (40 h, 3 seeds; `out_long_*.txt`):

    | Profile | 8 h | 24 h | 40 h |
    |---|---|---|---|
    | Typist | +11 floors (147 vs 136) | +9 | +12 |
    | Idle | +4 | +9 | +9 |

    - That's a constant offset, not a runaway. Fame at 40 h is ×579 against ×341, and the wall eats it (eHp ×1.275 per floor).
    - **Last trophy (f150):** the typist reaches it at 9.1 h. Idle reaches f130 at 30 h and never reaches 140 or 150 within 40 h.
    - Each trophy is worth about 0.8 floors. **Verdict on trophies: fine.** They only widen the gap in hours 2–10, because the leader collects them first.
  - **Typist Workshop value at 8 h:**
    - Second Wind: +5.8 floors (f146.8 vs f141.0).
    - Static Coins: +5.1 floors (f141.7 without it).
    - Idle's whole Workshop: about +2 (R4).
- Why it matters: typists are meant to win. But the idle Renown rate is half the typist's, and the gap grows exactly in the hours where a Next Fest player decides whether to wishlist. The review line would be: "if you don't type all day you fall behind fast".
- Proposed fix (tested in memory, `dynamo4/6`): add a Workshop item, **"Dynamo: +6% power per level while you're not typing, max 10, base 150 Embers, growth 1.6"** (`m.idlePow += 0.06 * l`).

  | Profile at 8 h | With Dynamo | Change |
  |---|---|---|
  | Idle | f109.3 | +4.0 floors, +9% Renown |
  | Burst | f115.3 | +2.3 |
  | Typist | f146.3 | −0.5 (noise) |

  - The gap goes from 1.39× to **1.34×**.
  - It stacks with Idle Battery (`powerMult` takes the max of the Fervor tier and 1 + `idlePow`), so it never makes typing worse.
  - Leave trophies as they are.

### F3 [severity: minor] "Hands Off" can't be earned in real play. Every click counts as an input, including the omen pick
- Evidence:
  - `achievements.js:47,87`: `runInputs` counts every `activity` event. That includes `click`s:
    - in the browser, `input.js:30` counts every mousedown;
    - in the desktop build, the global hook counts mousedowns in any app (`electron/main.js:192`).
  - **What a real player has to click:**
    - From retire 2 on, the dungeon is paused (`KK.paused`, `ui.js:461`) until you click an omen card or NO OMEN.
    - After retire 1, Legacy opens and every Renown buy is a click.
  - **The only paths are:**
    - retire #1 and then never spend; or
    - toggle "Count my keystrokes" to PAUSED *before* clicking Retire, which is undiscoverable.
  - The sim reports idle unlocking it at 90–92 min only because the sim player never clicks.
- Why it matters: an "idle" achievement in an idle game that idle players can't get reads as a bug ("Hands Off is bugged" threads, and broken completion %).
- Proposed fix:
  1. `KK.on('activity', ({ kind }) => { if (kind === 'key') KK.S.runInputs++; })`
  2. Add `KK.on('omenPicked', () => { KK.S.runInputs = 0; })`.
  3. Change the description to "Reach floor 50 in a delve without typing".
  - Expected unlock: the first overnight delve after retire 1 or later (idle about 1.5 h; typist whenever they leave it running).

### F4 [severity: minor] Speedrunner unlocks on the same kill as Gatekeeper for typists, and becomes impossible after Head Start 8
- Evidence:
  - **Typists, 4/4 seeds:** Gatekeeper and Speedrunner both unlock at 35 min.
  - **Why:** the in-game nudge retires at the f40 *door* (`ui.js:570`, `maxFloorRun >= 40`). So the first f40 boss kill happens in delve 2, at 8.9 min (`econ5_probe.js`), inside the 10-min window.
  - **Idle:** 75 → 94 min. **Burst:** 69 → 90 min.
  - **Head Start 8 starts at f41,** so a player without Speedrunner can never visit f40 again (`achievements.js:27`).
- Proposed fix: **"Beat the floor-60 boss within 10 minutes of a new delve."**
  - Measured f60 boss splits:
    - Typist: delve 4, 7.3 min (about 1h20–1h45).
    - Burst: delve 5, 9.2 min (about 2h10).
    - Idle: delve 5, 9.0 min (about 3h).
  - It's always reachable, since the Head Start maximum is f41.

### F5 [severity: minor] Blitz counts boss kills from before a restart (bug)
- Evidence:
  - `achievements.js:28` timestamps kills with `KK.simTime`. That restarts at 0 on every launch, but `S.achP.bossTimes` is saved.
  - Old entries get `now - x < 0`, so they pass the 10-min filter until the new session catches up.
  - **Repro:** save 4 boss kills at simTime 4700–5000, reload, kill 1 boss 50 min into the new session → **Blitz unlocks** (`[4700,4800,4900,5000,3000]`).
- Proposed fix: use `KK.S.stats.playTime` (saved, monotonic) instead of `KK.simTime`.

### F6 [severity: minor] Demo Renown ends at minute 51. With the import conversion in place, the cap can go back up to 120 at no cost to the full game
- Evidence (`econ5_demo.js`, `econ5_cap.js`):
  - **Cap 48 is reached at:**
    - typist 51–56 min;
    - idle 99–118 min;
    - burst 97–106 min.
  - After that, a Next Fest typist plays 2+ h of re-delves at +0.
  - **The demo's Legacy freezes at** Lineage 3, Treasury 3, Quartermaster, Veterans 1, Head Start 1, Zeal 1, Recruiter. Warm Campfire, Idle Battery and Relic Collector are **never bought in the demo**, so the demo never shows them.
  - **The import makes the cap size irrelevant to the full game.** Typist importer (cap 120 vs cap 48):

    | Time in the full game | Cap 120 | Cap 48 |
    |---|---|---|
    | +1 h | f110 R293 | f100 R241 |
    | +2 h | f120 R352 | f120 R354 |
    | +4 h | f135 R452 | f135 R451 |

    - Both stay below a fresh full player at equal total hours: 8 h fresh is f147. Cap 120 converts to renownFloor 73.
- Proposed fix: `KK.DEMO_RENOWN_CAP = 120` (`state.js:30`).
  - It's reached at 2h05 (typist) or 3h30 (idle), and buys Campfire 2, Battery 3, Veterans 3 and Head Start 2.
  - Keep "DEMO RENOWN MAXED: BEAT YOUR BEST TIME" after that.

### F7 [severity: minor] Head Start bought mid-delve jumps the party without its +8 levels per rank
- Evidence:
  - `state.js:239–240`: buying Head Start moves the party to the new start floor (the Legacy panel opens right after a retire, so this is the normal moment).
  - Only `veterans` raises hero levels.
  - **`econ5_hsjump.js`, 4 ranks bought right after retire 1:**
    - The party lands on f21 with the knight at **lv 1** (a fresh delve would give lv 33).
    - Idle: 19 wipes in the first 5 min, recovering by +15 min.
    - 8 ranks puts a typist on f41 with a lv-1 knight (13 wipes).
  - It's not a lock: rat gold and Earthshatter dig out. But it's the R4 "Head Start sends you backwards" complaint again.
- Proposed fix: in `buyLegacy`, change `if (id === 'veterans')` to `if (id === 'veterans' || id === 'headstart')`.

### F8 [severity: minor, info] Omens are now balanced flavour; Augur needs an "unseen" marker
- Evidence: one omen forced on every delve, 8 h, 4 seeds, Renown change against no omen:

  | Profile | Range | Best | Worst |
  |---|---|---|---|
  | Typist | −3% to +5% | Deep +5%, Storm/Ember Tide/Gilded +3% | Glass −3% (105 wipes vs 30) |
  | Idle | −6% to +9% | Quiet +9%, Deep +8% | Hoard −6%, Ember Tide −4% |
  | Burst | −1% to +12% | Quiet/Glass +12%, Storm +10% | |

  - **Best-of-3 by rank against random:** typist +0%, idle +6%.
  - Quiet being idle's best is by design.
  - Hoard and Ember Tide are mild idle traps: Embers have almost no idle use.
  - **Augur (all 10 omens)**, by Monte Carlo of the real offer rule (`econ5_augur.js`):

    | Picker | Omen delves needed |
    |---|---|
    | Seeks unseen omens | median 12 (p90 15) |
    | Random | median 25 (p90 40) |

    - Random-pick typist sim: 31.6 h.
  - The modal doesn't show which omens you've already delved under.
- Proposed fix:
  1. A "NEW" badge on omen cards not yet in `S.achP.omens`. That makes Augur a 12-delve goal (about 8 h typist, 10 h idle).
  2. Optional: add "NEEDS TYPING" on Ember Tide.
  3. No number changes.

## Verified fixes from last round (pass/fail, one line each)
- **R4 F1 demo cap 48: PASS.** Lifetime Renown is exactly 48 in 9 of 9 three-hour runs, reached at 51–118 min. Re-clears pay +0 after it, and the best-time loop keeps going (laps 5.4–8.9 min).
- **R4 F1 import conversion: PASS** (real `KK.load` with a fake file store):
  - `demoSave` true → false; renownFloor 40 → 49 (`renownFor(49)` = 49 ≥ 48).
  - Loading the converted save again changes nothing (49 stays 49).
  - An edge save with lifetime 400 converts to f128.
  - The importer is never ahead of a fresh full player at equal total hours: 3 h demo + 1 h full is f100 R251, against 4 h full-only at f125 R381.
  - All 17 internal demo achievements carry over. That's by design.
- **R4 F2 Deep ×1.12: PASS.** Forced Deep is +5%, +8% and +8% (typist, idle, burst), down from R4's +27%, +29% and +25%. It now costs 0.8–2.5 floors of depth, so it's a real trade.
- **R4 F3 Glass attack-speed bane: PASS.** Idle Glass went from +21% to +5%; typist is −3% at 8 h. The root cause (HP is free) is **not** fixed (F1).
- **R4 F4 Muster keeps the Forge: PASS for the code.** The Forge of 12/12/12 is restored on pick. In 1,000 consecutive offers, 0 omens repeated from the previous offer. Its value is weak: +0%/0%/+1% at 8 h, +4% typist at 4 h. That's no longer negative.
- **Omen value spread: PASS** (F8). No pick is right every time.
- **R4 F5 Static Coins tag: PASS.** `needsTyping: true` renders NEEDS TYPING. It's worth +5.1 floors to a typist at 8 h.
- **Second Wind (30 s, cost 120): PASS.**
  - Typist: +5.8 floors and +8% Renown at 8 h. It triggers 29.7 times per hour for 1,627 bonus Sparks per hour. The R4 trap was −13% at 1 h; there's now only a small cost at 1 h (f66.3 vs f67.8).
  - Burst: +3.5 floors, +5% Renown.
- **Head Start +8 levels and the retreat floor: PASS at retire** (HS 8 gives knight lv 65; a wipe at f41 stays on f41). **FAIL when bought mid-delve** (F7).
- **Sanctuary is free: PASS** (cost 0). It's cast 124–145 times per 8 h, 80–90% of them in Hollowed fights. It's simply not needed (F1).
- **R4 F6 harness: PASS.** The demo nudge waits for the card, and re-delves on clear (retires at 27/36/43/51 min).
- **R4 F7 Fame display: PASS** ("Fame x…").
- **Campfire copy: still FAIL.** `data.js:129` says "% of online"; `ui.js:502` says "recent kill income".

### Achievements: unlock times (sim minutes; 4 seeds at 8 h, 3 seeds at 40 h)
**Typist:**

| Achievement | Unlock |
|---|---|
| flow | 0 |
| first_boss | 4 |
| rat | 5 |
| caverns | 9 |
| comeback | 13 |
| epic | 14 |
| full_party | 16 |
| retire1 | 27 |
| ult_boss | 27 |
| **gatekeeper** | **35** |
| **speed40** | **35** |
| magma | 36 |
| echo | 39 |
| lv100 | 45 |
| void | 49 |
| omen1 | 53 |
| blitz | 61 |
| hollow | 66 |
| keys10k | 79 |
| f100 | 103 |
| deep90 | 122 (2/4 seeds; 380 at 40 h) |
| flow1h | 124 |
| hollowed6 | 146 |
| ults1k | 155 |
| revive | 198–285 |
| rats25 | 205 |
| chests100 | 219 |
| f125 | 234 |
| retire10 | 322 |
| crucible10 | 352 |
| keys100k | 781 |
| flow10h | 950 |
| omen10 | 1897 (random picker) |
| legacy_all | needs 317 Renown in capped ranks, about 4 h for a deliberate buyer; my even-split spender never finishes Veterans and Head Start |
| idle50 | never (F3) |

Result: 29–30 of 35 at 8 h, 33 at 40 h.

**Idle:**

| Achievement | Unlock |
|---|---|
| rat | 5 |
| first_boss | 7 |
| comeback | 17 |
| caverns | 21 |
| full_party | 33 |
| revive | 35 |
| retire1 | 50 |
| epic | 52 |
| gatekeeper | 75 |
| magma | 75 |
| echo | 77 |
| omen1 | 86 |
| speed40 | 94 |
| lv100 | 107 |
| void | 125 |
| blitz | 153 |
| hollow | 155 |
| ult_boss | 178 |
| rats25 | 228 |
| hollowed6 | 361–377 |
| f100 | 350–377 |
| chests100 | 429 |
| retire10 | 515 |
| deep90 | 655 |
| f125 | 1258 |
| omen10 | 1647 |
| ults1k | 1970 |
| crucible10 | never in 40 h (Embers spread over the typing items) |

- Idle structurally can't get 5: flow, keys10k, keys100k, flow1h and flow10h. That's acceptable for a typing game.
- Result: 23–24 of 35 at 8 h, 26–28 at 40 h.

**Burst:** like idle, but ult_boss comes at 68 min, ults1k at 438, and **Flow State is never reached** (a burst tops out at 72 Fervor).

**Demo set (5):**

| Profile | Unlocks |
|---|---|
| Typist | all 5 by about 28 min (gatekeeper and retire1 together) |
| Idle | 4 of 5 (no Flow); gatekeeper at 76 min |
| Burst | 4 of 5; gatekeeper at 66 min |

**Order and trivial cases:**
- Speedrunner = Gatekeeper (F4).
- Second Try (13–17 min) and Centenarian (45 min) are trivial onboarding.
- Buying Head Start emits a `floor` event for f41, so Into the Moss and Fire Below can unlock without walking there. Harmless.

## Ideas (optional, max 3)
1. **More trophies after f150:** every 10 floors to f200, at ×1.05 each. A typist hits f150 at 9.1 h and then has no depth goal for the rest of week 1 (40 h: f177). Each trophy is worth about 0.8 floors, so this can't run away.
2. **Show the trophy multiplier** ("13 depth trophies: ×1.89 dmg & gold") next to Fame. It's the second-biggest permanent multiplier, and the UI only shows the count.
3. **Steam leaderboard: fastest delve to f40 in the demo** (R4 idea 3, still valid). With Renown capped, the best time (typist 5.4–5.6 min, idle 7.7–8.9) is the demo's only score.
