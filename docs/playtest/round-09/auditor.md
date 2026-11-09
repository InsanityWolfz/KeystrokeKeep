# Round 09 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
Most of my R8 findings landed and measure well:
- Retiring on the sealed floor is now clean: 0 extra wipes, where R8 had 16–73.
- The Rat King summons in 25–100% of demo fights, up from 4–36%.
- The peek card no longer stacks on the Glimpse.
- All 21 achievement counters match their real triggers: 331 of 331 unlocks happened exactly at the goal.

Two things still hold the demo and the store page back:
1. **The Glimpse statue is right only at the card moment.** During the waves, the party walks through the statue. The statue then teleports up to 291 px ahead of it. After the card, the party walks 49–170 px past the statue during the 3 s hold.
2. **The store copy v2 quotes four numbers that are now wrong.**

For launch, the biggest gap is visual. After hour 8, **97% of play time is in the Hollow Void**. The last new sprite appears at 1.1 h for typists and 3.3 h for idle players.

I'd keep it running tomorrow. **8/10** (R8: 8). It's 8.5 once F1, F2 and F5 are in.

### Method
- **Code:** current `js/`; nothing in `js/` was edited.
- **Harness:** `docs/playtest/round-09/r9probe.js`. It is the R8 harness (`round-08/r8load.js`, which loads `js/fx.js` on sim time) plus R9 telemetry:
  - Glimpse geometry: statue, door and party x every frame; statue jumps; overlap; the 3 s hold; on-screen time at strip widths 640/960/1280.
  - The peek guard, both new and old.
  - Rat King summons per fight and per lap.
  - Every counter achievement: its `cur` at unlock, `cur > goal` without an unlock, `progress()` hiding a counter without unlocking it, and the NEXT line.
  - Coverage: bosses, monsters, relics and omens.
- **Runs** (`batch.sh`, output in `out/`), all with `--retire nudge --omen random`:
  - Demo, 3 h: 4 profiles × 6 seeds.
  - 8 h: 4 profiles × 4 seeds.
  - 40 h: typist, light and idle × 4 seeds.
- **Other scripts:**
  - `onsight.js`: a save already past each counter's goal.
  - `recruiter.js`: what Recruiter buys.
  - `biometime.js`: time share per biome over 40 h.
  - `round-08/r8edge.js` re-run.
  - `tools/playtest.js`: the idle demo gate (seeds 1–5) and 8 h typist/idle/burst runs.

## Findings (ranked, max 8)

### F1 [severity: major] Glimpse staging: the party still walks through the statue, before and after the card
- **Evidence:** `r9probe --demo`, 24/24 runs.
  - The statue appears at party +329 px at +0.5 s.
  - During the two waves, the party gets to within 5 px of it or walks up to **162 px past it** in 14/24 runs, overlapping it for **1.1–6.0 s**.
  - When the door spawns (`world.js:369`, `sealedX = max(sealedX, door.x + 44)`), the statue **teleports 15–291 px forward** (median ≈ 150).
  - **At the card moment it's right (23/23):**
    - The strip freezes (`ui.js` `KK.paused` on demoComplete).
    - The statue is 44 px beyond the door and 129 px ahead of the party.
    - The "SEALED: THE EMBER COLOSSUS WAITS…" alert fires there.
  - **After KEEP DELVING it breaks again.** The 3 s `glimpseHold` only delays the transition; `walkParty` in the door branch has no `stopAt`.
    - The party walks **93–214 px past the door** and 49–170 px past the statue before the fade.
    - Typists are worst, because they walk fastest.
