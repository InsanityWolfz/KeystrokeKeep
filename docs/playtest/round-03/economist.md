# Round 03 — T1 economist (Incentive & Economy Designer)

## Verdict
I would keep the full game running tomorrow. R2 fixed the economy, and in one place it overshot:
- **What works:**
  - The Workshop now matters: +17 floors at 8 h, against about +3 in R2.
  - Idle players have Embers.
  - The floor-100 wall is gone: a typist reaches f128 at 8 h, against f105 in R2.
  - Offline can no longer be gamed.
  - Compounding Fame doesn't run away over 40 h. It flattens into a soft wall.
- **What is new:**
  - **The demo's economy is finished after about 30 minutes for a typist (80 for idle).** Renown is capped at 30, and after the f40 boss nothing is left to chase: no boss, no relic, no retire. The "Demo complete" card still promises "retire for Renown and try new relic builds".
  - **Overcharge went from useless to the main damage source** (77–96% of damage). That stretches the typist/idle gap over long sessions.
  - **Kindling replaced Spark Jar as the dead Workshop item.**

Full game **8/10** (R2 7.5). Demo as shipped **6.5/10**: a strong first 30 min, then a dead end.

Method:
- About 250 seeded headless runs: 5 seeds for pacing and demo, 3–4 seeds for everything else.
- `tools/playtest.js` runs: typist 240 min; `--demo` typist 90 min and idle 120 min.
- Scripts in this folder:
  - `econ3.js` runs these scenarios: pacing, longrun, demo, wsvalue, wsday, legvalue, offline, heroes, legacy, firstretire, ultshare, embersrc.
  - `econ3fix.js` tests fixes in memory: demo, kindling, overcharge, crucible, tail, lightkeys, warmstart.
  - Raw output: `out/` (my files: `pacing8_*`, `long*`, `demo120`, `ws*`, `legv_*`, `fix_*`, `offline`, `embersrc`, `heroes`, `legacy`, `firstretire_*`, `ultshare`, `pt_*`).
- The player model is the R2 one: smart spend and a 60 s glance. Policies:
  - **stall8:** retire after 8 min with no new floor (the harness rule).
  - **nudge:** retire when the in-game nudge fires (gain ≥30 and either a run longer than 25 min or f40 on the first run), with stall8 as a fallback.
- No game file was edited.

## Findings (ranked, max 8)

### F1 [severity: major] Demo: the prestige loop ends at about 30 min, then the game contradicts its own "Demo complete" card
- Evidence (`econ3.js demo 120`, 5 seeds; the nudge policy gives the same picture):

  | | Typist | Burst | Idle |
  |---|---|---|---|
  | Floor 40 / "Demo complete" | 26–33 min | 50–90 min | 69–80 min |
  | 30 lifetime Renown (the most the demo pays) | 23–39 min | 47–82 min | 62–85 min |

  - **Lifetime Renown is capped at R(40) = 30.** It takes one retire (typist) or two (f30 +13, then f40 +17).
  - **After the cap boss, a new run can never reach f40 again.** `world.js:504` sends floor 39 back to 36, so `maxFloorRun` stops at 39 ("run2+ max floor 39-39"). Renown for f39 is 28, below 30, so `canRetire()` is false forever. The Retire button reads "REACH FLOOR 41 TO EARN RENOWN", a floor that doesn't exist in the demo.
  - **After the cap, the typist gets 0 relic offers per hour**, because the f37–39 farming loop has no boss. Embers still come in (3.9k/h), but the only things left to buy are hero levels and Forge ranks that change nothing you can see.
  - **The card is wrong on two counts** (`ui.js:455`): "farm gold, **retire for Renown** and **try new relic builds**". After the cap, both are impossible.
  - **Typist Legacy:** 30 Renown buys 7 of 10 kinds. Campfire, Battery and Collector are never affordable in the demo.
  - **The nudge fires on *arrival* at f40, before the boss fight.** A player who follows it retires at the boss door and only sees "Demo complete" in run 2, at 32–40 min instead of 26–33.
