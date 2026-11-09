# Round 04 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
Most of the R3 fixes landed:
- **Demo loop:** the floor-40 boss returns every delve, each re-clear pays +6 with a toast, and re-delve is always available.
- **The Hollow** is the floor-70 boss in 100% of delves.
- **Ultimate turn:** it no longer spins. Idle players now cast 25–30% Meteors (R3: 0%).
- **Hotkey Ring:** no procs are lost.
- **Floor-30 epic:** the guarantee survives an early retire.
- **Fame:** the Legacy line now shows the real compounded value.

Delve Omens roughly halved the longest stretch with nothing new for typists (R3: 321–332 min, now 99–201 min). But hours 5–8 are still empty, because delves stretch to 60–90 min each and every omen has been seen by then.

Three problems are new or still open:
1. **Sanctuary is now almost invisible.** Typists see 0.6–0.9 casts per hour, in 1–2% of boss fights.
2. **Demo Renown has no cap.** An engaged demo player imports enough Fame to burn through all of the full game's new content in under an hour.
3. **Achievements still don't exist.** A sim-checked set of 36 for launch (5 of them in the demo) is below.

I'd keep the full game running tomorrow. I'd keep the demo running for about two hours: after that the best time stops improving. **7/10.**

### Method
- **Scripts** (all in `docs/playtest/round-04/`):
  - `r4lib.js` is a shared harness: real sim, nudge-following player, random relic and omen picks. It tracks novelty, Sanctuary per boss fight, ultimate shares, Second Wind and Hotkey Ring through wrappers, the epic guarantee, the demo loop, and **all 46 candidate achievements** checked live from game events.
  - `r4probe.js` runs it from the command line.
  - `batch.sh` runs the batch:
    - typist s1–s3, idle s1–s2, burst, heavy and light (a new profile: 10–30 s of typing, 40–120 s pauses), 8 h each;
    - typist and idle for 24 h;
    - demo typist ×2, idle and burst, 3 h each.
- **Experiments**, run in memory only (no file in `js/` was touched):
  - `design_test.js`: Sanctuary HP spread, depth trophies, and importing a demo save into the full game.
  - `trophy_test.js`: the depth-trophy design.
  - `sanct_test.js` and `sanct_vigil.js`: Sanctuary rule variants.
  - `demo_cap_test.js`: capping demo Renown.
  - `sw_test.js`: Second Wind on vs off.
- **Output:** everything is in `out/` (`r4_*`, `r4demo_*`, `design_*`, `trophy_test_*`, `sanct_*`, `demo_cap_test.txt`, `sw_test.txt`, `ach_table.txt`). The `econ_*` files belong to T1.

## Findings (ranked, max 8)

### F1 [severity: major] Demo Renown has no cap, so an engaged demo player burns the full game's new content in under an hour
- Evidence:
  - **Demo, 3 h** (`r4demo_*`; re-delve one minute after each "sealed" toast):
    - Typists re-clear floor 40 **21–22 times** and gain +156 to +162 Renown after the card. Lifetime Renown reaches 156–162 (Fame x10.6–11.2). The lap time falls from 10.1 to 4.0 min.
    - Idle and burst players get 8–10 laps and +54 to +71.
  - **That save imported into the full game** (`design_C.txt`, `demo_cap_test.txt`, typist):

    | Imported lifetime Renown (demo play) | Void | The Hollow | Floor 100 | Last new content |
    |---|---|---|---|---|
    | 0 (fresh) | 1h09 | 1h18 | 3h26 | 3h05 |
    | 36 (40 min, card + 1 lap) | 0h21 | 0h41 | 3h20 | 2h56 |
    | 60 (capped) | 0h09 | 0h14 | 1h55 | 2h11 |
    | 72 (90 min) | 0h07 | 0h14 | 1h45 | 1h57 |
    | **162 (180 min)** | **0h03** | **0h06** | **0h45** | **0h57** |

    "Last new content" means the last new hero, biome, boss or mechanic.
  - **Idle** (imported lifetime 78): the Void comes at 0h17 instead of 2h14.
  - **Steam achievements earned in the demo:**
    - "10 retires" unlocks at 1h40–2h58 in the demo (`ach_table.txt`, retire10 column D:).
    - 100 chests unlocks at 2h21.
