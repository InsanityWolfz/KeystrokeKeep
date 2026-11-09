# Round 04 — T1 economist (Incentive & Economy Designer)

## Verdict
**Full game: 8/10 (unchanged).** I would keep it running tomorrow.
- Delve Omens add real variety in each delve.
- The long tail with omens stays safe: no runaway out to 40 h.
- **But Deep Omen is an automatic pick.** It is a flat ×1.25 on all Renown for about one floor of difficulty.
- **Veterans' Muster is never worth taking.**

**Demo: 7.5/10 for the first 3 hours** (R3: 6.5).
- The re-delve loop works: typist laps of 7.5 → 4 min, about 30 relic offers per hour, and a best time to beat.
- **But the repeatable +6 is an uncapped, linear Renown faucet.** After about 4.5 h (idle) or 6.5 h (typist) it out-earns the full game.
- **The faucet carries over into the full game.** A demo save left running for a Next Fest week makes the full game trivial.
- No refund risk, but it is a balance-breaker to fix before Next Fest.

Method:
- About 300 seeded headless runs, 2–5 seeds each.
- **Player model:** the R3 smart-spend player with a 60 s glance.
  - **Smart relic pick:** a rarity and synergy ranking, so Relic Hoard and Collector can matter. `playtest.js` takes offer[0], which undervalues them.
  - **Retire policy:** the in-game nudge (gain ≥ 30 and `runTime` > 25 min, or the first run at f40; muted in the demo until the card), with the 8-min stall rule as a fallback.
- **Scripts (all in `docs/playtest/round-04/`):**
  - `econ4.js` scenarios: `demo`, `headstart`, `muster`, `omens`, `choose`, `branch`, `sw`, `idlews`, `long`, `musterx`, `hp`, `importsave`.
  - Probes: `probe_wall.js` and `probe_wall2.js` (idle wall traces).
  - Option `--patch` replaces omen effects in memory only. Option `--enrage` is a test-only boss enrage.
- Raw output: `out/econ_*.txt`.
- No game file was edited.

## Findings (ranked, max 8)

### F1 [severity: blocker for the demo→full import, major in the demo] The demo's repeatable +6 is an uncapped Renown faucet that out-earns the full game, and it carries over
- Evidence:
  - **Lifetime Renown, demo** (`econ4.js demo`, re-delve as soon as f40 is cleared; 5 seeds to 3 h, 2 seeds to 8 h) **against the full game** (nudge policy, no omens, 4 seeds):

    | Time | Demo typist | Full typist | Demo idle | Full idle |
    |---|---|---|---|---|
    | 1 h | 48–54 | 88–101 | 0–13 | — |
    | 2 h | 108–114 | 225 | 54 | 77 |
    | 3 h | 174–180 | — | 96–102 | — |
    | 4 h | 252 | 339 | 156 | 172 |
    | 6 h | 396 | 414 | 276 | 208 |
    | 8 h | **540** | **452** | **396** | **237** |

  - **Demo laps settle at a walking-speed limit:** about 5.0 min for a typist (best 3.6 min at 8 h) and about 6.0 min for idle. That is a flat **72 or 60 Renown per hour, forever.**
  - **The full game's Renown flattens out instead:** lifetime Renown always comes back to `renownFor(record)`. A typist earns about +28 per hour at 4–8 h and about +8 per retire at 24–40 h.
  - **Crossover:** the demo pays more lifetime Renown than the full game from about **4.5 h (idle)** and **6.5 h (typist)**.
  - **The save import is a plain file copy** (`electron/main.js:274-276`). `KK.load` converts nothing, so `renownFloor` stays 40.
  - **Full game after importing a demo save** (`econ4.js importsave`):

    | Demo save imported | Full game after 1 h | Full game after 2 h | For comparison |
    |---|---|---|---|
    | Typist, 2 h of demo (R114) | | **f125, R470** | Full-game-only typist at 4 h: f118, R339–355 (+35% Renown for the importer) |
    | Idle, 8 h of demo (R396, Fame ×63) | | f133, R805 | Full-game-only idle at 10 h: about f105 |
    | Idle, 24 h of demo (R1380, Fame ×10,469) | **f181** | **f194** | Deeper than a 40 h full-game typist (f168–171) |

  - **Every demo Renown point above R(40) = 30 is a bonus on top of the full game's record-based Renown,** because the full game then pays R(f) − R(40) from scratch.
