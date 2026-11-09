# Round 02 — T1 economist (Incentive & Economy Designer)

## Verdict
I would keep it running tomorrow. Round 1's broken prestige is fixed. Renown is now record-based, retire-spam pays nothing, and patient play beats farming. Leaving the game closed earns less than running it, and Quartermaster stopped draining gold. Every currency now has a sink. Two problems are left:
- **Embers buy very little power.** About half of all Embers go into Spark Jar and Overcharge, which barely move the party (Jar does nothing at all), and idle players earn almost none.
- **Nothing teaches the player that retiring early is free.** The scripted typist plays 1.5–2 h before its first retire, although retiring at floor 30–40 gives the same 4 h/8 h result.

Past about floor 100 progress slows to a crawl, which matters for the full game more than for the demo. No refund. **7.5/10** (R1: 6/10).

Method:
- About 150 headless runs, all seeded and averaged over 3–5 seeds.
- `tools/playtest.js` batches: typist/idle/heavy/burst, 4 h and 8 h, `--stuck` 4/8/15/30.
- Custom scripts in this folder:
  - `econ2.js` runs these scenarios: verify, firstretire, gainwatch, legacy, legvalue, embers, wsvalue, ultshare, autoclick, offline, qm, heroes, fairness.
  - `econ2fix.js` tests each proposed fix in memory: legacy, hoard, idleembers, offline, fame, workshop.
- Raw outputs are in `out/`. No game file was edited.

## Findings (ranked, max 8)

### F1 [severity: major] Retiring early is free now, but neither the game nor the harness knows it. The "1h50 first retire" comes from the harness's stall rule, not from the economy.
- Evidence:
  - `econ2.js firstretire typist` (4 seeds) forces the first retire at a given floor; all later retires happen after an 8-min stall:

    | First retire | When | Renown at 2 h | 4 h | 8 h | Deepest at 4 h / 8 h |
    |---|---|---|---|---|---|
    | Stall 8 (harness) | 95 min, f62, +86 | 86 | 195 | 266 | 96 / 106 |
    | At f30 | 18 min, +13 | **112** | 193 | 273 | 96 / 106 |
    | At f40 | 29 min, +30 | 71 | 183 | 259 | 97 / 103 |
    | At f50 | 46 min, +51 | 101 | 194 | 266 | 95 / 105 |

  - Idle shows the same: retiring at f30 (41 min) gives 124/176 Renown at 4 h/8 h, against 113/187 for stall 8.
  - Run 2 gets back to the run-1 record in **10–13 min** for a typist and **16–27 min** for idle, whatever the first-retire floor. "Run 2 is dramatically faster" holds.
  - **Why the typist waits:** a typist doesn't stall for 8 min until the f60 or f70 boss. In `gainwatch` the Retire button reads +3 at 10 min, +30 at 30 min, +51 at 50 min and +79 at 85 min (the f60 wall). Batch: first retire at 66–112 min across 5 seeds (heavy typists 96–121 min).
- Why it matters: the player sees "+X renown" grow and thinks "retiring throws my run away", so they wait for a wall that a typist only hits after 1.5 h. That is the review line "prestige takes 2 hours to unlock". In fact the formula already makes an early retire free: lifetime Renown = R(deepest floor), and Fame plus Legacy start working immediately.
- Proposed fix (UI and harness, no economy change):
  1. **One-time nudge** the first time `renownGain() >= 30` and the run is at least 25 min old: "Retire now: +30 Renown = +90% damage & gold forever. Renown counts your record, so you lose nothing, and you'll be back here in about 10 min." Measured trigger times: typist ~29 min (f40), idle ~65 min, burst ~70 min. That puts typists in the 35–60 min target band (use ≥40 for 37 min) and idle players just after it.
  2. **Retire button preview:** "+N Renown (+X% dmg & gold)". Fame is 3% per Renown, so this is easy to compute.
  3. **Harness:** measure the first-retire target as "first time gain ≥ 30 or stall 8", not stall 8 alone.

