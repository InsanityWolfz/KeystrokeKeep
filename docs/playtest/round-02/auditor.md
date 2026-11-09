# Round 02 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
R1 fixed the loud problems. Meteor now fires about twice a minute, the Workshop gets used, and big new things keep appearing until about 4h30 for a typist (it was 2h15). Past that point the game is still empty, and the "Hollowed" bosses don't change that: they are renames with the same sprite and colours. For typists, 8 hours ends on the same four floor-70–100 bosses refought every delve. In 40 hours of play, one more new boss appears, at 11h. Then nothing new happens for 29 hours. R1 also left new dead content behind: the Spark Jar does literally nothing and still takes about 30% of all Embers. Sanctuary is still almost never seen. I'd keep it running tomorrow, but I'd still stop by day 3. **6.5/10.**

Method:
- 16 runs of `novelty2.js` (an updated R1 `novelty.js`; Hollowed X counts as a new boss), 8 h each: typist, idle, burst and heavy profiles, seeds 1–3.
- Two 40-hour long-tail runs: typist and idle.
- 8 runs of `tools/playtest.js --min 480`, plus multi-session runs: typist 6×120 min and idle 8×60 min, with 8 h offline between sessions.
- R1 `relic_impact.js` (45 min, 5 seeds, typist and idle) and R1 `ult_value.js`.
- New scripts:
  - `verify_r1.js`: pass/fail checks for the R1 fixes, plus dead-content probes.
  - `demo_cap.js`: demo-cap simulation.
- All raw output is in `out/`. The files are `nov480_*`, `nov2400_*`, `pt480_*`, `multi*`, `relic_*`, `ult_value`, `verify_r1`, `demo_cap`. Other files in `out/` belong to other testers.

## Findings (ranked, max 8)

### F1 [severity: major] Content still ends at about 4h30. The Hollowed bosses are a name change, and players re-fight the same four of them for days
- Evidence:
  - **Typist, last major novelty:** 4h06–4h51 (Hollowed Brood Mother, floor 100). After that, 189–233 minutes pass with no major novelty, in 3 of 3 seeds.
  - **Heavy typist:** last major at 3h37–4h32, then 207–263 minutes with no major novelty.
  - **Idle:** the only Hollowed boss an idle player meets in 8 h is the Rat King (4h40–6h59). Idle players top out at floors 83–88.
  - **Major novelty per 30 min after hour 1 (typist s1):** `2 1 1 0 1 0 1 0 0 0 0 0 0 0`. Within hours 1–5, the longest gap with no major novelty is 70–82 min (typist) and 63–138 min (idle). The brief's target is about 30 min.
  - **40-hour typist run (`nov2400_typist_s1`):**
    - The record goes from floor 105 at 8h to floor 120 at 40h, about +4 floors per 8-hour workday.
    - The only new boss after 4h25 is Hollowed Goblin Warlord at 11h00. After that, **1,740 minutes pass with no major novelty**.
    - Hollowed Ember Colossus (floor 120) and Hollowed Magma Lord (floor 130) are **never seen in 40 h** by either profile.
    - The 40-hour idle run reaches floor 102.
  - **Same order every delve:** the Hollowed order is fixed (`state.js:51`), so every delve is the same sequence: The Hollow (70) → Rat King (80) → Bone King (90) → Brood Mother (100). The typist meets it 17 times in 40 h (see the "bosses after floor 60" log).
  - **No visual difference:** a Hollowed boss is drawn with `KK.SPR.frame(e.key)` (`render.js:453`), the same sprite and palette as the Crypt or Caverns original. Only `def.name` changes (`world.js:79`), and it reads **"Hollowed The Rat King"** or "Hollowed The Bone King" on the banner and the boss bar.
