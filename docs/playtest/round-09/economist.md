# Round 09 — T1 economist (Incentive & Economy Designer)

## Verdict
**Full game: 8/10. Demo: 8/10.** I would keep it running tomorrow, and I would not refund at $4.99.

Most of the R8 economy fixes pass with realistic input:
- **Hour-1 gate:** idle players who click to buy and use the mouse on the desktop now get 0.7–2.8 retreats in hour 1. In R8 they got 4.8–10.6.
- **Quartermaster** matches a manual glancer in the demo hour.
- **Seal of the Day** is a real goal now. It is claimed on 89–100% of days for five weeks, 25–85 minutes into the run, and a stale star never pays.
- **Void Lantern** halves idle wipes when it is bought.

**Two economy problems remain:**
- **Seal clock farming:** moving the PC clock forward still pays a Seal about every 15 minutes. That is about 4× the Renown of honest play, and Devout unlocks in one sitting (F1).
- **The demo hint I proposed in R8 backfired.** At threshold 25, the "Stuck? Retire" hint fires at the floor-40 boss door (F4).

**The bigger risk for the price is shape, not size.** There are 30–60 hours of new things, but a typist meets every biome and every boss within 2.1 hours, inside Steam's refund window. After that, days 2–7 bring no new bosses, and from about day 8 to 13 most days bring nothing but the Seal (F2).

**Method:**
- About 1,100 seeded runs on the real sim, with no game file edited.
- **Build:** every number below was re-run on HEAD **847e0d4** (R9 part 1, including Recruiter "rejoin"), via `rerun9.sh`. Runs before that commit gave the same conclusions.
- **Scripts** (in `docs/playtest/round-09/`):
  - `pt9.js`/`gate9.js`: the hour-1 gate on top of unchanged `tools/playtest.js`. `KKCLICK=1` registers a click on each glance that buys something; `KKMOUSE=20` adds a desktop click every ~20 s; `KKTL` is a caution variant.
  - `week9.js`: a calendar model. Day 1 is 8 h; then 4 h sessions with 16 h offline before each (paid like `main.js` awayCheck, capped at 12 h, spent on return), with `KK.today` patched per day. Options: `--offember`; `pace9.js` adds pacing variants.
  - `sealfarm9.js`: the stale-star and clock-farm checks.
  - `qm9.js`/`qmlong9.js`: Quartermaster.
  - `demohint9.js`: the hint follower.
  - `econ9.js`: the R8 40 h model. Its premium is now `KK.powerMult()` divided by the floor.
- **Aggregates** are in `out/*_agg.txt`.

## Findings (ranked, max 8)

### F1 [severity: major] Seal of the Day is still farmable with the clock: about 31–37 Seals and 4–5× the Renown in 8 hours, with Devout in one sitting
- **Evidence:** `sealfarm9.js`, 6 seeds, an honest 8 h day 1, then 8 h more (`out/misc_agg.txt`).
  - The farmer moves the clock one day forward each time a Seal lands, then re-delves at once. Almost every re-delve is the free one: `canRedelve` allows it because `freeDelveDay` ≠ today.

  | 8 h after day 1 | Renown | Seals | Devout (30 Seals) |
  |---|---|---|---|
  | Honest typist / idle | 199 / 150 | 1 / 1 | 0/6 |
  | **Clock farmer, typist / idle** | **796 / 792** | **31.3 / 36.7** (one every 13–16 min) | **6/6 in one session** |
  | Farmer with "≥60 min of play since the last Seal" | 402 / 324 | 7.5 / 7.0 | 0/6 |
  | Farmer with ≥120 min | 276 / 211 | 4.0 / 4.0 | 0/6 |

  - **The stale-star path itself is fixed.** In 12/12 runs, a delve started under yesterday's star reached the Seal floor 10 times and paid 0 Seals (`omenStarDay` works).
  - **The 60-minute rule costs honest players nothing.** Under it, the honest runs were identical to shipped. In the 35-day model, two honest Seals are always at least about 3 h of play apart (4 h sessions; claims at 8–85 min into a run).
