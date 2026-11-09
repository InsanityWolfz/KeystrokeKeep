# Round 03 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
R2's mechanical fixes all landed:
- Echo now always double-casts.
- Hotkey Ring fires every 60th keystroke.
- Midnight Oil raises the offline cap to 100%.
- Battery is capped at 3.
- Head Start no longer overshoots.
- The Crucible works.
- Ultimates are worth 28% of a typist's speed again (R2: 17%).

**The demo has a good 35-minute arc for a typist.** Four heroes, four bosses and two biomes arrive in the first 14 minutes. There is a wall at floor 30, then a guaranteed epic. The retire comes about 27 minutes in, then a 9-minute re-climb, then the "Demo complete" card.

**After the card the demo is dead.** Across 5 of 5 runs and 83–112 minutes each, there were no bosses, no relic chests, no Renown and nothing new. The card itself promises "retire for Renown and try new relic builds", and neither is possible. On top of that, the card's state isn't saved, so the modal pops up again every launch.

**The full game's content cliff moved earlier.** A typist who follows the in-game retire nudge sees the last major novelty at 2h28–2h39 (R2: 4h06–4h51), then nothing new for 5½ hours. The rotation also hides The Hollow, the Void's own boss, on the player's first visit.

I'd keep the full game running tomorrow, but I'd close the demo after the card. **6.5/10.**

Method:
- **Pass/fail checks:** `verify_r2.js` covers the R2 fixes and the demo save round-trip.
- **Ultimate value:** R1 `ult_value.js`, 5 seeds.
- **8-hour novelty runs** (Hollowed X counts as a new boss):
  - 7 runs of R2 `novelty2.js`: typist s1–3, idle s1–2, heavy, burst.
  - 4 runs of the new `novelty3.js --nudge` (retires when the in-game nudge fires): typist s1–2, idle, burst.
- **Demo:**
  - `demo_map.js`: the real demo build (cap 40), minute by minute. Typist s1–2 for 120 min; idle s1–2 and burst for 180 min.
  - Three runs of `tools/playtest.js --demo --min 180`.
- **New scripts:**
  - `sanct_probe.js`: why Sanctuary is rare.
  - `turn_fix_probe.js`: ultimate-turn rule, live vs. a one-line patch applied in memory.
  - `omen_test.js`: Delve Omens balance probe. 10 omens, typist ×2 seeds for 6 h, plus 7 idle runs.
- **Output:** everything is in `out/`. My files are `verify_r2`, `ult_value`, `nov480_*`, `nov3nudge480_*`, `demo_map_*`, `pt_demo180_*`, `sanct_*`, `turnfix_*` and `omen_*`. The other files there belong to other testers.

## Findings (ranked, max 8)

### F1 [severity: major] Demo: after the "Demo complete" card nothing can happen, and the card promises things that are impossible
- Evidence (`demo_map_*.txt`, 5 runs; "after" counts everything from the card to the end of the run):

  | Run | Card at | Minutes after | Bosses | Relic chests | Renown | First-time events | Hero levels bought |
  |---|---|---|---|---|---|---|---|
  | typist s1 | 37m | 83 | 0 | 0 | 0 | 0 | 187 |
  | typist s2 | 33m | 87 | 0 | 0 | 0 | 0 | 189 |
  | idle s2 | 88m | 92 | 0 | 0 | 0 | 0 | 160 |
  | idle s1 | 71m (card in run 2) | 109 | 3 (run 3 re-climb) | 3 | +17 once, then 0 | 0 | 314 |
  | burst s1 | 67m (card in run 1) | 112 | 3 (run 2 re-climb) | 3 | +27 once, then 0 | 0 | 350 |

  - **Why the delve stops at 39.** Once `S.demoDone` is set, `W.nextFloor` (`world.js:504`) loops floors 37→38→39→37.
  - **Run 2 can never fight the floor-40 boss again.** Its record is stuck at 39, so `renownGain()` is 0 forever.
  - **The retire button reads "REACH FLOOR 41 TO EARN RENOWN" permanently** (`retireTarget()`), and floor 41 doesn't exist in the demo.
  - **Lifetime Renown is hard-capped at 30.** Because Renown is record-based, Campfire, Battery and Relic Collector (20) are never bought in any run (`legacy rows never bought`).
  - **The card's text doesn't match** (`ui.js:457`): "farm gold, retire for Renown and try new relic builds". Renown is 0 and there are no relic offers after the card.
  - **The floor counter visibly drops 39→37 every lap** with no HUD explanation.
  - **Workshop and Forge buys after the card change nothing visible**: 10–11 Workshop and 24–73 Forge buys.
