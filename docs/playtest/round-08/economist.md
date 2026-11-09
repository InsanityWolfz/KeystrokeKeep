# Round 08 — T1 economist (Incentive & Economy Designer)

## Verdict
**Full game: 8/10. Demo: 8/10 once F1 lands (7.5 today).** I would keep it running tomorrow and would not refund.

Every R7 economy fix passes its own test:
- **Caution rule:** idle hour-1 retreats are 1.6 at glance 60 and 2.7 at glance 300.
- **Dynamo cap 6:** the typing premium at 40 h is x1.39 (x1.25 with max 10).
- **Regroup and camp timers are separate:** 0 early re-fights.
- **Slain floors:** 0 boss re-kills.
- **Quartermaster** recruits in 10/10 runs.
- **The week-2 layer** adds about 30% to week-2 Renown, with no runaway.

The weak spot is the caution rule's trigger, "no input for 30 s". Two kinds of input switch it off:
- the clicks a player makes when they glance over and buy something;
- every mouse click on the desktop, which the Electron hook counts.

So the protection reaches only a truly hands-off player. A real idle player who clicks, or a typist who checks in every 5 minutes, still gets 4.8–11.7 retreats in hour 1 (F1).

R7 promised a "Glimpse of the Depths", and it is the demo's best moment. In commit 592ac10 it contained a hard softlock: retiring on the sealed floor broke the save. The working-tree change from 15:17 fixes it, and I verified the fix (F2).

**Method:**
- About 1,500 seeded runs of the real sim. No game file was edited.
- `pt8.js` wraps `tools/playtest.js` unchanged and adds telemetry. Options:
  - `KKCLICK=1`: a glance that buys something registers one click.
  - `KKMOUSE=N`: one desktop mouse click every ~N s.
  - `KKV` caution variants.
- `gate8.js` runs pt8 in parallel over seeds.
- `econ8.js`/`econ8batch.js` run the R6/R7 smart-spend player (`round-06/econ6lib.js`) for 8/40/80 h.
  - **Calendar days** are modelled by patching `KK.today` to one day per 8 h of play (`--day 4` for 4 h).
  - **Variants:** `--week2 off`, `--caution off|hybrid`, `--lanfree`, `--lanprice`, `--seal`, `--sealoff`, `--pm`, `--ws smart2`.
- **Other scripts:** `qm8.js` (Quartermaster hands-off vs manual), `chk_glimpse.js` (Glimpse and slain-floor edge cases), `agg8.js` (aggregation).
- **Raw output** is in `out/`, prefixed `gate_*`, `demo180*`, `e40*`, `e8c*`, `e80*`, `qm8_*`, `dynamo40.txt`. The `b40_*`/`b8_*` files there are another tester's.
- **Builds:** runs before 15:17 used commit 592ac10. `js/` then changed on disk (Glimpse retire fix, Rat King summons, glimpse door hold). `gate_now`, `e40now`, `e40pm` and the `chk_glimpse` re-check ran on that working tree. The anchors moved by 2 floors or less, and no conclusion changed.

## Findings (ranked, max 8)