- Why it matters: the players who wishlist from Next Fest and buy on day 1 are exactly the ones who grind the demo. They meet Magma, the Void, 3 new bosses, 6 Hollowed bosses and omens all in the first hour, then post *"Played the demo for 3 hours, the full game added 1 hour of new stuff."*
- Proposed fix (two lines in `A.renownGain` plus one toast):
  - Pay +6 only for the **first 3 re-clears** after the card, so the demo's lifetime Renown stops at 48.
    - 48 exactly buys the 7 cheap rows plus Relic Collector (28 + 20), or Campfire and Battery instead.
    - Measured at lifetime 36–60, the full game keeps its last new content at 2h11–2h56.
  - Once the cap is reached, the sealed toast says "Demo Renown maxed: your best time is the score now".
  - Count "10 retires" only for retires that pay at least 10 Renown, so demo re-delves don't count.
  - Optional: on import, start a fresh delve (floor = startFloor) instead of mid-run at floor 37, so the full game opens on a "MAGMA DEPTHS" banner.

### F2 [severity: major] Omens filled hours 2–5, but hours 5–8 are still empty. The next content should be depth trophies (data-only design below)
- Evidence: 8 h runs with nudge-following retires and random omen picks. "Major" = new hero, biome, boss or mechanic. An omen counts when it's picked for the first time.

  | Profile | Last major | Last new omen | Distinct omens picked | Longest gap after h1: major only | + omens | Empty 30-min windows, h2–5 / h5–8 |
  |---|---|---|---|---|---|---|
  | typist s1/s2/s3 | 3h16 / 3h57 / 3h05 | 6h20 / 4h39 / 5h47 | 6 / 6 / 7 | 283 / 243 / 295 min | **99 / 201 / 133 min** | 2,1,1 / **5,6,5** of 6 |
  | heavy | 2h10 | 5h33 | 6 | 349 | 147 | 4 / 5 |
  | light | 6h01 | 5h28 | 5 | 118 | 118 | 0 / 4 |
  | burst | 7h53 | 6h45 | 4 | 72 | 69 | 1 / 3 |
  | idle s1/s2 | 6h22 / 6h15 | 5h52 / 7h06 | 5 / 6 | 97 / 105 | 97 / 53 | 2,2 / 3,2 |

  - **Why omens fade:** an omen is offered once per retire. Typist delves stretch from 25 min to 60–90 min after 4 h (retires at 4h49, 6h20 and 7h52 in s1).
  - **Retires get smaller:** each pays only +17 to +35 Renown, because Renown is record-based and the depth curve flattens: floor 110 at 4h41, 116 at 6h20, 119 at 8h.
  - **All 10 omens:** reached only after 13h41 (typist) or 18h08 (idle), and only when the player prefers ones they haven't picked.
- **Comparing the three candidates** (measured reach times):
  - **Floor-100 finale:** one beat for typists at 2h17–3h52 (light 5h20). Idle players reach floor 100 only after **21h50**. It's one beat, mostly for typists.
  - **Legacy tier 2:** every capped Legacy row is maxed at 6h40–8h22 for typists and after more than 24 h for idle players. Until then Legacy still has purchases, so tier 2 is the right content for week 2, not hours 5–8.
  - **Depth trophies:** they arrive every 5 floors whenever progress happens, so they keep coming through hours 5–8 for typists. Pick this one, and make the floor-100 trophy the finale.

#### Depth trophies (simulated in `trophy_test.js`, 14 trophies at +6% each)
- **Data** (`data.js`):

  ```js
  const TROPHIES = [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150].map((floor, i) => ({ floor, name: TROPHY_NAMES[i], big: floor === 100 || floor === 150 }));
  // TROPHY_NAMES: 'Hollow Gate','Whispering Stair','Wraith Lantern',"Void Knight's Oath","Watcher's Eye",'HEART OF THE KEEP',
  //   'Ashen Crown','Silent Choir','Starless Well','Ninefold Door','Abyssal Sigil','The Last Torch','Echoing Deep','The Bottom (?)'
  ```