- Why it matters: desktop-companion demos get left running for days during the fest. After about 35 minutes (typist) or about 80 minutes (idle) the strip becomes a gold counter. The likely review: *"Demo ends after half an hour and then it just loops three floors forever, and the retire button says reach floor 41."* The lie in the card makes it worse.
- Proposed fix (cheapest first):
  1. **Loop floors 37–40 including the boss.** After the card, every f40 lap re-fights a Gatekeeper that cycles Rat King → Bone King → Brood Mother → Warlord. Each kill drops a relic chest and +10 Embers.
     - Then the "try new relic builds" promise is true: about 1 chest every 3–4 minutes for a typist.
  2. **Demo Renown:** in demo mode, a retire after re-clearing f40 pays a flat **+6 Renown** ("demo delve bonus"). With Head Start capped at 2, a lap from floor 11 to 40 takes about 9 min for a typist and 15–20 min for idle players.
     - That buys Campfire, Battery and Collector within 3–4 laps, so Legacy keeps having purchases for about an hour.
     - The retire button then says "REACH FLOOR 40 AGAIN", not 41.
  3. **HUD tag:** reuse `#hud-farm` to show "DEMO · farming floors 37–40".
  4. **Card text:** change it to "Keep delving: the Gatekeeper returns every lap. Magma Depths awaits in the full game."

### F2 [severity: major] `demoDone` is not saved, so the "DEMO COMPLETE!" modal pops on every launch
- Evidence:
  - **Cause:** `KK.load` only copies keys that exist in `KK.newState()` (`state.js:295`), and `demoDone` isn't one of them.
  - **Test** (`verify_r2.js` G): demoDone `true` before save, `undefined` after load.
  - **Next session:** the party on 37–39 walks into floor 40 again. The floor-40 boss spawned once and **demoComplete fired again** within 10 minutes of the reload.
  - So every launch re-fights the Warlord, rolls a free relic and shows the same blocking modal.
- Why it matters: a modal over your work every morning is exactly the nag/interrupt complaint the R1 offline toast removed. The same merge rule will silently drop any future top-level field, for example Omens or trophies.
- Proposed fix:
  - Add `demoDone: false` to `newState()`. This is one line.
  - Add a comment at the merge that every new persistent field must be added to `newState()`.

### F3 [severity: major] Full game: the content cliff moved about 1h30 earlier. Typists get no major novelty from about 2h30 to 8h
- Evidence: 8-hour runs. Major novelty = a new hero, biome, boss (including Hollowed X) or mechanic.

  | Profile (retire rule) | Last major novelty | Longest stretch with no major novelty after hour 1 | Major novelty per 30 min, hours 1–8 | Floor at 8 h |
  |---|---|---|---|---|
  | typist s1/s2/s3 (stuck 8 min) | 3h16 / 3h33 / 3h29 | 284 / 266 / 271 min | `2 2 2 2 2 0 0 0 0 0 0 0 0 0` (s1) | 127–130 |
  | typist s1/s2 (follows nudge) | **2h28 / 2h39** | **332 / 321 min** | `4 2 1 0 0 0 0 0 0 0 0 0 0 0` (s1) | 130 |
  | heavy (stuck) | 2h37 | 322 min | `3 2 2 1 0 0 0 0 …` | **150** |
  | burst (stuck / nudge) | 5h44 / 6h00 | 135 / 119 min | `2 1 4 0 1 2 2 0 0 1 0 …` | 101–102 |
  | idle s1/s2 (stuck) | 6h46 / 7h57 | 74 / 80 min | `3 1 2 1 1 0 1 0 2 0 1 1 0 0` | 97–99 |

  - **R2 comparison:** typists' last major novelty was at 4h06–4h51 and their 8-hour floor was 105–110.
  - **The rotation now spends all 7 Hollowed variants in the first 2–3 delves past floor 70,** and compounding Fame pushes typists through floors 100–130 in the same Void with the same 7 bosses.
  - **Floor 100 is reached at:** typist 2h37–3h27, heavy 2h09, burst 5h54–6h43. Idle players don't reach it in 8 h (97–99).