### F2 [severity: major] About half of the Embers buy (almost) nothing: Spark Jar has zero effect and Overcharge barely matters
- Evidence:
  - **Spark Jar: identical runs.** `econ2fix.js hoard` (stream mode), typist, 120 min, 3 seeds: jar 0, 5 and 10 give exactly the same run (floor 65.0, 4067 Embers). `wsvalue typist 180` also gives the same result for "none" and "jarOnly" (floor 70.3, gold 175.92M). Sparks are at cap 0% of the time in every batch run, because Embers come from spending, so capacity never binds.
  - **Overcharge: about zero.** `wsvalue typist 180`, 4 seeds:

    | Workshop plan | Floor at 3 h | Gold earned |
    |---|---|---|
    | None | 70.3 | 175.92M |
    | Overcharge only (8 levels) | 70.0 | |
    | Kindling only | 72.0 | |
    | Static Coins only | 72.3 | **757.97M (4.3x)** |
    | Default spread | 73.3 | |
    | No jar | 72.8 | |

    The whole Workshop is worth about +3 floors at 3 h. Static Coins is the dominant pick for gold.
  - Why Overcharge is weak (`ultshare`): ultimates do 21% of all damage and 14% of boss damage, and boss floors are the wall. Tripling ult damage (Overcharge 8, about 4925 Embers or 2.5 h of typing) gives +1.5 floors at 90 min.
  - **Where the Embers go:** a cheapest-first player has jar 10 and overcharge 8 at 8 h. That is about 4190 + 4925 = **9115 of 15979 Embers (57%)**. Jar is also the first purchase in every run (60 Embers at 2 min).
  - Pacing is otherwise fine (`econ2.js embers`, 3 seeds):

    | Profile | Embers per hour | Workshop levels at 8 h |
    |---|---|---|
    | Typist | ~2000 | 30 |
    | Heavy | ~3700 | 36 |
    | Burst | ~360 | 15 |

    Typists buy every 15–30 min after the first hour, and the Ember bank never grows above about 1100.
- Why it matters: Jar is the first thing everyone buys and it does nothing. It reads as "upgrades don't matter", and a min-maxer who notices posts it. Overcharge's tooltip ("+25% ultimate damage") promises a typing payoff that never shows up.
- Proposed fix (tested in `econ2fix.js workshop`):
  - **Jar becomes "Ember Crucible":** +15% Embers per level, max 10. It is a real invest-now-or-spend choice.
  - **Overcharge becomes multiplicative:** `ultPow *= 1.3^l`.
  - Result: typist floor 53.7 → 54.7 at 1 h and 72.7 → **75.0** at 3 h. Burst 57.3 → 58.0.
  - The better long-term fix is a **Boss Hoard toggle** (`econ2fix.js hoard`): ults hold on trash floors and are released on the boss floor, so Jar becomes the size of the boss burst. At jar 10 time on boss floors drops 27.0 → 21.0 min (−22%), but the final floor is unchanged (65 → 65) because trash clears slower. That makes it a real tradeoff for walled players. With jar 0, hoarding is worse (floor 60.3), so Jar gets a purpose.

### F3 [severity: major] Idle players have no Workshop: 73 Embers/hour, and the first thing they can afford is the useless Jar
- Evidence:
  - `econ2.js embers`: idle earns 19 / 89 / 294 / 623 Embers by 10 min / 1 h / 4 h / 8 h. That is **4% of a typist**. Workshop at 8 h: jar 3, kindling 2, overcharge 1.
  - Idle Sparks come only from golden rats: 60 each, spent on ults, which bank 15 Embers.
- Why it matters: one of the three meta panels stays empty for an idle player for their whole first day. Ember income at 4% of a typist's is too steep for "typing is rewarded without punishing idle players", even though gold and Renown are fair (F7).
- Proposed fix: an Ember trickle that doesn't come from typing: **+25 Embers per golden rat caught and +10 per boss kill**. Tested in `econ2fix.js idleembers`, 4 h, stall 8, 3 seeds:

  | Profile | Embers per hour | Workshop levels at 4 h |
  |---|---|---|
  | Idle | 73 → **245** | 3.0 → 8.7 |
  | Burst | 362 → 535 | |
  | Typist | 1999 → 2165 (+8%, so typing stays the main source) | |

  Deepest floors don't change within noise (idle 76/74).

### F4 [severity: major for the full game, minor for the demo] Long run: progress walls at floors 100–105, and late retires pay +5 to +26
- Evidence:
  - Typist deepest floor: 91–96 at 4 h, 102–106 at 8 h (both batches). Idle: 76–77 at 4 h, 86–89 at 8 h.
  - 8 h `playtest.js` (3 seeds each): the deepest floor is the same for any `--stuck` value: 98–107 for typists, 81–90 for idle.
  - Retires after 4 h pay **+4 to +26** against a lifetime of 240–268. A late retire moves Fame by only about 2–8%.
  - Mechanism: Fame is linear in Renown and Renown grows polynomially (floor^1.9), while enemy HP grows ×1.27 per floor. At f100 one more floor adds about 5 Renown, which is about +1.8% power, against the +27% that floor needs.
- Why it matters: from hour 5 on, the Retire button shows "+10", and everything else is a slow grind toward f100. That is a "content runs out at 5 hours" review, and the planned floor-100 finale lands right on the wall.
- Proposed fix: a compounding Fame term, **fame = (1 + 0.03R) × 1.004^R**. Tested in `econ2fix.js fame`, stall 8, 3 seeds:

  | Profile | Fame | 4 h | 8 h | Retires after 4 h |
  |---|---|---|---|---|
  | Typist | current | f91 | f105 | +11 to +48 |
  | Typist | proposed | f100 | **f119** | **+29 to +68** |
  | Idle | current | | f86 | |
  | Idle | proposed | | **f101** | |

  - Idle reaches the finale on day 1.
  - The first hour and the first retire don't change.
  - I rejected 1.008^R: it runs away (typist f145 and 510 Renown at 8 h, every retire paying more than the one before).
  - For the demo (cap around f40 and one retire) this can wait.