### F1 [severity: major] The caution rule only protects a player who never touches the PC. Clicks and typing switch it off, so realistic idle players and glancing typists still fail the hour-1 gate
- **Evidence:** demo, hour 1, 10 seeds, `gate8.js` (`out/gate_now.txt`, `gate_mouse_h1.txt`, `gate_caution_variants.txt`).
  - **The code:** `world.js` `nextFloor` gates caution on `KK.lastInputAgo() >= 30`.
    - `lastInputT` is reset by every `addActivity`, clicks included (`state.js:128`).
    - The browser counts every `mousedown` on the page (`input.js:30`).
    - Electron forwards **every global mousedown** (`electron/main.js:206`).
  - **The harness has no clicks at all,** so the R7 gate measured a player who never moves the mouse.

  | Hour-1 retreats, mean [range] | Shipped | **Hybrid rule (fix)** |
  |---|---|---|
  | Idle, glance 60, no input at all (the old gate) | 1.6 [0–4] | 1.6 [0–4] |
  | Idle, glance 300, no input | 2.7 [0–5] (seed 9 = 5) | 2.7 |
  | Idle, glance 60, a buy click on each glance | **4.8 [3–8]**, 5/10 seeds over 4 | **1.6 [0–3]** |
  | Idle, glance 60, a desktop mouse click every ~20 s | **5.9 [2–8]**, 8/10 over 4 | **0.9 [0–2]** |
  | Idle, glance 300, a mouse click every ~20 s | **10.6 [8–12]** | **2.9 [1–5]** |
  | Typist, glance 60 | 3.1 [2–5] | **1.0 [0–2]** |
  | Typist, glance 300 (types all day, checks in rarely) | **11.7 [6–17]** | **4.5 [2–7]** |
  | Burst, glance 60 / glance 300 | 3.4 / 7.3 | **1.1 / 3.5** |

  - **Every other measure under the hybrid rule** (`demo180_hybrid`, `e8c`, `e40now`, `e80`):

    | Measure | Shipped | Hybrid |
    |---|---|---|
    | Typist demo card | 33.0 min | 33.0 min |
    | Typist glance 300: card | 75.0 min | 63.9 min |
    | Typist glance 300: Renown cap | 5/10 runs | 10/10 runs |
    | Burst card (the only cost) | 69.3 min | 75.7 min |
    | Typist depth, 8 h / 40 h | 146.5 / 184.8 | 144.6 / 184.7 |
    | Typist wipes in 40 h | 341 | 253 |
    | Typist regroups in 40 h | 77 | 42 |
    | Typist wipes in 80 h | 855 | 589 |
    | Burst depth at 40 h | 161.8 | 159.8 |
    | Burst wipes in 40 h | 148 | 110 |
    | Idle runs | — | byte-identical |
    | Gap at 8 h / 40 h | 1.299 / 1.242 | 1.279 / 1.241 |
- **Why it matters:**
  - The Next Fest audience runs it beside work. That means mouse clicks all day, or typing with a glance every few minutes. Those are the two profiles that still see 6–17 RETREAT alerts in hour 1.
  - Review line: "says it's idle, but my party dies every five minutes unless I babysit it."
- **Proposed fix (the "hybrid" rule):**
  1. **Track keystrokes separately.** Add `KK.lastKeyAgo()` (set in `addActivity` only when `kind === 'key'`), and use it for the caution guard. Mouse clicks still give Fervor and Sparks as before.
  2. **Typing skips only the 60% replay.** Apply the **35% step-back and the 85% pre-boss check to everyone**:
     ```js
     const typing = KK.lastKeyAgo() < 30;
     if (low < 0.35 && !isBoss(f-1)) back = 2;
     else if ((!typing && low < 0.6) || (isBoss(f+1) && low < 0.85)) back = 1;
     ```
  3. **Show the state.** Keep the calm "Training on floor N" line. Optionally add "CHARGING" when typing skips a replay (R7 idea 2).

### F2 [severity: blocker in 592ac10; fixed in the working tree at 15:17] Retiring on the Glimpse floor softlocked the save
- **Evidence:** `node chk_glimpse.js retire 1` on 592ac10.
  - On sealed floor 41, `canRetire()` was true and `renownGain()` was 30. `A.retire()` left `S.glimpse = true`.
  - The new delve's floor 1 spawned f38 magma monsters with 40k–100k HP against level-1 heroes. That made **226 wipes in 20 min**, about one every 5 s, with no way out: renownGain was 0, `demoDone` was false so no re-delve, and it was saved to disk.
  - **Re-check on the working tree:** `canRetire` is false during the Glimpse, and `retire()` clears it. After a forced retire: f38 reached in 20 min, 4 wipes. **PASS.**
  - **A wipe on the sealed floor** recovers to f40 with the Glimpse still active, then reaches the card normally (`chk_glimpse.js wipe`). **PASS.**
- **Proposed fix (remaining):** a load guard for saves written by 592ac10 builds (internal and dev only): in `KK.load`, `if (fresh.glimpse && fresh.floor < 40) fresh.glimpse = false`.

