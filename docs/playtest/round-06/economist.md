# Round 06 — T1 economist (Incentive & Economy Designer)

## Verdict
**Full game: 7.5/10 (R5: 8). Demo: 7.5/10.** I would keep it running tomorrow and would not refund. The game got 0.5 lower because the new 3-minute boss enrage is either off or harmful:
- **As shipped, a guard bug switches it off.** After the first wipe of a delve or session, it never fires again.
- **Fixed naively, it walls idle players.** They get stuck for up to 14 h on one floor, and 40 h idle depth drops from f144.7 to f133.7.

Other R5 changes:
- **Dynamo misses its target.** The 8 h typist/idle gap is still 1.40x over 5 seeds (target ≤ 1.35x).
- **The Codex is not a week-2 system.** It is the biggest typist booster in hours 3–12 and arrives in clumps of six. It is the main reason the 8 h gap is 1.40x and not 1.31x.
- **The achievement fixes, Head Start, the Campfire text and the demo cap 120 all pass.** War Charge and Reassemble are flavour, not economy.

Method:
- About 330 seeded headless runs of the real sim (3–6 seeds each) at 3 h (demo), 8 h, 24 h and 40 h, with the R5 smart-spend player.
  - Nudge retire with an 8-min stall fallback.
  - Random omens unless stated.
- Plus `tools/playtest.js` reference runs (seed 6, `--retire nudge --omen random`, and `--demo`).
- Scripts are in `docs/playtest/round-06/`:
  - `econ6lib.js` is the player plus boss-fight, enrage-streak and Codex telemetry. It also holds the test-only toggles, applied in memory: `fixEnrage`, `noEnrage`, `enrageAt`, `wounds`, `softEnrage`, `noWarCharge`, `noReassemble`, `codexMult`, Dynamo variants.
  - `econ6.js` runs the variants. `econ6_demo*.js` covers the demo, `econ6_codex*.js` the Codex cadence and alternatives, `econ6_checks.js` the fix checks.
  - `batch*.sh` re-runs everything.
- Raw output is in `out/{v8,v40,v24,en8,en40,en24,dy8,dy8b,dy40,om8,sanct8,demo,pt}_*.txt`.
  - Another tester's files share `out/`; mine use those prefixes plus `checks`, `codex_designs` and `smoke`.
- No game file was edited.

## Findings (ranked, max 8)

### F1 [severity: major] The 3-minute boss enrage only fires once per delve or session (guard bug)
- Evidence:
  - **The bug:**
    - `world.js:466` checks `e.fightT > 180 && !W.wipeT`.
    - After any wipe, `W.wipeT -= dt` lands slightly **below** 0 (`world.js:280-283`), and only `W.reset()` puts it back to 0.
    - So `!W.wipeT` stays false until the next retire or app start. That is true after a normal HP wipe as well as after an enrage.
  - **Measured:** fights that passed 180 s without enraging (`out/v8_*.txt`, `out/v40_*.txt`):

    | Run | Long fights that skipped the enrage |
    |---|---|
    | Idle, 8 h | 9 of 24 |
    | Burst, 24 h | 26 of 49 |
    | Idle, 40 h | 52 of 100 |

    - The longest "won" Hollowed fight was 2,383 s (40 min) at f130+ (idle, 40 h).
    - In the demo, the idle player's first Warlord kill takes **224 s** wall time (`out/demo_first.txt`) because an earlier wipe already disabled the enrage.
  - So R5's "Hollowed fights could last 16 minutes" is still true in practice, and the "THE BOSS IS TOO STRONG" alert shows only about 4 times in 8 h (idle).
- Why it matters:
  - The feature is untested in real play. Whichever way it gets fixed, players see a new wall.
  - Worse, the behaviour depends on whether you have wiped yet. That makes it unreproducible for bug reports: "sometimes the boss gives up, sometimes it doesn't".
- Proposed fix: in `W.recover()` add `W.wipeT = 0;`, or use `!(W.wipeT > 0)` in the enrage check. **Ship it only together with F2**, because the fix alone walls idle players.