- **Why it matters:** Seals are 30–45% of daily Renown from week 2. One clock trick buys a month of Renown plus two achievements. On Steam, achievement hunters do this on day 1, and "Devout in 8 hours" ends up in guides.
- **Proposed fix:**
  1. In `claimSeal` (and the claim check in `world.js:724`), require `S.stats.playTime - (S.sealPT || -1e9) >= 3600`, and set `S.sealPT = S.stats.playTime` on claim.
  2. Make `KK.today()` zero-padded (`YYYY-MM-DD`) or an epoch-day number, and refuse a Seal (and the free re-delve) when `today < S.sealDay`, i.e. the clock went backwards. Today's `'2026-11-9'` sorts after `'2026-11-10'`, so a plain string compare would be wrong.
  3. Optional: the free re-delve only when `S.stats.playTime - S.sealPT >= 3600`.

  The result is a 2× ceiling for cheaters, Devout needing at least 30 h of play, and no change for honest players.

### F2 [severity: major] The content shape: typists see every biome and boss inside the 2-hour refund window, then days 2–7 bring no new boss and from about day 8 most days bring only the Seal
- **Evidence:** `week9.js`, 35 days (8 h, then 4 h/day), 4 seeds × 3 profiles × glance 60/300 (`out/month_agg.txt`, `week7_agg.txt`).
  - **Hours to see things** (median, glance 60 / glance 300):

    | | Typist | Burst | Idle |
    |---|---|---|---|
    | All 4 biomes | 0.8 / 1.2 h | 1.7 / 2.7 h | 2.0 / 2.8 h |
    | **All 14 bosses** (Heart + six Hollowed) | **2.1 / 2.8 h** | 5.0 / 6.2 h | 5.8 / 7.2 h |
    | All 10 omens | 23 / 18 h | 16 / 36 h | 20 / 22 h |
    | Codex 28 | day 5–7 | day 9–12 | day 11–14 |
    | Trophies to floor 200 | day 9–12 | day 16–21 | day 22–29 |
    | Achievements on day 1 (8 h) | 30 / 39 | 23 | 23 |

  - **The first week:** day 1 gives 55–84 milestones (14/14 bosses, 7 of 10 omens, 8–13 trophies). Each of days 2–7 gives 0 new bosses, 0–1 new omens, 0.2–2.8 trophies, 0–5.5 Codex ranks, 0.2–3.5 achievements, a Seal, and 2.7–15 record floors.

    | Day 7 | Typist | Burst | Idle |
    |---|---|---|---|
    | Longest stretch without a milestone | 140 min | 84 min | 100 min |
    | Worst seed | 199 min | 117 min | 108 min |
  - **Fully dead days in week 1** (only the Seal and records): 0–3 of 18 seed-weeks, all on day 6–7 for typists.
  - **Days with no milestone except the Seal, out of 35:**

    | Profile | Dead days | From day |
    |---|---|---|
    | Typist | 25–26 | 8 |
    | Burst | 18–21 | 11–14 |
    | Idle | 15–18 | 12–17 |

    Record floors drop to 1.5–3.7 per day by then.
  - **Economy knobs don't move the reveal** (`pace9.js`, 16 h, 4 seeds):

    | Variant | Typist reaches the Heart | Typist depth at 16 h | Idle depth at 16 h |
    |---|---|---|---|
    | Shipped | 1.7 h | — | — |
    | Monster HP ×1.02 per floor past 60 | 2.1 h | −12 floors | −12 floors |
    | Fame base 1.003 | 2.0 h | −9 floors | −7.5 floors |

    The cause is the Hollowed rotation, `six[((f-80)/10 + 2*retires) % 6]`, which shows all six within three retires past floor 80.
- **Why it matters:** about 30 h (typist) to 60 h (idle) of new things is fine value for $4.99 (≈ $0.08–0.17 per hour of novelty). But the curve is a cliff. The typist reaches the "final" boss at 1.7 h, and the refund window is 2 h. Review line: "saw the whole dungeon in two hours, after that it's numbers."
- **Proposed fix** (content pacing, no economy change):
  1. **One Hollowed joins the floor-80+ rotation per calendar day played**, all six by day 6: `six[(idx) % min(6, daysPlayed)]`. I tested this as `pace9.js --hdaily`, 6 seeds × 3 profiles, 7 days:
     - every profile gets **1.0 new boss per day on days 2–6**;
     - day-7 depth is unchanged (typist 190.2 vs 192.8, burst 165.8 vs 165.3, idle 155.3 vs 156.3);
     - achievements by day 7 stay the same (37.0 / 30.7 / 28.8);
     - Echoes of the Deep moves to day 6.

     It needs a `S.daysPlayed` counter that ticks on the first update of a new `KK.today()`.
  2. **Trophies past 200:** add 205–300 every 5 floors (20 more). A typist reaches f249 and idle f223 by day 35. That gives typists a trophy every ~2.6 days from day 10, and idle 4–5 more.
  3. **Codex:** `CODEX_MAX` 28 → 40, with 16 kills per rank past 28. That is about +4 days for typists.
  4. Optional: say "the Heart of the Keep waits on floor 100" only once floor 90 is reached, so it lands as a surprise and not as "the end".

