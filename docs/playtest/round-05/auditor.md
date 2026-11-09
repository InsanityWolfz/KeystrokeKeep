# Round 05 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
Almost every R4 fix landed and does what it should:
- **Demo Renown** stops at exactly 48.
- **Sanctuary** now shows up in half of all typist boss fights (R4: 1–2%).
- **Depth trophies** cut the empty 30-min windows in hours 5–8 from 5–6 of 6 to 2–3 of 6.
- **Second Wind** fires about 250 times per 8 h, with a floater.

The new problem is **week 2**. A typist has every trophy (floor 150) and 34 of 35 achievements by about **17 h**. After that, nothing new happens for **12–23 h** of running. The party sits at record walls of 7–10 h. Retire is disabled there, because it would pay 0 Renown, so the strip just loses to the same Hollowed boss 8–13 times an hour.

There is also a visible demo bug: every re-delve after the cap shows a **"+redelve RENOWN"** banner.

I'd keep it running tomorrow. By day 3 (about 24 h of strip time) I'd have no reason left to look at it. **7.5/10.**

### Method
- **Scripts** (all in `docs/playtest/round-05/`):
  - `r5lib.js` and `r5probe.js` replace the R4 harness. They:
    - track the game's own `KK.ach` unlocks (not my R4 table);
    - count novelty beats: majors, omens, trophies and achievements;
    - track Sanctuary per boss fight, Second Wind from the `secondWind` event, and Ember sources;
    - record **every boss fight** (duration, swings, slams, wipes);
    - record saturation: when Legacy and Workshop max out.
- **The batch** (`batch.sh`):
  - 8 h runs: typist seeds 1–3, idle seeds 1–2, burst, heavy and light;
  - 40 h runs: typist, idle and light;
  - 3 h demo runs: typist ×2, idle and burst;
  - all with `--retire nudge --omen random`.
  - `tools/playtest.js` was also run with seed 5 (typist 8 h and demo 3 h).
- **Experiments**, in memory only (nothing in `js/` was touched):
  - `sig_test.js`: the six signature moves;
  - `week2_test.js`: the stipend, Legacy tier 2 and trophy tail;
  - `codex_test.js`: Hollow Codex timing and a Speedrunner replacement;
  - `bugcheck.js`: targeted trigger and value checks.
- **Output:** everything is in `out/`.

## Findings (ranked, max 8)

### F1 [severity: major] Week 2 is empty: everything is finished by about 17 h, then 12–23 h pass with nothing new
- Evidence: 40 h runs (`out/r5_*_2400.txt`, `week2_test.txt`, `codex_test.txt`). A "beat" is a new major, omen, trophy or achievement.

  | Profile (40 h) | Last trophy | Achievements | Longest gap with no beat after 8 h | Longest stretch with no new record | Unspent Embers at 40 h |
  |---|---|---|---|---|---|
  | typist s1 | f150 @16h57 | 34/35 @17h05 | **1,375 min** (17h05 → 40h) | **10.5 h** (27h30–38h) | **70,646** |
  | typist s2 | f150 by 16h | 34/35 | 738 min | 3.5 h | — |
  | light | f150 @35h15 | 32/35 | 474 min | 4.5 h | 25,940 |
  | idle | f115 @32h49 | 26/35 | 273 min | 2.5 h (but retires pay only +4 to +11) | 890 |

  - **The wall** (typist s1, 19h–26h and 27h30–38h):
    - The run can't beat its record, so `renownGain()` is 0. The Retire button is disabled ("REACH FLOOR 155..."), and there's no re-delve in the full game.
    - The party repeats the same Hollowed fight, wipes, and falls back a floor:
      - **57 wipes vs the Hollowed Magma Lord** (4–13 fights per hour, h19–h25);
      - **57 vs the Hollowed Ember Colossus** (h30–h37).
  - **Saturation:**
    - Capped Legacy rows are all maxed at 6h41–7h10 (heavy 4h08). Head Start 8 at 4h00.
    - Workshop capped rows are all maxed at 9h08.
    - After that, Renown only buys +25% Lineage and Treasury.
    - Embers pile up: Overcharge level 15 costs 115k, and the typist earns about 7k per hour.
  - **What I tested that does NOT fix it** (`week2_test.txt`, typist s1):
    - A +5 "wall stipend" plus Legacy tier 2 (Deep Roots, Polished Trophies, Hollow Bounty, Omen Seer) plus trophies past 150:
      - doubled retires after 8 h (11 → 28);
      - left depth unchanged (167 → 168 at 40 h);
      - cut the longest gap only to 806 min.
    - The wall comes from the power curve (+27.5% enemy HP per floor), not from a shortage of Renown. **Week-2 goals have to be independent of depth.**