### F2 [severity: major] A working enrage creates retreat → re-fight loops for idle players, up to 103 in a row (14 h). "The boss keeps its wounds" fixes it
- Evidence (`fix` = F1 applied in memory; 3–5 seeds):

  **40 h, idle:**

  | Variant | Depth | Renown | Enrages | Longest streak (same floor) | Codex ranks |
  |---|---|---|---|---|---|
  | Shipped (bug) | f144.7 | R523 | 14 | 2 | 15.7 |
  | fix | **f133.7** | **R442** | **171** | **103 enrages, 840 min** | 9.0 |
  | fix + boss keeps wounds (`wounds1`) | **f141.3** | R499 | 28 | 6 enrages, 70 min | 12.7 |
  | fix + wounds + enrage at 300 s | f141.0 | R497 | 20 | 7 enrages, 101 min | 14.0 |
  | fix + enrage at 420 s | f144.0 | R510 | 22 | 12 enrages, 207 min | 15.0 |
  | fix + 25% heal-back between tries | f142.0 | R505 | 67 | 41 enrages, 554 min | 10.7 |
  | Soft enrage (boss attack +2%/s after 180 s, no forced wipe) | f140.0 | R489 | 0 | 0 (but 134 wipes) | 11.3 |
  | No enrage at all | f143.0 | R513 | 0 | 0 (fights up to 23 min) | 14.0 |

  **8 h** (`out/en8_*.txt`, 5 seeds):

  | Profile | Shipped | fix | Change | Enrages with fix | f100–129 bosses won |
  |---|---|---|---|---|---|
  | Idle | f106.2 | f104.8 | −1.4 | 12/seed | 5% (no enrage: 35%) |
  | Burst | f115.4 | f111.2 | −4.2 | 7/seed | |
  | Typist | f148.2 | f148.2 | 0 | 1.2/seed | |

  - The f100 Heart of the Keep (x1.5 HP) is the idle loop at 7–8 h: up to 15 enrages in a row, about 90 min.
  - **Typist:** irrelevant. They wipe on HP before 180 s (f130+: 92% of fights end in a wipe, about 1% in an enrage).
  - **Burst 24 h:** shipped f147.0, fix f144.7, fix+wounds f145.0, fix+wounds+300 s f146.7.
  - **Why loops happen:** each retry starts the boss at full HP and the party is only 1 floor of gold stronger. A fight the party would win in 300–560 s is lost every 180 s, until gold leveling alone closes the gap.
  - **Why "heal back h%" fails:** the loop ends only if one try deals at least h% of the boss's HP. With h = 25%, idle still looped 41 times.
  - **"Keeps all wounds"** always ends the loop, after ceil(1 / share dealt per try) tries.
- **Omens** (8 h, forced every delve, `out/om8_*`):
  - Gilded (+40% HP) and Deep (+30% HP/atk) are the enrage omens for idle. With the fix, they make **88%** and **68%** of f100–129 fights enrage (Deep: 0% won).
  - Glass doesn't interact: Glass fights end in HP wipes (40%), not timeouts.
  - The void slam (12 s) caps at about 15 slams per fight, so it's fine.
- **Timer quirk:** `fightT` pauses during stuns (Earthshatter, the Reassemble pile) and during War Charge phases. Typists, who stun more, get a median of **239 s** of wall time before the enrage; idle gets 180 s. The rule is hidden and there is no on-screen timer.
- Why it matters:
  - "My party retreats every 3 minutes forever" is the classic idle-game refund complaint. The overnight idle player is exactly the one who meets it (14 h on one floor).
  - The fix also starves the Codex (idle 9 ranks instead of 15.7 at 40 h) and Renown (−15%).
- Proposed fix (tested: `fix+wounds1`):
  1. Apply F1.
  2. **A boss that enrages keeps its wounds.**
     - On `bossEnrage`, store `S.bossWound = { floor, frac: max(0.05, boss.hp / boss.maxHp) }`.
     - In `spawnWave`, if the floor matches, set `boss.hp = boss.maxHp * frac`.
     - Clear it on that boss's kill and on retire.
  3. Keep 180 s. Ordinary HP wipes still reset the boss, so danger stays real.
  4. Show it: "WOUNDED 62%" on the boss bar on return, and a thin enrage bar under the boss HP bar (red for the last 30 s).
  5. Optional: 300 s for f ≥ 100 (+0.3 floors for idle, fewer alerts). Don't go above 300 s, or the 16-minute fights the enrage was meant to stop come back.
  - Result: idle 40 h gets back to within 3 floors of the shipped result, the longest streak drops to 6 tries, and typist (f186.0) and burst (f145.0) don't lose depth.