- **Why it matters:** this is the demo's wishlist moment and store shot g5. It reads "the heroes walked through a ghost", then "the ghost jumped". A streamer clip of the climax looks like a bug.
- **Proposed fix (world.js, 3 lines; the statue stays put and the party never passes it):**
  1. **spawnWave**, glimpse branch: keep `if (!W.sealedX) W.sealedX = W.partyX + 330`. Spawn the enemies in front of the statue:
     ```js
     const gx = Math.min(x0, W.sealedX - 50); makeEnemy(…, gx + i * 12, …)
     ```
  2. **Door:**
     ```js
     W.door = { x: S.glimpse ? Math.max(W.partyX + 24, W.sealedX - 44) : W.partyX + 85, t: 0 };
     ```
     Delete the `sealedX = max(…)` bump.
  3. **Door branch:**
     ```js
     walkParty(dt, speedMult, false, KK.S.glimpse ? W.door.x - 4 : undefined);
     ```
     The party then waits at the door with the statue 48 px ahead for the whole hold.
  - **Optional:** `W.recover` sets `W.sealedX = 0` when `!S.glimpse || S.floor <= KK.DEMO_CAP`. After a glimpse-floor wipe the statue is still drawn on floor 40. It wasn't reached in 24 runs (0 KOs).

### F2 [severity: major] The Rat King still skips his move on 57–75% of typist demo laps (one-shot kills from above 60%)
- **Evidence:** share of Rat King fights with Royal Summons, demo 3 h:

  | Profile | R9 | R8 |
  |---|---|---|
  | Typist | **25–43%** | 4–9% |
  | Light | 56–94% | 6–18% |
  | Burst | 92–100% | 8–23% |
  | Idle | 100% | 20–36% |

  - **Typist kills take a median 1.8 s.** The killing blow is usually an ultimate landing in `updateShots`, which runs after `updateEnemies`/`sigMove`. So a boss at 60–100% HP dies without `sigMove` ever seeing `frac < 0.6`.
  - **Side effect:** when the HP route fires stage 0, stage 1 is also due on the next frame. That makes 2 waves (4 rats) in one moment in 2–4 fights per typist run, leaving no room at 30% (max 4 alive).
- **Why it matters:** typists are the target audience and the demo laps are the content loop. "A big rat that dies" is the shallow-boss review line R7 and R8 were built to avoid.
- **Proposed fix:**
  - **`W.damageEnemy`**, before `e.hp -= dmg`, so he always calls his court once:
    ```js
    if (e.key === 'ratking' && !(e.summonStage >= 1)) dmg = Math.min(dmg, Math.max(0, e.hp - e.maxHp * 0.55));
    ```
  - **sigMove:** when stage 0 fires via HP, `e.summonStage = 2`, so the 60% wave isn't doubled.

### F3 [severity: major, store] Store copy v2 (round-07/market.md) quotes numbers that are now wrong
- **Wrong today:**

  | Copy v2 says | Truth at HEAD | Source |
  |---|---|---|
  | "36 achievements" | **39** (5 in the demo; 21 with progress counters) | achievements.js LIST |
  | "14 depth trophies" | **19** (floors 75–130 every 5, then 140–200 every 10) | data.js TROPHIES |
  | "FLOW STATE (up to x2.2 power)" | the HUD shows **x2.53** (2.2 × the R8 +5%-per-tier bonus); **x3.68** with the Flow Pendant | state.js powerMult |
  | "Hollowed bosses beyond it" (floor 100) / "Past floor 100 the bosses return Hollowed" | **The Hollow from floor 70; Hollowed bosses from floor 80**, before the Heart; the Codex starts at 70 | state.js bossFor, world.js:89 |

- **True but missing from the copy:** the week-2 layer, the demo's Glimpse, and counters.
  - **Week-2 layer:** Omen of the Day plus Seals of the Day (+10 + record/10 Renown, 7- and 30-Seal achievements).
  - **Demo Glimpse:** the demo now ends on one sealed Magma floor with the stone Ember Colossus.
  - **Counters:** "progress shown for 21 of them".
- **Corrected lines:**
  - **Bullet 6:** "**Deeper than it looks.** Four biomes and endless floors: The Hollow on floor 70, six Hollowed bosses from floor 80, the Heart of the Keep on floor 100, a 28-rank Hollow Codex, 19 depth trophies to floor 200 and 39 achievements (progress shown for 21). [after Steamworks: Steam achievements]"
  - **Bullet 2:** "…into FLOW STATE (x2.5 power)."
  - **New bullet:** "**A reason to look every day.** One starred Omen of the Day; reach its floor for a Seal and bonus Renown."
  - **Long description, RETIRE section:** "From floor 80 the old bosses return Hollowed, and the Hollow Codex rewards every one you put down."
  - **Demo section:** "The free demo covers floors 1–40 (the Crypt and the Mossy Caverns, four bosses, five achievements) and ends with a glimpse of the sealed Magma Depths."