- Why it matters: this is a strip that runs all workday, so 17 h of play is day 3. Week-2 retention decides whether people leave a review, and whether it's *"Ran out after three days, now it just loses to the same boss all day."*
- Proposed fix: the minimal week-2 layer, measured where possible:
  1. **Hollow Codex** (build first; about 15 lines plus a Legacy panel block):
     - Each of the 7 late bosses (the 6 Hollowed bosses and The Hollow) has 4 mastery ranks at **3 / 10 / 20 / 40 kills**.
     - Each rank gives **x1.03 damage and gold**, so all 28 give x2.29.
     - Kills count from `kill` with `e.hollowed || e.key === 'hollow'` into `S.achP.codex[key]`. Apply the bonus in `KK.mods()` next to the trophies.
     - UI: 7 rows with 4 pips each, plus a "Codex: H-Magma Lord 2/4" toast on each rank-up.
     - Measured on unmodified 40 h runs:

       | Profile | Rank-ups by 40 h | Of those, after 8 h | Beats after 8 h | Longest gap after 8 h |
       |---|---|---|---|---|
       | typist s1 | 17 of 28 | 10 | 9 → 19 | 1,375 → **624 min** |
       | typist s2 | 21 | 13 | 13 → 26 | 738 → **389 min** |
       | light | 16 | 13 | 18 → 31 | 474 → 287 min |
       | idle | 12 | 11 | 19 → 30 | 273 → 243 min |

     - Rank 4 is never reached in 40 h, so the tail runs into week 3.
     - The +3% steps also chip at the walls, because every wipe-loop kill counts.
  2. **Omen of the Day** (about 20 lines):
     - The first omen offer of each local calendar day includes a ★ omen picked from a seed made of the date.
     - Delving under it and reaching **record − 15** pays **+10 Renown** outside the record (once a day), plus a Seal.
     - New achievements: "Faithful" (7 Seals) and "Devout" (30 Seals).
     - That's one goal per day for 30 days, each about one delve: a late delve reaches f120 in 11–12 min.
  3. **Void Lantern**, a Workshop Ember sink aimed at the wall:
     - −8% void-slam damage per level, max 5.
     - Cost `4000 × 1.8^l`: 4k / 7.2k / 13k / 23k / 42k, 89k in total.
     - At the typist's ~7k Embers/h, that's 5 purchases landing over roughly hours 9–20.
  4. **Data-only extras:**
     - Trophies every 10 floors past 150 (160…300) at **x1.03**. The typist reaches 160 at 27h and 170 at about 40h.
     - Restore the **Bottomless** achievement (f150): typist 16h57, light 35h15.
     - Optionally, allow the demo's 0-Renown "RE-DELVE" in the full game once a delve has spent 40+ minutes within 3 floors of its record. That lets a walled player reroll relics and the omen instead of watching.
- **Estimate:** together, these take typist beats after 8 h from 9–13 to about **30–35** in hours 8–40. The longest gap drops from 738–1,375 to about **300–400 min**. Codex rank 4 and the 30 Seals reach into weeks 3–4.

### F2 [severity: major] Demo: every re-delve after the Renown cap shows the banner "+redelve RENOWN"
- Evidence:
  - `A.retire()` returns `gain || 'redelve'` (`state.js:321`). `UI.confirmRetire` prints `'+' + g + ' RENOWN'` (`ui.js` confirmRetire).
  - Every demo run after the cap: the `retire()` return values are `[30,6,6,6,"redelve" ×16]` (typist, 3 h), and 7 per idle or burst session. Confirmed in `out/bugcheck.txt`.
- Why it matters: it's the Next Fest build's core loop, after the card. The banner flashes a debug string at every engaged demo player 7–16 times in a session.
- Proposed fix: one line. Use `typeof g === 'number' ? '+' + g + ' RENOWN' : 'NEW RUN · BEAT ' + U.fmtTime(KK.S.bestCapTime)`. While in there, add the lap count to the pill: "BEST 5:24 · 20 CLEARS". Laps are tracked in `S.demoLaps` but never shown. Best time saturates at 4.9–5.4 min.

