# Round 01 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
The first hour is well paced: a typist sees something new at least every ~11 minutes, and something big every 10–20 minutes. Then novelty stops. The last biome (Void, floor 61) arrives at 1h35–2h12, its only boss (The Hollow) at about 2h15, and after that nothing new appears for the rest of an 8-hour day. That is right at the edge of Steam's 2-hour refund window. On top of that, two of the four heroes' ultimates (Meteor, Sanctuary) almost never fire, and the whole Spark Workshop is dead content. I'd keep it running tomorrow morning, but not by day 3. **6/10.**

Method: about 30 harness runs, all 2–8 hours long (typist, idle, burst, heavy and afk profiles; smart, greedy and random strategies; seeds 1–9; 6×60-minute sessions with 8 h offline between them; `--stuck 20`), plus three custom scripts in this folder:
`novelty.js` (logs the first time each piece of content appears and measures the gaps between novelties), `relic_impact.js` (each relic held alone for 45 minutes, 5 seeds), and `ult_value.js` (the same run with ultimates or Fervor switched off). Raw outputs are in `out/`.

## Findings (ranked, max 8)

### F1 [severity: major] Content runs out at ~2h15. After The Hollow (floor 70) nothing new ever appears, with no ending and no loop
- Evidence:
  - `node docs/playtest/round-01/novelty.js --min 480 --profile typist --seed 1|2 --quiet`: the last *major* novelty is at 2h10–2h15. After that, 345–350 minutes pass without a major novelty. The last novelty of any kind is at 2h40 (seed 2), or at 4h23 for seed 1, where it was just a rare relic finally being offered.
  - In 5-hour runs the longest stretch without a major novelty after hour 1 is 163–178 min for typists, 188–201 min for heavy typists, and 64–85 min for idle players. Idle players hit the same wall later (Hollow at 3h35–4h30).
  - Novelty per 30 min after hour 1 (typist s1, 8 h): `17 3 7 0 2 0 3 0 0 0 0 0 0 0`.
  - `data.js:77`: the Void boss list is `['hollow','hollow']`. `F.biomeOf` (`state.js:43`) returns Void for every floor ≥ 61, so floors 70, 80, 90, 100, 110… all bring the same 3 monsters and the same boss. In 8 h, The Hollow was killed 12–20 times (`typist480_s1/s2`).
  - The practical wall after 8 h is floor 100–110 (`playtest.js --min 480`, seeds 1, 2 and 9). There is no win state, no credits and no milestone reward at any depth.
- Why it matters: "content runs out in 2–3 hours" is the classic idle-game refund and review line, and here it lands exactly at the refund cutoff. Expected review: *"Saw everything in two hours, then it's the same purple corridor and the same eyeball boss forever."*
- Proposed fix (cheapest first):
  1. Give Void real bosses. Use a pool for floors 70+ that cycles all 7 bosses with a void palette and a prefix ("Hollowed Rat King", "Hollowed Warlord"…), so each boss floor shows a different silhouette.
  2. Make floor 100 a goal: a "Heart of the Keep" boss, a banner and credits moment, plus an unlock (a cosmetic, or the Rogue hero from the GDD roadmap). Show "Next milestone: floor 100" in the Legacy panel.
  3. For 1.0: past floor 100, loop the four biomes as "Depth II" with one affix per cycle (enemies regenerate, elites, double minions).

### F2 [severity: major] Mortimer's Meteor and Sister Pell's Sanctuary almost never fire: the Knight eats every Spark
- Evidence:
  - Ultimates per minute of owning the hero (`novelty.js`, 5 h):
    - Typist: Knight 4.2–4.6, Archer 0.9–1.5, **Mage 0.03–0.08, Cleric 0.00–0.03**.
    - Heavy typist: Mage 0.09–0.65.
    - Idle and burst: Mage 0–3 casts *in 5 hours*, **Sanctuary 0 casts in all 6 idle and burst runs**.
  - For typists, the first Meteor comes anywhere from 1 to 83 minutes after the Mage is recruited. `ult_value.js`: per 45-min run, 176 Earthshatter, 46 Arrow Storm, **2 Meteor, 0 Sanctuary**.
  - Root cause, `world.js:300-306`: every frame, heroes are checked in party order, and the Knight (cost 25, cooldown 6 s) casts whenever Sparks ≥ 25. Typing income is about 2 Sparks/s, so the pool never reaches 50. The highest observed Sparks in a typist run is 65–96, and that only happens out of combat.