- Why it matters: Next Fest ranks demos partly on playtime, and the typist (the target player) runs out of goals at 30 min. Players who leave it running all afternoon see a party walking f37 → f39 forever. Expect this review line: "said I could keep retiring and trying builds; the button is greyed out".
- Proposed fix (tested in `econ3fix.js demo`):
  1. **After `demoDone`, allow a 0-Renown "Re-delve".** It resets the run and rerolls relics. There is no exploit, because demo Renown is capped. Measured over 120 min:
     - Typist: 11–12 re-delves, best run to f40 **6.5 min**, about 30 relic offers per hour, 337 purchases per hour.
     - Idle: 4–5 re-delves, 14 min per run to f40.

     That is the "try new relic builds" loop the card promises.
  2. **Show "Best time to Floor 40"** on the card and in the Legacy panel, so the post-cap loop has a score: about 6.5 min for a typist, 14 min for idle.
  3. **Retire button in the demo:** "Demo Renown maxed (30/30). The full game goes to floor 110+".
  4. **In the demo, fire the f40 nudge on `demoComplete`** (after the boss kill), not on arrival.
  - Don't make the farming loop f37–40 including the boss: laps take 0.4 min for a typist, which means **160 relic offers per hour**.
  - **Alternative: cap 50**, the first Magma boss. Typist done at 37–45 min, two retires, 51 Renown (9/10 Legacy kinds). But idle needs **101–106 min**, outside the 30–90 min demo window, so keep 40 and add items 1–4.

### F2 [severity: major for the demo] Head Start ranks 3–8 can be bought in the demo, do nothing, and their text lies
- Evidence: demo, 30 Renown, buying Head Start four times:

  | Rank | Cost (Renown) | Real start floor | Description says |
  |---|---|---|---|
  | 1 | 3 | 6 | 6 |
  | 2 | 5 | 11 | 11 |
  | 3 | 7 | 11 | "now floor 16" |
  | 4 | 9 | 11 | "now floor 21" |

  - `data.js` LEGACY headstart caps the *effect* at 2 (`Math.min(l, 2)`), but not `max` and not `desc`.
  - Ranks 3 and 4 cost **16 of the demo's 30 Renown** for nothing.
  - Even ranks 1–2 are the weakest opener (`legvalue 30 40`): head2+lin reaches f50.0 at 30 min idle, against f53.3 for lin+tre and f52.0 for vet+lin.
- Why it matters: it spends half of a demo player's only Renown on nothing, and the text says otherwise. Expect "Head Start is bugged".
- Proposed fix: in the demo, effective `max = 2` (UI shows MAXED), or compute `desc` with the same `Math.min(l, 2)`. One line.

### F3 [severity: major] Overcharge is now the main damage source, and it stretches the typist/idle gap over long sessions
- Evidence:
  - **Ultimates' share of damage** (`ultshare`, typist, 60 min):

    | Overcharge level (ult multiplier) | Share of all damage | Share of boss damage |
    |---|---|---|
    | 0 | 17% | 12% |
    | 8 (×8.2) | **77%** | 62% |
    | 16 (×66) | 96% | 96% |

  - **Each item's worth over an 8 h day** (`wsday typist`, 3 seeds): none f111, default f128.3, no Overcharge f116, no Static f123.3, no Crucible f124.3, no Kindling f128.3. Overcharge is **12 of the 17 floors** the Workshop adds.
  - Typists earn 4.7k Embers per hour (90% from ults), idle 480/h. At the end of a day Overcharge is level 14–15 for a typist and 7 for idle.
  - **The gap grows with time** (`pacing`, `longrun`):

    | Time | Typist/idle depth | Typist/idle Renown | Fame |
    |---|---|---|---|
    | 4 h | 1.34x | 1.74x | |
    | 8 h | 1.33x | 1.85x | |
    | 24 h | **1.44x** (f155 vs f108) | 2.1x | ×204 vs ×29 |
    | 40 h | **1.44x** (f166 vs f115) | | |

    R2 was 1.25x at 4 h and 1.19x at 8 h.
  - Ultimates scale at ×1.3 per level for ×1.5 cost. That's a better exponent (0.65) than hero levels (about 0.39), and it never resets.
