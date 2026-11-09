# Round 06: Summary

| Tester | R4 | R5 | R6 |
|---|---|---|---|
| Economist | 8 / demo 7.5 | 8 / 7.5 | **7.5 / 7.5** |
| Auditor | 7 | 7.5 | **7.5** |
| Market | 8 | 6 (low-GPU sprite bug), 8.5 once fixed | *(still running at write-up; folded into R7)* |
| Player | 7.5 | 7.5 / 7.5 | **7.5 demo / 8 full** |

Before this round: the R5 market blocker was fixed in 89f4651. Low-GPU mode blanked every baked sprite; baked canvases now use `willReadFrequently`, and there's a sprite-check gate in the self-test. Also in that commit: lowGpu "auto", demo productName/profile, second-instance handling, the caption-based fullscreen rule, and async save retries.

## Headline findings
- **Enrage:** the 3-minute boss enrage stopped working after the first wipe of a delve (`wipeT` never reset). Fixing only that trapped idle players in retreat and re-fight loops, with up to 103 enrages in a row.
- **Typist/idle gap:** about 1.40x at 8 h over 5 seeds. Dynamo at +6% per level was too weak.
- **Codex:** ranks arrived in clumps of six, with 12–16 h droughts in between.
- **Wipe treadmill:** at the late frontier, typists wiped about 60 times an hour on the same Hollowed boss.
- **Blitz** unlocked on the same kill as Speedrunner.
- **Player UX:**
  - The achievements list fix didn't work: CSP blocks inline handlers.
  - The digit fix didn't work: the Pixelify font itself confuses 2/8 and 5/S.
  - The enrage read as a sudden wipe.
  - Reassemble was invisible: the Bone King died again within 0.4 s.
- **WIP bugs the auditor caught:**
  - Wounded retries lost their Hollowed status.
  - The bone pile could still be hit, so the Bone King never stood up.
  - War Charge paused other timers.
- **Remaining work the auditor delivered as prototyped designs:** four signature moves, Omen of the Day, and Void Lantern.

## Changes made

### Enrage, walls and bosses
- **Enrage works and makes progress:**
  - `W.recover` resets `wipeT`.
  - An enraged boss keeps its wounds (≥5% HP) for the next try; wounds clear on the kill or on retire.
  - The enrage clock never pauses.
- **Enrage is readable:**
  - A fuse bar under the boss bar after 60 s, an "ENRAGE NNS" countdown after 120 s, and a red pulse after 165 s.
  - Its own alert: "ENRAGED! RETREAT. IT KEEPS ITS WOUNDS (x%)".
  - It no longer plays the generic RETREAT banner and doesn't count as a wipe.
- **Regroup:** after 3 straight losses at a wall, the party farms below the wall for 10 minutes ("Regrouping: next try in Xm"). No more wipe treadmill.
- **Four new signature moves**, from the auditor's prototyped numbers:
  - **Rat King, Royal Summons:** 2 rats at 0.8 s, and again at 60% and 30% HP (max 4).
  - **Brood Mother, Web Shot:** every 7 s at the back-most hero, for 2.5 s with no attacks or heals. **An ultimate tears the web.**
  - **Ember Colossus, Magma Shell:** arrives shelled, then every 12 s for up to 4 s; normal hits do x0.5. **Any ultimate cracks it** (1 s stun).
  - **Magma Lord, Lava Rain:** every 8 s, 3 marked drops with a 0.9 s warning, 0.5x attack each.
  - All have alerts and FX.
- **Move timing:** moves hold off near a void slam. Timers tick even during stuns and charges, so War Charge no longer pauses anything.
- **Reassemble is visible:** the Bone King collapses into an untargetable bone pile, then rises over 1.5 s. An alert names him, and damage numbers stay hidden while he's down.
- **Wounded retries keep Hollowed status:** the Hollowed check runs before wounds are applied.

### Economy
- **Dynamo:** +10% per level (was +6%).
- **Hollow Codex:** one rank every 8 Hollowed kills in total, up to 28. Old per-boss counts are folded in. The toast shows "rank N/28, next in 8 kills".
- **Blitz:** 8 bosses in 10 minutes.
- **War Charge** opens at 0.5 s.

### UI
- **Achievements list** keeps its open state via a capture-phase `toggle` listener (no inline handler).
- **Digits:** all digits and % render in Silkscreen through a `unicode-range` font face ("KK Digits") placed first in `--font-ui`.
- **Wind-up flashes:** the boss flashes during War Charge and Void Slam wind-ups and in the enrage window. Floating numbers dim to 35% while a big banner plays.
- **Re-delve:** the confirm reads "RE-DELVE? … Beat your best", and the demo retire banner shows "+6 RENOWN · BEAT <time>". The sealed toast stops promising +6 once the cap is hit.
- **Wall hint:** no false "Stuck?". The stall timer resets on boss kills and while a boss is active, and is skipped once the demo is done.
- **Pills:** the omen pill shows its tooltip (pointer-events) and is `display: table`, so it no longer stretches.
- **Audio:** after the 3rd slam in a fight, slam sounds go quiet; the warning now uses the "zone" cue instead of the error blip.

## Verification
- **Sim (seed 3, nudge, random omens):**
  - Typist: 8 h max f139, 17 wipes.
  - Idle: 8 h max f100, 22 wipes.
  - Demo, 3 h: 17 laps, best f40 3.9 min.
- **Move checks (4 h headless):**
  - royalSummons 6, webShot 4 (webbed 4), magmaShell 12 (cracked 4), lavaRain 39 (117 drops), reassemble 1, warCharge 10.
  - Wounded retries 2/2 kept their Hollowed status.
- **Browser:**
  - The achievements list stays open after a Legacy purchase.
  - Digits render in "KK Digits".
  - Web Shot fires on the floor-30 Brood Mother.
  - No game console errors. The only error is an old injected tester snippet.

## Watch next round
- Fold in the R6 market report: verification of the low-GPU and sprite fix, the demo/full dialog flow, and the dated Next Fest and Desktop Companion Fest plan.
- Do the four new moves read well at strip size? Is Web Shot annoying? Is Lava Rain readable?
- Is wounds + regroup + Codex every 8 kills enough for week 2? The auditor's Omen of the Day and Void Lantern designs are ready in round-06/auditor.md.
