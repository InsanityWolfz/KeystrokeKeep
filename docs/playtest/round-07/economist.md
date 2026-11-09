# Round 07 — T1 economist (Incentive & Economy Designer)

## Verdict
**Full game: 8/10 (R6: 7.5). Demo: 7.5/10.** I would keep it running tomorrow and would not refund. Every R6 economy fix I asked for passes:
- **Enrage + wounds:** no more retreat loops.
- **Dynamo 10%:** the 8 h typist/idle gap is 1.31x on 5 seeds and 1.33x on 10.
- **Codex every 8 kills:** no more clumps.
- **Regroup:** typist frontier wipes are down from about 60 an hour to 11–13 an hour.
- **Blitz 8:** no longer unlocks together with Speedrunner.

The demo stays at 7.5 for one reason: **the idle first hour still fails the market gate**. It averages 7.9 retreats over 10 seeds, and the first one always lands at 10:00–11:24, the moment the onboarding grace ends.

None of the levers in the brief fixes it on its own: hero HP, early enemy scaling, Rivet Armor, the camp rule, Quartermaster and grace length all fall short. What works is one small rule: an idle party that **took a beating on a floor replays it, instead of descending**. That gives 1.5 retreats in hour 1 (0–3 per seed), with the first at 16.4 min. The typist demo and the 8 h curve are unchanged within noise (F1).

Method:
- **About 1,100 seeded runs of the real sim.** No game file was edited.
- **Gate runs:** `pt7.js` wraps `tools/playtest.js` unchanged, the same method as the market's `wipe_floors.js` (`--demo --retire nudge --omen random`, glance 60, plus glance 300/900 as a less attentive idle player). `gate.js` runs it over seeds.
- **8 h and 40 h curves:** `econ7.js`/`econ7batch.js` reuse the R6 smart-spend player (`round-06/econ6lib.js`), so the numbers compare directly with my R6 report.
- **Variants:** `r7patch.js` applies every variant in memory, named in `variants.js`.
- **Aggregation and checks:** `agg7.js` aggregates. Code-bug checks are in `dbg_regroup.js`, `dbg_recover.js` and `dbg_dynamo.js`.
- **Raw output** is in `out/` (`gate_*.txt`, `cand_*.txt`, `full8_*.txt`, `e8_*.jsonl`, `e40*.jsonl`, `pt_*.txt`).

## Findings (ranked, max 8)