- Why it matters: The boss is the recurring big moment, and a rename of a boss already killed 6–8 times reads as filler. The likely review: *"After floor 70 it's the same bosses with 'Hollowed' stuck on the name. Ran out of game on day 1."* The wall is at about +4 floors per day, so any content placed past floor 110 is invisible to almost everyone. New content has to live in the floor 70–110 band that players replay every delve.
- Proposed fix (cheapest first):
  1. **Rotate the Hollowed order per delve:**
     - Change `all[(Math.floor((f - 70) / 10) + S.retires * 3) % 7]` in `F.bossFor`.
     - Each delve's four boss floors then show a different set, so all 7 appear within one day.
     - This is a one-line change.
  2. **Make Hollowed bosses look hollowed:**
     - Bake a void-palette version of each boss in `sprites.js`, reusing the `hol` remap the Hollow already uses, and pick `frames['h_' + key]` when `e.hollowed`.
     - Rename them to "The Hollowed Rat King" by stripping the leading "The ".
  3. **Delve Omens (the week-2 hook):** on every retire, offer 1 of 3 run modifiers applied through `KK.mods()`, which keeps it data-only. Examples:
     - "Gilded: +100% gold, enemies +40% HP"
     - "Rat Plague: a golden rat every 60 s"
     - "Boss Rush: a boss every 5 floors"
     - "Storm: ultimates cost −50%, Fervor drains 2×"
     - "Glass Party"

     Ten entries would make each delve a choice and change the floor 70–110 band that players replay.
  4. Keep the backlog item for the floor-100 "Heart of the Keep" finale. It sits right where typists end day 1 (4h–4h50), so it would be seen.

### F2 [severity: major] The Spark Jar does nothing, takes about 30% of all Embers, and empties the HUD spark bar
- Evidence:
  - **Sparks are never at the cap:** "sparks at cap 0.0% (in combat 0.0%)" in **all 16 eight-hour runs and both 40-hour runs**, every profile, heavy typists included.
  - The highest Spark balance is 65–411, against a base cap of 150. The only higher value, 853, comes from the s1 typist whose Jar had already raised the cap.
  - Round-robin ultimates spend Sparks long before the cap matters.
  - **Effect test** (`verify_r1.js` F, 45 min, 4 seeds): Jar 10 vs Jar 0 gives **identical results: floor 40.3, 186 ultimates, 0 Sparks wasted**. For comparison, Static 8 reaches floor 48.8 and Overcharge 8 floor 45.5.
  - **Players buy it first:** at 60 Embers it's the cheapest Workshop row. The smart player buys it first at 0h02m, as a real player would, because the Workshop "!" badge (`ui.js:116`) lights up for it alone.
  - **Share of Embers:** about 4.2K of roughly 15K Embers in 8 h (27%), and 23K of 78K in 40 h (30%). Buying all 25 levels costs 674K Embers, about 340 hours of income.
  - **In the demo**, the Jar is the **only** Workshop purchase idle players make (`demo_cap.txt`: `ws {"jar":1}`).
  - **It hurts the HUD:** the spark bar width is `sparks / sparkCap` (`ui.js:62`). At Jar 10 it reads something like "37/1150", so the bar that's meant to show "your typing fills this" sits nearly empty.
- Why it matters: the first Ember a player ever spends goes to a trap, and that trap also weakens the most important piece of typing feedback.
- Proposed fix: replace the Jar and keep the cap fixed at 150.
  - Candidate replacements:
    - "Spark Coil: +15% Sparks per keystroke per level (max 10)", which means more ultimates and keeps the typing link.
    - "Quick Charge: −6% ultimate cooldown per level".
  - On load, refund owned Jar levels as Embers.
  - Optional: show Embers per minute on the Workshop header so players can see the income.

### F3 [severity: major] Sanctuary is still almost never seen, and round-robin halved what ultimates are worth
- Evidence:
  - **Meteor is fixed:** Mage 1.37–2.04 ultimates per owned-minute for typists, 2.8–4.0 for heavy typists, and the first Meteor comes 34–41 s after recruiting. In R1 it was 0.03–0.08 per minute, and the first Meteor took 1–83 min.
  - **Sanctuary is still almost never cast:**
    - Typist: **0.01–0.09 per owned-minute**, 5–44 casts in 8 h.
    - Burst: 2–8 casts in 8 h.
    - Idle: **0 casts in 40 hours** (`nov2400_idle_s1`).
  - Root cause: Sanctuary only wants to cast when someone is below 55% HP, or dead, at the exact moment her turn comes up (`world.js:316`). Her own heal beam keeps the party above that line.
  - **Ultimates are worth less:** in `ult_value.js`, a typist reaches floor 30 in 21.4 min with ultimates and 25.7 min without. That's **17% of a typist's speed, down from 37% in R1**, while Fervor tiers make up 45% (39.0 min without them). Forced turns make the cheap, high-value Earthshatter wait for the 50-Spark Meteor.
  - This is why every ultimate-related item now barely matters (see F4): Echo +1.8 floors, Hotkey +0.8, Enter +2.0.
