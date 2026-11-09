# Round 01 — T1 economist (Incentive & Economy Designer)

## Verdict
I would keep it running tomorrow. The gold layer works: first boss at 2–4 min (typist) or 6–8 min (idle), first retire at 33–43 min, run 2 reaches the old wall about 2x faster, and a typist ends up with 2.0x the Renown of an idle player. The other three currencies are broken or degenerate. Sparks never reach the Workshop. Renown is worth most if you retire every 3–4 minutes, and after Head Start 4 you can earn it with no play at all. After Campfire, leaving the game closed earns more gold than running it. An economy-minded player finds these in an evening, and they would turn "cozy idle" reviews into "broken prestige" reviews. I would not refund. **6/10.**

Method: about 80 headless runs (`tools/playtest.js` for typist/idle/heavy/burst × smart/greedy/random, 2–8 h, `--stuck` 2/4/8/15/30, `--sessions 4 --offline 8`), plus the custom scripts in this folder:
- `econ_scenarios.js` runs the scenarios: retirespam, quartermaster, battery, offline, sparks, prestige, legacy, heroes, prestigefix, sparkfix, combo.
- `econ_batch.js` is a multi-seed table runner.
- `econ_ults.js` measures what ultimates are worth.
- `econ_fervor.js` tests Fervor decay.

Proposed fixes were tested by overriding formulas in memory. No game file was edited.

## Findings (ranked, max 8)

### F1 [severity: blocker] Head Start lets you retire again right away, for free Renown, forever
- Evidence:
  - `A.renownGain()` = `renownFor(S.maxFloorRun)` (js/state.js:225), and `retire()` sets `maxFloorRun = startFloor` (js/state.js:236). Once Head Start puts the start floor at 21 or deeper, the Retire button shows a positive gain again the moment you land.
  - `node docs/playtest/round-01/econ_scenarios.js retirespam`:

    | Head Start | Start floor | Renown per click | 100 clicks |
    |---|---|---|---|
    | 4 (cumulative cost 30) | 21 | +3 | 300 |
    | 6 | 31 | +9 | 900 |
    | 8 (cost 108) | 41 | +18 | 1800 |

  - Lifetime Renown also feeds Fame at +3% dmg & gold per point, so 100 clicks at Head Start 8 is roughly ×55 power. In the `legacy` scenario a normal buy-everything player reaches Head Start 4 at retire #3 (3h10m). A thrifty player gets there by retire #2.
- Why it matters: the UI shows the exploit itself: right after retiring, the panel says "+3 RENOWN" again. It makes the meta layer and any future Renown achievements trivial. Review line: "prestige is broken, just spam retire."
- Proposed fix: adopt F2 (record-based Renown), which removes this completely. Minimum hotfix: `gain = renownFor(maxFloorRun) - renownFor(runStartFloor)`, with the run's start floor stored on retire.

### F2 [severity: major] Retire timing beats everything else, and the optimal play is shallow farming every ~4 minutes
- Evidence:
  - Renown is paid in full every run as a function of depth (`((f-10)/5)^1.6`), not as progress past your best. Early floors are fast after a retire, so short runs win.
  - `econ_scenarios.js prestige`, lifetime Renown after 4 h (2 seeds, seeded player):

    | Retire rule | Typist renown | Typist deepest | Idle renown |
    |---|---|---|---|
    | Retire after stalling 2 min | 648 | f100 | 357 |
    | Stall 4 min | 336 | | 184 |
    | Stall 8 min (harness default) | 129 | | 106 |
    | Stall 15 min | 95 | | 55 |
    | Retire at +20 floors over start (64 retires, ~3.7-min runs) | **752** | **f46** | |

  - At 8 h (H=8 prestigefix 0): +10-floor farming gives 4004 Renown against 504 for stall-8 (**8x**), and the farmer never goes past floor 51.
  - `playtest.js --min 480 --stuck 4 / 8 / 30` gives 1090 / 534 / 123 lifetime Renown.
  - An idle player who retires every 2 min (357) beats a typist who waits 8 min (129) by 2.8x. The Retire button matters more than the keyboard, and the optimal player never sees Magma or the Void.
  - Most retires in my runs (about 3 in 4) happen at a floor ending in 0. The walls are the bosses.