### F5 [severity: minor] Legacy: splitting Lineage and Treasury always wins; Head Start and Veterans are traps; the first retire still buys every kind
- Evidence:
  - `econ2.js legacy`: the first level of every item costs **61** in total. Budgets of 13 / 30 / 51 / 61 / 108 buy 4 / 7 / 9 / 10 / 10 kinds of 10.
  - A stall-8 typist's first retire (+79 to +112) buys all 10. A realistic f40 retire (+30) buys 7.
  - `legvalue 108 69 typist`, floor of run 2 at 15 / 30 / 60 min:

    | How the 108 Renown is spent | 15 min | 30 min | 60 min |
    |---|---|---|---|
    | Lineage + Treasury split | f68.7 | f79.7 | **f89.3** |
    | Lineage only | f62.3 | f76.7 | f86.7 |
    | Buy-all loop | f65.3 | f75.3 | f83.7 |
    | Veterans 7 + Lineage | f58.7 | f71.3 | f80.7 |
    | Head Start 5 + Lineage | f55.0 | f70.3 | f80.0 |
    | Nothing (Fame only) | f51.7 | f67.7 | f77.0 |

  - With an idle budget of 30 the split wins again.
  - Fame alone gives most of the gain. Head Start saves about 3 min of a run that clears f1–40 in under 15 min anyway.
  - There are still sinks: maxing every capped item costs 544, against 266 lifetime at 8 h.
- Why it matters: this is mild. Choosing among Legacy items comes down to "split Lineage and Treasury", and the 100+ Renown Head Start is a newbie trap.
- Proposed fix:
  - Price Head Start as quality of life: cost 8+6l → **3+2l** (8 ranks cost 80, down from 232).
  - Veterans: +5 → **+10 levels per rank**, cost 4+3l → **3+2l**. Tested: veterans + lineage becomes the best opener at 15 min for idle (f40.7 against f36.7 for the split), which gives it a niche.
  - I also tried Head Start as "10% of your record floor per rank" and dearer Lineage/Treasury (3+3l). It was neutral on the 8 h curve (typist f105 → f102) and did not change which build wins. **Keep Lineage/Treasury at 2+2l.** "Buy one of each" at the first retire is acceptable now that Renown keeps flowing.

### F6 [severity: minor] Offline: fine on average, but closing the game right after a boss kill pays 1.3–2.2x online for up to 12 h
- Evidence:
  - `econ2.js offline`: the average offline/online ratio is now 0.18–0.56x (pass).
  - Offline pays the current `incomeRate`, which is an EMA with a time constant of about 33 s. A boss kill (14x gold) or a chest (10x) makes it spike. Closing at that moment pays:

    | Setup | Typist | Idle |
    |---|---|---|
    | Fresh save | 1.31x online | 2.22x online |
    | Campfire 4 (first `offline` test) | | up to 4.45x |

  - Midnight Oil's "+20 offline points" does nothing once Campfire 4 has reached the 80% cap (campfire 4 and campfire 4 + Oil give the same numbers).
  - `tools/playtest.js:202` still uses the old offline formula `max(incomeRate, 0.3*enemyGold)` instead of main.js's, so its `--offline` numbers are stale.
- Proposed fix:
  - Offline rate = `min(incomeRate, average kill+chest gold per second over the last 10 min)`. Tested in `econ2fix.js offline`: closing at the best moment drops to **0.58x / 0.51x**, and the average stays at 0.14x / 0.21x.
  - Midnight Oil: make it "offline cap 80% → 90%", or drop its offline part.
  - Sync playtest.js with main.js.

### F7 [severity: minor/info] Typist vs idle: fair when compared at the same time. "108 vs 13" compared different moments.
- Evidence (`econ2.js fairness stall8`, 4 seeds):

  | Time | Typist/idle Renown | Typist/idle depth |
  |---|---|---|
  | 2 h | 2.1x (86 vs 42) | 1.39x |
  | 4 h | 1.7x (195 vs 113) | 1.25x |
  | 8 h | 1.4x (266 vs 187) | 1.19x |

  - "108 vs 13" set the typist's retire at 1h52 (f69) against the idle player's at 0h42 (f30): the idle player stalls at the f30 boss, the typist doesn't.
  - Heavy typists: 293 Renown at 8 h (1.1x a typist).
  - **Light typists (burst) are no better off than idle:** f77 against f77 at 4 h and f91 against f89 at 8 h, despite 5x the Embers.
  - No input exploit: an autoclicker at the 15/s token-bucket cap reaches f75.5 at 2 h, against f76.5 for a heavy typist (`autoclick`).