- **Still true:** 4 heroes, 7 bosses, 6 signature moves (+ the void slam), 17 relics, 10 omens, 4 biomes, a Forge and a Workshop, offline up to 12 h, Ctrl+Shift+Alt+K (electron/main.js:24).
- **Honesty caveat for screenshots:** the 7 bosses are 1.5–2x recolours of their biome's monsters (sprites.js:496–504), and Magma Slime and Void Knight are recolours too. Don't put a boss and its base monster side by side in one store shot. The Heart of the Keep is The Hollow with +50% HP and a new name.
- **Why it matters:** wrong counts on a store page are the "lies about content" review. Undercounting (36 vs 39, 14 vs 19) is free marketing left on the table.

### F4 [severity: major, launch] Biggest content hole: after hour 8, 97% of play is in one biome with 3 monsters
- **Evidence:**
  - **Time share per biome** (`biometime.js`, 40 h, seed 1):

    | Profile | Hollow Void, first 8 h | Hollow Void, after hour 8 |
    |---|---|---|
    | Typist | 80% | **97.2%** |
    | Light | 72% | **97.5%** |
    | Idle | 56% | **97.4%** |

    The remaining ~2.5% is the Magma floors each Head-Start delve passes through.
  - **The last new sprite** (The Hollow) arrives at typist 1.05–1.13 h, light 1.84–2.22 h, idle 2.92–3.33 h.
  - **After that it's only tints and renames:** Hollowed (purple tint) through typist 2.5 h, light 4.9 h, idle 7.5 h; then the Heart at typist 2.0–3.3 h, light 5.0–5.4 h, idle 7.7–11.7 h.
  - **Floors 61 → 190+** use the same palette and the same eye, wraith and Void Knight.
  - **The Codex completes at 31.8–33.4 h for typists.** After it, the 40 h typist runs have their longest gap of 282–436 min, with 4–6 empty 2-hour windows out of 17. Only f190/f200 trophies and one Seal a day remain.
- **Why it matters:** this is "content runs out in 3 hours" for a $4.99 idle game. A typist sees every unique visual by 1.1 h. Review time (2–10 h) is spent entirely in the Void.
- **Scoped plan: Biome 5, "The Heartroot", floors 101–150, plus "Echoed Depths" from 151.**
  - **Timing:** the band lands right after the Heart.
    - Typist: 2.0–2.7 h, staying until about 13.5 h (f150 at 13.2–13.8 h).
    - Light: 4.1–4.5 h, staying until 22–26 h.
    - Idle: 7.7–10.6 h (f130 at 26–31 h).
    - It fills exactly the window with no new visuals.
  - **Data:** a `BIOMES` entry `{ id: 'root', from: 101 }`. `biomeOf` already handles it. `bossFor` floors 61–100 keep the Void.
  - **3 monsters, each reusing an existing code path:**
    - **Root Lasher:** ranged; its hit roots the front hero for 1.5 s. This is the web path; keys tear it.
    - **Spore Bloat:** splits into 2 x0.35-HP sporelings on death. This is the summon path.
    - **Heart Warden:** front guard taking x0.5 from normal hits until an ultimate lands. This is the shell path.
  - **2 new bosses with signature moves** on f120 and f140 (and f160, f180… in the echo band):
    - **The Rootmother:** "Overgrowth" roots the whole line for 2 s unless you type; keys tear it.
    - **The Keeper:** "Lockdown" seals one hero's ultimate for 6 s.
    - f110, f130 and f150 stay Hollowed.
    - Let both count for the Codex: `e.hollowed || key === 'hollow' || biome root boss`. Codex completion then stays at about 32 h.
  - **Echoed Depths (f151+, zero new art):**
    - Every 10 floors, cycle the four old palettes and monster sets, tinted with `hollowTint`, at Void stats.
    - Every 10 floors past 150 a different biome comes back, so hours 13–40 stop being one colour.
  - **Extras:**
    - 3 relics: 1 per rarity, e.g. an epic "Root Ward": the first root or web each fight is ignored.
    - 4 achievements: reach the Heartroot, defeat each new boss, reach f175 in the Echoed Depths.
    - 1 trophy art pass.
  - **Cost estimate:**
    - Art: 3 monsters × 2 frames, 2 bosses × 2 frames (unique, not upscaled), 1 palette + 1 root prop, 3 relic icons. About 3–4 artist days at 8–16 px.
    - Code: about 2 days, because all three mechanics exist.
    - Balance pass: about 1 day with `r9probe` at 8 h and 40 h.
  - **Store copy after it:** 5 biomes (+ the Echoed Depths), 15 monsters, 9 bosses, 8 signature moves, 20 relics, 43 achievements.
  - **Watch out:**
    - Augur's desc says "all ten omens", while its goal is `D.OMENS.length`. If omens are added, update the text.
    - `TROPHIES` needs no change.
    - Hollowed boss frequency in 101–150 drops from 5 to 3 per 50 floors. `hollowed6` is unaffected, since all six still cycle.