- Why it matters: the GDD's headline line is *"Typing is literally what fires the Meteor."* The player pays 1,500 gold for the Mage, and his ultimate VFX, shake and audio (`fx.js`, `audio.js` 'meteor') are built but effectively never seen. Ultimates are 37% of a typist's speed (`ult_value.js`: floor 30 at 19.0 min with ultimates vs 26.0 without), so who casts them matters.
- Proposed fix: add a round-robin ultimate pointer, `W.nextUlt`, cycling through the heroes you own. Only the hero whose turn it is may cast. If its condition is false (the Cleric with nobody below 40% HP), the turn passes to the next hero; the queue never waits on a missing condition. Expected result for a typist: one cycle costs 25+30+50 = 105 Sparks, so about 1 Meteor per minute. Optionally, show a small charge pip above each hero (see Ideas). Verify with `novelty.js`: the "ults per owned-minute" line should show Mage ≥ 0.7.

### F3 [severity: major] Spark Workshop: backlog item confirmed, plus the cap math is broken even after a fix
- Evidence:
  - 0 Workshop purchases in **every** run and profile, up to 8 h. "Sparks at cap" is 0% of the time for all profiles except heavy. Idle players only get Sparks from golden rats (60 per rat), and ultimates spend them immediately.
  - New: Sparks can never exceed the jar cap, and **the Spark Jar locks itself at level 7 of 25** (level 8 costs 1,079, but the cap is 850). That leaves Overcharge at most 6 levels, Kindling 6 of 10, Static Coins 4 of 8, Idle Battery 3 of 5. Jar levels 8–25 are unreachable by construction.
  - **Idle Battery**, the one Workshop item meant for idle players, costs 200 against the base cap of 150, so it shows "NEEDS BIGGER JAR" from the start (`ui.js:206`). Idle players, who have no Sparks, can never buy it.
  - The Workshop tab never gets an affordability badge (`ui.js:95-110`).
- Why it matters: this is a fifth of the upgrade content, and it's the one shop the GDD sells as "your typing investment is permanent." It's also the pillar ("your activity is the fuel") that a typist can never feel.
- Proposed fix:
  1. Have the Workshop spend a separate, passively earned currency (e.g. 1 "Spark Dust" per 10 counted inputs, banked, never capped) so it doesn't compete with ultimates. Alternatively, let players set a reserve threshold ultimates won't spend below.
  2. Change Jar to `+150 cap per level, growth 1.35` so cost stays below cap at every level.
  3. Price Idle Battery in Renown or gold.
  4. Add a "!" badge on the Sparks tab.

### F4 [severity: major] Next Fest demo pacing: the planned floor-30 cap shows about 20 minutes of content to a typist, and idle players never meet the 4th hero
- Evidence:
  - The GDD's Dec 21 plan is "Demo build (cap at floor 30 + 1 retire)".
  - Floor 30 arrives at 15–21 min for typists, about 40 min for idle players, and under 40 min for burst players.
  - Inside that cap: 2 biomes (Caverns only half), 3 bosses, and the first retire worth only **9 Renown**, which buys 5 Legacy rows in the idle run (`idle240.txt`).
  - **Sister Pell costs 12,000 gold at unlock floor 18**, and first-run idle income is 7–40 gold/s. Idle players recruit her at 1h43–2h04, after 2 retires (`novelty_idle_s*`, `idle240`, `afk480`). Burst players recruit her at 45 min to 1h43. Demo players who don't type much will finish the demo with 3 heroes.
  - Outside the cap: Goblin Warlord, Magma, Void, and on average every epic relic. The first epic offer comes anywhere from 3 min to 2h12.
- Why it matters: a demo that ends in about 20 minutes can be fine for Next Fest, but the cap should end on the strongest beat, not in the middle of a biome, and should not hide a hero from the audience that types less.
- Proposed fix:
  1. Cap the demo at **floor 40** (end of Caverns, Warlord kill, 17 Renown on retire) plus 1 retire.
  2. Cut Cleric's recruit cost from 12,000 to about 3,000, or scale every recruit cost to about 120× the per-kill gold at its unlock floor, so all profiles meet her around floor 20.
  3. Guarantee one epic in the floor-30 boss offer of a save's first run, so every demo player sees an epic.