### F3 [severity: major] Dynamo does not reach the 1.35x target: the 8 h typist/idle gap is 1.40x, and burst and typist gain more from Dynamo than idle does
- Evidence (8 h, 5 seeds, `out/dy8*_*.txt`):

  | Variant | Typist | Idle | Burst | Typist/idle gap |
  |---|---|---|---|---|
  | Shipped (6%/level) | f148.2 | f106.2 | f115.4 | **1.395x** |
  | No Dynamo | f146.0 | f104.8 | f108.6 | 1.393x |
  | 8%/level | f146.8 | f109.4 | f115.2 | 1.342x |
  | 8%/level, cost 80 × 1.5^l | f148.2 | f111.2 | f117.8 | 1.333x |
  | **10%/level** | **f147.8** | **f111.6** | **f117.8** | **1.324x** |
  | 10%/level, cost 80 × 1.5^l | f147.6 | f113.6 | f120.4 | 1.299x |
  | Only after 60 s without input | f147.0 | f106.2 | f109.6 | (hurts burst −5.8) |

  - **Dynamo's actual effect:** idle +1.4 floors, typist +2.2, burst +6.8.
  - **Idle can't afford it:** idle has only about 3.6 levels at 8 h. With no typing there are no Sparks, so no Embers.
  - **Typists own Dynamo 8 at 8 h.** It's a power floor, so it beats the IDLE and FOCUSED tiers in their pauses.
  - **The idle player wastes Embers:** if it skips the NEEDS TYPING items (Second Wind, Static Coins), idle alone reaches f110.2 (1.345x).
  - **No long-run distortion at 10%** (40 h): typist 184.7, idle 145.0, gap 1.27x, the same as shipped (1.27x). It's a catch-up for hours 2–10, not a runaway.
  - **Note:** R5's "≈1.35x" came from one seed (seed 6: `playtest.js` gives f135/f100). Over 5 seeds it is 1.40x.
- Why it matters: in hours 2–8, where Next Fest players decide whether to wishlist, idle Renown is still about half the typist's (R267 against R551). The review line would be: "Dynamo is another typist upgrade."
- Proposed fix:
  1. `data.js:117` Dynamo: `0.06 * l` → **`0.10 * l`**. Keep the cost, or make it 80 × 1.5^l if you want 1.30x.
  2. Sort NEEDS TYPING Workshop items last (or dim them) when the player has typed under 500 keys this delve, so idle players don't sink their first 500 Embers into Second Wind.

### F4 [severity: major] The Hollow Codex arrives in clumps of six and widens the 8 h gap; it barely touches week 2
- Evidence:
  - **Rank timing** (40 h, 3 seeds; `out/v40_*`, `econ6_codex.js`):

    | Ranks | Typist | Idle | Burst |
    |---|---|---|---|
    | 1 | 1.9 h | 3.3 h | |
    | 7 | 4.0 h | 11.5 h | 8.9 h |
    | 14 | 11.6 h | 30.9 h | |
    | 21 | 30.5 h | never in 40 h | |
    | 28 | never in 40 h | never in 40 h | |
    | At 40 h | 22 | 15.7 | 12 at 24 h |

  - **Why it clumps:** the six Hollowed bosses rotate evenly, so all six reach 3, then 10, then 20 kills within the same hour.
  - **Typist rank times (seed 1):**
    - Six ranks between 3.4 and 4.2 h.
    - Five ranks between 11.1 and 12.6 h.
    - **A 12–16 h drought** (12.6 → 25–29 h).
    - Then five ranks at 27–31 h, and a 9–10 h drought.
  - **Idle:** droughts of 8–11 h.
  - **What it's worth** (noCodex vs base):

    | | Depth | Renown |
    |---|---|---|
    | Typist, 8 h | +8.2 floors (f148.0 vs f139.8) | +11% |
    | Typist, 40 h | +9.3 floors | |
    | Idle, 8 h | ±0 (1.3 ranks) | |
    | Idle, 40 h | +7.4 floors | |

    - **The 8 h gap would be 1.31x without the Codex.** The Codex goes to whoever is already deepest.
  - **Snowball risk: low.** A x1.92 multiplier at 22 ranks adds about 9 floors over 40 h. Each rank is worth about 0.4 floors, and the wall (eHp x1.275 per floor) absorbs it, the same as with trophies.
  - **Hollow Scholar (all 28 ranks) is not reached in 40 h by anyone.** Extrapolated: about 60 h typist, 100+ h idle.
  - **The week-2 drought is really the frontier wall** (typist kills: 111 at 16 h, 133 at 24 h, so the Codex starves there too).
- Why it matters:
  - The Codex was meant to fill week 2. It mostly pays the typist in hours 3–12 instead.
  - Six toasts within 45 minutes, then nothing for 12 hours, is the opposite of a drip feed.
