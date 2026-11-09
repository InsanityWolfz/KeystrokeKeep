# Round 10 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
The Heartroot works. Hours 8–40 are no longer one colour:

| Profile | Share of hours 8–40 in the Heartroot | Other palettes after hour 8 |
|---|---|---|
| Typist | 29–35% | four echo palettes |
| Light | 53–63% | |
| Idle | 80–84% | Void 13–16% |

Before this commit, all three profiles spent 96–98% of those hours in the Void.

New art now arrives at these times:

| Profile | Root Lasher | The Keeper |
|---|---|---|
| Typist | 2.6–3.2 h | 9.9–10.7 h |
| Light | 4.1–5.7 h | 14.7–17.2 h |
| Idle | 9.1–9.6 h | 29–35 h |

Before, the last new sprite came at 1.0–2.7 h.

Two of the new mechanics don't pull their weight:
- **Lockdown changes nothing.** The sealed hero couldn't afford its ultimate anyway in 82–99% of casts.
- **The Heart Warden's guard mostly ends silently** on its timer. When an ultimate breaks it instead, the Warden usually dies in the same hit.

There is also one rotation bug. From day 5 on, the Hollowed Rat King, Brood Mother and Ember Colossus only ever appear on floor 80.

Idle players still spend 81% of hours 8–40 in one biome. They never reach floor 151 in 40 h.

I'd keep it running tomorrow. **8.5/10** (R9: 8).