### F5 [severity: minor] The demo silently earns 4–10 full-game achievements and shows them as locked
- **Evidence:** demo 3 h, 24 runs. Beyond the 5 demo achievements, players earned:

  | Profile | Full-game achievements earned |
  |---|---|
  | Typist | **9–10** (rat, caverns, epic, echo, ult_boss, keys10k, chests100, flow1h, blitz…) |
  | Light | 5–8 |
  | Burst | 5–7 |
  | Idle | 4–6 |

  - They are stored in `S.ach`. The toast is suppressed (ui.js `KK.DEMO_CAP && !def.demo`).
  - `achHTML` draws every non-demo row as greyed "FULL GAME", earned or not.
- **Why it matters:** "you've already earned 9 more achievements; they unlock in the full game" is a free wishlist hook, and today it's invisible.
- **Proposed fix:**
  - **achHTML locked row:**
    ```js
    `<i class="new">${got[a.id] ? '✓ EARNED · UNLOCKS IN THE FULL GAME' : 'FULL GAME'}</i>`
    ```
  - **Summary:** "(+34 more in the full game, 9 already earned)".
  - **DEMO COMPLETE card**, one line: "You've already earned N full-game achievements; they unlock when you start the full game." The import already grants them.

### F6 [severity: minor] Counters: the Heart counter vanishes at the wall; 6 counters don't unlock on sight
- **Evidence:**
  - **The Heart counter vanishes at the wall:**
    - `f100` uses `cur = min(maxFloorEver, 100)`, and `A.progress` returns null at 100 without unlocking (special case).
    - So the "Heart of the Keep" counter **disappears for 27–204 min** exactly while the player is stuck at the Heart: typist 27–42, light 43–52, burst 41–84, idle 63–204 (28/30 runs).
    - It's absent from NEXT too.
  - **`onsight.js`** (a save already past each goal, then `progress()` as the Legacy panel calls it): **15/21 unlock**.
    - blitz, hollowed6, omen10, deep90 and lv100 don't, because their `test` needs the event object (`c.ev.e` / `c.ev.to`).
    - Only lv100 is reachable in play: Veteran Recruits 10 means heroes join at L101+ without a levelUp. It unlocks at the next level-up, which is seconds later.
  - **lv100 is per delve:** its counter goes down after each retire (1–3 times per run), by design. Consider "best this delve" in the label.
- **Proposed fix:**
  - **f100:** `cur: (S) => Math.min(S.maxFloorEver, 99)`, and drop the `def.id !== 'f100'` special case. It reads "99/100" while the Heart stands, and NEXT points at it.
  - **`A.progress`:** when `cur >= def.goal`, call `A.unlock(def.id)` directly rather than `check(def)`. The counters matched the triggers in 331/331 unlocks, so the counter is safe to trust.
  - **Cosmetic:** live refresh updates only rows that had a bar at render. A counter crossing `from` (f100 at 61, f125/f150 at 100, lv100 at 30, deep90 at 40) appears only after the panel re-renders.