### F3 [severity: major] Early bosses: "slam every 4th swing" is invisible after the first delve. One signature move each, designed for 2-second fights
- Evidence (boss telemetry, `out/r5_*`):
  - **After delve 1, non-Hollowed bosses die fast.** For typists, the median fight is **2–4 s**, the median is 0–1 boss swings, and only **12–33% of fights reach swing 4**.
  - **Rat King** is fought **once per save** for typists. Head Start skips floors 1–40 from about 4 h.
  - **Hollowed versions (f80+) are the long fights:** 7–400 s. They're the week-2 wall.
  - **In the demo, early bosses are the content:** Bone King, Brood Mother and Warlord come back **11–23 times per 3 h session**. Warlord fights last 11–44 s (85–100% reach swing 4). Bone King lasts 4–7 s.
  - So each move needs either an **opener ≤1.5 s after engaging** or a **death trigger**, and then a timer for the long Hollowed fights.
- Proposed design:
  - One generic engine in `updateEnemies`: `e.sigT` counts down from `sig.first`, then repeats every `sig.every`. Each move fires a `sigWarn` call text above the boss, about 0.6 s before it lands.
  - Keep the 4th-swing slam, because it's the Vigil hook.
  - Data rows go in `MONSTERS` (`sig: {...}`):

| Boss | Move (`sig`) | Numbers | Reads on a 64 px strip as | Code cost |
|---|---|---|---|---|
| Rat King | **Royal Summons** "SQUEAK!" | first 1.0 s, every 9 s: 2 Cellar Rats at boss.x−16/−28, hp x0.35, atk x0.6, **gold x0.5**, max 4 alive | two rats pop up in front of him and shield him (the queue pushes him back); AoE ults clear them | 8 lines (uses `makeEnemy`) |
| Bone King | **Reassemble** "RISES AGAIN!" | once per fight, on death: becomes a bone pile for 1.5 s (untargetable), then stands up at **25% HP** (Hollowed 25%) | collapse, then rise: the boss bar refills; seen in **100%** of fights, even 2-second ones | 10 lines + 4 render (reuse the dead-hero rotation) |
| Brood Mother | **Web Shot** "WEB!" | first 1.5 s, every 7 s: a web projectile at the **back-most** hero, 0.3x atk, webbed 2.5 s (no attacks or heals) | a white arc over the party; a net on Mortimer or Pell; the first boss after Pell joins | 12 lines + 3 render |
| Goblin Warlord | **War Charge** "CHAAARGE!" | first 1.5 s, every 10 s: backs off 30 px at 60 px/s, 1.0 s wind-up (red flash), charges at 120 px/s; **2.0x atk** to the front hero, **party pushed back 16 px**, Knight stunned 0.8 s | big horizontal motion, the strip's strongest axis | ~20 lines (small state machine) |
| Ember Colossus | **Magma Shell** "SHELL!" | on engage and every 12 s: takes **x0.3** from normal hits for up to **5 s**; **any ultimate cracks it** (stun 1.0 s, "CRACKED!") | grey stone tint (the `hollowTint` pattern), then a crack burst. "Your typing breaks him" | 8 lines + 6 render |
| Magma Lord | **Lava Rain** "LAVA RAIN!" | first 1.0 s, every 8 s: 3 glowing ground marks under random heroes, 0.9 s warning, then drops from the ceiling for **0.9x atk** each | the mirror of Mortimer's Meteor: vertical drops plus ground glow | ~15 lines + shot render case |

- Measured (`out/sig_test_*.txt`, in-memory prototype, tuned numbers):
  - **Depth at 8 h:** typist 125 → 125 and 120 → 120, idle 90 → 90, burst 100 → 97.
  - **Demo best floor-40 time:** typist 5.4 → 5.2 min, idle 8.6 → 8.6.
  - **Moves seen per 3 h demo:**
    - War Charge 40–62 (2–5 per fight);
    - Reassemble 12–23 (every Bone King fight);
    - Web Shot 32–46.
  - **Ember Colossus shell for idle players:** without the 5 s cap, idle cracked only 4 of 150 shells and the Hollowed Ember Colossus fights doubled. Keep the cap.
  - **Reassemble at 40%** added Bone King wipes for weak players, so use 25%.
  - **Rat summons with gold 0:** in one idle seed the delve-1 Bone King wall went from 1 to 6 wipes. That's a single seed, so pay x0.5 gold and have T1 check it.