- Why it matters:
  - Desktop-strip players leave the app open all day. Eight hours a day for a Next Fest week is about 48 h, or **about 2,900 Renown.**
  - The full game then opens at f190+ in its first hour. Omens, the Hollow, all of Magma and the Void get skipped, along with the first-retire curve we tuned.
  - Expected review: "the demo is the real game, I was done with the full version in an evening".
- Proposed fix (two lines, both needed):
  1. **Cap demo lifetime Renown at 120.**
     - Re-clears past the cap pay 0, but the best-time loop and its toast stay.
     - The retire button reads "DEMO RENOWN MAXED (120/120)".
     - The cap is reached at about 2h10 (typist) or about 3h20 (idle).
     - 120 buys at least one rank of every Legacy kind (all of them at rank 1 cost 60), so Collector, Campfire and Battery are reachable.
  2. **On a demo→full import, set `renownFloor` to the first floor where `renownFor(f) ≥ renownLifetime`.**
     - For 120 Renown that is f72: `while (F.renownFor(rf) < S.renownLifetime) rf++`.
     - Demo Renown then becomes an advance on the record instead of a bonus on top of it.
     - The importer keeps the Fame they earned, and their next Renown comes from f73.
  - Alternative to (1): a diminishing re-clear reward, `+max(1, 6 - floor(redelves / 4))`.

### F2 [severity: major] Deep Omen dominates every profile: ×1.25 Renown for about one floor of difficulty
- Evidence:
  - **How the math works:** lifetime Renown always comes back to `renownFor(record)`. `renownMult` multiplies every delve's delta, so a delve under Deep pays 1.25 × its delta. The +30% enemy HP and attack cost about 1.1 floors.
  - **Omen forced on every delve** (8 h, 4 seeds, nudge policy; change against no omen):

    | Omen | Typist Renown | Idle Renown | Burst Renown | Typist depth | Idle depth |
    |---|---|---|---|---|---|
    | **Deep** | **+27%** | **+29%** | **+25%** | +4.5 | +3.8 |
    | Glass | +10% | +21% | +14% | +5.8 | +9.0 |
    | Storm | +8% | +7% | +9% | | |
    | Ember Tide | +8% (Embers ×2, Overcharge lv 11 vs 8.5) | +1% | +4% | | |
    | Fever | +4% | +5% | +1% | | |
    | Hoard (smart relic pick) | +4% | +5% | −2% | | |
    | Gilded | +2% | +4% | +2% | | |
    | March | 0% | +12% | +4% | | |
    | Quiet | −1% | +13% | +4% | | |
    | Muster | −1% | 0% | −3% | | |

  - **A rational best-of-3 picker** takes Deep every time it is offered (9 of 41 delves for a typist, 13 of 31 for idle).
  - **Deep variants tested** (`--patch`):

    | Deep variant | Typist | Idle | Burst | Notes |
    |---|---|---|---|---|
    | Renown ×1.10, same bane | +11% | +8% | +5% | |
    | **Renown ×1.12, same bane** | **+9%** | **+10%** | **+9%** | Same tier as Glass, Storm and Ember Tide |
    | Renown ×1.15, enemy HP ×1.6, attack ×1.4 | +4% | 0% | −2% | Typist −3.7 floors; too harsh |

- Why it matters: if one of three cards is always right, the omen modal is a "find Deep" test. Min-maxers will post "always take Deep" within a week.
- Proposed fix: **Deep `renownMult` 1.25 → 1.12**, and keep the bane. The x1.25 long tail is still safe (F7), so this is about choice, not runaway.