- Proposed fix: a **single track on total Hollowed-boss kills: one rank every 8 kills**, 28 ranks at 224 kills. Replayed on the recorded kill timelines (`out/codex_designs.txt`):

  | Design | Typist ranks @8 / 24 / 40 h | Typist longest gap | Idle ranks @8 / 40 h | Idle longest gap | Full Codex (typist) |
  |---|---|---|---|---|---|
  | Shipped (3/10/20/40 per boss) | 9.0 / 15.7 / 22.0 | 12.9 h | 1.0 / 15.7 | 9.8 h | ~60 h |
  | **Every 8 kills** | 7.7 / 16.3 / 24.3 | **6.5 h** | 2.0 / 15.0 | **4.3 h** | ~46 h |

  - Toast: "Hollow Codex 9/28 · next at 80 kills". Keep x1.03 per rank.
  - If you want per-boss flavour, give each boss a *name* line in the Codex panel, but count ranks on the shared total.

### F5 [severity: minor] At the frontier the late game is a wipe treadmill: about 60 wipes an hour for 20+ hours (typist)
- Evidence (typist, 40 h, 3 seeds, `out/v40_typist.txt`):
  - Blocked at a Hollowed boss for **1,238–1,428 min of 2,400**.
  - **2,489** f130+ boss attempts, 92% lost to wipes; 951 wipes in total.
  - Idle reaches the same state at f130 (fix variant: 171 enrages).
  - With record-based Renown, retiring at the wall pays 0, so the wall hint ("pays ≥ 10") never appears. The player has no action except waiting.
  - Retires: 17.7 at 16 h → 19.7 at 24 h, so two in 8 hours.
- Why it matters:
  - Economically a wall is fine (24 → 40 h still gains about 15 floors).
  - But a strip that flashes WIPE plus the retreat banner every minute, all workday, is the "noisy desktop pet" review. It also costs the Codex kills.
- Proposed fix ("camp"):
  1. After 3 consecutive losses at the same boss, the party camps on floor −1 and doesn't challenge again until party power is 20% higher than at the last loss, or 10 minutes pass.
  2. Show "CAMPING · NEXT TRY 6:40".
  3. Gold income is unchanged (farming f−1 earns the same), so the economy doesn't move. Only the noise and the CPU-heavy FX churn go away.

### F6 [severity: minor] Speedrunner now always unlocks on the same kill as Blitz
- Evidence:
  - The floor-60 boss within 10 minutes means bosses 10–60 (or 20–60 with Head Start 2) fell within 10 minutes. That is at least 5 bosses, so Blitz unlocks automatically.
  - Measured (3–4 seeds, `out/checks.txt`):
    - Typist: speed60 64 min = blitz 64 min.
    - Burst: 150 = 150.
    - Idle: 155 vs 177 (idle has to wait for the next delve).
- Proposed fix: Blitz → **"Defeat 8 bosses within 10 minutes"**.
  - Typist about 4.5 h (269 min), burst about 7 h (1 of 3 seeds in 8 h), idle late.
  - It's an active-player achievement, which Hands Off balances.
  - (5-in-5 min: typist 274 min, idle never.)