### F7 [severity: minor] Weak or invisible: Recruiter, the Lantern's NEW chip, the Echo cue
- **Recruiter** (8 Renown, -75% recruit cost) saves **0–60 s per delve** (`recruiter.js`, 3 seeds; time to the full party):

  | Legacy state | Typist, without → with | Idle, without → with |
  |---|---|---|
  | HS0 VR0 | 3.0–3.3 min → 2.7–3.0 | 5.0 → 4.0–4.3 |
  | HS2 VR3 | 1.3–1.7 → 1.3 | about the same |
  | HS4 VR5 | 0.3–0.7 → 0.3 | about the same |

  - The same 8 Renown in Heroic Lineage is +25% damage forever.
  - `tools/playtest.js` idle 8 h: Recruiter **NEVER bought** (so is Relic Collector).
  - It exists only to complete Hall of Legends.
  - **Fix:** "Recruiter: every hero you have recruited before rejoins at the start of each delve" (cost 8). Recruit costs stay for first-time recruits.
- **Void Lantern:**
  - The toast and NEW chip work (PASS), but **NEW stays until the first level is bought**.
  - Idle players reach f70 at about 2.6 h and buy L1 at 16.8–19.7 h, so the chip shows for about 14–17 h of play.
  - **Fix:** clear it when the Workshop tab is first opened after f70 (`S.tutorial.lanternSeen`).
  - Lantern pacing is much better than in R8:

    | Profile | L1 R9 | L1 R8 | L5 R9 |
    |---|---|---|---|
    | Typist | 2.2–2.7 h | 5.9–7.1 h | 10.3–11.3 h |
    | Light | 4.4–5.3 h | 10.5–12.6 h | 18.1–20.0 h |
    | Idle | 16.8–19.7 h | never | — |

- **Echo Rune:** R8 removed the empty `echo` listener, but the suggested cue wasn't added. The `echo` event still only feeds the achievement, so the epic relic's second cast has no "ECHO!" text.
  - **Fix (fx.js):**
    ```js
    KK.on('echo', ({ h }) => FX.text(h.x, h.y - 26, 'ECHO!', '#c472ff', 1, { life: 1 }))
    ```

### F8 [severity: minor] Wired-but-dead leftovers
- **Emitted, no listener:**
  - `glimpse`: harmless; the biome banner covers it.
  - `swing` and `fizzle`: harmless.
- **Listened to, never emitted:** none. `meteorLand`/`skyarrowLand` come from a ternary emit.
- **`state.js` comment** above `starOmen` says "reaching (record - 15)", but `sealFloor` is record − 5. The comment is stale.
- **`A.retire` doesn't check `canRetire`:** `UI.confirmRetire` → yes calls `A.retire()` directly. A confirm modal opened before the floor-40 boss falls can still retire during the Glimpse.
  - This is now **clean:** 0 extra wipes; the card shows once (burst s4, unscripted, plus r8edge 3/3).
  - **Optional:** `if (!A.canRetire()) return false` at the top of `A.retire`, if the lead prefers the button rule to be absolute.
- **`demoComplete` from a retire** opens the card at +900 ms. The retire banner, the "Spend your Renown" toast and `UI.open('legacy')` all land in the same second. Rare, cosmetic.

## Verified fixes from last round (pass/fail, one line each)
- **Glimpse retire safety: PASS.**
  - `canRetire` is false on the sealed floor.
  - A forced retire clears the glimpse, sets demoDone and shows 1 card. The next delve has **0 extra wipes** (r8edge seeds 1–3, 15 min each; R8: 16–73). It reaches floor 38–39 normally.
  - An unscripted retire mid-glimpse (demo burst s4) was also clean.
- **Statue/door staging: PARTIAL.**
  - At the card: PASS in 23/23. The statue is 44 px beyond the door, the party 129 px short, and the strip is frozen.
  - During the waves and the hold: FAIL in 24/24 (F1).
- **Peek guard: PASS.**
  - `!glimpseDone && maxFloorRun < 36` suppressed the 40-min card in the 2 runs that were 1–4 floors from the Glimpse (light s2 at f39, s5 at f36).
  - It still fires at 40:00 in 16/18 idle/burst/light runs, at f14–34.
  - Typists glimpse at 28.6–32.2 min and never get the peek.