### F3 [severity: major] Quartermaster v2 no longer freezes, but a hands-off Quartermaster player is 11 floors behind a manual glancer
- **Evidence:** `qm8.js 60 1-10 60`, idle demo hour, Quartermaster owned from the start.

  | Player | Max floor at 1 h | Hour-1 retreats | Unspent gold (in cheapest levels) | Party levels at end (knight / archer / cleric / mage) |
  |---|---|---|---|---|
  | **Hands-off: only relics, rats and Quartermaster** | **24.1** | 2.7 | 8.4 | 39 / 28 / **2** / 17 |
  | Manual smart spender, no Quartermaster | **35.4** | 1.8 | 1.9 | 55 / 44 / 18 / 33 |

  - **2 h at glance 300:** 30.4 vs 39.8, and **f40 in 0/10 runs vs 6/10**.
  - **Recruits work:** all ten clerics recruited, at 45.4 min against 42.7 for the manual player.
  - **The cause:** the frugal rule (only buy levels costing ≤10% of current gold) keeps the party about 16 levels behind, and Quartermaster never buys Forge.
  - My replica of `autoBuy` matches the shipped one (24.0 floors vs 24.1).

    | Variant | Max floor at 1 h | Hour-1 retreats | Clerics recruited |
    |---|---|---|---|
    | Frugal 0.5 | 27.2 | 2.7 | 8/10 |
    | Frugal 1.0 (starves the cleric) | 26.9 | 2.4 | 5/10 |
    | **Frugal 0.5 + Forge** | **32.2** | **1.2** | **10/10** |
- **Why it matters:**
  - Quartermaster is the first Legacy buy for nearly everyone, and it exists for the idle player.
  - Trusting it makes the game slower than glancing. Review line: "the auto-leveler is a trap, it hoards gold."
- **Proposed fix:**
  - In `autoBuy`: frugal threshold `0.1` → **`0.5`**.
  - After the recruit check: `for (d of FORGE.slice(0,3)) up to 5x while upCost(d) <= gold*0.25 buyForge(d)` (Sharpen Blades, Rivet Armor, Gilded Purse).
  - New description: "levels heroes, recruits and buys Forge upgrades with spare gold".

### F4 [severity: minor] Seal of the Day: healthy amount, no decision. It is a login bonus claimed 20 minutes into the day, and a stale star pays seals on later days
- **Evidence:** `econ8batch` 40 h, 6 seeds × 3 profiles, with an 8 h play day (`out/e40b_agg.txt`, `e40now_agg.txt`, `e40seal.jsonl`).
  - **Seals are claimed every time:** 30/30 days for every profile. The claim comes **17–25 min into the first run of the day** (first day: 5 min), because record − 15 is reached almost at once.
  - **Picking the omen is not a choice:** the star is forced into every offer on an open day. Even a player who **ignores** the star gets 76–84% of the seals.
  - **The value is healthy.** Seals make up **~31% of week-2 Renown** for both profiles:

    | Profile | Renown, 40 h → 80 h | From Seals |
    |---|---|---|
    | Typist | 927 → 1104 | 50 |
    | Idle | 594 → 753 | 50 |

    Depth at 40 h, compared with the week-2 layer off:

    | Profile | Week-2 layer off | Layer on |
    |---|---|---|
    | Idle | 146.2 | 148.8 |
    | Typist | 180.2 | 184.8 |
    | Burst | 158.2 | 161.8 |

    With a 4 h day: idle 151.5, typist 190.5. No runaway; the gap is 1.233–1.265 everywhere.
  - **Stale star (code):** `claimSeal` checks `S.omen === S.omenStar`, but the star isn't tied to its day.
    - A run started under yesterday's star pays today's Seal on the next floor change (0.2–0.8 stale seals per typist in 40–80 h; one came 480 min into a run).
    - Moving the PC clock forward therefore gives +10 Renown and a Seal per day advanced, with no retire needed. That makes Faithful and Devout farmable.
  - **Harder variants tested:**

    | Variant | Median minutes into the run | p90 | Seals | Idle / typist depth at 40 h (base 148.8 / 184.8) |
    |---|---|---|---|---|
    | Record − 10, payout 20 | 21–26 | 34–48 | 5/5 | 152.7 / 189.7 |
    | **Record − 5, payout 25** | **35–40** | **58–70** | **5/5** | **155.3 / 191.7** |

    The 25 payout and the gap of 1.234 belong to the record − 5 variant.
- **Why it matters:** the daily ritual is the week-2 hook, and right now it asks for nothing.
- **Proposed fix:**
  - `sealFloor = max(40, renownFloor - 5)`.
  - Payout `10 + floor(renownFloor / 10)` (about 25 at a record of 150).
  - Store `S.omenStarDay = KK.today()` at retire and require `S.omenStarDay === KK.today()` in the claim.
  - Optional: refuse a Seal when `today` sorts before the last `sealDay` (clock went backwards).