### F5 [severity: minor] Several relics are blanks; Echo Rune (epic) is weaker than almost every common
- Evidence: `relic_impact.js --min 45 --seeds 5`. Each relic is held alone and all boss offers are declined; numbers are the change in time to reach floor 30.

  | Relic (rarity) | Typist | Idle |
  |---|---|---|
  | Glass Cannon (epic) | −31% | −21% |
  | Flow Pendant (epic) | −21% | 0% |
  | Critic's Lens (rare) | −18% | −4% |
  | Giant's Belt (common) | −17% | −16% |
  | Whetstone (common) | −12% | 0% |
  | Hotkey Ring (epic) | −9% | 0% |
  | **Echo Rune (epic)** | **−2%** (+28% more ultimates, almost no progress) | 0% |
  | Enter Amulet (rare) | −2% | −1% |
  | Backspace Boots (common) | −2% | +2% (slightly *worse* than no relic) |
  | Midnight Oil (rare) | 0% (only matters if you go offline before retiring) | 0% |
  | Clacky Keycap (rare) | −11% | **exactly 0%** |
  | Caps Lock Crown (rare) | −3% | **exactly 0%** |

  - Keycap, Caps Lock, Flow Pendant, Hotkey Ring and Echo Rune all do exactly 0 for idle players. Epics are 40 of 610 total roll weight (6.6% per card).
  - Across twelve 5-hour runs, each epic failed to appear at all in 2–3 runs.
- Why it matters: when a relic card is a non-choice, the roguelite layer reads as fake depth. Typing-themed relics should never be dead cards for low typers.
- Proposed fix:
  - Echo Rune: 30% → 100% (always double-cast) at the same rarity, or "ultimates refund 50% of their Sparks".
  - Enter Amulet: −25% cost becomes −40% cost and −25% cooldown.
  - Backspace Boots: replace with "Tab Dash: no walk between waves", or add +15% gold.
  - Midnight Oil: "+100% offline, and offline time also descends floors".
  - Give typing relics an idle floor: Caps Lock Crown "Fervor never drops below 25 (FOCUSED)"; Clacky Keycap "clicks count too".
  - Raise epic weight from 10 to 15.

### F6 [severity: minor] Keen Edge is strictly worse than Sharpen Blades at every price
- Evidence: crit chance is 6% at 2× damage, so +2% crit adds about +1.9% average damage. Compared at equal gold:
  - Keen L0→1 (600 gold) gives **+1.9%**; Blades L3→4 (590 gold) gives **+10.3%**.
  - Keen L4→5 (16.8K) gives +1.8%; Blades L9→10 (14.2K) gives +6.4%.
  - Keen L8→9 (469K) gives +1.6%; Blades L15→16 (343K) gives +4.6%.

  The UI never shows the crit multiplier (`data.js:109`, `ui.js:209`), so players can't tell.
- Why it matters: it's a fake choice in a five-item shop, and the harness's smart player still buys it about 88 times in 8 h.
- Proposed fix: Keen Edge gives "+3% crit chance and +25% crit damage per level", and the description shows the current multiplier ("crits deal 2.75×").

### F7 [severity: minor] Bosses are reskins with one shared attack; the slam timer is effectively random; Golem sprites don't animate
- Evidence:
  - All 7 bosses are `bossOf(<regular monster sprite>)` (`sprites.js:494-502`) and share one behaviour: "slam the whole party every 4th attack" (`world.js:408`).
  - The slam counter `e.hits` is also incremented every time a *hero* hits the boss (`world.js:109`) as well as on boss attacks (`world.js:414`), so the "every 4th" cadence is really random.
  - None of the bosses is ranged. Magma Lord and The Hollow are just flying versions of Imp and Watcher.
  - Rock Golem and Ember Colossus each have two identical frames (`sprites.js:485, 499`), so they never animate.
  - The GDD's Nov 30 target is "8 bosses with unique attacks". Today there are 7 distinct bosses and 0 unique attacks.
- Why it matters: bosses are the main recurring "big moment". When they all fight the same way, depth feels shallow, which the reviews will notice.
- Proposed fix:
  - Add a separate `e.swings` counter for the slam.
  - Give each boss one signature move: Rat King summons 2 rats at 50% HP; Bone King revives one skeleton; Brood Mother spawns spiderlings; Warlord enrages below 30%; Ember Colossus leaves burning ground; Magma Lord throws ranged fireballs; The Hollow drains 20 Fervor per slam, which is on-theme because it fights your typing.
  - Add a second Golem frame.