- **Rule:** each trophy is permanent, multiplies damage and gold by **x1.06**, and stacks multiplicatively (all 14: x2.26). It's based on `S.maxFloorEver`, which is already saved, so **no new save field is needed** (R3 F2 rule satisfied).
- **Hooks** (about 12 lines):
  - `KK.mods()`: `const n = D.TROPHIES.filter((t) => S.maxFloorEver >= t.floor).length; m.dmg *= 1.06 ** n; m.gold *= 1.06 ** n; m.trophies = n;`
  - `W.nextFloor`: `const rec = S.floor > S.maxFloorEver;` goes before the record update. If `rec` is true and the floor is a trophy floor: `KK.dirty(); KK.emit('trophy', t)`.
  - FX: banner "DEPTH TROPHY · <name>" with "+6% DMG & GOLD FOREVER". Floor 100 gets "HEART OF THE KEEP / ...BUT THE KEEP GOES DEEPER".
  - Legacy line: "Depth trophies 5/14 · next: floor 100".
  - The Steam achievements Centurion, Abyss Walker and Bottomless fire on the same event.
- **Measured reach times** (h:mm):

  | Profile | 75 | 85 | 95 | 100 | 105 | 110 | 115 | 120 | 125 |
  |---|---|---|---|---|---|---|---|---|---|
  | Typist s1–s3 | 1h16–1h34 | 2h00–2h07 | 2h41–3h02 | 3h13–3h27 | 3h55–4h31 | 4h44–5h26 | 5h29–6h33 | 6h35–7h24 | 7h48 (s1) |
  | Idle | 3h56–4h00 | 5h40–6h33 | — | — | — | — | — | — | — |

  - **Typist** also reaches 80 at 1h38–1h58 and 90 at 2h05–2h30.
  - **Idle** also reaches 80 at 4h16–4h20 and 90 at 7h48–7h54.
  - **Heavy** has 13 trophies by 6h52.
- **Novelty effect** (counting majors, new omens and trophies):
  - **Longest gap after hour 1:**

    | Profile | Before | After |
    |---|---|---|
    | Typist | 99–201 min | **65–78 min** |
    | Heavy | 147 min | 68 min |
    | Light | 118 min | 57 min |
    | Burst | 69 min | 41 min |
    | Idle | 53–97 min | 47–58 min |

  - **Empty 30-min windows in hours 5–8:** typist 5–6/6 → **2–3/6**, idle 2–3/6 → 1/6.
- **Balance** (depth at 8 h):

  | Profile | Before | After |
  |---|---|---|
  | Typist s1 | 119 | 127 |
  | Typist s2 / s3 | 120 | 124 |
  | Light | 103 | 110 |
  | Burst | 90 | 99 |
  | Idle | 88–89 | 90 |
  | Heavy | 130 | 144 (snowball) |

  - If T1 dislikes the heavy-typist snowball, use x1.05.
- Why it matters: hours 2–8 are when players decide whether this is worth $4.99 and whether to leave a review. Typists are the target audience, and they currently spend about 3 of those hours seeing nothing new. The likely review: *"After lunch it's just numbers going up."*

### F3 [severity: major] Achievements are still missing. Here is a launch set of 36 that the sim can check (5 for the demo)
- Evidence:
  - Every trigger below exists as a live test in `r4lib.js` (the `ACH` table), keyed to real event and stat names.
  - Unlock times are measured, not guessed (`out/ach_table.txt`: 8 runs of 8 h, 2 runs of 24 h, 4 demo runs of 3 h).
  - "—" means not reached in the run. "est." means extrapolated from the 24 h slope.
- Implementation:
  - `D.ACHIEVEMENTS` holds rows of `{ id, name, desc, demo, on: '<event>'|'poll', test(S, data, P) }`.
  - Add `ach: {}` (id → time) and `achP: { hollowed: [], omens: [], runInputs: 0, bossTimes: [], bigRetires: 0 }` to **`newState()`**, or the load merge will drop them (the R3 F2 lesson).
  - The checker is one `KK.on` per event type, plus a 1 Hz poll for the `stats` counters.
  - Unlocking shows a toast and calls the Steam bridge.
  - The demo tracks every achievement but grants only its 5. The full game grants the rest from the shared save on its first launch.