- **Build first: Goblin Warlord, War Charge.**
  - It's the demo's final boss. Every Next Fest player fights it 11–21 times per session, in the longest early fights (11–44 s).
  - Horizontal motion is the one thing a 64 px strip shows best.
  - It's balance-neutral in the sim.
  - Next: Bone King **Reassemble**. It's the cheapest, and the only move guaranteed to be seen in 2-second fights. Then Ember Colossus **Magma Shell**: it ties the boss to typing, and its Hollowed version is a week-2 wall boss.

### F4 [severity: minor] Achievements: one broken trigger, one trivial one, one impossible in the real game, one with missing progress
- Evidence (`out/bugcheck.txt`, batch ACH lines):
  - **Blitz is broken across restarts.**
    - `c.P.bossTimes` is saved, but `KK.simTime` restarts at 0 on launch.
    - Stale entries give `now - x < 0`, which is under 600, so 4 old kills plus 1 new one unlock it.
    - Reproduced: unlocked = true.
    - Fix: use `S.stats.playTime` (saved) instead of `KK.simTime`.
  - **Speedrunner is trivial and redundant.**
    - It unlocks in the **same minute as Gatekeeper and Fire Below** in every typist run (0h34–0h37). That's three toasts at once. Idle players get it at 1h41–1h46.
    - It's also impossible after Head Start 8 (start floor 41).
    - Replace it with **"reach floor 80 within 12 min of a new delve"**. Measured: typist ~2h18–2h57, light ~4h24, idle ~15h33 (`codex_test.txt` run times).
  - **Hands Off can't be earned by normal play.**
    - Any click counts: catching a rat, a buy button, or the omen card. Reproduced: unlocked = false after one click.
    - The sim's idle unlock at 1h24–1h28 is an artifact, because the sim never clicks.
    - Only pausing input in Settings *before* retiring works.
    - Fix: count keys only (`kind === 'key'`) and change the description to "...without typing". Idle players then get it at about 1h25.
  - **No progress is shown for counter achievements.** "Open 100 chests" has no chest count anywhere: the stat box still has no chests or wipes. Echoes (x/6), Augur (x/10), Dynasty (x/10) and the key or FLOW counters show no progress either.
    - Fix: add a `(n/N)` suffix in `achHTML` from `S.achP` and `S.stats`, and add Chests to the stat box.