### F3 [severity: major] Quartermaster v2 keeps up in the demo hour, but over 8 h of the full game a hands-off player falls 10–15 floors behind, because it never buys Swift Boots or Keen Edge
- **Evidence:**
  - **Demo hour:** `qm9.js 60 1-10 60`.

    | | Max floor | Retreats |
    |---|---|---|
    | Quartermaster | **35.1** | 0.9 |
    | Manual | 35.4 | 1.8 |

    In R8 the Quartermaster player reached 24.1 vs 35.4. At glance 300, Quartermaster is ahead: 29.1 vs 24.7. **PASS.**
  - **Full game, 8 h:** `qmlong9.js`, 6 seeds. The player spends manually until Quartermaster is owned, then only picks relics, catches rats, buys Legacy/Workshop and retires.

    | Max floor at 8 h | Manual | Quartermaster | **Quartermaster + Swift/Keen** |
    |---|---|---|---|
    | Idle, glance 300 | 104.8 | **89.7** | **103.5** |
    | Idle, glance 60 | 112.0 | 99.5 | **112.7** |
    | Typist, glance 300 | 146.3 | 136.2 | **143.8** |
    | Typist, glance 60 | 147.2 | 140.7 | **148.5** |

    - **Renown:** idle 286 (manual) vs 205 (Quartermaster) vs 270 (with Swift/Keen).
    - **Forge at 8 h** (idle seed 1, Quartermaster vs manual):

      | | Blades | Armor | Purse | Swift | Keen |
      |---|---|---|---|---|---|
      | Quartermaster | 24 | 26 | 19 | 0 | 0 |
      | Manual | 40 | 42 | 33 | 10 | 10 |

    - Keen Edge alone is worth +30% crit chance and +250% crit damage.
- **Why it matters:** the idle audience buys Quartermaster first and trusts it. A hands-off player ends up 13% shallower and 28% poorer in Renown by hour 8.
- **Proposed fix:** in `world.js` `autoBuy`, change the forge list from `['blades','armor','purse']` to `['blades','armor','purse','swift','keen']`, with a max-level check (`(S.forge[id]||0) < d.max`), at the same ≤25% of gold. This reaches parity in every row above.

### F4 [severity: minor] Demo: at threshold 25, the "Stuck? Retire" hint fires at the floor-40 boss door, so following it delays the Glimpse by 3–14 min (my R8 F7 fix made this worse)
- **Evidence:** `demohint9.js`, 10 seeds, 180 min (`out/misc_agg.txt`). The follower retires whenever the HUD hint shows (`ui.js` slowUpdate logic). Typical trigger: "75m f40 +30".

  | Minutes to Glimpse | Hint 25 (shipped) | Hint 10 (R7) | Ignore the hint | **Hint 10, hidden at the f40 boss (f38+)** |
  |---|---|---|---|---|
  | Idle, glance 60 | **87.0** | 75.5 | 78.5 | **73.9** |
  | Idle, glance 300 | **125.7** | 113.3 | 122.8 | **111.3** |
  | Burst, glance 60 | 73.6 | 70.2 | 66.2 | **66.2** |
  | Burst, glance 300 | 114.4 | 106.5 | 109.9 | **102.6** |

  - **The cause:** `blocked` includes `bossBlock && floor < bossBlock`. A wipe on the floor-40 boss shows "+26–30" right at the door to the Glimpse.
  - **Early retires at f27–30 for +10–13 do pay back** with this player, who buys Quartermaster and Lineage at once. The R8 `--stuck` comparison missed that.
- **Proposed fix:**
  - `hintMin` back to 10.
  - In the demo before `S.glimpseDone`, hide the retire hint when `S.bossBlock === KK.DEMO_CAP || S.maxFloorRun >= KK.DEMO_CAP - 2`. Show "Floor 40 boss: level up, the depths wait below" instead.