- Why it matters: the core ratio is healthy. The gap is never punishing and shrinks over time. The weak spot is the casual typist who types in short bursts and feels nothing. Their Fervor peaks at FOCUSED and then decays.
- Proposed fix: nothing for the core ratio. For light typists, F3's trickle helps a little. If more is wanted, try a longer Fervor decay grace below ZONE (3 s → 8 s while Fervor < 60), so short bursts hold FOCUSED. That change is untested.

### F8 [severity: minor] Mortimer's levels are still the worst gold per DPS
- Evidence (`econ2.js heroes`), DPS bought with the same budget relative to the knight:
  - Archer: 0.73–1.07x (fixed, R1 F8).
  - Mage: 0.27x at 1e3 gold, 0.31x at 1e4, then **0.43–0.61x** at 1e6–1e10 budgets (splash credited 1.5x).
  - Mage lvlCost was cut 500 → 200 in R1; it needs to go lower.
- Proposed fix: Mage lvlCost **200 → 80**. That is about +8.8 levels for the same gold, roughly 1.6x DPS, so about 0.85x the knight.

## Verified fixes from last round (pass/fail, one line each)
- **R1 F1, retire spam with Head Start: PASS.** After any retire `canRetire()` is false. 100 extra clicks give +0 at Head Start 0 and +1 at Head Start 4. Head Start 8 gives one +29 payout for floors 21–41, only reachable if your record is below 41, and HS8 costs 232 Renown, so that can't happen in practice.
- **R1 F2, farming beats patient play: PASS.**
  - Typist at 8 h: stall 8 gives **261** Renown, stall 2 gives 224, farming +10 or +20 floors gives 164.
  - Idle at 8 h: stall 8 gives 186, farming gives 50–58.
  - Patient play is now optimal.
- **R1 F3, dead Workshop: PASS for typists** (24–30 levels by 4–8 h, first buy at 2 min). **FAIL for idle** (3 levels at 4 h, all Jar; see F3). Half the value is wasted (see F2).
- **R1 F4, offline beats online: PASS on average** (0.18–0.56x). **Partial:** the best-moment spike reaches 1.3–2.2x (see F6).
- **R1 F5, first retire buys all of Legacy: PARTIAL.**
  - Budgets: 13 Renown buys 4 kinds, 30 buys 7, 61 or more buys all 10.
  - The harness typist (+79 to +112) still buys all 10.
  - It's acceptable because the later sinks (544 to max) keep Renown meaningful (see F5).
- **R1 F6, Quartermaster drain: PASS.** Run 2, 45 min, QM off vs on:
  - Floor: 84/83/83 against 80/87/80.
  - Median gold at a glance: 49–99M against 31–224M (not drained).
  - Mage joins at 1.0 min and Cleric at 3.0 min both ways.
- **R1 F7, Battery inverts the typing incentive: PASS.** At Battery 5, Fervor 0 / 30 / 70 / 95 gives 1.40 / 1.40 / 1.60 / 2.20. Typing never weakens the party.
- **R1 F8, Knight is the only good gold sink: PARTIAL.** The Archer is fixed; the Mage is still 0.43–0.61x (see F8).
- **R1 method note, seeded playtest: PASS.** `playtest.js --seed 3` run twice gives byte-identical output.
- Reference numbers for the lead's step 6 (`playtest.js --min 240`, stall 8, 5 seeds):

  | Profile | Boss 10 | Boss 20 | First retire | Deepest at 4 h | Renown at 4 h |
  |---|---|---|---|---|---|
  | Typist | 3–5 min | 7–11 min | 66–112 min | 90–100 | 194–242 |
  | Idle | 6–12 min | 19–28 min | 41–60 min (f26–30) | 70–78 | 112–142 |
  | Heavy | | 6–8 min | 96–121 min | 96–104 | |
  | Burst | | 19–23 min | 42–101 min | 70–80 | |

## Ideas (optional, max 3)
1. **Boss Hoard toggle**, from F2: a real Spark decision right when the player is stuck, and it gives Jar its job. Measured −22% time on boss floors at jar 10.
2. **Ember-lit Fame:** "+1% damage per 100 lifetime Embers". Typing then feeds permanent power directly (a typist at 8 h has about 16k Embers, so ×2.6; idle ×1.06). Only add it if F4's compounding Fame isn't enough, and recheck the F7 ratio (it should stay under about 2x at 4 h).
3. **Retire forecast:** the Legacy panel shows "Next retire at f69 would pay +108. You'd return here in about 10 min." This turns F1's insight into a visible plan, and it's the number economy players screenshot.