- **The demo set:**

  | # | Name | Exact trigger | Typist | Idle |
  |---|---|---|---|---|
  | 1 | Cellar Door | `kill`: `e.boss` | 0h02–0h04 | 0h07 |
  | 2 | Flow State | `fervorTier`: `to === 3` | 0h00 | never (burst: never) |
  | 3 | Fellowship | `recruit`: all four `S.heroes.* > 0` | 0h12–0h19 | 0h32–0h34 |
  | 4 | A New Generation | `retired` | 0h20–0h28 (demo 0h27–0h32) | 1h02 (demo 1h10) |
  | 5 | Gatekeeper | `kill`: `e.boss && S.floor === 40` (in the demo, also on `demoComplete`) | 0h28–0h38 (demo 0h26–0h30) | 1h21 (demo 1h28) |

- **The other 31 for 1.0:**

  | # | Name | Exact trigger | Typist | Idle |
  |---|---|---|---|---|
  | 6 | Gilded Whiskers | `ratCaught` | 0h04 | 0h04 |
  | 7 | Epic Loot | `relicPicked`: `RELICS[id].rar === 'epic'` | 0h09–0h47 (luck in later runs) | 1h58–2h50 |
  | 8 | Second Try | `kill`: `e.boss`, and at `bossSpawn` `S.bossBlock === S.floor` (capture at spawn, because `killEnemy` zeroes `bossBlock` before it emits `kill`) | 0h05–0h08 (1 of 3 seeds never) | 0h07–0h18 |
  | 9 | Not Today | `revive` | 0h12–0h21 | 0h33–0h35 |
  | 10 | Say It Twice | `echo` | 0h21–5h30 | 2h02–22h27 |
  | 11 | Extinction Event | 3 or more `kill`s between two `meteorLand`s whose last `hit` had `ult && src.id === 'mage'` | 0h14–0h39 | 2h02–never |
  | 12 | Blitz | 5 boss `kill`s within 600 s of `KK.simTime` | 0h51–1h54 | 11h48 (burst: no in 8 h) |
  | 13 | Packrat | `relicPicked`: `S.relics.length >= 8` | 5h30–11h54 | no in 24 h ⚠ |
  | 14 | Fire Below | `floor`: `floor >= 41` | 0h28–0h54 | 1h21 |
  | 15 | Into the Hollow | `floor >= 61` | 0h42–1h38 | 2h23–2h37 |
  | 16 | Hollow Victory | `kill`: `e.key === 'hollow'` | 0h58–2h02 | 3h12–3h22 |
  | 17 | Echoes of the Deep | `kill`: `e.hollowed`; set of `e.key` has 6 | 2h36–4h14 | 12h29 |
  | 18 | Centurion | `floor`: `S.maxFloorEver >= 100` | 2h17–3h52 | 21h50 |
  | 19 | Abyss Walker | `S.maxFloorEver >= 125` | 6h39 (heavy) – 12h14 | no in 24 h |
  | 20 | Bottomless | `S.maxFloorEver >= 150` | about 29 h (est.) | practically never ⚠ |
  | 21 | Dynasty | `retired` with `gain >= 10`, counted 10 times | 6h26–7h52 | 11h38 |
  | 22 | Living Legend | `S.renownLifetime >= 500` | 23h | about 60 h (est.) |
  | 23 | Ill Omen | `omenPicked`: `id` set | 0h45–1h12 | 1h52 |
  | 24 | Augur | set of picked omens has all 10 | 13h41 (if the player prefers unseen omens; random: 6–7 by 8 h) | 18h08 |
  | 25 | Against the Omens | `floor`: `S.omen === 'deep' && floor >= 90` | 5h51 | 14h09 |
  | 26 | Hall of Legends | `upgrade`: every LEGACY row with `max < 999` is at max | 6h40–8h22 | more than 24 h |
  | 27 | Forgemaster | `S.workshop.crucible >= 10` | 3h51–7h20 | more than 24 h (8 of 10 at 24 h) |
  | 28 | Centenarian | `levelUp`: `to >= 100` | 0h41–1h30 | 2h00–2h23 |
  | 29 | Treasure Hunter | `S.stats.chests >= 100` | 2h08–6h34 | 9h56 |
  | 30 | Rat Catcher | `S.stats.rats >= 25` | 2h49–4h30 | 3h15–4h04 |
  | 31 | Warming Up | `S.stats.keys >= 10,000` | 0h40–1h18 (light 3h32) | never |
  | 32 | Wordsmith | `S.stats.keys >= 100,000` | 6h55 (heavy) – 13h00 | never |
  | 33 | Million-Key March | `S.stats.keys >= 1,000,000` | about 130 h of play ⚠ | never |
  | 34 | Deep Work | `S.stats.flowTime >= 3600` | 1h14–2h06 | never |
  | 35 | Monk Mode | `S.stats.flowTime >= 36000` | 16h26 | never |
  | 36 | Hands Off the Keyboard | `floor >= 50 && achP.runInputs === 0` (keys and clicks counted since `retired`; needs the new field) | only by pausing input (teaches the pause toggle) | 1h37 |