### F1 [severity: major] Idle first hour: 7.9 retreats and a guaranteed wipe at 10:00. Only a "caution" rule passes the gate cheaply
- **Evidence:** idle demo, hour 1, `node gate.js --demo --min 180 --seeds 1-10 --variants ...` (playtest.js player, glance 60). Market gate: ≤4 retreats, none before minute 10.
  - **Shipped:** 7.9 retreats `[8,10,8,6,9,6,9,8,8,7]`, split 4.3 normal floor / 3.4 boss / 0.2 enrage.
    - The first is at **10.2–11.4 min in 10/10 seeds**. The grace keeps the party at 1 HP, so it marches to f14–17, then wipes the second the grace ends.
    - Hours 2–8 add only 0.8 wipes an hour. The pain is all in the first impression.
  - **Every lever from the brief, alone:**

    | Lever | Hour-1 retreats (mean [per seed]) | First wipe |
    |---|---|---|
    | Shipped | 7.9 [6–10] | 10.2 |
    | Hero base HP x1.25 / x1.5 / x2 | 7.2 / 5.3 / 4.2 [2–8] | 10.3 |
    | Enemy attack x0.5 on f1, ramping to x1 at f40 | 5.8 [4–7] | 10.3 |
    | Rivet Armor 60 × 1.55^l / 40 × 1.5^l / +20% per level | 7.6 / 9.2 / 8.0 | 10.1 |
    | Camp exit at +12 levels / +20 levels and 15 min | 6.2 / 5.8 | 10.2 |
    | Grace 15 / 20 min; grace only before the first boss | 8.8 / 6.0 / 7.8 (7 wipes before 10:00) | 15.1 / 20.0 / 6.6 |
    | Quartermaster owned from the start | 6.6 | 10.4 |
    | Cleric recruit 2,000 / 1,000 | 6.5 / 6.0 | 10.2 |
    | Regroup after 1 boss loss | 5.8 (demo card +14 min) | 10.2 |

  - **Why HP and scaling don't work:** they shift the frontier but don't change how the player meets it.
    - Enemy danger grows about 1.45x per floor (attack x1.14, time-to-kill x1.275).
    - A wipe costs only 2.4 s plus one floor, and the camp exits at +4 levels within a minute or two.
    - So the cheapest way forward is to bounce off the wall, and the idle party does exactly that.
  - **The caution rule.** On a normal floor, when no key has been pressed for 30 s or more:
    - if the party's total HP fell below **60%** at any point, it replays that floor;
    - below **35%**, it steps back one floor (never onto a boss floor);
    - on floor x9, it needs **≥85%** before it may enter the boss floor.

    | Variant (10 seeds) | Idle hour 1, glance 60 | First | Idle glance 300 (shipped 15.8) | Idle card / best lap | Typist demo: hour-1 retreats / card / lap | Burst demo, hour 1 (shipped 8.2) |
    |---|---|---|---|---|---|---|
    | Shipped | 7.9 [6–10] | 10.2 | 15.8 [13–21] | 81.2 / 5.1 min | 4.1 / 28.9 / 4.1 | 8.2 |
    | Caution 50% only | 3.3 [1–7] | 11.6 | 8.9 | 77.2 / 5.3 | 2.4 / 30.3 / 4.1 | |
    | Caution 50% + pre-boss 85% | 2.7 [0–6] | 13.1 | 4.3 | 91.8 / 5.4 | 1.3 / 30.9 / 4.1 | |
    | **Caution 60 / 35 / 85, all the time** | **1.5 [0–3]** | **16.4** | **3.3 [0–5]** | 83.4 / 5.3 | 0.6 / 31.1 / 4.1 | 0.8 |
    | **Caution 60 / 35 / 85, only after 30 s without input** | **1.5 [0–3]** | **16.4** | **3.3** | 83.4 / 5.3 | **4.1 / 30.9 / 4.0** | 2.5 |
    | The same, after 60 s without input | 1.6 [0–3] | 16.7 | 3.2 | 85.9 / 5.3 | identical to shipped | 4.9 |
    | The same + Quartermaster v2 (F2) | 1.1 [0–4] | 15.3 | **2.3** | 88.0 / 5.2 (glance 300: card 117 vs 146 min) | 1.1 / 29.0 / 4.0 | |
    | Caution 50% + pre-boss 85% + hero HP x1.25 | 1.4 [0–3] | 16.1 | 3.7 | 81.0 / 5.3 | 0.5 / 29.6 / 4.2 | |

    - Seeds 1–5 (the brief's "5 seeds"): 2, 3, 3, 2, 1.
    - The market's seeds 1/2/6: 2, 3, 1.
  - **Long curve with the idle-only rule (30 s):**

    | | Shipped | With the rule |
    |---|---|---|
    | 8 h, econ player, 10 seeds: idle / typist / burst | f110.2 / 146.5 / 114.0 | f107.6 / 146.4 / 114.8 |
    | 8 h, playtest.js, all-the-time version: idle / typist | f101.2 / 136.8 | f102.8 / 133.4 |
    | 40 h, 5 seeds: idle / typist | f147.0 / 184.8 | f143.6 / 180.8 |
    | Idle wipes in 40 h | 106 | 45 |
    | Typist wipes in 40 h | 411 | 378 |

    - **Gap at 8 h:** 1.33x → 1.36x on the econ player and 1.35x → 1.30x on playtest.js. That is within seed noise, and nothing walls.
- **Why it matters:**
  - This is the Next Fest wishlist window. Ten "RETREAT" alerts in the first hour on a strip that sits beside your work reads as "it's not really idle", and the first one comes exactly when the player looks back at the screen after 10 minutes.
  - It also changes the economics. Wiping is currently the fastest strategy, so the idle party wipes by design. With caution, playing safe is what the idle party does automatically, which is the genre's "auto-farm" norm.
- **Proposed fix:** about 12 lines in `world.js` plus a pill.
  1. **Track the floor's low point.** Keep `W.floorLow = 1`, reset in `nextFloor`, `recover` and `reset`. In `W.damageHero`, after `h.hp -= dmg`, set it to the minimum of itself and (sum of alive heroes' HP / sum of max HP).
  2. **Apply caution at the top of `W.nextFloor`**, guarded by `KK.lastInputAgo() >= 30`, `!F.isBossFloor(S.floor)`, not the demo cap floors, and only when the existing camp/regroup hold isn't already active (otherwise the floor drops twice):
     - `floorLow < 0.35` and `!isBossFloor(S.floor - 1)` → `S.floor -= 2` (step back);
     - else if `floorLow < 0.60`, or (`isBossFloor(S.floor + 1)` and `floorLow < 0.85`) → `S.floor -= 1` (replay);
     - clamp to `startFloor`.
  3. **UI:** a calm pill, "TRAINING ON F19" or "GATHERING STRENGTH FOR THE BOSS". No sound.
  4. **The grace debt goes away by itself.** Grace saves pin heroes at 1 HP, which counts as a beating, so the party stops advancing during the grace instead of overreaching.

  With the 30 s guard, typing means "the party charges" and idling means "the party plays it safe". The typist demo is byte-identical at 60 s and differs by noise at 30 s.