- Why it matters: Sister Pell's whole hook is the revive, and most players will never see it. The store-page line "your typing fires the Meteor" holds true, but the Meteor hardly matters.
- Proposed fix:
  - Sanctuary condition: anyone dead, OR anyone below 55%, OR (a boss is alive AND anyone is below 80%). Also allow a cast as a reaction to `bossSlam`.
  - Raise base ultimate payoff about 1.5× (for example Meteor 8× → 12×, Arrow Storm 1.5× → 2× per arrow), so typing → ultimates is worth about 30% again.
  - Verify with `novelty2.js`: cleric ≥ 0.3 per owned-minute, and the `ult_value` gap at least 5 minutes.

### F4 [severity: minor] The relic rework missed: Echo Rune is still a blank epic, Hotkey Ring is a blank too, and Midnight Oil is now the worst relic
- Evidence: `relic_impact.js --min 45 --seeds 5`. Each row is one relic held alone; the comparison is against holding no relic.

  | Relic | Typist: change in time to floor 30 | Typist: change in max floor | Idle: change in max floor | R1 typist result |
  |---|---|---|---|---|
  | Glass Cannon (epic) | −22% | +8.0 | +2.4 | −31% |
  | Flow Pendant (epic) | −23% | +7.0 | 0 | −21% |
  | Clacky Keycap (rare) | −13% | +6.2 | 0 | −11% |
  | Enter Amulet (rare) | −9% (+65% ultimates) | +2.0 | −0.8 | −2% |
  | **Echo Rune (epic)** | **0%** (+59% ultimates) | **+1.8** | −0.4 | −2% |
  | **Hotkey Ring (epic)** | **0%** (38 procs) | +0.8 | 0 | −9% |
  | Backspace Boots (common) | −1% | +0.8 | −0.2 | −2% |
  | **Midnight Oil (rare)** | **+3% (slower)** | +0.8 | −0.4 | 0% |

  - Keycap, Caps Lock, Flow Pendant and Hotkey Ring all give idle players **exactly 0**, the same as R1 (an open backlog item).
  - The offline half of Midnight Oil is clamped away by the 80% cap once Campfire reaches rank 2 (`verify_r1.js` E):
    - Campfire 2 + Oil = 80%.
    - Campfire 3 + Oil = 80%.
    - Campfire 4 + Oil = 80%.

    Typists have Campfire 3 by 8 h and 4 by 19 h. From then on, Oil is a strictly weaker Treasure Map (chests ×1.5 vs ×2).
- Why it matters: two of the four epics are dead picks, which the player only learns after taking one. It's the "fake depth" complaint again.
- Proposed fix:
  - **Echo Rune:** "Ultimates always cast twice." Make the echo 100% and keep it free.
  - **Hotkey Ring:** "Every 60th keystroke fires the next hero's ultimate for free, without passing the turn." Today it's every 150th keystroke, a random hero, and it often lands out of combat.
  - **Midnight Oil:** "While you're away, the party also clears floors (1 per 30 min, up to your record − 5)." This also gives a reason to come back.
  - **Backspace Boots:** "Tab Dash: no walking between waves."
  - **Typing relics:** each needs an idle fallback. For example, Caps Lock Crown: "Fervor never drops below 25."