### F8 [severity: minor] No week-2 reason: Legacy maxes in one workday, Head Start deletes early content, and long-term goals don't exist
- Evidence:
  - `novelty.js --min 480`: for typists, all 7 capped Legacy rows are maxed by **6h52–7h29**. Quartermaster, Recruiter and Collector are maxed by 0h39–1h12, and Zeal and Campfire by 3h–5h. After that, only Lineage and Treasury remain, both "+25%" rows with linear cost `1+l`.
  - Head Start 8 starts every run at floor 41, so Crypt and Caverns, 4 of the 7 bosses and all three recruit moments disappear from later runs. The Rat King was killed only 3 times in 8 h.
  - There are no achievements, daily modifiers or collection log. `S.stats.chests` and `S.stats.wipes` are tracked but shown nowhere (`ui.js:254-258`). After the first retire, the Legacy tab never badges unspent Renown (`ui.js:107`).
- Why it matters: idle players judge a game by day 7, and the review that follows is *"great first day, nothing to do after."*
- Proposed fix:
  - Add a Legacy tier 2 that unlocks at 150 lifetime Renown: a 5th hero, +1 relic carried over on retire, offline floor progress.
  - Add depth milestones and Steam achievements (floor 50/75/100/125, first epic, 1h of FLOW in a day).
  - Badge the Legacy tab whenever something there is affordable.
  - Add a toggle to turn Head Start off ("start from floor 1 for ×1.25 Renown"), so players who want the early content back have a reason to replay it.

## Verified fixes from last round
- None. This is round 01, so there was nothing to verify. Status of the known backlog items:
- Workshop never affordable: **confirmed** for every profile up to 8 h, and worse than logged (see F3: jar self-lock, Idle Battery locked for idle players).
- First retire buys every Legacy upgrade: **confirmed**. The typist's first retire (17 Renown at 35–39 min) buys 8 of 9 rows; only Collector (6 Renown) is left over. The idle player's first retire (9 Renown) buys 5 rows.
- Void unseen in 90 min: **confirmed**. Void arrives at 1h35–2h12 for typists, 1h24–1h49 for heavy typists, 2h50–3h33 for burst players and 3h03–4h01 for idle players. It's fine that Void comes late; the problem is that it's the end (F1).

## Ideas (optional, max 3)
1. **Ultimate charge pips** above each hero that fill as you type, with a flash and the hero's name when it fires ("METEOR!"). This makes the "your typing fires this" loop visible at a glance, and pairs naturally with the round-robin fix in F2.
2. **FLOW today** counter in the HUD (`S.stats.flowTime` already exists), with a daily best and a shareable end-of-day card ("3h12m in FLOW · floor 88"). It's a cheap week-2 hook and something streamers can show off, as the GDD's own §14 suggests.
3. **Floor 100 "Heart of the Keep"**: a one-time finale boss that uses all four ultimates' VFX, followed by the endless remix (F1). It gives the Steam page and trailer an "ending" beat.

## Appendix: when content first appears (median of 3 seeds, novelty.js, 5 h)
| | typist | idle | burst | heavy |
|---|---|---|---|---|
| First FLOW STATE | 0:10 | never | 0:10–4:45 | 0:06 |
| Archer / Rat King (floor 10) | 2m / 2.5–3.5m | 3–5m / 6–8m | 3–5m / 5–7m | 2m / 2.5m |
| First golden rat | 3m40 | 3m40 | 3m40 | 3m40 |
| First relic offer / first epic offered | 3–4m / 4m–37m | 6–9m / 1h15–1h51 | 6–7m / 1h17–2h12 | 3m / 3m |
| Mage recruit / first Meteor | 11–13m / 13m–1h34 | 23–36m / 1h38 or never | 21–29m / 1h37, 4h06 or never | 7–11m / 7–13m |
| Cleric recruit / first Sanctuary | 18–25m / 45m–3h22 or never | **1h43–1h58** / never | 45m–1h43 / never | 16–23m / 20–27m |
| Caverns / Magma / Void | 7–9m / 32–37m / 1h38–2h06 | 17–23m / 1h48–2h08 / 3h03–4h01 | 17m / 1h43–1h57 / 2h50–3h33 | 6–7m / 23–49m / 1h24–1h31 |
| First retire | 46m–1h02 (35–39m with playtest.js) | 41–53m | 40m–1h09 | 30–45m |
| The Hollow (last new boss) | 2h01–2h25 | 3h35–4h30 | 3h35–4h10 | 1h40–1h52 |
| Never, in any run | all 5 Workshop upgrades | + Meteor/Sanctuary, Keycap/Hotkey procs | | |

Hour-1 cadence (any novelty per 10 min, typist): `28-37, 8-18, 2-7, 3-10, 2-4, 2-12`. The longest gap with no novelty of any kind is 8–11 min, which passes the ~10-minute target. The longest gap with no *major* novelty is 15–22 min, between the floor-40 wall and the first retire (about 0:35–0:55).