- Why it matters: hours 2–5 are the "is this worth $4.99" window, and typists, the target audience, now spend 5 of their first 8 hours seeing nothing new. The likely review: *"Saw everything by lunch."*
- Proposed fix: ship **Delve Omens** first (spec under Ideas 1). It recurs at every retire: nudge-following typists retire 11–12 times in 8 h, about one every 40 min, which lands right in the dead stretch. Then build the floor-100 finale, which typists reach exactly at the cliff (2h37–3h27). Depth trophies are a cheap 30-minute add-on for the 110–150 stretch (Ideas 2).

### F4 [severity: major] The Hollow, the Void's own boss, is skipped on the first Void visit for anyone who retires early
- Evidence:
  - **Rotation rule:** `bossFor` uses `all[(floor((f-70)/10) + 3*retires) % 7]` (`state.js:60`).
  - **Which delves have no Hollow** (`verify_r2.js` F): with retires = 1, 3 or 5, floors 70–100 hold no Hollow at all:
    - r1: brood, warl, colos, magma
    - r3: bone, brood, warl, colos
    - r5: rat, bone, brood, warl
  - **Nudge-following players** (`nov3nudge480_*`, "first f70 boss"):

    | Profile | First boss at floor 70 | First The Hollow |
    |---|---|---|
    | typist s1 | Hollowed Magma Lord (r2) | 1h16, f80 |
    | typist s2 | Hollowed Magma Lord (r2) | 2h00, f90 |
    | burst | Hollowed Ember Colossus (r4) | 4h21 |
    | idle | Hollowed Ember Colossus (r4) | 5h01 |

  - So the biome called "The Hollow Void" opens with a purple Ember Colossus, a boss the player already killed at floor 50.
  - Only the harness's stuck-retire typist, who first reaches floor 70 with 0 retires, meets The Hollow at floor 70.
- Why it matters: the one boss with a unique identity in the Void is buried among re-tints, and the Void's first boss moment reads as a repeat.
- Proposed fix:
  - Floor 70 is always The Hollow.
  - Rotate the other six bosses over floors 80+: `if (f === 70) return 'hollow'; return six[(Math.floor((f - 80) / 10) + 2 * retires) % 6]`.
  - At 4 boss floors per delve (80–110), a step of 2 still shows all six within 2 delves.

### F5 [severity: major] Sanctuary is still almost never cast. The "boss <80%" rule changed nothing measurable
- Evidence:
  - **Casts per minute of owning the Cleric:**

    | Source | R3 | R2 |
    |---|---|---|
    | Typist, 8 h | 0.02–0.08 (11–35 casts) | 0.01–0.09 |
    | Heavy, 8 h | 0.15 | — |
    | Burst, 8 h | 0–1 casts | — |
    | Idle, 8 h | 0–6 casts | — |
    | Demo, before the card | 0–6 casts | — |

  - **`sanct_probe.js`** (3 h runs):

    | Run | Boss fights with the Cleric | Fights with a Sanctuary | Cleric holds the ultimate turn (% of boss time) | Someone below 80% (% of boss time) | Average Sparks at a boss slam |
    |---|---|---|---|---|---|
    | typist s1 | 17 | 5 (29%) | 6.1% | 22% | 11 |
    | typist s2 | 21 | 0 (0%) | 4.1% | 16% | 17 |
    | idle s1 | 12 | 0 (0%) | 7.7% | 30% | 10 |

  - Sanctuary costs 40 Sparks, and only 2–14 of 193–247 boss slams happened with 40 or more Sparks banked.
  - Root cause: the turn reaches the Cleric only briefly, she passes unless someone is low at that exact moment, and Knight and Archer have already spent the Sparks.
- Why it matters: "revives the fallen" is Sister Pell's whole card, and most players will never see a REVIVED pillar.
- Proposed fix: make Sanctuary a **reaction, not a turn**.
  - In each boss fight, the first `heroDown`, or the first `bossSlam` that leaves anyone below 50%, triggers a **free** Sanctuary if Pell is alive and `ultCd` is 0.
  - Take her out of the Spark rotation, so the other three get her share.
  - Verify with `sanct_probe.js`: at least 60% of hard boss fights (fights with a wipe or a death) should show a Sanctuary.