### F5 [severity: minor] The Void Lantern is near-dead: typists buy it when it no longer matters, and the idle player who needs it can't afford it
- **Evidence:** 40 h, 6 seeds (`out/e40b_agg.txt`, `e40lan*.jsonl`).
  - **Typist:** buys all 5 levels at **6.6 h** with spare Embers (3k–170k Embers unspent at 40–80 h). Depth: Lantern off 189.2 vs on 186.2, which is noise.
  - **Burst:** 2–3 levels by 19 h.
  - **Idle:** **never** buys it. The R6 player sinks its Embers into Overcharge and typing-only items.
  - **A smarter idle player** (Dynamo, then Lantern, then Crucible) still gets only **2 levels by 14.6 h** (146.8 vs 147.2 without it), because idle earns about 27k Embers in 40 h and level 3 costs 12,960.
  - **What it could do:** Lantern 5 given for free cuts **idle wipes from 91 to 55** and regroups from 33 to 19, and adds +3.6 floors. It is a comfort item that the right player never gets.

    | Smart idle player, Dynamo first | Lantern | Wipes in 40 h | Regroups | Depth at 40 h |
    |---|---|---|---|---|
    | Lantern off | — | 110 | 37 | 147.2 |
    | Repriced: 1,000 × 1.6, −10% per level | **4.8 levels by 6.3 h** | **45** | **17** | **149.7** |
- **Proposed fix:**
  - `lantern: base 4000 → 1000, growth 1.8 → 1.6`, effect `-8%` → **`-10%` per level** (max −50%).
  - Optional: tag it "FOR IDLE PARTIES" the way typing items are tagged, so the shop points idle players at it instead of Overcharge.

### F6 [severity: minor] Fervor's middle tiers are dead after hour 2. The Dynamo floor (x1.78) beats IN THE ZONE (x1.6), so the HUD multiplier only moves in FLOW
- **Evidence:** `round-07/dbg_dynamo.js` on the current build (`out/dynamo40.txt`).
  - **Burst seed 1:** typing premium **x1.00 from h2 to h39**, with the floor binding 98–100% of the time.
  - **Typists:** x1.17–1.52 at 16–40 h. That passes the R7 F3 test (seed 2 was x1.01).
  - **The cause:** `powerMult = max(tier, 1 + idlePow + dynamo)`. Once Dynamo is 3 or more, FOCUSED and ZONE never win.
  - **Variant "stack5"** (`max(tier, floor) × (1 + 0.05 × tierIndex)`, 6 seeds, current build):

    | Profile | Shipped at 40 h | stack5 at 40 h |
    |---|---|---|
    | Typist | 184.8 | 187.3 |
    | Burst | 161.8 | 162.2 |
    | Idle | 148.8 | 148.8 |

    The gap at 8 h goes from 1.299 to 1.324, and at 40 h from 1.242 to 1.259.
- **Why it matters:** the store fantasy is "your typing powers them". Burst typists, the office majority, see the number frozen at x1.78 whatever they do.
- **Proposed fix:** in `KK.powerMult`: `return Math.max(mult, floor) * (1 + 0.05 * t)`, which gives +5/10/15% at FOCUSED/ZONE/FLOW on top of whichever is higher.

### F7 [severity: minor] Demo: the "Stuck? Retire" hint before the first floor-40 clear delays the idle player's Glimpse by about 7–9 minutes
- **Evidence:** idle demo, 10 seeds, 180 min.

  | Policy | Glimpse at glance 60 | Glimpse at glance 300 |
  |---|---|---|
  | `--stuck 8` (stall retires at f30–34 for +3 to +13 Renown) | 89.7 min | 146.6 min (9/10 runs) |
  | `--stuck 999` (never retire before f40) | **82.8 min** | **137.3 min** |

  The early Renown doesn't pay back the reset. The HUD shows "Stuck? ♛ Retire: +g" when `g >= 10` and the run has stalled for 5 min (`ui.js:88`).
- **Proposed fix:** in the demo, before the first f40 clear (`!S.glimpseDone`), raise the hint threshold to `g >= 25`, which means floor 37 or deeper. Or show "Keep going: the floor-40 boss guards the depths".