### F3 [severity: major] For idle players, defence stops mattering after the 2nd retire, so HP banes are free and Glass is the automatic idle pick
- Evidence:
  - **Idle parties never wipe late** (`econ4.js hp`, 8 h, 4 seeds): **0.0 wipes after retire 2.**
  - **Enemy attack barely matters for idle:** ×3 gives f101.3 against f100.5 at 8 h.
  - **For idle, Rivet Armor is a gold trap.** Never buying it gives f64.8 against f59.8 at 2 h, and f100.8 against f100.5 at 8 h.
  - **The idle wall is slow damage, not danger.** In the `probe_wall.js` traces the party is at 91–100% HP at every stall. The f50 boss takes 5 minutes to grind down, and the f60–90 stalls show bosses at 23–59% HP with the party at full.
  - **Typists are the opposite:** no Rivet Armor costs **−13 floors** at 8 h (171 wipes), and enemy attack ×3 costs −5.5 floors.
  - **So every "monsters hit harder" or "party HP" bane costs idle nothing.** That covers Glass, March, Fever and half of Deep, and it is why Glass is idle's best omen (+21%, +9 floors).
  - **Boss enrage tested and rejected** (after 60 s, boss attack +3% per second): typist −4.2 floors, idle −2.7, and idle Glass is still +12–16%.
  - **Glass with an attack-speed bane** (damage ×1.6, HP ×0.65, attack speed ×0.8): typist +8%, idle +14%, burst +5%.
    - Ultimates aren't slowed, so typists keep most of the boon.
    - Idle's choice becomes real: Glass +14%, Quiet +13%, March +12%, Deep (×1.12) +10%.
  - The tested damage cuts are worse:

    | Glass variant | Typist | Idle | Burst |
    |---|---|---|---|
    | Damage ×1.45 | +4% | +19% | |
    | Damage ×1.4 | +4% | +15% | +9% |

    They kill Glass for typists and leave it on top for idle.
- Why it matters:
  - For an idle player, the "but…" half of most omens is fake.
  - The Spacebar Shield and Vampire Fang relics, Cleric heals and Sanctuary are dead late. This matches the auditor's "Sanctuary invisible" note.
  - Rivet Armor quietly takes about 40% of the Forge gold budget, which is how the smart player spends.
- Proposed fix:
  1. **Glass Delve:** add `m.aspd *= 0.8` and update the text: "…party HP ×0.65 and attacks 20% slower".
  2. **Rule for future omens:** give anything meant to cost an idle player a bane on enemy HP, gold or speed, not on enemy attack or party HP.
  3. **Optional:** add a NEEDS TYPING-style hint on Rivet Armor for parties that haven't wiped in the last 30 min, or let Quartermaster skip Armor when there have been 0 wipes this delve. No numbers change.

### F4 [severity: minor] Veterans' Muster is never worth it, and no start-of-delve boost can be under record-based Renown with the 25-min nudge
- Evidence:
  - The current Muster is forced every delve:

    | Muster variant | Typist | Idle | Burst |
    |---|---|---|---|
    | Now | −1% | 0% | −3% |
    | +40 levels, gold ×0.9 | −2% | +2% | −4% |
    | +30 levels, no bane | +3% | +1% | 0% |
    | Heroes join at 50% of the last delve's levels (`musterx halfLevels`) | −2% | +3% | 0% |
    | **Keep the last delve's Forge levels, gold ×0.8 (`musterx keepForge`)** | **+2%** | **+8%** | **+2%** |

  - Why start levels don't pay:
    - A delve's value is how far it pushes past the record, and that is limited by gold at the end of the run.
    - The nudge holds every run open for at least 25 min, so getting back to the record faster saves no time.
  - **`pickOmen` does raise levels (PASS):** with Veterans 2, the Knight goes from 21 to 36. The world hero's maxHp is 2545, as expected.
- Proposed fix: **Veterans' Muster → "Keep your Forge upgrades from the last delve, but gold ×0.8".**
  - `retire()` stashes `S.lastForge = S.forge`, and `pickOmen('muster')` restores it.
  - It sits in the Gilded/Fever tier (+2/+8/+2%), it's visible from the first second, and it's a different kind of boon.
  - Otherwise, cut it to 9 omens.