### Method
- **Code:** `git show 51310be`, plus a read of world.js, state.js, render.js, fx.js, ui.js and achievements.js. Nothing in `js/` was edited.
- **Harness:** `docs/playtest/round-10/r10probe.js`. It is the R9 harness (round-06/r6lib + round-08/r8load, so fx.js runs on sim time) with new telemetry:
  - biome time share, banners, and first sightings (plain, echo-tinted and Hollowed);
  - for each Warden, how its guard ended;
  - for each Sporeling, how long it lived;
  - for each root and Overgrowth, what released it;
  - for each Lockdown, the frame before (Sparks against the ultimate's cost, cooldown) and the ultimates cast in the 6 s before and after;
  - Root Ward calls and blocks;
  - the boss on each floor;
  - Codex progress.
- **"Before" runs:** the same probe with `KK_SRC=old_js`, which is `git show 51310be^:js/*`.
- **Runs:** `batch.sh` and `batch2.sh`, all with `--retire nudge --omen random`:
  - 8 h: 4 profiles × 4 seeds.
  - 40 h: typist, light and idle × 4 seeds, for both the new and the old code.
  - Demo, 3 h: typist and idle × 2 seeds.
  - 80 h: typist seed 1.
- **Harness bug, fixed for batch 2:** the headless sim never calls `KK.dayTick` (main.js does), so `daysPlayed` stayed at 1 and the Hollowed pool stayed at Rat King and Bone King.
  - Batch 2 (`d40_*` new, `do40_*` old, 2 seeds) ticks it, at one day per 8 h of play.
  - Biome share and new-content timings match between the two batches.
- **Other scripts:** `counts.js` (content counts from the code, plus `bossFor` for every floor, day and retire count), and `agg10.js` / `tab10.js` (aggregators).

## Findings (ranked, max 8)

### F1 [severity: major] The Keeper's Lockdown does nothing you can measure
- **Evidence:** The code is `world.js:545-551`. It sets the turn-holder's `ultCd` to 6 and `locked` to 6.
  - The rotation at `world.js:412` reads `if (h.ultCd > 0) W.passUlt()`, so the next frame simply hands the turn to the next hero.
  - The heroes are almost always waiting on Sparks, not on cooldowns. Passing the turn doesn't change what the party can cast.
- **Lockdown telemetry, 40 h:**

  | Profile | Lockdowns | Sealed hero's Sparks below its cost | Ultimates in the 6 s after vs before (median) | Windows with no ultimate after |
  |---|---|---|---|---|
  | Idle s1 / s2 | 216 / 248 | 215 / 246 | 0 vs 0 | 210/216, 241/248 |
  | Light s1 | 153 | 141 | 0 vs 0 | — |
  | Typist s1 / s2 | 243 / 265 | 199 / 230 | 1 vs 1 | — |

  - Only 0–2 of the sealed heroes already had a cooldown of 6 s or more.
  - Keeper fights see 10.0–10.4 ultimates per minute for typists, the same as Hollowed fights at the same depth (7.4–10.4).
  - The Keeper beats idle parties (4–5 kills in 14–16 fights), but on raw HP, not on Lockdown.
- **What the player sees:** "LOCKDOWN! WREN'S ULTIMATE IS SEALED" and a padlock. Nothing changes.
  - Players learn to ignore a boss's signature move. That undercuts the "8 signature moves" line on the store page.
- **Proposed fix:** make Lockdown hold the whole rotation and be breakable by typing. That matches the other moves ("type to …").
  - `W.ultGap = Math.max(W.ultGap, 5)`. No ultimate goes off for 5 s, so a banked FLOW burst is actually stopped.
  - The sealed hero also stops attacking, like a root: `h.webbed = Math.max(h.webbed, 3); h.webKind = 'lock'`. Each keystroke takes 0.5 s off, as with webs.
  - This works for idle parties too: one hero is silenced for 3 s every 10 s.
  - Alert text: "LOCKDOWN! TYPE TO BREAK THE SEAL".
  - **Check:** the Keeper's idle kill rate (already only 4/14) may need its HP multiplier from 1.4 to 1.3.

### F2 [severity: major] Hollowed rotation: from day 5, floors 110+ only ever show 3 of the 6 Hollowed bosses
- **Evidence:** `state.js:82` sets the slot to `Math.floor((f - 80) / 10) + 2 * retires`, taken mod the pool size.
  - 51310be took floors 120, 140, 160 and so on for the root bosses. Every remaining Hollowed floor from 110 up (110, 130, 150, 170, …) now has an **odd** slot: 3, 5, 7, 9…
  - Adding `2 * retires` keeps it odd, and so does any pool size of 2, 4 or 6.
- **`counts.js`, over 6 retires on floors 80–300:**

  | Day | Pool | What appears |
  |---|---|---|
  | 1 | 2 | Every floor from 110 up is the Hollowed Bone King (60/60) |
  | 5+ (permanent) | 6 | Bone King, Warlord and Magma Lord 22 each; Rat King, Brood Mother and Ember Colossus 2 each, and only on floor 80 |

  - Before 51310be, floors 120 and 140 supplied the even slots.
  - The 40 h runs end on day 5, so first sightings and Echoes of the Deep (`hollowed6`, about 32 h) are unchanged. The damage is weeks 2+, exactly where the variety is needed.
- **Proposed fix:** count the Hollowed boss floors, not raw floors. With 70 and 100 being the Hollow and the root floors skipped:
  ```js
  const slot = f < 110 ? (f - 80) / 10 : 2 + (f - 110) / 20;
  return pool[(slot + 2 * (KK.S.retires || 0)) % pool.length];
  ```
  - With the even pool sizes, also consider `+ (KK.S.retires || 0)` rather than `+ 2 * retires`. That stops the shift from preserving parity.

### F3 [severity: major, store] Store copy v3 and in-game copy: corrected numbers
- **From the code** (`counts.js`):

  | What | v2 / R9 says | Truth at 51310be |
  |---|---|---|
  | Biomes | 4 | **5** (Crypt, Mossy Caverns, Magma Depths, Hollow Void, Heartroot from f101), **plus the Echoed Depths** (f151+: each 10-floor band brings back one of the five, hollow-tinted, in a cycle) |
  | Monsters | 12 | **16** (3 per biome + the Sporeling) + golden rat |
  | Bosses | 7 | **9 unique** (+ The Rootmother, The Keeper); **16 boss encounters** (9 + 6 Hollowed + the Heart of the Keep) |
  | Signature moves | 6 + Void Slam | **8 + Void Slam** (+ Overgrowth, Lockdown; see F1 before advertising Lockdown) |
  | Relics | 17 | **18** (6 common, 7 rare, 5 epic) |
  | Achievements | 39 | **43** (5 in the demo; **22** with progress counters) |
  | Depth trophies | 19 to f200 | **39** (f75–130 every 5, f140–200 every 10, f205–300 every 5) |
  | Hollow Codex | 28 ranks | **40 ranks** (8 kills per rank to 28, then 16); the Rootmother and the Keeper count too |
  | Unchanged | | 4 heroes, 10 omens, 21 upgrades (5 Forge, 6 Workshop, 10 Legacy) |

- **Corrected bullet:** "**Deeper than it looks.** Five biomes and the endless Echoed Depths: The Hollow on floor 70, six Hollowed bosses from floor 80, the Heart of the Keep on floor 100, then the Heartroot with the Rootmother and the Keeper. A 40-rank Codex, 39 depth trophies to floor 300 and 43 achievements (progress shown for 22)."
- **Honesty for shots:**
  - **The Keeper is the first fully unique boss sprite.** Use it in the store shots.
  - The Rootmother is the Root Lasher at 2× with a recolour (sprites.js:602). Don't show the two side by side.
  - The other 7 bosses are recolours, as in R9.
- **Stale copy inside the game (ui.js):**
  - **:565, the demo card upsell:** "The Magma Depths and The Hollow Void, 3 new bosses, 6 Hollowed returns, the Heart of the Keep, 60+ more floors…"
    - Replace with: "The Magma Depths, the Hollow Void and the Heartroot, 5 new bosses, 6 Hollowed returns, the Heart of the Keep, the endless Echoed Depths, Delve Omens, the Codex and 43 achievements…"
  - **:325, demo Codex text:** "(28 ranks)" should be **40**, and "Hollowed boss kills" should be "Hollow, Hollowed and Heartroot boss kills".
  - **:329, real bug since R9:** "next rank in `CODEX_EVERY - kills % 8`". Past rank 28 a rank costs 16 kills, so it's wrong.
    - Example: at 230 kills the UI says 2; the truth is 10.
    - Use the cumulative target: `next = ck < 224 ? 8 - ck % 8 : 16 - (ck - 224) % 16`.
  - **:597, the toast:** "Next rank in 8 Hollowed kills". The same 16-kill fix is needed.
  - **"Hollow Codex" / "Hollowed kills"** now also counts the Rootmother and the Keeper. Consider just "the Codex" or "boss kills below floor 70".

### F4 [severity: major] Biome time share: fixed for typists, half-fixed for light, moved rather than fixed for idle
- **Evidence:** share of hours 8–40, run by run. Batch 2 is the `d40_*` and `do40_*` runs, with days ticking.

  | Profile | Before (old_js) | After (HEAD) |
  |---|---|---|
  | Typist | Void 96–97% | Heartroot 28–35%; palettes after 8 h: root 28–38, void 17–28, magma 17–32, + crypt/caverns |
  | Light | Void 97–98% | Heartroot 53–63%; Echoed Crypt/Caverns 11–19% each |
  | Idle | Void 97% | **Heartroot 80–84%**, Void 13–16% |

  - **Idle never reaches f151 in 40 h.** maxEver is 144–149, where the old code gave 147–154. The Heartroot step costs idle players their f150 achievement: old 37.5 h in 2/4 runs, new 0/6.
  - **First echo band** (Echoed Crypt): typist 13.1–15.3 h, light 21.4–26.0 h, idle never.
  - **Last new visual** (counting echo-tinted bands as new): typist 30.8–39.4 h, light 32.7–37.6 h, idle 29–35 h (the Keeper). Old: 1.0–2.7 h.
  - **Novelty after hour 8:**

    | | Longest gap, new | Longest gap, old | Empty 2-h windows, new | Empty 2-h windows, old |
    |---|---|---|---|---|
    | Typist | 134–397 min (median about 170) | 182–269 | 1–4/17 | 2–5/17 |
    | Light | 115–228 min | 120–167 | 1–2/17 | 1–2/17 |
    | Idle | 133–269 min | 147–215 | 1–4/17 | 1–4/17 |

    The new content lands as single beats. The long gaps are the stretches between Codex ranks and trophies, and they didn't shrink much.
- **Proposed fix (zero art, idle only):** give the Heartroot two named sub-bands, the way `biomeOf` already clones a biome for the echoes.
  - **f121–130 and f141–150:** "The Deep Heartroot" with a shifted palette (accent `#9cff8a` sap-green instead of pink; darker floor). The biome-change banner fires on band change automatically because the object identity changes.
  - **Optional:** a 1-floor "echo pocket" at f135, to give idle players a preview of the Echoed Depths.

### F5 [severity: minor] Heart Warden: the guard usually ends unseen, or on a corpse
- **Evidence:** batch 1, 40 h. The probe double-counted dead Wardens as "left floor"; those rows are ignored.

  | Profile | Wardens | Guard worn out on its timer | Broken by an ultimate | Died still guarded | Hits taken while guarded |
  |---|---|---|---|---|---|
  | Idle s1 | 1002 | **864** | 31 | 107 | 11–12% |
  | Typist s1 | 2317 | 378 | 1138 | 801 | 20–21% |

  - **For typists, 730 of the 1138 ultimate breaks kill the Warden within 0.5 s.** "GUARD BROKEN" floats over a corpse. In the 8 h runs that was 8–13 of about 120.
  - **The timer break is silent:** `fx.js` and `audio.js` skip text and sound when `worn`. It comes after a median 6.2–6.8 s of contact.
  - The 8 s starts at spawn, and contact comes after a median 1.2–1.3 s.
- **Why it matters:** the "ultimate breaks the guard" lesson only teaches when the break is seen and then followed by a fight. Today idle players never see it, and typists see it on a dying Warden.
- **Proposed fix:**
  - The breaking ultimate is also halved (`if (opts.ult) { …; dmg *= 0.5; }`), so the Warden survives its break most of the time.
  - Tick `guardT` only while the Warden is engaged (`e.x <= reach + 2`), and raise it to 10 s.
  - The worn break shows a small "BARK SPLITS" text.

### F6 [severity: minor] Root Ward is a dead epic outside the Heartroot, including the demo and the guaranteed f30 epic
- **Evidence:**
  - `rollRelics` (state.js:281) has no floor gate. Root Ward is one of the 5 epics in the guaranteed f30 epic draw, so a 1-in-5 chance there.
  - **Demo:** offered 2–8 times per 3 h demo and picked 0–3 times, with **0–2 blocks in total**. Its text promises "root or Overgrowth", which don't exist in the demo.
  - **Full game, 40 h:** for picks below f90, the share of the rest of that delve spent where a web or root can happen is 0–22%, and most picks block 0 times.
    - Picked at f95 or deeper it is strong: 60–100% useful, 30–60 blocks.
  - It also uses the same `shield` icon as Spacebar Shield.
  - The "WARDED" text appears over the front hero, even when the web was aimed at the back hero (Brood Mother).
- **Proposed fix:**
  - Add `minFloor: 91` on the relic, and filter `pool` with `!(r.minFloor && S.floor < r.minFloor)`. That also keeps it out of the demo and the f30 epic.
  - Give it its own icon (a root or ward glyph).
  - Emit `warded` with the target hero.

### F7 [severity: minor] Roots read as webs, and 20–27% of Sporelings die in the frame they spawn
- **Roots read as webs:**
  - Every root shows the white "WEBBED" text (fx.js:347 ignores `root`) and "WEB TORN!" when torn.
  - Typists hit 3.4–4.3 k roots per 40 h; idle players hit 9.8–10.6 k. That's about 100–300 "WEBBED" pops per hour in the Heartroot.
  - Nothing tells the player that keys tear a Lasher's root. The only "TYPE TO TEAR" hint is the Brood Mother's alert, about 70 floors earlier.
  - Some hero is rooted 5.6–9.7% of Heartroot time for typists, 9.6–17.8% for light players and 13.8% for idle players. Typists' median root lasts 0.57–1.53 s.
  - **Fix:**
    - `KK.on('webbed', ({ h, root }) => FX.text(…, root ? 'ROOTED' : 'WEBBED', root ? '#c08a4a' : '#f2f2f2', …))`, and "ROOTS TORN!" on tear.
    - The first root of a delve gets one `moveAlert('root', e, 'ROOTED! TYPE TO TEAR IT')`.
- **Sporelings die in the frame they spawn:**
  - The Spore Bloat's split is lost to AoE. `killEnemy` pushes the Sporelings into `W.enemies` while the slam or meteor `for…of` loop is still running over it (world.js:653, :667), so the same ultimate hits them.
  - Same-frame deaths: typists 20–27%, light 13–27%, idle 3–5%. Late-game typists' median Sporeling life is 0.40 s.
  - **Fix:** queue the split (`W.pendingSpores.push(...)`) and spawn after `updateShots`, or give Sporelings `spawnT`-based immunity for 0.3 s.

### F8 [severity: minor] Long tail after f200: one trophy every 5–15 h, and nothing new after the Codex
- **Evidence:** 80 h typist s1.
  - f200 comes at 49.3 h, then f205 at 53.5 h, f210 at 58.8 h, f215 at 71.1 h and f220 at 73.9 h.
  - Codex 40/40 at 64.2 h. After it, the longest gap is **416 min**, and 11 of 37 two-hour windows past hour 8 are empty.
  - Still missing at 80 h: `seals30`, `idle50`, and `hollowed6` (the last one is the day-tick artifact; it falls at about 32 h with days ticking).
  - From f151 the boss floors alternate the Rootmother and the Keeper every 20 floors, with no Hollowed version of either.
  - Echo bands always use the base biome's monsters at the depth's stats. An "Echoed" boss (for example a Hollowed Rootmother with a Void Slam, in echo bands from f200) would be new, at the cost of one flag.
- **Week 2 for a typist (about 50–100 h):**
  - one Seal a day;
  - a trophy every 5–15 h;
  - the echo band banners (after the first lap, the big banner never comes back; first-ever-only);
  - the 2 Heartroot bosses on repeat.
- **Proposed fix (cheap):**
  - Past f200, the Rootmother and the Keeper come back Hollowed (`hollowed = true`, so a Void Slam plus their move; they still count for the Codex).
  - Add 2 achievements: "Echoes of the Root" (beat a Hollowed Rootmother) and "f250".
  - **Bigger:** an "Echo Codex" past rank 40 (1 rank per 24 kills, x1.01) so the Codex never goes silent.

## Code review of 51310be (no bug unless noted)
- **Biome banner on echo bands: OK.** `biomeOf` caches each band (`echoCache`), so the identity check at world.js:768 fires exactly on 150→151 and every 10 floors after. The first-ever key `biome:<name>` makes each "Echoed X" big once. Head Start jumps still always banner (old behaviour).
- **Hollowed naming: OK.** Root bosses are excluded (`!boss.def.root`), so there's no "The Hollowed Rootmother" and no Void Slam on them. Hollowed bosses in echo bands stay Hollowed and tinted.
- **Codex: OK.** `e.def.root` counts. Copy is stale (F3).
- **Bugs:** the rotation parity (F2), and the AoE iteration that kills Sporelings (F7).
- **Glimpse and demo (`DEMO_CAP` 40): OK.**
  - The Glimpse uses `biomeOf(41)`, and `bossFor` branches from 120 up are unreachable in the demo.
  - `wardUsed` resets in the Glimpse branch too.
  - The only demo leak is Root Ward (F6).
- **Retire, `bossWounds`, enrage, slain floors: OK.**
  - The root bosses go through the same `slain`, `bossWounds` and `fightT` paths.
  - An old save's `bossWounds[120]` or `[140]` from a Hollowed boss now applies to the Rootmother or the Keeper for one fight. That's harmless, and `startDelve` clears `bossWounds` anyway.
- **Save/load: OK.** No new persisted fields; `guard`, `locked`, `webKind` and `wardUsed` are transient.
  - `h.locked` only counts down while the hero is alive. After a KO and Sanctuary revive the padlock persists for the remainder; cosmetic.
- **Ward reset:** `W.wardUsed` resets per *wave* (spawnWave), not per fight. That's more generous than "each fight" on multi-wave floors. Either is fine; the description could say "each wave".
- **Overgrowth:** it uses `Math.max(webbed, 2)` but always sets `webKind = 'root'`. An in-flight Brood web then draws brown; cosmetic.
- **Achievements are all reachable:**

  | Achievement | Typist | Light | Idle |
  |---|---|---|---|
  | heartroot | 2.6–3.2 h | 4.1–5.7 h | 9.1–9.6 h |
  | rootmother | 5.9–6.6 h | 9.1–11.4 h | 19.5–25.7 h |
  | keeper | 10.4–11.8 h | 15.4–18.2 h | 31–37 h |
  | echo175 | 22.5–24.9 h | 33.6–39.2 h | not in 40 h |

  Naming clash: Echo Rune, "Say It Twice", "Echoes of the Deep" (Hollowed 6), the Echoed Depths and "Echoes All the Way Down". Consider renaming `hollowed6` to "Hollowed Out".

## Verified fixes from last round (pass/fail, one line each)
- **Rat King one-shot guard: PASS.** Demo typist laps: 100% with Royal Summons (24/24, R9: 25–43%); idle 10/10 with 3 waves.
- **Biome 5 built: PASS.** Typist share of hours 8–40 outside one biome went from 3% to 65–71%; idle is still 81% in one biome (F4).
- **Glimpse staging: PASS (code).** The door is at `max(partyX+24, sealedX-44)` and waves spawn short of the statue (world.js:84, :381); the party stops at the door during the hold (:368).
- **Demo shows earned full-game achievements: PASS (code).** It's on the demo card (ui.js:563).
- **f100 counter capped at 99: PASS (code).**
- **Echo cue: PASS.** "ECHO!" at fx.js:359.
- **Recruiter rejoin: PASS (code).** data.js:143.
- **Codex 40: PASS** in the sim: 40/40 at 64 h for a typist. **FAIL** for the "next rank" text past rank 28 (F3).
- **Trophies to 300: PASS.** 39 trophies; the typist 80 h run reached f220.
- **Pacing: no regression in the first hours.**
  - 8 h max floor: typist 130, light 110–120, burst 104–110, idle 100.
  - 40 h max floor: typist 190–199 (old 193–200); idle 144–149 (old 147–154; the "step").

## Ideas (optional, max 3)
1. **Keeper "Lockdown" as the typing boss** (F1). The seal on the whole rotation breaks after N keystrokes, with a key counter over the padlock. This would be the one boss that rewards a burst of typing, which suits the game's identity.
2. **Hollowed Heartroot bosses past f200** (F8). One flag, and it gives week 2 a "new" boss and an achievement.
3. **Sub-banded Heartroot palette** for idle players (F4): "The Deep Heartroot" on f121–130 and f141–150, zero art.

---
**Scripts:**
- `docs/playtest/round-10/r10probe.js` (probe)
- `batch.sh`, `batch2.sh` (runs)
- `counts.js` (counts and rotation)
- `agg10.js`, `tab10.js` (aggregators)
- `old_js/` (51310be^ copy, for the "before" runs)

**Raw output:** `docs/playtest/round-10/out/` (n8_, n40_, o40_, d40_, do40_, demo_, n80_). The other `*_agg.txt` files in `out/` belong to another tester.