- Why it matters: "typing fires the spells" is the fantasy, so ults doing most of the damage is good. But idle players fall further behind every day. This matters most when the floor-100 finale and its achievements arrive: idle reaches f100 at about 9–10 h, the typist at about 3 h.
- Proposed fix: **Overcharge cost growth 1.5 → 1.6** (tested, `fix_overcharge`, 3 seeds):

  | Profile | At 4 h | At 8 h | At 24 h |
  |---|---|---|---|
  | Typist | f106 (unchanged) | f127 (was 128) | f146 (was 155) |
  | Idle | f79–80 | f96 (unchanged) | f111 (was 108) |

  The 24 h gap drops from 1.44x to **1.32x**. 1.7 costs typists 4–5 floors at 8 h; too much.

### F4 [severity: minor] Kindling is the new dead Workshop item for every profile. Replacing it with "Second Wind" also fixes light typists
- Evidence:
  - `wsday typist` 8 h: default f128.3, no Kindling **f128.3**. Typists already sit in FLOW 62% of the time, so +12% Fervor gain changes nothing.
  - `wsvalue idle` 180 min: Kindling-only = none = f57.5, the same run to the decimal (idle has no input).
  - Burst: about +0.
  - Cheapest-first still buys 9 levels of it (about 2,200 Embers) by 8 h.
- Reworks tested in memory (`fix_kindling`, `fix_lightkeys`, `fix_warmstart`; 8 h, stall8, 4 seeds):

  | Kindling becomes | Typist at 8 h | Burst at 8 h | Idle at 8 h |
  |---|---|---|---|
  | Now (+12% Fervor gain) | f128.8 | f99.8 | f96.8 |
  | "Afterglow": +1 s / +2 s Fervor grace per level | f126.3 / f129.3 | f100.0 | |
  | +10% Sparks per key per level | **f135.5** (Embers x1.8) | f100.5 | |
  | "Rat Bait": rats +10% more often per level | f130.0 | f102.5 | f96.3 (Embers +15%) |
  | **"Second Wind" (40 keys, +2 Sparks)** | **f128.8 (unchanged)** | **f108.0** (+8.2; f87.0 against f81.8 at 4 h) | |

  - The Sparks version only widens F3.
  - Rat Bait gives idle more Embers but no more depth.
  - "Second Wind" means: after a pause of 60 s or more, the next 40 keys each make +2 extra Sparks.
- Why it matters: it's R2's Spark Jar problem again. A min-maxer will notice that one of four Workshop items does nothing.
- Proposed fix: **Kindling → "Second Wind": after a pause of 60 s or more, your next 4 × level keys make +2 Sparks each** (max 10 levels, so 40 keys). Same prices (90 × 1.55^l).
  - At full strength it gives light typists **+5 floors at 4 h and +8 at 8 h**, which moves burst/idle from 1.03x to **1.12x**.
  - Continuous typists are untouched (their pauses are under 60 s), so the F3 gap doesn't grow.
  - It also rewards coming back from a meeting, which fits a desktop companion.
  - Tested as a flat effect; scaling it by level is linear, so expect about +0.8 floors per level for burst.

### F5 [severity: minor] For idle players, half the Workshop does nothing, and the cards don't say so
- Evidence:
  - Idle Embers per hour: 73 in R2, **480** now (rats 54%, ults 32%, bosses 14%; `embersrc`). R2 F3 is solved on income.
  - But Kindling and Static Coins have **exactly zero effect** without input (identical runs).
  - `wsday idle` 8 h: none f95.0, default (cheapest-first) f95.7, **Overcharge-only f99.7** (`fix_crucible`: f98.5).

  So the idle Workshop as players will use it is worth +0.7 floors. Idle depth is driven by Fame and Legacy, and that's fine.