- **Flags:**
  - **Trivial:**
    - Gilded Whiskers is 0h04 for everyone.
    - Flow State is 0h00 for typists.
    - Cellar Door and Second Try take under 10 min.
    - Keep them: 4 freebies out of 36 is normal.
  - **Effectively impossible:**
    - Bottomless for idle players: about 0.1 floor per hour at 24 h.
    - Million-Key March takes months for a real typist.
    - Both are fine as the one or two "week-2+" badges.
    - Packrat never happens for idle players: their delves clear only 5–6 bosses. Use 6 relics if idle fairness matters.
  - **Typing only:** 6 achievements are impossible for idle players (Flow State, Deep Work, Monk Mode and the three key counts).
  - **Idle-leaning:** Hands Off is the idle counterweight, and Rat Catcher and Treasure Hunter are even.
  - **Rejected after measuring:**

    | Candidate | Why it was dropped |
    |---|---|
    | "Clear floor 40 in under 10 min" | Every typist gets it on the first re-climb (0h28–0h38), and Head Start 8 skips floor 40 entirely |
    | "10 min continuous FLOW" | Only the heavy profile manages it; typists peak at 3.8 min |
    | "Overcharge 10" | Typists take 9h24, idle players never |
    | "1,000 ultimates" | Typing only |
    | "25,000 kills" | About 60 h |

  - **Demo inflation (F1):** Dynasty, Treasure Hunter and Rat Catcher are all reachable inside the demo. The `gain >= 10` rule handles Dynasty.

### F4 [severity: major] Sanctuary as a reaction is now rarer than before: typists see it in 1–2% of boss fights
- Evidence (`r4_*_480`, `design_A.txt`, `sanct_vigil.txt`):
  - **Typists:**
    - 5–7 casts in 8 h (0.6–0.9 per hour; R3, the Sparks-based version: 11–35 casts).
    - Only 1 of 64–68 boss fights has a Sanctuary.
    - In **61–66 of 64–68 fights, nobody drops below 50%**, so the `<50%` slam rule never fires.
    - The party's minimum HP when the boss crosses 50% has a **median of 0.95–0.98**.
  - **Heavy:** 34 casts, but they bunch into 6 losing fights at the wall.
  - **Idle:** 20–28 casts, mostly outside boss fights (trash KOs).
  - **First REVIVE:** happens for everyone soon after recruiting Pell (0h12–0h35), and then almost never again.
  - **Threshold variants** (`sanct_test.js`):
    - Below 75%: 6–20% of fights.
    - Below 85%: 30–44%.
    - Both bunch dozens of casts into wall fights (typist s1: 86 casts in 10 fights).