### F5 [severity: minor] Second Wind works for burst typists but is a trap for continuous typists, and the idle Workshop is still almost empty
- Evidence (`econ4.js sw`, `idlews`; 8 h, 4 seeds):
  - **Burst players:**

    | Retire policy | With Second Wind | Without | Gain |
    |---|---|---|---|
    | Stall | f112.8, R317 | f107.3, R276 | +5.5 floors, +15% Renown |
    | Nudge | | | +4.5 floors, +7% Renown |

    - Second Wind pays 940–1010 bonus Sparks per hour at level 7.
    - **Burst/idle depth goes from 1.03x to 1.07–1.10x.**
  - **Continuous typists** (pauses of 15–55 s) **never trigger it:** 0 Second Wind Sparks per hour. Cheapest-first still buys level 9.5 (about 2.8k Embers).
    - At 1 h: f63.5 against f66.8 without Second Wind, and R88 against R101 (−13%).
    - At 8 h: R480 against R486.
    - It's the 2nd-cheapest Ember item (90, after Crucible at 60), so it's the early Ember sink.
  - **Idle Workshop, depth at 8 h:**

    | Policy | Depth |
    |---|---|
    | Buy nothing | f102.3 |
    | Cheapest-first | f102.8 |
    | Overcharge + Crucible only | f104.3 |

  - **Static Coins still has no NEEDS TYPING tag** (`data.js:117`). Idle cheapest-first buys 3–4 levels of it.
- Proposed fix:
  1. Add `needsTyping: true` on Static Coins (one line; this was half of R3 F5).
  2. **Second Wind base 90 → 140** so it's no longer the default early Ember sink (untested; cost only). Show the R3 "SECOND WIND" flash, so a typist who never triggers it can see that.
  3. Leave the 60 s trigger alone. Lowering it would pay continuous typists and widen F8.

### F6 [severity: minor, tooling] `playtest.js --demo --retire nudge` retires at the f40 door, before the boss, and only re-delves on the 8-min stall
- Evidence:
  - `node tools/playtest.js --demo --retire nudge --min 60 --seed 1`: RETIRE #1 at 0h27 "from floor 40 +30", but the first Goblin Warlord kill is at **0h38**, in run 2.
  - The in-game nudge is muted until `demoDone` (`ui.js:546`). The harness nudge isn't.
  - The harness re-delves only by stall, about every 15 min. A player who follows the "re-delve for +6" toast re-delves every **5 min (typist) or 8.5 min (idle)**.
  - The R3 SUMMARY line "re-delve about every 15 min, 78 Renown at 2.5 h" is the lazy policy. The eager player has 150+ at 2.5 h.
  - `--omen first` and the relic pick both take offer[0], which is effectively random. That hides Hoard and Collector, and any omen ranking.
- Proposed fix:
  1. In the `nudge` const, add `&& !(KK.DEMO_CAP && !S().demoDone)`.
  2. Add `--retire nudge` handling for `runCapCleared` in the demo (re-delve on clear).
  3. Add `--omen best` with a ranking list (`econ4.js` has one).

### F7 [severity: minor, info] Long tail with omens: no runaway. Deep ×1.25 compounding with Fame shifts the wall by only 3–7 floors at 40 h
- Evidence (`econ4.js long`, 40 h, 3 seeds, nudge):

  | Profile | Omen policy | Depth | Renown | Fame |
  |---|---|---|---|---|
  | Typist | None | f168 | R704 | ×368 |
  | Typist | Best-of-3 picker | f170 | R753 | ×477 |
  | Typist | **Deep every delve** | **f171** | **R886** | **×948** |
  | Idle | None | f122 | R367 | ×52 |
  | Idle | Best-of-3 picker | f125 | R410 | ×69 |
  | Idle | Deep every delve | f129 | R489 | ×111 |

  - Late gains are +4 to +22 per retire, with 3–7 h runs.
  - Fame ×2.6 is worth only about 4 floors of enemy HP (1.275 per floor), so the wall soaks it up.
- Why it matters: compounding Fame is safe even with the strongest Renown multiplier. Only the demo faucet (F1) breaks it, because it is linear rather than bound to the record.
- Proposed fix: none for Fame. Cosmetic: show Fame as "×948" instead of "+94,700% DMG & GOLD" past ×10.