- **Rat King HP summons through the gate: PASS** (typist 25–43%, light 56–94%, burst 92–100%, idle 100%; R8: 4–36%). Only 0–2 waves fired under a banner. Typists still lose most laps (F2).
- **Boss-bar label clamp: PASS (code).** Centre is `min(bx+bw/2, Wd-3-lw/2)`. The worst label, "THE HOLLOWED GOBLIN WARLORD (WOUNDED) - CHARGING" (48 chars, 191 px), ends at Wd−2 and starts at ≥126 px for Wd ≥ 320.
- **Lantern toast, NEW chip and badge: PASS (code).**
  - One toast on the first floor ≥ 70 event in the full game.
  - The NEW chip shows until bought (F7).
  - `wsAff` now honours `minFloor`.
- **Dead-code removal: PASS.** Removed or fixed: `UI.offlineModal`, `tooBig`/`data-lock`, the `runInputs` no-op, `CODEX_RANKS`, the empty echo listener, the cleric cooldown (now from data), the Web Shot text ("TYPE TO TEAR IT"), the re-delve modal omen line, and the duplicate Codex line in the retire box. **Not done:** the Echo cue (F7).
- **Fire Below not on the Glimpse: PASS** (0/24 demo runs; the test is `floor >= 41 && !S.glimpse`).
- **Esc/backdrop leaves `UI.demoOpen` stuck: PASS** (code). `UI.modal`'s close resets it on every path.
- **Progress counters: PASS with one hole.**
  - 21 counters.
  - 331 counter unlocks across 54 runs, **all at cur == goal**; for example keys10k at 10000–10006/10000 and flow1h at 3600.1–3601.5 s.
  - 0 counters ever exceeded their goal without unlocking.
  - Old saves past a goal unlock on sight for 15/21; lv100 is the only reachable miss (F6).
  - NEXT works, e.g. "Treasure Hunter 84/100", "Abyss Walker 102/125", "Dynasty 9/10".
  - **The hole:** the f100 counter hides at the Heart wall (F6).
- **Pacing sanity: PASS.**
  - 8 h max floor:

    | Profile | R9 | R8 |
    |---|---|---|
    | Typist | 130–133 | 120–125 |
    | Light | 110–116 | 110 |
    | Burst | 100–106 | 100–109 |
    | Idle | 97–100 | 94–100 |

    The typist gain is the R8 +5%-per-tier Fervor change.
  - Idle demo hour-1 gate (`tools/playtest.js --demo`): wipes 2/1/2/4/0, unchanged.
  - 40 h: typists finish the Codex at 31.8–33.4 h and reach f190 at 33.4–39.5 h.

## Content inventory (for the Steam page; exact counts at HEAD)