### F5 [severity: major] Demo scope: cap at floor 40, one retire, then a "Demo complete" card. Guarantee an epic and leave out the Jar
- Evidence (`demo_cap.js --cap 40/50`; the run stops at the cap, then 1 retire and a re-climb to the cap):

  | Profile | Run 1 to floor 40 | Renown | Run 2 to floor 40 | Total |
  |---|---|---|---|---|
  | Typist | 28–31 min | +30 | **9 min** | 37–40 min |
  | Burst | 71–84 min | +30 | 14–16 min | 88–98 min |
  | Idle | 63–85 min | +30 | 18–23 min | 84–104 min |

  - **Floor 40 cap:**
    - All 4 heroes are recruited in run 1 by every profile; the Cleric now costs 4,000, and idle players recruit her at 30–61 min (1h43–2h04 in R1).
    - 30 Renown buys 7 of the 10 Legacy rows, so it's a real choice, though not all of them.
    - Run 2 is 3–4× faster, which is exactly the prestige "aha".
  - **Floor 50 cap:** typists need 50–54 min and idle players 96–129 min for run 1. 51 Renown buys nearly every first rank, so the choice disappears. Too long for a fest visitor, and it gives Legacy away.
  - **Record-based Renown gives a natural end:** once the record is 40, further retires at the cap pay 0.
  - **Epics:** in **2 of 3 typist seeds, no epic is offered in run 1.** That run sees 9 relic cards (bosses at floors 10, 20 and 30), and the chance of a card being epic is 60/618 ≈ 9.7%.
  - **Excluded by the cap:** Magma Depths, the Void, every Hollowed boss, and Ember Colossus. The cap hides about 50% of the 7 boss sprites and 2 of the 4 biome palettes, which is fine; keep them for the full game.
- Why it matters: the Next Fest audience gives a game 15–60 minutes. Desktop-companion demos also get left running for days, so the demo has to end on a high and then idle gracefully.
- Proposed fix:
  - **Contents:** floors 1–40 (Crypt and Caverns, 4 bosses, all 4 heroes, FLOW, rats, Forge, Workshop, 1 retire with the full Legacy menu).
  - **Ending:** clearing floor 40 again on run 2 shows a "Demo complete: Magma Depths awaits" card, with the Magma door drawn shut at floor 40.
  - **After the end:** the strip keeps farming floors 30–40 for gold, so it stays on the desktop all fest.
  - **Epic:** force at least one epic card in the floor-30 offer of the first delve.
  - **Head Start:** cap at rank 2 in the demo (start at floor 11) so run 2 still shows the Crypt.
  - **Workshop:** ship the F2 Jar replacement before the demo build, because the demo Workshop is otherwise the Jar alone for idle players.
  - **Save:** the demo save carries over to the full game (backlog item).

### F6 [severity: minor] Idle Battery ranks 4–5 erase the FOCUSED tier for everyone, typists included
- Evidence: `verify_r1.js` D. `powerMult` for IDLE/FOCUSED/ZONE/FLOW at each rank:

  | Battery rank | IDLE | FOCUSED | ZONE | FLOW |
  |---|---|---|---|---|
  | 0 | 1.00 | 1.25 | 1.60 | 2.20 |
  | 3 | 1.24 | 1.25 | 1.60 | 2.20 |
  | 4 | 1.32 | **1.32** | 1.60 | 2.20 |
  | 5 | 1.40 | **1.40** | 1.60 | 2.20 |

  - The floor `max(tier, 1 + idle)` (`state.js:97`) applies all the time, not only "while you're not typing" as the description says (`data.js:130`).
  - Typists spend 15% of their time in FOCUSED (`pt480_typist_s1`) and reach Battery rank 5 at 28 h. Idle players reach rank 5 at 26 h.