### F5 [severity: minor] Offline income looks big but is worth about zero: the day-2 morning windfall changes no measurable outcome
- **Evidence:** `week9.js` with 16 h offline (paid as 12 h × `m.offline`, 80% here) vs `--off 0`. Same seeds, so day 1 is identical.

  | | Typist | Burst | Idle |
  |---|---|---|---|
  | Day-2 windfall vs gold on hand | 814× | 609× | 339× |
  | Day-2 windfall in online income | 190 min | 191 min | 393 min |
  | Levels bought on the spot | 77 | 65 | 44 |
  | **Floor at the end of day 2, offline vs none** | **159.3 vs 159.3** | 131.7 vs 133.3 | **126.7 vs 126.7** |
  | Floor at the end of day 7, offline vs none | 192.8 vs 190.7 | 165.3 vs 164.5 | 156.3 vs 156.0 |
  | Returns that retire within 15 min | 2/6–6/6 | 2/6–6/6 | 2/6–6/6 |

  - On the returns that retire within 15 min, the windfall is wiped. Gold has no value across a retire.
  - **Variant:** offline also pays Embers (the last session's Ember rate × away × `m.offline`). Day-7 depth: typist +5.5, burst +6.0, idle −0.6. This widens the typing gap, because the typists' Embers come from Sparks. Idle reaches Forgemaster (Crucible 10) within week 1.
- **Why it matters:** the welcome-back toast is the genre's "come back tomorrow" hook. Here the Seal carries the return instead. Today the hook pays nothing that lasts; it only reads well.
- **Proposed fix (both cheap):**
  1. Suppress the retire nudge toast for 10 min after an offline payout worth ≥30 min of income. Change the toast to "...earned X gold: +N levels ready in ⚔ Party".
  2. Pay idle-neutral **offline Embers**: a 10-min average of Embers from bosses and rats only (not Sparks) × seconds away × `m.offline`. That gives a persistent morning gift of roughly 1–3k Embers, which matters for idle players (Lantern, Crucible) and is noise for typists.

### F6 [severity: minor] The starred omen is a no-brainer, so the omen choice is dead on the first delve of every day
- **Evidence:** 7-day model, 6 seeds. Players who always take the star vs players who pick an omen at random:

  | Day 7 | Star | Random |
  |---|---|---|
  | Typist depth | 192.8 | 185.8 |
  | Idle depth | 156.3 | 150.5 |
  | Burst depth | 165.3 | 159.2 |
  | Seals per day, days 4–7 | 6/6 | 2–5/6 |
  | Faithful (7 Seals) by day 7 | 18/18 seed-weeks | 0/18 |

  - A Seal is 25–34 Renown, which is 30–45% of a day's Renown from week 2. The best non-star omen, the Deep Omen, adds only +4–7 to a retire.
- **Why it matters:** this is not a bug; it is the daily goal working. But "pick the star" is never a decision, and the other two cards on that offer are decoration.
- **Proposed fix:** let the Seal be claimable under any omen on an open day, worth `10 + record/10`. The **starred omen doubles it**. The star stays the best pick, but a player can trade it for an omen that suits the build, at a price they can see.

### F7 [severity: minor] The Void Lantern works, but only if the player knows to buy it: the default idle shopper gets 2.3 levels by hour 15 and no benefit
- **Evidence:** `econ9.js`, 40 h, 6 seeds (`out/e40_agg.txt`).

  | Idle player, 40 h | Lantern levels | Wipes | Regroups | Depth |
  |---|---|---|---|---|
  | **Smart: Dynamo, then Lantern** | **4.8 by 6.3 h** | **48** (Lantern off: 91) | **19** (off: 31) | **+3.5 floors** |
  | Default round-robin shopper | 2.3 by 15.3 h | 77 (Lantern off: 71) | — | — |

  The default shopper spreads Embers over Overcharge and other items.
- **Proposed fix:** tag the Lantern "FOR IDLE PARTIES", like the typing tags. Sort the Workshop so that for a player with less than 10% FLOW time, Lantern and Dynamo come before Overcharge.

### F8 [severity: info] Achievement reach by profile, for the price check
- **Evidence:** 35-day model, median hours.

  | Profile | Last non-calendar achievement | Never reached in the sim |
  |---|---|---|
  | Typist | 38/39 by about 28 h (Hall of Legends 27 h, Faithful 29 h) | Hands Off (it needs one deliberate no-typing delve) |
  | Burst | 37/39 by about 45 h, plus Wordsmith (100k keys) at 90 h | Deep Work and Monk Mode (FLOW 1 h / 10 h) |
  | Idle | 33–34/39 by about 48 h, plus Forgemaster at 66 h at glance 60 | Forgemaster at glance 300; the five typing achievements (Flow State, Warming Up, Wordsmith, Deep Work, Monk Mode) |

  - **Devout** comes at day 30 (≈121–125 h) for everyone.
- **Notes:**
  - "All achievements" is therefore 30 calendar days for any player who does both kinds of play once.
  - I'd add a hint line on Hands Off ("leave the keyboard alone for one delve") and on the FLOW achievements for idle players.
  - Price: fine. Content cost per hour is low; the risk is the reveal curve (F2).

## Verified fixes from last round (pass/fail, one line each)
- **Hour-1 gate with realistic clicks (keys-only caution): PASS.**
  - Idle demo, 10 seeds (`out/gate_h1.txt`):

    | Idle, hour-1 retreats | Mean | Range |
    |---|---|---|
    | Glance 60, click on buy | 1.6 (R8 4.8) | 0–3 |
    | Glance 60, click + mouse every ~20 s | 0.7 (R8 5.9) | 0–2 |
    | Glance 300, click + mouse | 2.8 (R8 10.6) | 1–4 |
    | Glance 300, no input | 2.7 | seed 9 = 5, unchanged |

    No wipe before 10:00 in any run.
  - Burst: 1.4 at glance 60 and 4.0 at glance 300, vs R8 3.4 / 7.3.
  - **Typist at glance 300: PARTIAL**, 6.4 [2–11] vs R8 11.7. The caution rule can't get it to ≤4: even treating typists as idle gives 4.5. 23/64 are boss-floor losses; the rest is five minutes of unspent gold.
- **Quartermaster v2: PASS in the demo hour** (35.1 vs 35.4 floors, retreats 0.9 vs 1.8). **FAIL over 8 h of the full game** (−10 to −15 floors, F3).
- **Seal as a goal: PASS.**
  - Claimed 89–100% of days through day 35. Median claim time: 8 min (day 1), 24–40 min (days 2–7), 47–86 min (weeks 2–5). Value 23–34.
  - **Stale star: PASS** (0/12).
  - **Clock farming: FAIL** (F1).
- **Lantern repricing: PASS when bought:** 4.8 levels by 6.3 h for a smart idle player, wipes −47%. It doesn't reach the default shopper (F7).
- **Fervor tier edge (+5% per tier): PASS, small.**

  | Typing premium over the power floor | Before (R8 formula) | Now |
  |---|---|---|
  | Burst | ×1.000 | ×1.013 (FOCUSED 18% and ZONE 3% of the time) |
  | Typist | ×1.40 | ×1.58 |

  The typist/idle gap is 1.272 at 8 h and 1.239 at 40 h (R8 formula: 1.252 / 1.244).
- **Demo hint at +25: FAIL.** It fires at the floor-40 boss door and costs 3–14 min of Glimpse time (F4).
- **Demo pacing:** demo180 on 847e0d4, 10 seeds:

  | Profile | Card | Notes |
  |---|---|---|
  | Typist | 28.3 min | Renown cap 120 within 3 h; the **first retire, at 28 min, is now under the LOOP's 35–60 min target** (R8 33.0) |
  | Burst | 78.8 min | — |
  | Idle, glance 60 | 85.9 min | — |
  | Idle, glance 300 | 139.4 min | 10/10 runs reach floor 40 |

## Ideas (optional, max 3)
1. **Seal streak pips:** +1 Renown per consecutive Seal day, up to +7, shown as seven pips on the omen card. It costs nothing in week 1, and it gives the milestone-less days from day 8 a visible counter that F2 says they lack.
2. **An Ember sink for week 2:**
   - Typists bank 50–70k Embers per day by day 7, and Overcharge is their only sink.
   - Add a "Relic Reforge": reroll one relic offer for Embers, cost doubling per use within a delve. Gate it behind floor 100 so it arrives as week-2 novelty.
3. **"Rested" return instead of a bigger windfall:** after ≥8 h away, the first 20 min back run at ×1.5 gold. It is visible as a HUD chip, profile-neutral, and makes the morning feel like something happened, without the payout itself being thrown away by the next retire.