- Proposed fix: a small "needs typing" tag on the Static Coins and Kindling/Second Wind cards, so an idle player puts Embers into Overcharge and Crucible (+3.5 to +4.7 floors at 8 h). No economy change.

### F6 [severity: minor] Long tail: compounding Fame is safe. It doesn't run away; it flattens into a soft wall
- Evidence (`longrun 40`, 3 seeds, stall8):

  | Profile | 4 h | 8 h | 24 h | 40 h |
  |---|---|---|---|---|
  | Typist | f106 | f128 | f155 | f166 |
  | Idle | f80 | f96 | f108 | f115 |

  - Typist gains per retire: +94 average in 0–4 h, +55 at 8 h, +17 at 24 h, +8 at 40 h. Runs grow from 75 to 218 min.
  - Idle: +5 to +7 per retire after 16 h, with 2–3.5 h runs.
  - The nudge policy ends in the same place (typist f162 at 40 h).
  - Why there's no runaway: Fame's log-gain per floor is about 0.04 at f110 and about 0.05 at f200, against +0.243 per floor of enemy HP. The crossover is near f1400.
  - I tested an HP-growth taper past f100 (`fix_tail`):
    - ×1.22 per floor: the typist reaches f181 at 24 h, gains rise to +51 per retire, and it's close to running away.
    - ×1.25 per floor: typist f159; idle 109 instead of 108, which means it does nothing for idle.

    Idle's wall is at f100–110, before a taper starting at f100 kicks in.
- Why it matters: nothing is wrong in the formula. The full game will feel "done" at about f110 (idle) or about f150 (typist) on day 2. That's content: the finale, Depth II and Omens are already in the backlog.
- Proposed fix: no Fame change. Put the floor-100 finale and first Depth II at f100. If you add a taper, start it at **f90 with ×1.25**, not f100 with ×1.22.

### F7 [severity: minor] Light (burst) typists are still no better off than idle, and R2's Fervor-grace idea doesn't help
- Evidence:
  - Burst/idle depth ratio: 1.13x at 1 h, 1.17x at 2 h, **1.02x at 4 h, 1.03x at 8 h** (5 seeds). This is despite 2x the Embers (977/h against 480/h).
  - Burst Fervor: IDLE 74%, FLOW 2%.
  - **Tested: 8 s grace while Fervor is below 60** (the R2 F7 idea): burst f99.8, the same as now (f99.8). A 5–15 s burst every 1–3 min decays to 0 inside any reasonable grace.
  - Tested Kindling-as-grace (+1 or +2 s per level): f100.0. Kindling-as-Sparks: f100.5.
- Why it matters: a light typist is effectively an idle player, and idle is now well tuned. It's only a problem if marketing promises "even a little typing helps".
- Proposed fix: **drop the "8 s grace" item from the backlog** (measured: no effect). Use F4's "Second Wind" instead. It's measured at burst +8.2 floors at 8 h with typists unchanged, because the bonus pays out Sparks per burst instead of Fervor, which decays.

### F8 [severity: minor] Offline can't be gamed now, but it pays far less than the "40% speed" the modal claims
- Evidence (`econ3.js offline`, 3 seeds; offline pay as a share of online gold, average and at the best moment to close):

  | Profile | Fresh | Campfire 4 | Campfire 4 + Oil |
  |---|---|---|---|
  | Typist | 0.10x (best 0.20x) | 0.21x (0.40x) | 0.23x (0.49x) |
  | Idle | 0.19x (best 0.40x) | 0.34x (0.71x) | 0.37x (0.77x) |

  - Closing 2–20 min after a retire pays **0.01–0.15x**: the 10-min average and the EMA both lag a run that is climbing fast.
  - The modal says "Offline earnings run at 40% speed" (`ui.js:450`).
  - Online gold also counts rats (75 s of income each) and Static coins, which offline never pays.
- Why it matters: hardly anyone measures this, but "came back after 8 h to almost nothing" is a common idle-game review complaint.
- Proposed fix: either change the copy to "40% of your recent kill income" (cheap), or pay `max(incomeAvg, 0.5 × incomeRate)` (untested). The min() already blocks the peak-close exploit.