### F7 [severity: minor, info] War Charge and Reassemble don't change the demo's economy (that's good); War Charge is barely visible after lap 1
- Evidence (3 h demo, 4–6 seeds, `out/demo_ab.txt`, `out/demo_fix.txt`, `out/demo_first.txt`):

  | Profile | Time to the card (both moves / neither) | Wipes to the card | Best f40 lap (both / neither) |
  |---|---|---|---|
  | Typist | 31.3 / 27.6 min | 8.5 / 7.3 | 4.09 / 4.10 min |
  | Idle | 71.8 / ~67 min | | 5.32 / 5.23–5.37 min |
  | Burst | 67.1 / ~70 min (opposite sign: seed noise) | | |

  - Lap medians are unchanged.
  - **First clear:** War Charge lands 14 times per first-delve Warlord fight for typists (84 s, 14% of the knight's max HP each) and 28 times for idle (224 s, 9%). So players do see it on their first clear.
  - **After lap 1:** the typist kills the Warlord in a median **4 s**, so at most one charge per lap (28 charges over 26 laps).
  - **Reassemble:** the Bone King comes back 1.5–1.8 times per first delve; later f20 fights last 2–3 s.
  - **With F1 fixed:** idle and burst hit 0.3–0.5 enrages per 3 h demo. The card comes 5–8 min later (idle 79.8 vs 71.8 min).
- Proposed fix: none for the economy.
  - For readability: start the first War Charge at `chT = 0.5` instead of 1.5, so even a 4-second kill shows one charge.
  - Keep the Warlord's enrage at 180 s, with F2's wounds.

### F8 [severity: minor, info] The heal cap works for typist and burst (wipes, Sanctuary moments); idle depth doesn't care about Sanctuary
- Evidence (8 h, 4 seeds, `out/sanct8_*`):

  | Profile | Depth without Sanctuary | Wipes with / without Sanctuary |
  |---|---|---|
  | Typist | −2.4 floors | 50 / 63 |
  | Burst | −2.9 floors | 29 / 38 |
  | Idle | +1.6 (noise) | 22 / 32 |

  - Idle wipes 22 times in 8 h (R5 target 25–30), 11 of them at Hollowed bosses.
  - Sanctuary is cast 163 times in 8 h (idle) and saves 10 wipes, but no depth: idle's wall is the timer and boss HP, not party HP.
  - **The f130+ typist wall got harder:** 19% of fights won at 8 h (R5: 35%), and blocked 49–126 min (R5: 20–55).
- Proposed fix: none needed. It's the intended trade. Re-check after F2: idle's wall then becomes "deal enough damage" again.

## Verified fixes from last round (pass/fail, one line each)
- **Heal cap 25%: PASS (partial).**
  - Idle 22 wipes in 8 h, 11 at Hollowed bosses (R5 before: 0). Sanctuary saves about 10 wipes per 8 h for every profile.
  - Depth: typist and burst −2.5 to −3 floors without it; idle unaffected (F8).
- **Dynamo (typist/idle ≤ 1.35x at 8 h): FAIL.** 1.395x over 5 seeds. Dynamo is worth +1.4 floors to idle, +2.2 to typist and +6.8 to burst. 10%/level gives 1.32x (F3).
- **Hands Off counts keys only: PASS.**
  - `kind === 'key'`, and an omen pick resets the count (`achievements.js:88-90`). Clicks and the omen modal no longer break it.
  - Idle unlocks it at 86–88 min; typist and burst never (correct).
- **Speedrunner on the floor-60 boss: PASS for the Gatekeeper overlap** (typist 64 min vs Gatekeeper 37; idle 155 vs 75). **New overlap with Blitz** (F6).
- **Blitz uses playTime: PASS.** Repro via real `KK.save`/`KK.load`:
  - The saved stamps `[4700…5000]` plus a kill 50 min after reload: locked.
  - 4 more bosses 1 min apart: unlocked.
- **Demo Renown cap 120: PASS.**
  - Typist reaches it at 123–127 min (6/6).
  - Idle at 3 h: R54 by 2 h, not reached.
  - Burst: 1 of 6 runs at 175 min.
  - `playtest.js --demo` typist: lifetime Renown 120 at 3 h, 16 retires.
- **Head Start mid-delve levels: PASS.**
  - Head Start 4 bought after retire 1 → knight lv 33 (= 1 + startLvl), 0 wipes in the next 5 min (R5: 19).
  - Head Start 8 → lv 65, 4 wipes (R5: 13, from the knight-only party until recruits).
- **Campfire text: PASS.** `data.js:130` and the offline modal both say "% of your recent kill income".
- **Void slam 12 s / 55%: PASS.** About 15 slams at most per fight with a working enrage. Not a problem in any profile.
- **Heart of the Keep at f100 (x1.5 HP): PASS as content, watch as a wall.** With a working enrage it is idle's 7–8 h loop (up to 15 tries) until F2's wounds are in.
- **3-minute enrage: FAIL** (F1 guard bug; F2 loop risk once fixed).

## Ideas (optional, max 3)
1. **Wound decals instead of a timer.** When a boss keeps its wounds (F2), draw cracks or a missing chunk on its sprite, and play "IT REMEMBERS YOU" on return. That turns the retreat into a visible two-part fight: an idle "come back later and finish it" moment, which is the genre's best feeling.
2. **Codex as a bestiary page.** With F4's single track, each Hollowed boss's page fills in as you kill it (lore line at 3 kills, sprite at 10). Ranks then feel collected rather than granted, without changing the numbers.
3. **"Camp" as an upgrade path** (from F5). A Legacy rank, "Siege Camp", where each 10 minutes of camping gives +5% damage against that boss, up to +50%. It turns the frontier wall into a timer an idle player can see shrinking, at no cost to the typist curve.