- **Differences from my R4 table:**
  - **Added:** Into the Moss, Overkill, Speedrunner (I'd rejected it), Spark Plug.
  - **Dropped:** Extinction Event, Packrat, Bottomless, Living Legend, Million-Key March.
  - Everything else matches my triggers (Dynasty's `gain >= 10`, Second Try's capture at spawn).
  - Measured unlocks over 8 h: typist 28–31/35, heavy 31, light 25, burst 21, idle 18–20.
  - "Say It Twice" depends on picking Echo Rune: 2 of 3 typist seeds missed it in 8 h. That's fine.

### F5 [severity: minor] Ember floaters show the wrong number, up to 5x too low
- Evidence:
  - `fx.js:335–336` hard-codes '+10 EMBERS' and '+25 EMBERS'.
  - `KK.gainEmbers(n)` multiplies by `emberGain`. With Crucible 10 and Ember Tide, a boss pays **50** and a rat **125** (`bugcheck.txt`).
  - Typists max Crucible at 5h41–6h12.
- Proposed fix: `'+' + fmt(10 * KK.mods().emberGain) + ' EMBERS'`, and the same for rats (or have `gainEmbers` return the amount).

### F6 [severity: minor] Wired but invisible or dead (leftovers)
- **Omen pill:** works ("◆ STORM FRONT"), but it has no tooltip. Add `pill.title = om.desc`.
- **Pell's card** reads "FREE Sanctuary: Free: answers…". Drop the "Free:" from `HEROES.cleric.ult.desc`.
- **Unused cooldown:** `def.ult.cd: 25` for the cleric is never read; `sanctuaryReact` hard-codes 25.
- **Dead code:**
  - `UI.offlineModal` is never called.
  - `upCard`'s `tooBig`/`data-lock` is always false.
  - `S.runInputs = (S.runInputs || 0);` in `addActivity` is a no-op.
  - `KK.on('echo', () => {})` is empty, so an echo still shows only "x2" when the labels merge.
- **Spark cap "/150":** reached **0%** of the time again (26 Sparks wasted of 60k inputs). The cap number is noise; show "⚡ 87" only.
- **Hotkey Ring:** free casts are still untagged. Add "HOTKEY!" to the ult text when `free && inHotkey`.
- **Heavy typists** (pauses of 15–25 s) get **0 Second Wind triggers**, yet the buyer still maxes it. Consider lowering the threshold to 20 s, or showing "last triggered: never" on the card.

### F7 [severity: minor] Head Start makes the early bosses one-visit content in the full game
- Evidence:
  - Typist boss counts over 40 h: Rat King **1**, Bone King 5, Brood Mother 7, Warlord 7, then none after about 4 h. Ember Colossus, Magma Lord and The Hollow are fought about once an hour but die in 2 s (median 0–1 swings).
  - Only their Hollowed versions are long fights.
- Why it matters: any boss art or move spent on floors 10–40 is seen mostly in the demo and on day 1.
- Proposed fix: ship signature moves on the **Hollowed variants too** (F3 does). Give the Codex (F1) a per-boss line so the early names stay in the player's head.

## Verified fixes from last round (pass/fail, one line each)
- **Demo Renown cap: PASS.** Lifetime Renown is exactly **48** in 4 of 4 demo runs: +30, then +6 ×3, then 0. The retire hint shows "DEMO RENOWN MAXED". Best time 4.9–5.4 min for typists, 8.2–8.6 for idle and burst.
- **Trophies fill hours 5–8: PASS for typists.**
  - Empty 30-min windows in h5–8 (no achievements counted): typist 2/3/3 of 6 (R4 before: 5/6/5).
  - Longest gap after h1: typist 66–85 min (R4: 99–201). Light 101 (R4: 118). Burst 53 (R4: 69).
  - Heavy is only partial: 13 trophies by 7h54, then a 116-min gap.
  - Idle is unchanged (3/6 and 1/6), because trophies start at 3h34.
- **Sanctuary Vigil: PASS.**
  - Typists: casts in **49–58%** of boss fights, 13.9–16.1 casts per hour (R4: 0.6–0.9).
  - Idle 67–68%, burst 65%. In 40 h runs, 60–68%.
- **Second Wind: PASS.**
  - Typists get 224–251 triggers per 8 h, and 16–20% of their Sparks come from it. Light 35%, burst 42%.
  - The "SECOND WIND!" floater shows.
  - Heavy typists get 0 triggers (F6).
- **Omen HUD pill: PASS** (code). `#hud-demo.omen` shows "◆ NAME". There's no tooltip (F6).
- **Pending omen survives reload: PASS** (code). `main.js` boot calls `chooseOmen` when `S.omenOffer` is set, and the modal pauses the dungeon.
- **Ember floaters:**
  - **PASS (shown):** "+10 EMBERS" after boss kills, "+25 EMBERS" after rats.
  - **FAIL (value):** the amounts are hard-coded and up to 5x too low (F5).
- **Achievements vs my table: PASS, with exceptions.** 35 are live and stored in `S.ach`/`S.achP`, and the toast and Legacy list work. Blitz breaks across restarts. Speedrunner is trivial. Hands Off can't be earned without pausing input. See F4.
- **Pell's card shows FREE, and the dead cleric ult-turn branch is removed: PASS.** The wording is doubled (F6).
- **R4 F8 leftovers: still open.** Chests and wipes aren't in the stat box, the Spark cap is reached 0% of the time, Hotkey casts are untagged, and the demo lap count isn't shown.

## Ideas (optional, max 3)
1. **Hollow Codex as the week-2 spine** (F1): data plus about 15 lines, and it's idle-friendly. It turns the wipe loop into progress ("2 more Hollowed Magma Lord kills for rank 3").
2. **Signature moves as "new boss" content for the demo** (F3): War Charge first. A GIF of the Warlord charging the party is better capsule and trailer material than any slam.
3. **Omen of the Day plus a Steam rich-presence line** ("Delving under Glass Delve · floor 142"): a daily reason to look at the strip, and free visibility in friends lists.
