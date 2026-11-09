# Round 05: Summary

| Tester | R3 | R4 | R5 |
|---|---|---|---|
| Economist | 8 / demo 6.5 | 8 / 7.5 | **8 / 7.5** |
| Auditor | 6.5 | 7 | **7.5** |
| Market | 7.5 | 8 | *(still running at write-up; folded into R6)* |
| Player | 7 | 7.5 | **7.5 demo / 7.5 full** |

## Headline findings
- **Cleric heals scaled with damage** (up to thousands of times max HP), so the void slam, HP banes and Sanctuary were cosmetic for idle and burst players. **The typist/idle gap** was 1.39x at 8 h.
- **Achievement bugs:**
  - Hands Off was impossible in real play (any click broke it).
  - Speedrunner unlocked together with Gatekeeper.
  - Blitz unlocked by mistake after a restart (`simTime` resets).
  - Ember floaters showed the wrong amounts.
- **Demo:** re-delves showed "+redelve RENOWN", and Demo Renown hit its cap by minute 51.
- **Week 2 was empty:** after about 17 h a typist had every trophy and achievement and nothing new for up to 23 h. More Renown or more trophies doesn't move the wall.
- **Early bosses all fought the same.** The auditor designed six signature moves: War Charge first (the demo's final boss), then Reassemble.
- **The VOID SLAM warning was unreadable,** buried under damage numbers. Hollowed fights could last 16 minutes with a slam every 8 s, so it turned into noise.
- **Floor 100 was spoiled:** the omen pill covered the banner, two toasts said the same thing, and the boss was a purple Rat King.
- **Small issues:**
  - Head Start bought mid-delve skipped its levels.
  - The achievements list closed on every purchase.
  - Digits were misread at 12 px.

## Changes made
- **Heal cap and Dynamo:**
  - A regular Cleric heal is capped at 25% of the target's max HP. Danger is real again: idle players wipe about 25–30 times in 8 h, Sanctuary matters, and Rivet Armor matters.
  - New Workshop item **Dynamo**: +6% power per level while not typing (max 10), for idle players.
- **Achievement fixes:**
  - Hands Off counts keystrokes only and resets when you pick an omen.
  - Speedrunner is now "beat the floor-60 boss within 10 min of a new delve".
  - Blitz uses `stats.playTime`.
  - Ember floaters show the real amount (x `emberGain`).
  - New: **Hollow Scholar** (complete the Codex), for 36 achievements in total.
- **Demo:**
  - The Renown cap is raised from 48 to 120 (~2 h for a typist). The full game converts it on import anyway.
  - The re-delve banner says "A NEW DELVE BEGINS · BEAT <best>", and the pill shows best time and clear count.
  - The card pitches the Codex, trophies and 36 achievements, with a shorter "♥ WISHLIST" button.
- **Hollow Codex (week 2):** The Hollow and the six Hollowed bosses each rank up at 3/10/20/40 kills. Each rank gives x1.03 damage and gold, 28 ranks in total. Ranking up shows a toast, and the Codex has a line in Legacy.
- **Signature moves:**
  - **Goblin Warlord, War Charge:** every 10 s he backs off, telegraphs, charges for 2x attack and shoves the party back 16 px. About 37 charges per 90 min.
  - **Bone King, Reassemble:** once per fight he rises at 25% HP after a 1.5 s bone-pile stun.
  - Both also apply to the Hollowed versions.
- **Void slam:**
  - Every 12 s for 55% max HP (was every 8 s for 45%).
  - Flash and shake are damped after the third slam.
  - A boss fight longer than 3 minutes counts as a wall: "THE BOSS IS TOO STRONG: RETREAT", then a retreat.
- **Alerts channel:** `FX.alert` is a separate warning channel that is never dropped, drawn last on a black plate over the party ("VOID SLAM INCOMING", "WAR CHARGE!"). During the 1 s wind-up the boss's own damage numbers are hidden.
- **Floor 100 is The Heart of the Keep:** a fixed boss (a bigger Hollow, 1.5x HP) with one toast (the achievement). The omen pill hides while banners play and has a tooltip showing the omen text.
- **UI:**
  - Head Start bought mid-delve raises current heroes.
  - The achievements list keeps its open state.
  - Omen, card and demo-stat text is 14 px.
  - The wall hint opens the panel at the top, and also shows after a 5-minute stall when retiring would pay at least 10.
  - The Campfire description is corrected.
  - Omen cards show a "NEW" badge for omens not yet delved under.
- **Shell:** a named-pipe lock keeps the demo and the full game from running at the same time. Exclusivity was tested in Node; the two real builds were not launched together, to keep the real save folder untouched.

## Verification
- **Sim (seed 6, nudge, random omens, 8 h):**

  | Profile | Max floor | Achievements | Wipes |
  |---|---|---|---|
  | Typist | 135 | 29/36 | 13 |
  | Idle | 100 | 23/36 | 31 |

  - Demo (3 h): Renown 120, 17 clears, best time to floor 40 is 4.2 min.
  - The typist/idle gap is about 1.35x.
- **Signature moves (90-min sim):** War Charge fired about 37 times; Reassemble triggered.
- **Browser (full game, from floor 99 with strong heroes):**
  - The Heart of the Keep spawns and dies.
  - The f100, hollow, void and magma achievements unlock.
  - The "VOID SLAM INCOMING" alert fires in the alert channel.
  - Trophies count.
  - No game console errors. One "shop2" ReferenceError came from a tester's injected script, not from game code.

## Watch next round
- Is the 25% heal cap plus the new void slam too punishing for idle players (max floor 100 at 8 h)? Is the 3-minute boss enrage-retreat fun or frustrating?
- Are War Charge and Reassemble readable at strip size in the demo?
- How does the Codex pace out in week 2?
- The market report (power with low-GPU on/off, fullscreen filters, save hardening, packaged build) wasn't in at write-up. Check its findings next round.