- Why it matters: Sister Pell costs 4,000 gold and her card is "revives the fallen", yet a typist sees that once. The likely review: *"The healer's ultimate never does anything."*
- Proposed fix ("Vigil", tested in `sanct_vigil.js`):
  - **The first boss slam of every boss fight** triggers a free Sanctuary. For that one cast, ignore the 25 s cooldown.
  - Keep the KO reaction.
  - Measured: Sanctuary shows in **53–59% of typist boss fights and 72–77% of idle and burst fights**. The rest end before the boss's 4th swing.
  - That's 4.5–7.3 casts per hour.
  - Depth at 8 h moves by ±2 floors, so it's balance-neutral.
  - Code: one `bossSlam` listener in `world.js` that stores the boss's uid.

### F5 [severity: minor] Wired but lying: Pell's card still shows a Spark cost, and the Cleric ultimate-turn code is unreachable
- Evidence:
  - **The card:** `ui.js` heroCard prints `⚡${Math.ceil(def.ult.cost * m.ultCost)} Sanctuary`, which reads "⚡40". The data's `cost: 40, cd: 12` are never used. Sanctuary is free, on a 25 s cooldown, and fires only from `W.sanctuaryReact`.
  - **The turn:** `W.passUlt` filters out the Cleric, and the turn holder excludes her. So `W.ultTurn` can never be `'cleric'`, and the `if (h.id === 'cleric') want = ...` branch in `W.update` is dead.
  - **The charge bar:** `render.js:446` never draws it under Pell. She's the only hero whose bar never appears, and nothing says why.
- Why it matters: players will wait for her to charge.
- Proposed fix:
  - Card line: "✚ Sanctuary (automatic): when a hero falls or the boss first slams, heals everyone and revives the fallen. 25 s cooldown."
  - Delete the dead branch.
  - Draw a small cooldown pip under Pell instead of a charge bar.

### F6 [severity: minor] Second Wind works but gives no feedback, and it does nothing for continuous typists
- Evidence (`sw_test.txt`):
  - **Light typists:** 216–226 triggers in 8 h, so 31–32% of all their Sparks come from it. Ultimates rise from 889–991 to 1,290–1,484 (+30–67%), and depth from 93–100 to 103–106.
  - **Burst typists:** 47% of their Sparks come from it, and ultimates rise +19–76%. Depth stays flat (90–93 vs 94).
  - **Harness typist and heavy profiles: 0 triggers.** Their pauses last 15–55 s, under the 60 s threshold. Yet the smart buyer still maxes it at level 10, which costs about **12,900 Embers** for nothing.
  - **No event is emitted when it triggers**, so the player never learns it fired.
- Why it matters: Second Wind is either invisible (light typists) or a trap (continuous typists).
- Proposed fix:
  - Lower the threshold from 60 s to **30 s**, so it triggers on ordinary pauses.
  - Emit `secondWind` when it triggers and show "SECOND WIND!" as floating text, plus a Spark-coloured flash on the HUD counter.
  - Change the tag from "NEEDS TYPING" to "FOR TYPISTS WHO PAUSE".

### F7 [severity: minor] The active omen can't be seen, and a pending omen offer is lost on reload
- Evidence:
  - **Where the omen shows:** `S.omen` is shown only inside the Legacy panel (`ui.js` legacyHTML). There's no HUD pill, and the strip itself never says which omen is active.
  - **Lost offers:** `UI.chooseOmen` opens only from the retire-confirm flow, 1.2 s after the retire.
    - `S.omenOffer` is saved, but `main.js` boot never reopens it.
    - So if the app is closed, crashes or reloads while the omen modal is up, the delve runs with no omen and the offer silently disappears.
    - The modal has no other way to close and nothing reopens it.
- Why it matters: omens are now the main mid-game content (F2). If you can't see it, it doesn't feel like content.
- Proposed fix:
  - On boot: `if (S.omenOffer) setTimeout(UI.chooseOmen, 1500)`.
  - Add a pill under the floor reusing the `#hud-demo` style: "◆ GILDED DELVE", with the omen's description in the tooltip.