## Verified fixes from last round (pass/fail, one line each)
- **R2 F1, retiring early is free but the game doesn't say so: PASS for the game, FAIL for the harness.**
  - The nudge fires for a typist at **23–31 min** (f40), heavy 19–24, burst 47–85, idle 62–88.
  - Following it gives a typist R286 at 4 h, against R240 for stall8, with the same 8 h result (395–401 against 408). Run 2 gets back to the record in 8.3 min.
  - The button shows "+N% DMG & GOLD FOREVER".
  - The harness part was not done: `playtest.js` still retires only on stall, so its typist "first retire" is still **46–121 min**. The lead's 35–60 min check measures the harness, not the game.
- **R2 F2, Jar dead and Overcharge weak: PASS, and it overshot.**
  - The Workshop is worth +17 floors at 8 h, against about +3.
  - Crucible is a real investment: rushing it costs 6.5 floors at 1 h (f51.8 against f58.3) and pays back by 8 h (f129.0 against f128.8). Skipping it costs 4 floors at 8 h.
  - Overcharge now dominates (F3), and Kindling is dead (F4).
- **R2 F3, idle Embers: PASS on income** (73 → 480 per hour; Workshop level 17.4 at 8 h). **PARTIAL on value**: only Overcharge does anything for idle (F5).
- **R2 F4, wall at f100–105: PASS.** Typist f128–129 and idle f96 at 8 h, against f102–106 and f86–89 in R2. Late retires pay +55 on average at 8 h. No runaway out to 40 h (F6).
- **R2 F5, Legacy traps: PARTIAL.** Veterans has its niche: the best opener at 10 min (typist f45.0 against f42.0 for buy-all; idle f37.0 against f31.5). Head Start is still the weakest opener at 3+2l (idle f57.8 against f64.3 for lin+tre at 60 min). Lineage, or the Lineage/Treasury split, still wins at 30–60 min. Buying one of everything costs about 5 floors at 60 min.
- **R2 F6, offline jackpot: PASS.** Closing at the best moment pays 0.20–0.77x, against 1.3–4.45x. `playtest.js` is synced with main.js. Midnight Oil now matters (+0.02 to +0.06x).
- **R2 F7, typist/idle fairness: PASS at 4 h** (1.34x depth, 1.74x Renown). **Watch it long-term** (1.44x depth at 24–40 h, F3). Burst = idle is unchanged (F7; F4's "Second Wind" fixes it in testing).
- **R2 F8, Mage gold value: PASS.** Relative to the knight: 0.44x at 1e3 gold, 0.65x at 1e4, then **0.90–1.08x** at 1e6–1e14.
- **R2 changes didn't break pacing: PASS** (5 seeds, 8 h):

  | Profile | Boss 10 (R2) | Boss 20 (R2) | Deepest at 4 h | Deepest at 8 h |
  |---|---|---|---|---|
  | Typist | 3–4 min (3–5) | 6–10 min (7–11) | f101–113 | f126–130 |
  | Idle | 6–8 min (6–12) | 18–24 min (19–28) | f78–81 | f93–100 |
  | Heavy | | 6–8 min | f118–130 | |
  | Burst | | 19–22 min | f80–87 | |

  Run-2 speedup: run 2 is back at the record in 8–11 min (typist) and 14–15 min (idle).

## Ideas (optional, max 3)
1. **"Delve clock" for the demo** (and later Depth II): a best time to f40 and a re-delve with a new relic build is a speedrun loop that costs nothing to build. Typist laps are about 6.5 min.
2. **Overcharge as a visible stat**: "Your keys did 77% of today's damage." It's true from about 3 h, it's the store-page fantasy as a number, and it's a natural Steam achievement ("Ult-powered: 90% of damage from ultimates").
3. **A "Second Wind" flourish (F4):** when the bonus triggers, show a short "SECOND WIND" charge-bar flash. Coming back to the keyboard then feels rewarded, which is the moment a desktop-companion player most often glances at the strip.