| What | Count | List |
|---|---|---|
| **Heroes** | 4 (4 ultimates) | Sir Clank (Knight, Earthshatter), Wren (Archer, Arrow Storm), Mortimer (Mage, Meteor), Sister Pell (Cleric, Sanctuary: free, reactive) |
| **Monsters** | 12 (+ golden rat, summoned rats) | Crypt: Cellar Rat, Crypt Bat, Skeleton. Caverns: Moss Slime, Cave Spider, Goblin. Magma: Fire Imp, Rock Golem, Magma Slime. Void: Watcher, Wraith, Void Knight |
| **Bosses** | 7 unique | The Rat King (f10), The Bone King (f20), Brood Mother (f30), Goblin Warlord (f40), Ember Colossus (f50), Magma Lord (f60), The Hollow (f70) |
| **Boss encounters** | **14** | the 7 above + 6 Hollowed (Rat King, Bone King, Brood Mother, Goblin Warlord, Ember Colossus, Magma Lord; cycling from f80) + The Heart of the Keep (f100; The Hollow, +50% HP) |
| **Signature moves** | 6 + Void Slam | Royal Summons, Reassemble, Web Shot, War Charge, Magma Shell, Lava Rain; Void Slam on The Hollow, the Heart and every Hollowed boss (who also keep their own move) |
| **Biomes** | 4 | The Crypt (1–20), Mossy Caverns (21–40), Magma Depths (41–60), The Hollow Void (61–∞) |
| **Floors** | endless | bosses every 10; trophies to 200 |
| **Relics** | 17 | 6 common (Whetstone, Lucky Coin, Spacebar Shield, Backspace Boots, Bottomless Coffee, Giant's Belt), 7 rare (Clacky Keycap, Caps Lock Crown, Enter Amulet, Vampire Fang, Midnight Oil, Treasure Map, Critic's Lens), 4 epic (Echo Rune, Glass Cannon, Flow Pendant, Hotkey Ring) |
| **Delve Omens** | 10 | Gilded Delve, Glass Delve, Storm Front, Quiet Halls, Treasure Fever, Ember Tide, Forced March, Relic Hoard, Veterans' Muster, Deep Omen (from the 2nd retire; full game only); + 1 starred Omen of the Day |
| **Forge (gold)** | 5 | Sharpen Blades, Rivet Armor, Gilded Purse, Swift Boots, Keen Edge |
| **Workshop (Embers)** | 6 | Ember Crucible, Overcharge, Second Wind, Void Lantern (from f70), Dynamo, Static Coins |
| **Legacy (Renown)** | 10 | Heroic Lineage, Royal Treasury, Quartermaster, Veteran Recruits, Head Start, Zealous Spirit, Recruiter, Warm Campfire, Idle Battery, Relic Collector (8 capped) |
| **Upgrades total** | 21 | |
| **Achievements** | 39 | 5 in the demo; 21 with progress counters |
| **Depth trophies** | 19 | f75, 80 … 130 (every 5), 140 … 200 (every 10); x1.05 each |
| **Hollow Codex** | 28 ranks | 1 per 8 kills of The Hollow/Hollowed; x1.03 each |
| **Fervor tiers** | 4 | Idle, Focused, In the Zone, FLOW STATE (x2.53 on the HUD) |
| **Daily** | — | Omen of the Day → Seal of the Day (+10 + record/10 Renown); Faithful (7), Devout (30) |
| **Events** | — | golden rat (every 3–6 min), treasure chests, Second Wind, Sanctuary revives |
| **Demo** | — | floors 1–40, 2 biomes, 4 bosses, 5 achievements, the sealed Magma Glimpse, best-time laps (+6 Renown, cap 120), save carries over |

**First seen, 8 h runs** (typist / light / idle):
- **Magma Depths:** 0.56–0.61 / 0.86–1.17 / 1.41–1.85 h.
- **Hollow Void:** 0.97–1.04 / 1.41–1.78 / 2.25–2.65 h.
- **The Hollow:** 1.05–1.13 / 1.84–2.22 / 2.92–3.33 h.
- **All 6 Hollowed:** 2.5 / 4.9 h for typist / light. Idle sees 3–5 of 6 in 8 h; the Hollowed Warlord never appears in 8 h.
- **Heart:** 2.8–3.3 / 5.0–5.4 h for typist / light; 0/4 idle runs in 8 h (7.7–11.7 h in the 40 h runs).
- **Never seen in 8 h:** 0 monsters for any profile.

**Relics:** all 17 are offered in every 8 h run. **Omens:** all 10 are picked by 40 h in 10 of the 12 runs; Augur came at 12.5–35.3 h.

## Ideas (optional, max 3)
1. **Echoed Depths for f151+** (zero art, F4 part 2):
   - Rotate the four old biomes' palettes and monster sets every 10 floors, tinted with `hollowTint`, at Void stats.
   - The banner reads "ECHO OF THE CRYPT".
   - It's the cheapest possible fix for "97% of hours 8–40 in one palette" and could ship before the Heartroot.
2. **Make the sealed statue clickable** (round-08/market.md idea 3) and show "✓ 9 achievements already earned" on the DEMO COMPLETE card (F5). Together they turn the demo's climax into the wishlist ask.
3. **NEXT achievement as the Legacy button tooltip**, e.g. "NEXT: Heart of the Keep 99/100" (with F6). The nearest goal is then one hover away in week 2.

---
Scripts: `docs/playtest/round-09/r9probe.js`, `batch.sh`, `onsight.js`, `recruiter.js`, `biometime.js`; raw output in `docs/playtest/round-09/out/`.