### F8 [severity: minor] Leftovers from R3 that are still invisible
- **No Ember floaters:** there's still no float on boss kills (+10) or golden rats (+25). Rat text shows gold only, and idle players' Embers come almost entirely from those two.
- **Hidden stats:** `S.stats.chests` and `S.stats.wipes` are tracked but not shown in the stat box, and both are achievement counters in F3.
- **Spark cap:** "/150" was reached **0% of the time in all 14 runs**, again.
- **Hotkey Ring:** its free casts look exactly like paid ultimates. There's no "HOTKEY!" tag, even though 117–290 of them fire per 8 h for typists.
- **Demo best time:** it saturates at **4.0–4.3 min** after about 20 laps (typists, about 2 h). The time is limited by walking speed, so the demo's "score" stops moving. Show the lap count ("Floor 40 cleared x22") next to the best time so there's still something to push.

## Verified fixes from last round (pass/fail, one line each)
- **Demo re-delve loop: PASS.** The card comes at 0h26–0h31 (typist) and 1h18–1h28 (idle and burst). Each re-clear fires `demoSealed`: 21–22 toasts in 2.5 h for typists, 8–9 for idle and burst. The lap time drops from 10.1 to 4.0 min. The over-payout is a separate problem (F1).
- **Demo +6 Renown: PASS.** Every re-delve after a re-clear paid exactly +6, and the first retire after the card paid the record (+30).
- **Demo sealed toast: PASS.** It fires each re-clear with the run time and the best time.
- **`demoDone` persistence: PASS.** It's in `newState`, and the nudge waits for the card (code check).
- **The Hollow at floor 70: PASS.** 100% of floor-70 bosses were The Hollow: 92 of 92 across all profiles, r2 to r20. Hollowed variants rotate from floor 80: all 6 by 2h36–4h14 (typist), 12h29 (idle).
- **Ultimate turn no longer spins: PASS.**

  | Profile | Knight | Archer | Mage | R3 |
  |---|---|---|---|---|
  | Idle | 37–41% | 33–35% | **25–30%** | Mage 0% |
  | Typist | 35–36% | 33–34% | 30–31% | — |
  | Demo idle | 44% | 37% | 20% | — |

- **Sanctuary as a reaction: FAIL (visibility).** Typists get 0.6–0.9 casts per hour, in 1–2% of boss fights (F4).
- **Second Wind: PASS mechanically, FAIL for feedback.** Light and burst typists get 31–47% of their Sparks from it. Continuous typists get 0 triggers, and nothing is ever shown (F6).
- **Idle Battery 6% per rank: PASS.** At rank 3 the idle floor is x1.18, so FOCUSED (x1.25) keeps +5.9%.
- **Hotkey banking: PASS.**
  - Procs equalled free casts in every run (typist 117–290 per 8 h, heavy 139, burst 26).
  - 1–18 procs per run were banked and all were released.
  - 0 were lost to overflow.
- **Epic guarantee flag: PASS.** All 14 runs were offered an epic on the first floor-30 kill ever. That includes burst s1, which retired at the floor-30 wall and got the epic in run 2 (0h59).
- **Fame display: PASS.** The Legacy line uses `KK.mods().fame`: typist s1 lifetime 349 = x46.2, shown as "+4,520%". The retire button uses the same formula.
- **Head Start in the demo (max 2) and the honest description: PASS** (code).

## Ideas (optional, max 3)
1. **Depth trophies with a floor-100 finale beat** (F2): about 12 lines plus a data row. It's the cheapest way to fill hours 5–8, and it doubles as the trigger for 3 Steam achievements.
2. **Legacy tier 2 at week 2:**
   - Unlock 4 capped rows once every first-tier capped row is maxed (typists 6h40–8h22):
     - "Omen Seer": omen offers show 4.
     - "Deep Roots": Head Start +5 more floors, 2 ranks.
     - "Ember Pact": Embers x1.25 per rank, 4 ranks.
     - "Hollow Bounty": Hollowed bosses drop +1 relic choice.
   - Each uses existing mods fields except Omen Seer.
   - This gives the Renown that currently pours into the two uncapped +25% rows something to buy.
3. **Achievements as the hours-5–8 glue:** with the F3 set counted as beats, typists' longest gap after hour 1 drops to 55–91 min even without trophies, because time and counter achievements (keys, FLOW hours, chests, rats, omens) keep landing after progress stalls. Ship them with the Steam build, not later.