### F2 [severity: major] Quartermaster freezes all leveling whenever a hero is unlocked but unaffordable, which makes idle wipes worse
- **Evidence:**
  - **The code:** `world.js` `autoBuy()` returns early while `A.canRecruit(id) && S.gold < A.recruitCost(id)`, and it never recruits.
    - The mage unlocks at f10 (1,500 gold) and the cleric at f18 (4,000).
    - So through most of f10–30, Quartermaster levels nothing until the player clicks Recruit.
  - **A player that saves gold this way** (`saver` variant, glance 60) gets **16.4 hour-1 retreats against 7.9**, and its demo card comes at 110.9 min instead of 81.2.
  - **Quartermaster owned from the start** barely helps: 6.6 retreats at glance 60, and **15.2 against 15.8 at glance 300**, which is exactly the less attentive player Quartermaster exists for.
  - **Quartermaster v2** (recruits when affordable, saves only when gold plus 120 s of income covers the recruit, otherwise keeps 10%-frugal leveling): 12.6 retreats at glance 300 alone. With F1 it gets **2.3** and a demo card at 117 min instead of 146.
- **Why it matters:**
  - Quartermaster is the first Legacy purchase almost everyone makes (6 Renown).
  - "I bought the auto-leveler and my party stopped leveling" is a support ticket and a review line.