- Why it matters: the best strategy means clicking Retire every few minutes, which goes against the glance-every-10–30-min design (GDD §1, pillar 2). Players who play "naturally" are 5–8x behind and don't know it. Review line: "the optimal way to play is to never go deeper than floor 40."
- Proposed fix: make Renown **record-based**: `gain = floor(((max-10)/5)^1.9) - floor(((bestEver-10)/5)^1.9)`, with bestEver taken before this run. Lifetime Renown then equals `renownFor(deepest floor ever)`. When the gain is 0, the retire button reads "Beat floor N to earn Renown". Tested (`econ_scenarios.js prestigefix 8`, typist 4 h):

  | Retire rule | Renown | Deepest |
  |---|---|---|
  | Stall 2 min | 167 | |
  | Stall 8 min | **189** (+46% over today's 129) | 85–90 |
  | Stall 15 min | 185 | |
  | +20 floors farming | 48 | |
  | +10 floors farming | 46 | |

  - At 8 h: 203 / 242 / 242 against 100–105 for farming. Deepest floor 100–106, against 107 today for stall-8.
  - Idle 4 h: 92 / 112 / 82 against 22 for farming.
  - Patient play is now optimal and farming is worst. F1 disappears.
  - Rejected alternatives:
    - Exponential Renown (`3*1.08^(f-20)`) runs away to 1.1M Renown with linear Fame.
    - A 15-min minimum run still lets 15-min farming win 5.8x.

### F3 [severity: major] Spark Workshop is dead (backlog R0, confirmed and quantified)
- Evidence:
  - 24 runs of 4 h (`econ_batch.js`, typist/idle/heavy/burst × smart/greedy × 3 seeds): **zero Workshop purchases except Spark Jar 1 (and one Kindling 1) in 3 heavy runs**. "Sparks at cap: 0% of the time" in every run.
  - `econ_scenarios.js sparks`, 2 h:

    | Profile | Sparks spent on ults (% of keystroke income) | Peak bank |
    |---|---|---|
    | Typist | 101% | 79 |
    | Heavy | 102% | 109 |
    | Burst | 112% | 74 |

    Rats top up the rest. The jar holds 150, and Battery (200) shows "NEEDS BIGGER JAR".
  - Ults are a real power source: `econ_ults.js` reaches floor 48–50 at 60 min with ults against 44–46 without, so the fix should not take them away. Idle players earn Sparks only from rats, 60 each.
- Why it matters: GDD §3 sells "your typing investment is permanent". In play, that permanent layer never unlocks. Five upgrades, including the two most typing-themed (Static Coins, Kindling), are dead content.
- Proposed fix: **Embers**. Every Spark spent on an ultimate also banks 1 Ember, a permanent currency that is never capped. Workshop prices are paid in Embers. The jar only limits ults. `econ_scenarios.js sparkfix`, 120 min:

  | Profile | Workshop levels | Ults | Max floor |
  |---|---|---|---|
  | Typist | 31 (today 1) | 609 (today 618) | 67 (today 58) |
  | Heavy | 37 | 1053 | 71 (today 60) |
  | Burst | 13 | 94 (today 97) | |

  - Typist first purchases land at 2 / 2 / 4 / 7 / 17 min.
  - I rejected a "keep 40% of the jar in reserve" rule: it works for typists (13 levels) but cuts burst-typist ults from 97 to 18, which punishes light typists.

### F4 [severity: major] After Campfire, leaving the game closed earns more gold than running it
- Evidence:
  - The offline payout is `max(incomeRate, 0.3*enemyGold(floor)) * m.offline` (js/main.js:62-63). m.offline is 0.5 base, ×(1+0.5/rank) from Campfire, and ×2 from Midnight Oil.
  - `econ_scenarios.js offline` compares the average offline rate with measured online gold/s:

    | Setup | Typist (offline ÷ online) | Idle (offline ÷ online) |
    |---|---|---|
    | Fresh save | 0.55x | **1.28x** |
    | Campfire 4 (14 Renown, first-retire money) | 2.34x | 3.83x |
    | Campfire 4 + Midnight Oil | 4.85x | 7.66x |

    The fresh idle case is already above 1x because the floor-based minimum is higher than a walled idle party's real income.
  - `playtest.js --sessions 4 --offline 8`: 8 h away gives +10.2M gold on a 3.6K balance, which buys 79 hero levels.
- Why it matters: this breaks pillar 1 ("your activity is the fuel"). Min-maxers will close the strip during work, which also kills the ambient value. Review line: "the best way to play is to quit the app."
- Proposed fix:
  - Cap offline at **80%** of the online rate: `m.offline = min(0.8, 0.4 + 0.1*campfire + (oil ? 0.2 : 0))`. That means Campfire gives +10% per rank and Midnight Oil +20% additive, with x2 removed.
  - Use `incomeRate` alone. Fall back to `0.3*enemyGold(floor)` only when incomeRate is 0.

### F5 [severity: major] The first retire buys every Legacy upgrade, and then only two "+25%" buttons are left (backlog R0, confirmed)
- Evidence:
  - `playtest.js --min 120 --profile typist` retires #1 at 0h38m (floor 40, +17). All 8 first purchases (lineage, treasury, quartermaster, veterans, headstart, zeal, recruiter, campfire) happen in the same minute, 0h39m.
  - The cheapest level of all 9 items costs 23 in total.
  - `econ_scenarios.js legacy`: retire #1 (+27) gives all 9 items at least one level and maxes 3. After retire #5 (5.2 h) only Lineage, Treasury, Veterans and Head Start are open. Lineage and Treasury cost the same and give the same +25%, so they are a coin flip, not a choice.
- Why it matters: the brief asks whether Renown creates choices. Right now it doesn't: the first retire is a "buy all" moment and later retires are "dump into Lineage".
- Proposed fix: reprice so that the cheapest level of every item costs about 58 (currently 23). Proposed costs:

  | Item | Proposed cost |
  |---|---|
  | Lineage / Treasury | 2+2l |
  | Quartermaster | 6 |
  | Recruiter | 8 |
  | Veterans | 4+3l |
  | Head Start | 8+6l |
  | Zeal | 4+2l |
  | Campfire | 4+2l |
  | Collector | 20 |

  - Under the current formula (17 at the first retire) this buys about 3 items. Under F2 (30 at f40, 51 at f50) it buys 4–6 of 9 kinds.
  - Tested in `econ_scenarios.js combo` (PRICE=a): the first retire bought 6 kinds and left 8 open.
  - A stingier set (QM 10, Collector 35, Head Start 15+10l, PRICE=b) left Collector unbought after 6 h, so it is too much.
  - With F2 + set A, run 2 reaches floor 40 in 8 min, against 35 in run 1. "Dramatically faster" holds.

### F6 [severity: major] Quartermaster drains gold every 0.5 s: no progress gain, emptier glances, slower recruits
- Evidence:
  - `autoBuy()` (js/world.js:535-548) spends all gold on the cheapest hero level twice a second.
  - `econ_scenarios.js quartermaster`: same Legacy, 45-min run, QM off vs on, 2 seeds each:

    | | QM off | QM on |
    |---|---|---|
    | Max floor | 60 / 59 | 60 / 60 (**no gain**) |
    | Glances with nothing affordable | 3 / 45 | 9–16 / 45 |
    | Median gold at a glance | 206–261K | 8–14K |
    | Cleric recruited at | 4–5 min | 11 min |
    | Mage recruited at | 2 min | 4–8 min |
    | Forge buys | 65–74 | 50–53 |

- Why it matters: Quartermaster is the classic "quality of life" unlock and one of the cheapest Legacy items (3), so everyone buys it on the first retire. Here it takes away the glance decisions (pillar 4) and delays recruits, the main source of novelty in a run, while adding zero progress.
- Proposed fix:
  - Quartermaster only buys a level that costs at most 10% of current gold.
  - It holds while an unlocked hero is unaffordable, saving for the recruit.
  - Add an on/off toggle in the Legacy panel.

### F7 [severity: minor, becomes major once F3 ships] Idle Battery makes light typing weaker than not typing
- Evidence:
  - `powerMult` adds `idlePow` only at tier 0 (js/state.js:91-96). `econ_scenarios.js battery`:

    | Battery level | IDLE power | Compared with |
    |---|---|---|
    | 2 | **1.40** | FOCUSED 1.25 |
    | 3 | 1.60 | equal to IN THE ZONE |
    | 5 | **2.00** | ZONE 1.60, and FLOW is only 2.20 |

  - It is latent today because nobody can buy it (F3). Under the Embers fix, `sparkfix` shows Battery 4 for a typist and Battery 5 for a heavy typist after 2 h; the 6 h `combo` run with EMBERS=1 also ends at Battery 5.
- Why it matters: when someone starts typing a little, Fervor reaches FOCUSED and the party gets *weaker* (2.0 → 1.25). That is a reversed incentive on the game's core hook.
- Proposed fix: `mult = max(tierMult, 1 + idlePow)` (a floor, not a separate tier bonus), plus `idlePow` 0.08/level, max 5 → 1.40, so IDLE stays below ZONE at 1.6.

### F8 [severity: minor] Leveling the knight is the dominant gold sink, and Mortimer's levels are a trap
- Evidence:
  - Equal gold put into one hero gives the DPS below (`econ_scenarios.js heroes`; DPS = dmg/attack interval, Mage splash credited ×1.5):

    | Budget | Knight | Archer | Mage |
    |---|---|---|---|
    | 1e4 | 561 | 481 | 118 |
    | 1e6 | 8063 | 5397 | 2407 |
    | 1e8 | 60089 | 63462 | 22260 |

    Per gold, the Mage gives 0.21–0.37x the Knight's DPS.
  - Levelling only the knight reaches floor 40/40/47 at 40 min, against 40/40/40 for cheapest-level spread.
  - Later heroes are less efficient per gold, which is the opposite of the Cookie Clicker rule that later buildings pay more per coin.
- Why it matters: the shop has an obvious answer ("only level Clank"), and the 1500-gold Mage recruit has no economic payoff after it joins.
- Proposed fix: Mage `lvlCost` 500 → **60** (0.9–1.0x Knight DPS per gold at every budget) and Archer 30 → **20** (≈1.0–1.1x). Keep the recruit prices as the gate.

## Verified fixes from last round
- None to verify: this is round 01. Backlog R0 Workshop: confirmed (F3). Backlog R0 Legacy buy-all: confirmed (F5).
- Method note for the lead: `tools/playtest.js` is **not reproducible with `--seed`**. Its typing model (playtest.js:73-74) uses node's unseeded `Math.random`, not the seeded sim RNG. The same command `--profile typist --min 120 --seed 1` gave lifetime Renown 44 and 56 on two runs, and 4 h `--sessions` runs moved retire times by ±8 min. Use `KK.U.rand()` there (as `econ_scenarios.js` does), or the step-6 before/after pacing check is comparing noise. Until then, average 3–6 seeds (`econ_batch.js`).
- Reference numbers for the step-6 check (playtest.js, 6 seeds, 4 h, smart, stuck 8):

  | Profile | Lifetime renown avg | Deepest floor avg | Boss-20 kill |
  |---|---|---|---|
  | Typist | 173 | 86 | 7–10 min |
  | Idle | 86 | 69 | 16–25 min |
  | Burst | 103 | 70 | 17–20 min |

  - Heavy ≈ typist: typing beyond about 50% FLOW time adds nothing.

## Ideas (optional, max 3)
1. **Boss Hoard toggle (a real Spark choice).** Every run stalls at a boss. Let the player flip "Hoard": ults hold during normal waves and fire all at once on the boss with +50% power. That turns Sparks into a decision at exactly the moment the player is stuck, instead of an automatic drain.
2. **Flow pays Renown.** Retire gain ×(1 + 0.1 per hour spent in FLOW this run, cap +50%). This puts the typing reward into the meta currency, which F2 shows is where long-term power comes from today. It also gives a shareable stat ("3h FLOW today", GDD §14).
3. **Boss grudge to soften walls.** Each wipe on a boss floor gives +5% damage against that boss (stacks to +50%, resets when it dies). A long stall then resolves on its own instead of hitting the "stuck 8 min → retire" cliff, and patient play stays rewarding under the F2 record-based Renown.