### F6 [severity: minor] The ultimate turn "spins" to the Archer, so idle players basically never see Meteor
- Evidence:
  - **The rule:** a hero with nothing in range passes the turn (`world.js:322`), so between waves the turn circles every frame. The Archer has the longest reach (120), so it claims the first cast of every wave.
  - **Live rule:**
    - Idle, 2 h, 3 seeds: **Archer 83%, Meteor 0** of the ultimates.
    - Idle, 8 h: Mage 2–10 casts.
    - Demo after the card, typist: Archer 659 vs Mage 66 (`pt_demo180_typist`).
  - **`turn_fix_probe.js`** patch, applied in memory: `if (h.ultCd > 0 || (!want && h.id === 'cleric')) W.passUlt();`, so a hero only passes on cooldown.

    | Profile | Live rule | Patched |
    |---|---|---|
    | idle (Knight / Archer / Mage share) | 13% / 83% / 0% | **33% / 33% / 29%** |
    | typist (Knight / Archer / Mage share) | 25% / 50% / 23% | 39% / 36% / 24% |
    | typist depth after 60 min | 50.7 | 51.7 |

- Why it matters: Mortimer's 1,500-gold recruit is Meteor, and idle players never see it.
- Proposed fix: the one-line change above. A hero holds the turn until something is in range or its cooldown runs; only the Cleric passes on "no need".

### F7 [severity: minor] Leftover dead or lying rows
- **Idle Battery 3 nearly erases FOCUSED:** x1.24 vs x1.25 (`verify_r2.js` D), so light typing adds +0.8%.
  - Typists reach rank 3 at 2h51–3h09, idle players at about 8 h.
  - Fix: 0.06 per rank (max x1.18), so FOCUSED keeps +6%.
- **Head Start ranks 3–8 are buyable in the demo but do nothing:** `data.js:126` clamps to 2, while the description says "now floor 16".
  - Fix: set max to 2 in demo, or append "(demo: max floor 11)".
- **Hotkey Ring loses about 15% of its procs** out of combat (61 procs → 52 casts; `verify_r2.js` B2).
  - Fix: store the proc and fire it on the next active enemy.
- **The guaranteed floor-30 epic misses players who retire at the floor-30 wall:** the check is `retires === 0` (idle s1 retired at 43 min while stuck on Brood Mother).
  - Fix: use a `S.tutorial.epic30` flag that fires on the first floor-30 kill ever.
- **The Workshop header says Embers come only from Sparks** (`ui.js:238`). Idle players' Embers come almost entirely from bosses (+10) and rats (+25), and no Ember pop-up exists anywhere.
  - Fix: change the text to "…plus 10 per boss and 25 per golden rat", and add a small "+10 ✦" float on boss kills.

### F8 [severity: minor] Wired but invisible
- **Fame is shown linearly but compounds:**
  - The Legacy line `+${R*3}% dmg & gold` (`ui.js:267`) shows **+1,257%** at lifetime 419. The real value is `(1+0.03R)·1.004^R` = **+7,130%**, understated 5.7×.
  - This is the single biggest number in the game. The retire button already uses the right formula.
  - Fix: use `renownWorth`'s `fame()` in the Legacy line.
- **Stats nobody sees:** `S.stats.chests` and `S.stats.wipes` are still tracked and never shown (`ui.js:273-279`).
- **The spark cap is never reached:** "/150" sat at cap **0.0% of the time in all 11 eight-hour runs**, with heavy typists peaking at 148.
  - The bar is honest, but "/150" reads like a goal. Consider showing just the number plus the charge bar.
- **The demo floor loop is unexplained** (see F1.3).