### F8 [severity: minor] Overcharge 1.6 narrowed the long-session gap only partly: 1.44x → 1.38x at 24 h
- Evidence (same model as R3 for comparison: stall policy, first relic, no omens; 3 seeds):

  | Profile | 24 h (R3) | 24 h now | Overcharge level |
  |---|---|---|---|
  | Typist | f155 | f149 | 13 |
  | Idle | f108 | f108 | 6.3 |

  - The 24 h gap is 1.38x. R3 predicted 1.32x.
  - Under the nudge policy: 1.37x at 24 h (f159/116) and 1.38x at 40 h.
  - At 8 h: 1.32–1.35x. Typist f123 against R3's 128. Some of that drop is Second Wind's waste (F5).
  - The rest of the gap is Fervor plus ultimates, which is the intended fantasy.
- Proposed fix: keep 1.6. R3 measured that 1.7 costs typists 4–5 floors at 8 h. If the gap must shrink, give idle a real Workshop item (Idea 2), not a typist nerf.

## Verified fixes from last round (pass/fail, one line each)
- **R3 F1, demo dead end: PASS.**
  - The "Demo complete" card shows at 26–29 min (typist, 5 seeds), 58–74 (burst) and 65–85 (idle).
  - Re-delving on clear:
    - Typist laps go 7.5 → 4.2 min (best 4.1–4.2 at 3 h), with 25–26 re-delves in 3 h and **28–29 relic offers per hour** (R3: 0 after the cap).
    - Idle laps go 14.9 → 6.0 min, with 11–14 re-delves.
    - A lazy player (one who farms 8 min after each clear) re-delves 10 times in 3 h.
  - Best time and the toast work. New problem: F1.
- **R3 F1.4, nudge waits for the card: PASS in the game** (`ui.js:546`). **FAIL in the harness** (F6).
- **R3 F2, Head Start in the demo: PASS.**
  - In the demo, rank 3 is refused (max 2), the description says "now floor 11", and the start floor is 11.
  - The full game keeps max 8 (f41).
- **R3 F3, Overcharge growth 1.6: PARTIAL.** The 24 h gap went from 1.44x to 1.38x, not the predicted 1.32x (F8).
- **R3 F4, Kindling → Second Wind: PASS for burst** (+4.5 to +5.5 floors at 8 h; burst/idle 1.03x → 1.07–1.10x). It's a new trap for continuous typists (F5).
- **R3 F5, idle Workshop / NEEDS TYPING tags: PARTIAL.**
  - Second Wind is tagged; Static Coins isn't.
  - The idle Workshop is worth +0.5 floors (cheapest-first) to +2.0 floors (Overcharge + Crucible) at 8 h.
- **R3 F8, offline copy: PASS.** `ui.js:483` now says "X% of your recent kill income". The Campfire text in `data.js` still says "% of online", so the two disagree.
- **Veterans' Muster applies on pick: PASS.** The Knight goes from 21 to 36 (Veterans 2 + Muster), the world hero's HP refreshes, and recruits use the new `startLvl`. Its value is the problem (F4).
- **Demo Legacy reachability: PASS.**
  - Typist: Campfire and Battery are first bought at 85–90 min. At 3 h: Lineage 6, Treasury 6, Veterans 4, Zeal 3, Campfire 2, Battery 3.
  - Idle: Campfire and Battery are first bought at 126–158 min.
  - Collector (20) is affordable within 3–4 laps. My cheapest-first loop just never saves for it.
  - The Workshop ends 3 h with 155–1454 Embers unspent and nothing dead.

## Ideas (optional, max 3)
1. **"No omen" as a real card.** It's never right today: the worst omen is −1 to −3%, and a typist sees an offer with nothing positive in 1 of 120. Suggestions: "Steady Delve: the next 3 bosses offer +1 relic", or "+1 omen reroll banked". Every pick becomes a trade-off, and Deep (×1.12) no longer has to be the "safe" choice.
2. **An idle-side Workshop item,** for example "Dynamo: +0.03 Sparks/s per level while not typing, max 10".
   - Idle ultimates currently come only from rat Sparks (60 per rat). Overcharge is the only Workshop item idle can use, and it's worth about 2 floors at 8 h.
   - This is the clean way to close the remaining 1.35x gap without nerfing typists.
3. **A demo leaderboard: "fastest delve to Floor 40" through Steam.**
   - With F1's cap, the best time stops falling once Renown is maxed (typists around 4–5 min).
   - The leaderboard then rewards relic drafting and typing bursts instead of farming hours. It's a cheap Next Fest hook ("beat my 4:12").