- **Proposed fix:**
  - In `autoBuy`: first `for (id) if (A.canRecruit(id) && S.gold >= A.recruitCost(id)) A.recruit(id)`.
  - Then save only if `S.gold + S.incomeRate * 120 >= A.recruitCost(id)`.
  - Update the description: "...and recruits new heroes".
  - Optional for the demo: grant Quartermaster after the first boss kill (it is the idle player's best F1 companion).

### F3 [severity: major] Dynamo 10 plus Idle Battery is a x2.18 power floor that equals FLOW STATE, so typing's power premium can drop to x1.01 after about 12 h
- **Evidence:** `dbg_dynamo.js` samples once per second over 40 h.
  - **Typists own Dynamo 3 within hour 0, 8 by hour 8 and 10 by hours 12–16.** Typing makes Sparks, Sparks make Embers.
  - **The floor:** `KK.powerMult = max(tier, 1 + idlePow + dynamo)`. With Dynamo 10 and Battery 3 that is 2.18, against FOCUSED 1.25, ZONE 1.6 and FLOW 2.2.
  - **The typing premium (average power / floor):**

    | Typist | 0 h | 4 h | 8 h | 16–40 h |
    |---|---|---|---|---|
    | Seed 1 (has Flow Pendant) | x1.64 | x1.28 | x1.18 | x1.23–1.35 |
    | Seed 2 (no Pendant, 16–40 h) | x1.70 | x1.20 | x1.53 | **x1.01** |

    The floor beats the player's tier 25–43% of the time.
  - So for the most engaged players, the Fervor tiers become a light show in week 1. Typing still pays through ultimates (Sparks).
  - **Capping Dynamo at 6** (floor 1.78; FLOW keeps +24%) costs nothing measurable, because typists spend the Embers elsewhere:

    | | 8 h, 10 seeds | 40 h, 5 seeds |
    |---|---|---|
    | Typist | f147.0 vs 146.5 | f182.0 vs 184.8 |
    | Idle | unchanged | f146.2 vs 147.0 (idle reaches level 7 only at about 32 h) |
    | Gap | 1.334x vs 1.329x | 1.245x vs 1.257x |
- **Why it matters:** the store fantasy is "your typing powers them". The review line would be "after day one FLOW STATE does nothing, it's just idle".
- **Proposed fix:**
  - `data.js` Dynamo: `max: 10` → **`max: 6`**. Refund levels 7–10 in `KK.load`: `150 × 1.6^l` for l = 6..9, which is about 13.8k Embers per save that has them.
  - The Overcharge sink absorbs the refund.

### F4 [severity: minor] Regroup is ignored after a retire: the old delve's `campFloor` overrides the boss wall
- **Evidence:** `dbg_regroup.js` checks every regroup to see whether the boss is re-fought before 10 minutes.
  - **8 h:** this happens 1 time in 106 regroups (10 seeds per profile).
  - **40 h typist:** **35 of 293** (3 seeds) are re-fought within 15–511 s:
    - 27 have a stale `campFloor` above the boss floor. For example, `campFloor 179` from the previous delve with a regroup at f160: the wall is `max(bossBlock, campFloor)` = 179, so `floor + 1 >= wall` is false and the party walks straight back in.
    - 1 is the normal-floor camp's level exit zeroing the shared `campUntil`.
    - 7 are a normal-floor wipe during a regroup overwriting `campUntil` with the camp's shorter timer.
  - `A.retire` resets `campUntil` but not `campFloor` or `campLevels`.
- **Why it matters:** this is the R6 wipe treadmill coming back in week 2, right after the player's retire.
- **Proposed fix:**
  - `A.retire`: add `S.campFloor = 0; S.campLevels = 0;`.
  - Give the boss regroup its own `S.regroupUntil`. In `nextFloor`, the wall is `regroupUntil > now ? bossBlock : (campUntil > now ? campFloor : 0)`.
  - The camp's level exit clears only `campFloor`, `campLevels` and `campUntil`.

### F5 [severity: minor] A retreat from floor x1 lands on the cleared boss floor: a forced boss rematch, a second wipe, and a free relic
- **Evidence:**
  - `dbg_recover.js` (idle demo, seed 4, glance 300): "13.2m WIPE f11 → recovered to f10 → bossSpawn ratking → 14.3m WIPE f10".
  - The camp rule then holds the party on f10, so each loop is another boss fight.
  - At glance 300, 11 of 158 hour-1 retreats are on x1 floors. Each costs a likely boss wipe after it, and **1–5 repeat boss kills per 3 h**, each worth a relic offer, 10 Embers and 14x gold.
  - Glance 60: 0–0.6 per 8 h. Rare for attentive players, common for the true idler.
- **Proposed fix:** in `W.recover`, if the new floor is a boss floor below `maxFloorRun`, play it without the boss: `W.bossCleared = true` skips the boss wave, or land on x9 (`S.floor -= 1`). F1's step-back rule already avoids boss floors.

### F6 [severity: minor, info] The six signature moves are economy-neutral. The "ultimate breaks it" rewards fire for typists but don't widen the gap
- **Evidence:** 8 h, 5 seeds, each move switched off in memory.

  | Variant | Idle f@8h | Typist f@8h | Burst f@8h | Gap at 8 h | Idle hour-1 wipes |
  |---|---|---|---|---|---|
  | Shipped | 111.8 | 146.6 | 114.2 | 1.311x | 9.0 |
  | No moves | 110.0 | 144.8 | 116.4 | 1.316x | 8.4 |
  | No Web Shot | 108.4 | 146.0 | 114.0 | 1.347x | 8.8 |
  | No Magma Shell | 109.2 | 144.6 | 115.6 | 1.324x | 9.0 |
  | Ultimates don't tear webs or crack shells | 111.8 | 144.8 | 115.6 | 1.295x | 9.0 |
  | No Lava Rain / Summons / War Charge / Reassemble | 108.6–111.2 | 143.0–146.0 | 114.6–117.4 | 1.31–1.34x | |

  - At 40 h, no moves gives a 1.263x gap against 1.257x shipped.
  - **Every delta is within ±2.5 floors**, which is seed noise.
  - **The idle demo's hour 1:** 9.3 retreats with no moves against 7.9 shipped. The moves are not why idle wipes; Royal Summons rats even pay gold.
  - **Web Shot:** 70 webs per 8 h for idle, 0 torn by an ultimate. Typist: 44 webs, **4 torn (9%)**. The web targets the back-most hero, whose ultimate is rarely up in the rotation.
  - **Magma Shell:** typists crack **45%** of shells (22/49), idle 3% (1/38). But the shell only halves normal hits for 4 of every 12 s, on about 1 in 10 bosses, so even for idle it's about a 17% damage loss in those fights.
- **Proposed fix:** none for the economy. If you want Web Shot's counterplay to be visible, aim the web at the hero whose ultimate turn is next (`W.ultTurn`) instead of the back-most hero. Typist tears would rise from about 9% to the share of webs that land while that hero has Sparks, and idle stays at 0.

### F7 [severity: minor, info] The idle demo player who glances every 5 minutes has twice the shipped wipes
- **Evidence:** the same gate at `--glance 300`: idle **15.8** hour-1 retreats (13–21); typist 13.4.
  - Gold piles up between glances, so the party is under-leveled for minutes at a time.
  - F1 alone brings idle down to 3.3 (0–5). F1 plus F2 brings it to 2.3.
- **Why it matters:** the market's gate assumes a player who spends every 60 s. A real idle player looks over every few minutes, and that player sees twice as many retreats. Please judge F1/F2 at glance 300 too.
- **Proposed fix:** add `--glance 300` to the market gate. F1 + F2 meet ≤4 on 8/10 seeds there (max 5).

### F8 [severity: minor] The typist's first retire comes at 21–28 min, below the LOOP's 35–60 min pacing target
- **Evidence:** `playtest.js --retire nudge`:
  - Typist: first retire on seeds 1/2/3/4/5 at 25.7, 27.7, 28.6, 26.2 and 21.7 min, each from f40 for +30 Renown.
  - Idle: 26–72 min, mostly stall retires for 3–30 Renown.
  - The nudge fires on the first f40.
- **Proposed fix:** none needed if the 35–60 target is meant for the median (idle/burst) player. If not, nudge the first retire at f45 (`renownFor(45)` = 36), which moves typists to about 32–35 min.

## Verified fixes from last round (pass/fail, one line each)
- **Enrage resets after a wipe (`W.recover` → `wipeT = 0`): PASS.** The longest won boss fight across all 40 h runs is 179 s (R6 shipped: 2,383 s).
- **Wounds stop the loops: PASS.**
  - Idle 40 h: longest streak 7 enrages / 93 min (R6, fix without wounds: 103 / 840 min). Idle has 5.2 enrages per 8 h and 30.8 per 40 h; typist 0.7 / 2.8.
  - Depth, 8 h (10 seeds) / 40 h (5 seeds):

    | | Now | R6 shipped |
    |---|---|---|
    | Idle | f110.2 / 147.0 | 106.2 / 144.7 |
    | Typist | f146.5 / 184.8 | 148.2 / 186 |
    | Burst | f114.0 / 156.4 | |
- **Regroup after 3 losses: PASS, with the F4 bug.**
  - Typist frontier wipes are 11.2/h at 8–24 h and 12.6/h at 24–40 h (R6: about 60/h). 40 h wipes: 411 (R6: 951).
  - Regroups hold ≥600 s in 105 of 106 cases at 8 h, but 35 of 293 break at 40 h.
- **Dynamo 10%: PASS.** The typist/idle gap at 8 h is 1.311x (5 seeds) and 1.329x (10 seeds), per seed 1.22–1.39. Idle owns about 3.4 levels at 8 h. At 40 h the gap is 1.257x (R6: 1.27x).
- **Codex every 8 kills: PASS.**
  - The clumps are gone: at most 2 ranks within any hour (R6: 6).
  - Ranks at 8 / 24 / 40 h:

    | | Now | R6 replay prediction |
    |---|---|---|
    | Typist | 7.4 / 18.2 / 24.6 | 7.7 / 16.3 / 24.3 |
    | Idle | 2.2 / 8.0 / 12.0 | |

  - Longest gaps:
    - Typist: 3.0–10.3 h (median 6.7), and only at the 20–31 h frontier. Before 16 h it never exceeds 4.5 h.
    - Idle: 5.9–7.9 h.
  - Note: idle has 12 ranks at 40 h, against 15.7 under the old per-boss track. The cheap 3- and 10-kill ranks are gone.
- **Blitz = 8 bosses in 10 minutes: PASS.** Typist at 265 min (10/10 seeds), separate from Speedrunner (63 min). Idle and burst never reach it in 8 h; burst does at about 994 min. Never in the 3 h demo (typist 0/5).
- **No KOs before the first boss or 10 min: PASS literally, but it creates a cliff.** There are 0 wipes before 10:00 in 40/40 runs, but the first comes at 10.0–11.4 min in 10/10 idle seeds (F1 removes the cliff).
- **Normal-floor camp (+4 levels or 8 min): PARTIAL.** It works as written, but the +4-level exit comes within 1–2 min, so it barely reduces wipes. Even +12 levels only gets 6.2.
- **War Charge from 0.5 s / Reassemble: PASS as flavour.** Switching either off changes 8 h depth by at most ±3.6 floors (noise).

## Ideas (optional, max 3)
1. **Make "Training" a visible, rewarding state.** While the F1 rule holds the party, show a tiny XP-style bar ("TRAINING · 62% → F19") that fills as levels close the gap to the next floor's predicted danger. The idle player sees the party preparing instead of failing. It is the same economics as now, with a far better feeling.
2. **"The party charges when you type."** Make the F1 rule's 30 s guard visible: a "CHARGE!" stance when typing resumes, so the party skips caution and pushes. Typing then gets a second, legible reward (aggression) on top of power, which also helps F3 after Dynamo is capped.
3. **Codex drip at the frontier.** The remaining 6–10 h droughts are typist frontier walls. Give 1 Codex kill-credit for every regroup that ends without a win (max 1 per 10 min). That's at most about 4 credits an hour, half a rank, enough to keep the bar moving in week 2 without touching hours 1–12.