- Why it matters: in week 2, light typing visibly does nothing ("FOCUSED" shows, but power doesn't change). It quietly undercuts the core promise.
- Proposed fix: cap Battery at 3 ranks (+24%, still below FOCUSED). Alternatively, make it additive on every tier (`tier.mult + idle/2`) so typing always adds something. Fix the description either way.

### F7 [severity: minor] No sink in week 2: Renown slows to a trickle and every Legacy row already exists after the first retire
- Evidence:
  - **Renown per retire (typist):** +108, +86, +48, +16 (`pt480_typist_s1`) and +79, +96, +19, +48, +21, +33, +11 (`multi6x120_off8`).
  - **Lifetime Renown:** 268 at 8 h, 355 at 40 h. That's +87 Renown in 32 hours, roughly one Legacy purchase every 2–3 hours, of rows the player has owned since hour 1.
  - **Workshop:** Kindling and Static are maxed at 22h and 35h. After that, only Overcharge and the dead Jar are left.
  - **Visibility:** nothing in the UI shows the depth record as a goal. `S.stats.chests` and `wipes` are still tracked and shown nowhere (`ui.js:266-272`).
- Why it matters: a week-2 player opens Legacy and sees nothing new. Day 7 is when idle reviews get written.
- Proposed fix:
  - Depth trophies: at floors 75/100/110/120, give a permanent +5% and a banner, plus a "Next trophy: floor N" line in Legacy. This is data-only and lands where players actually are.
  - The Legacy tier 2 backlog item at 150 lifetime Renown: typists cross 150 at 2h30, idle players at 5h. Make the Rogue hero or a relic carried across retires its first row.

### F8 [severity: minor] The new systems are invisible, plus a Head Start edge case
- Evidence:
  - **Ultimate turn:** whose ultimate is next, and why Sparks are piling up (the Mage saving for 50), is shown nowhere. `W.ultTurn` isn't read by `render.js` or `ui.js`.
  - **Hollowed:** the only signal is the name.
  - **Head Start edge case:** bought during a door transition, it lands 1 floor past the target (`verify_r1.js` B: target 16, landed 17). The `jumpFloor` handler doesn't cancel `W.trans`. Harmless, but sloppy.
- Proposed fix:
  - A 2-px Spark pip over the hero whose turn it is, filling toward that hero's cost (the open backlog item "make the typing → power link readable").
  - Clear `W.trans` in the `jumpFloor` handler.

## Verified fixes from last round (pass/fail, one line each)
- **Ultimate starvation, Meteor: PASS.** Mage 1.37–2.04 per owned-minute for typists (R1: 0.03–0.08); first Meteor 34–41 s after recruit (R1: 1–83 min).
- **Ultimate starvation, Sanctuary: FAIL.** 0.01–0.09 per minute for typists, 0 casts in 40 h idle (F3).
- **Workshop → Embers: PASS with a caveat.** Typists buy 30 levels in 8 h (R1: 0), but the Jar is dead weight (F2). Idle players buy only 3–6 levels in 8 h, and 0 Static.
- **Post-floor-70 content: PARTIAL.** Last major novelty moves 2h15 → 4h06–4h51. But the Hollowed bosses are cosmetic renames, never seen past floor 110, and refought in the same order (F1).
- **Echo Rune 60%: FAIL.** 0% change in time to floor 30 (R1: −2%).
- **Enter Amulet −40%: PASS.** −9%, up from −2%.
- **Midnight Oil rework: FAIL.** +3% slower, and the offline part is clamped at Campfire 2 or higher.
- **Keen Edge: PASS.** At L4→5 (7.8K gold) it gives +8.3% vs +6.8% for Sharpen Blades at the same price, and +9.0% vs +4.6% at 318K.
- **Boss slam counter: PASS.** Slams = floor(swings / 4) exactly, for all 4 bosses tested (Rat King 2/10, Bone King 5/21, Brood Mother 3/14, Warlord 20/80).
- **Head Start applies immediately: PASS.** Floor 1 → 6 and floor 8 → 11; lands +1 floor if bought mid-transition (F8).
- **Veterans applies immediately: PASS.** Archer L3 → L6; higher levels untouched.
- **Cleric recruit cost: PASS.** Idle players recruit her at 30–61 min (R1: 1h43–2h04).
- **Epic weight 15: PASS, but not enough for the demo.** Epics are 9.7% of cards; 2 of 3 typist seeds see no epic in the first 40 floors (F5).

## Ideas (optional, max 3)
1. **Delve Omens** (F1.3): pick 1 of 3 run modifiers at every retire. This is the cheapest real week-2 content, because it changes the floor band people replay rather than adding floors they'll never reach.
2. **Daily Omen:** one extra modifier seeded by the date, with "Today: Rat Plague" shown on the welcome-back toast. It gives a reason to open the strip each morning, and it shows up well in streams.
3. **Codex:** a monster, boss, relic and Hollowed collection grid, with silhouettes for anything not yet found. The data already exists in `S.stats` and the kill events. Echo Rune and Hotkey Ring went un-offered or unpicked in several 8-hour runs, so collection gives the long tail something to chase.