### F8 [severity: info] Demo pacing with Head Start capped at 1, plus the Glimpse: nothing broken
- **Evidence:** `out/demo180.txt`, `gate_now.txt`, 10 seeds, 180 min.

  | Profile | Glimpse / card | Renown cap of 120 | Notes |
  |---|---|---|---|
  | **Typist** | 32.5 / 33.0 min (range 29.6–36.9) | at **125 min**, 10/10 runs | Best lap **4.4–4.5 min** (R7 with Head Start 2: 4.1); 16 retires |
  | Burst | 68.7 / 69.3 min | 2/10 runs in 3 h | |
  | Idle, glance 60 | 89.7 / 90.1 min | never in 3 h (78–108 Renown) | The 40-min "what waits below" card fires for all idle and burst runs |
  | Idle, glance 300 | 146.6 / 147.1 min | | Seed 6 never reached f40 in 3 h |

  The Glimpse floor itself takes about 30 s (plus the 3 s door hold in the working tree).
- **Notes:**
  - The typist's first retire is at 33 min, just under the LOOP's 35–60 min target. I'd leave it.
  - Head Start capped at 1 keeps the Rat King in every lap, as intended; the cost is 0.4 min per lap.

## Verified fixes from last round (pass/fail, one line each)
- **Idle hour-1 gate, playtest.js player with no input: PASS.**
  - Glance 60: 1.6 [2,1,2,4,0,1,2,3,0,1]; R7 shipped 7.9.
  - Glance 300: 2.7 [3,0,4,2,3,2,3,3,5,2], 9 of 10 seeds at 4 or under; R7 15.8.
  - No wipe before 10:00 in any run. But it **fails with realistic clicks** (F1).
- **Caution rule vs 8/40 h depth and the gap: PASS.** Shipped vs caution off, 6 seeds, 592ac10:
  - Idle 112.5 / 147.2 vs 112.8 / 149.3; typist 146.2 / 186.2 vs 146.7 / 187.2; burst 119.0 / 160.8 vs 118.2 / 161.7.
  - The gap is 1.299 vs 1.300 at 8 h and 1.265 vs 1.253 at 40 h.
  - Hour 1 for idle: 1.0 vs 7.3 wipes. Side effect: idle has more boss wipes after 8 h (82 vs 67 in 40 h), because it reaches bosses more often instead of camping.
- **Quartermaster v2: PASS as a mechanic, FAIL on value.** Recruits 10/10 and no freeze, but hands-off play is −11 floors at 1 h (F3).
- **Dynamo cap 6 vs FLOW: PASS.**
  - Typist premium x1.39 at 40 h (max 10: x1.25); seed 2 at 16–40 h is x1.17–1.48 (R7 x1.01).
  - Depth 186.2 vs 186.0 with max 10. The refund formula in `KK.load` matches `upCost`.
  - Burst still has x1.00 (F6).
- **Regroup timer separation: PASS.** 0 boss re-fights within 10 min of a regroup, across 18 runs of 40 h and 12 runs of 80 h (R7: 35/293).
- **Slain floors, no re-kill: PASS.**
  - 0 repeat boss kills per delve in every econ, gate and demo run (R7: 1–5 per 3 h at glance 300).
  - A forced wipe on f11 recovers to f10, which plays without the boss (`chk_glimpse.js slain`).
- **R7 F8, typist first retire: info.** It is now at 33.0 min, from f40 for +30.

## Ideas (optional, max 3)
1. **An Ember sink with personality for week 2.** Typists hold 80k–170k unspent Embers at 80 h, and the only sink is Overcharge at ×1.6 cost for ×1.3 damage. Add a repeatable "Relic Reforge" (Embers → re-roll one relic offer, cost ×2 each use per delve). It turns a pile into a decision.
2. **Seal streaks instead of bigger Seals.** +1 Renown per consecutive day, up to +7, shown as seven pips on the omen card. That is the genre's proven week-2 hook, and it costs nothing in the first 8 h.
3. **Late boss loops.** After hour 8, about 90% of wipes are the boss → 3 losses → regroup cycle: idle 2.6 an hour, typists 6.9 an hour. Applying the hybrid rule's 85% pre-boss check after a boss loss, and holding until +5 levels, would make the week-2 strip quieter. F1 already cuts typist wipes by 26–31%.