## Verified fixes from last round (pass/fail, one line each)
- **Spark Jar → Ember Crucible: PASS.** Crucible 10 multiplies Embers by 2.5: typist 1,676 → 4,190 and idle 185 → 464 per 45 min. All 10 levels cost 10,899. Typists hold crucible 9 by about 5h30.
- **Sanctuary frequency (boss <80% rule): FAIL.** 0.02–0.08 per owned-minute for typists, 0–6 casts in 8 h for idle players, 0–29% of boss fights (F5).
- **Ultimate value after the 1.5× buff: PASS.** Floor 30 in 19.9 min with ultimates vs 27.7 without. That's a 7.8-minute gap (target ≥5), worth 28% of a typist's speed (R2: 17%). Fervor is worth 48% (38.2 min without it).
- **Echo always twice: PASS.** 100 casts gave 100 echoes (200 ultimate events).
- **Hotkey every 60th keystroke: PASS.** 3,691 keys gave 61 procs (62 expected). 15% are lost out of combat (F7).
- **Midnight Oil raises the cap: PASS.** Campfire 4 + Oil = 100% (R2: clamped at 80%). Campfire 2 + Oil = 80%, Campfire 3 + Oil = 90%.
- **Hollowed rotation by retires: PASS mechanically.** All 7 bosses appear within any 2 consecutive delves. Side effects: the cliff moved earlier (F3) and The Hollow is skipped (F4).
- **Hollowed tint and name: PASS.** Purple tint and void glow (`render.js:216,484`). The name reads "The Hollowed Rat King".
- **Idle Battery cap 3: PASS.** Max 3, x1.24, and the old ranks are refunded on load. The value is still too close to FOCUSED (F7).
- **Head Start transition overshoot: PASS.** 5 of 5 mid-door purchases land on floor 11.
- **Demo cap 40: PASS as a cap.** The card arrives at 33–37 min for typists and 67–88 min for idle and burst players. The run after the card is dead (F1), and the card re-pops each launch (F2).
- **Demo epic: PASS in 5 of 5 runs.** An epic was offered in every run. The floor-30 guarantee itself missed 1 of 5 (F7).
- **Ultimate charge bar (R2 F8): PASS.** It's drawn over `W.ultTurn` (`render.js:446`).

## Demo map (cap 40), minute by minute

**Typist** (`demo_map_typist_s1/s2`):

| Min | What's new / what happens | What the player learns |
|---|---|---|
| 0 | Crypt, rats and bats. FOCUSED → ZONE → FLOW and the first Earthshatter, all in minute 0. | Typing lights the dungeon. |
| 2–3 | Wren joins, then the Rat King (f10). First relic chest, first golden rat. | Bosses drop choices; click the rat. |
| 4–8 | Forge and Workshop buys. Bone King (f20, often a wipe). Retire unlocks. Mossy Caverns at 7. | Wipes are soft (back 1 floor). |
| 10–14 | Mortimer (Meteor) at 10–12, Goblins, Sister Pell at 13–14. | The full party. |
| 14–20 | **Brood Mother wall:** 1–4 wipes over 4–6 min. Then the guaranteed epic. | Level up to beat a boss. |
| 21–27 | Quiet climb (no new things for about 6 min). Goblin Warlord (f40) at 25–27. | — |
| 25–28 | Retire nudge (+30) and retire. Buys 7 Legacy rows at once (28 of 30 Renown). | Prestige. |
| 28–37 | Re-climb from f6: bosses at 10/20/30/40 in about 9 min. **DEMO COMPLETE at 33–37.** | The prestige "aha": 3× faster. |
| 37–120 | Floors 37–39 loop. 0 bosses, 0 chests, 0 Renown, 0 new things. | Nothing. |

**Idle** (`demo_map_idle_s1/s2`):

| Min | What happens |
|---|---|
| 5 | Wren joins. |
| 5–7 | Rat King (f10). |
| 16–18 | Bone King (f20), then the Caverns. |
| 20–34 | Mortimer joins. |
| 22–31 | Four wipes at floors 25–28. |
| 32–38 | Pell joins. |
| 35–43 | Brood Mother wall, then a stuck retire (+13). |
| 45–71 | Run 2 to floor 40. The card comes at 71–88 min. |

- Idle players cast only **21–49 ultimates in total before the card**, including 0–4 Meteors and 0–6 Sanctuaries.
- They never see FLOW, by design.

**The arc is good up to the card.** Typists get something new about every 2–3 minutes for 14 minutes, then a wall, a reward, the prestige and a fast re-climb.

**Dead in the demo:**

| Content | Status |
|---|---|
| Whole post-card stretch | Nothing new (F1) |
| Legacy: Campfire, Battery, Relic Collector | Never bought, 5 of 5 runs |
| Legacy: Head Start ranks 3–8 | Buyable, no effect |
| Forge and Workshop after the card | Buys change nothing visible |
| Midnight Oil | Offline gold with nothing worth buying |
| Excluded by design | Magma Depths and the Void (6 monsters, 3 bosses) |

## Ideas (optional, max 3)

### 1. Delve Omens: the one to build first
This is data plus three one-line hooks.

**Why this one first:**
- **It recurs.** Nudge-following typists retire 11–12 times in 8 h, stuck-rule typists 5 times, idle players 6–9 times. So it lands every 40–95 minutes across the hours 2–8 hole.
- **It changes the band players replay** (floors 70–130), rather than adding floors past the wall.
- **It gives idle players a lever** (Quiet Halls).

**What depth trophies and the finale would add instead:**
- Depth trophies give about 4 one-time beats.
- The floor-100 finale gives one.

**Rules:**
- Starting with retire #2, the retire confirm rolls **3 of 10 omens**. The player picks one, or "No omen", using the relic-offer overlay ("◆ CHOOSE AN OMEN FOR THIS DELVE").
- If the player hasn't chosen, the offer waits in ◆ Legacy until the floor-10 boss, then defaults to none.
- Store it in `S.omen`, which resets on retire, and add `omen: null` to `newState` (see F2).
- Not in the demo.

**Hooks:**
- Add `eHp: 1, eAtk: 1, renownMult: 1` to the `KK.mods()` defaults.
- In `makeEnemy`: `hp *= m.eHp; atk *= m.eAtk`.
- In `A.renownGain`: `Math.floor(gain * m.renownMult)`.
- Apply `S.omen` in `KK.mods()` the same way relics are applied.

**Data rows and measured balance** (`omen_test.js`):
- The omen was held for the whole 6-hour session, which is the worst case.
- Typist baseline (no omen): floor 120/120 and 355 Renown (2 seeds).
- Idle baseline (no omen): floor 95 and 194 Renown.

| id | Name | Boon / bane | Typist f@6h (s1/s2) | Idle f@6h | Tune |
|---|---|---|---|---|---|
| gilded | Gilded Delve | gold ×2 / monster HP ×1.4 | 124 / 120 | 90 | ok |
| glass | Glass Delve | dmg ×1.6 / hero HP ×0.65 | 126 / 129 | 99 | ok (the strong pick) |
| storm | Storm Front | ult cost ×0.6 and ult dmg ×1.5 / Fervor drain ×2 | 130 / 126 | 92 | ult cost **×0.7** |
| quiet | Quiet Halls | idle power floor 1.35 / Fervor gain ×0.5 | 120 / 120 | **96 (+28 Renown)** | ok (the idle omen) |
| fever | Treasure Fever | chests ×3 / monster ATK ×1.25 | 120 / 125 | 90 | ok |
| embertide | Ember Tide | Embers ×2 / gold ×0.75 | 126 / 123 (5.6–7.5K Embers) | 87 | gold **×0.85** |
| march | Forced March | walk ×1.5, attack speed ×1.15 / hero HP ×0.85 | 124 / 125 | — | ok |
| hoard | Relic Hoard | +1 relic choice / monster HP ×1.2 | 119 / 119 | — | ok |
| veteran | Veterans' Muster | heroes start +15 levels / gold ×0.8 | 120 / 120 | — | ok |
| deep | Deep Omen | Renown ×1.25 / monster HP and ATK ×1.3 | 124 / 119 (**432–472 Renown**) | — | ok (the push pick) |

- The spread is −1 to +10 floors (≤8%), so no omen is a trap and none is a must-pick.
- The two tuned values (Storm ×0.7, Ember Tide ×0.85) are untested; re-run `omen_test.js` after the change.
- Add `S.stats.omensSeen` for a later Codex. All 10 omens show up within about 4 retires (about 3 hours for a typist).

### 2. Depth trophies (30 minutes of work, data-only)
- **What:** a permanent +5% damage and gold, a banner, and a "Next trophy: floor N" line in Legacy.
- **Where they land** (measured first-reach times):

  | Trophy | Typist | Heavy | Burst | Idle |
  |---|---|---|---|---|
  | Floor 75 | 1h09–2h16 | — | 2h40–3h10 | 2h59–3h47 |
  | Floor 100 | 2h37–3h27 | — | 5h54–6h43 | — |
  | Floor 110 | 3h10–4h13 | — | — | — |
  | Floor 120 | 4h25–6h00 | — | — | — |
  | Floor 125 | 6h12–7h06 | — | — | — |
  | Floor 150 | — | 7h24 | — | — |

- Together they fill the typist hole with about 4 beats, and floor 75 gives idle players one at about 3 h.

### 3. Floor-100 finale ("Heart of the Keep")
- Typists reach floor 100 at 2h37–3h27, exactly when novelty runs out, so the finale would be seen.
- Make it the one non-rotating boss floor (like the F4 fix for floor 70), with a one-time "THE KEEP IS YOURS" banner and a trophy.
