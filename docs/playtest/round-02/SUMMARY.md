# Round 02: Summary

| Tester | R1 | R2 |
|---|---|---|
| economist | 6 | **7.5** |
| auditor | 6 | **6.5** |
| market | 6 | **6.5** |
| player | 6.5 | **7.5** |

Reports: `economist.md`, `auditor.md`, `market.md`, `player.md` (plus scripts and `market_probe/`).

## Headline findings
- **The typist's late first retire is a harness artifact.** It came from the 8-min-stall retire rule. Retiring at f30 reaches the same depth by 4–8 h. The real fix is to teach players to retire: a nudge, and showing what the Renown is worth.
- **Spark Jar was dead content.** Sparks are at the cap 0% of the time, so the first Workshop buy did nothing. Overcharge (+25% per level, additive) barely mattered.
- **Idle players had almost no Workshop.** They earned about 4% of a typist's Embers.
- **Content still ran out at about 4h30.** "Hollowed X" was just a rename and always came in the same order. The game walls at floors 100–105 because Fame was linear.
- **The R1 GPU fix failed in practice.** The 30 fps JS cap held, but endless CSS animations (wave-pip blink, badge bob, FLOW text) kept the window recompositing at 160 Hz. rAF also kept waking up 160 times a second.
- **The strip still covered fullscreen apps.** On Windows, every always-on-top level is TOPMOST.
- **Hidden or muted states still did work.** Lock/unlock while hidden restarted drawing. Muted audio leaked nodes into a suspended context.
- **The input hook stayed installed while paused.** Ctrl+Alt+K is AltGr+K on some layouts.
- **A postponed relic offer was overwritten by the next boss.** Disabled Spark/Renown buttons looked enabled. Big crit numbers and the boss bar collided with the HUD. The golden rat was still nearly uncatchable.
- **Next Fest dates were verified on Valve's page (all PST):**

  | Date | What |
  |---|---|
  | Jan 10 | Registration deadline |
  | Jan 18 | Demo and store page submitted for review (in time for the Press Preview) |
  | Feb 1 | Final cutoff |
  | Feb 22 – Mar 1 | Festival |

## Changes made

### Economy and content
- **Workshop:**
  - Spark Jar is replaced by the **Ember Crucible**: +15% Embers per level, max 10. Old Jar levels are refunded as Embers.
  - Overcharge is now multiplicative (×1.3 per level).
- **Ultimates hit 1.5× harder:** slam 4→6, arrows 1.5→2.25, Meteor 8→12. Sanctuary also triggers in boss fights when anyone is below 80%.
- **Idle players earn Embers too:** +10 per boss kill and +25 per golden rat. `KK.gainEmbers` applies the Crucible bonus.
- **Fame compounds gently:** `(1 + 0.03R) × 1.004^R`, so late retires still push the floor-100 wall.
- **Offline pay** uses min(current rate, 10-minute average), so there's no jackpot for quitting right after a boss. Midnight Oil raises the offline cap to 100%.
- **Relics:** Echo Rune always double-casts. Hotkey Ring fires every 60th key, using the next hero in the rotation.
- **Legacy:**
  - Head Start costs 3+2l.
  - Veterans gives +10 levels per rank and costs 3+2l.
  - Idle Battery is capped at 3, so it never beats FOCUSED.
- **Costs and growth:** Mage levels 200 → 80, enemy HP growth 1.27 → 1.275.
- **Hollowed bosses:**
  - Purple-tinted, with a void glow.
  - Named "The Hollowed Rat King".
  - The order rotates by 3 bosses per retire.
- **Relics:** the floor-30 boss of the first delve always offers an epic. A Head Start bought mid-transition no longer overshoots.
- **Demo mode** (`?demo`, `--kk-demo` or `KK_DEMO=1`, `playtest.js --demo`):
  - Content stops after the floor-40 boss, with a "Demo complete" card.
  - The party keeps farming floors 37–39.
  - Head Start is capped at 2 levels.

### Readability and UI
- **Ultimate charge bar** above the hero whose turn it is, filled by your Sparks. It flashes when ready.
- **Retire button** shows "+N% DMG & GOLD FOREVER". A one-time nudge appears when the gain is ≥30, at the first f40 or after a 25-minute run.
- **Relic offers queue up:** the badge shows a count and the overlay says "(N more waiting)". The next chest opens after you take one.
- **Disabled Spark/Renown buttons** now look disabled.
- **Workshop:** the tab is renamed "Workshop" with a candle icon. Embers show on the HUD. The retire confirm mentions Embers. The first run says "no record yet".
- **Readability:**
  - The boss HP bar and name moved to the right of the play band, away from the HUD centre.
  - Crit numbers are scale 1 instead of 2.
  - The boss-kill flash is 0.4 (was 0.85) and shake 4 (was 6).
- **Golden rat** runs in screen space (the camera can't drag it away). It is slower (22), sits higher, and has an 18 px hitbox.
- **Cards:** the level badge no longer squeezes the name, buttons are pinned to the bottom, and the biome name has an ellipsis.

### Power and desktop shell
- **Frame loop:** a sleeping `setTimeout` loop instead of rAF, so nothing wakes up between frames. Locked, asleep, hidden or fullscreen-hidden freezes the loop, with saves on freeze.
- **No endless CSS animations:**
  - Blinks are driven at 2 Hz from the UI tick.
  - Badges are static; only a waiting relic glows.
  - `.kk-paused` pauses all CSS animation.
- **Audio:** `tone`, `noise` and `play` return early unless the context is running, so no nodes are queued while muted.
- **Electron:**
  - **Fullscreen auto-hide:** `SHQueryUserNotificationState` is polled every 1.5 s through koffi (states 2, 3 and 4). There's a tray toggle, on by default.
  - One visibility model (user shown × fullscreen × locked × suspended) drives both window visibility and the renderer's power state. Lock/unlock while hidden stays off.
  - **Pause removes the uiohook hook entirely.** The tray tooltip says whether input is being counted or is PAUSED.
  - **Hide hotkey** is now Ctrl+Shift+Alt+K. `register()` is checked and the tray only advertises the hotkey if registration worked. Hiding for the first time shows a balloon.
  - Dev tools are removed from packaged builds. The strip re-docks when a display is added.
  - **Self-test isolation:** `KK_SNAPSHOT` runs use a `-selftest` userData profile, so they never touch the real save.

## Verification
- **Sim:** typist and idle 4 h runs, seed 2:
  - Typist: Void at 1h04 and floor 110 by 4 h. Workshop: crucible 8, overcharge 8, kindling 7, static 5.
  - Idle: the Workshop is now used (crucible 4, overcharge 3, kindling 3, static 1). Floor 83 by 4 h.
  - Demo mode: floor 40 at 25 min; retire +30.
- **Browser smoke test (fresh save, warp 20x):**
  - Two boss offers queued (badge "2", glow class).
  - Embers show on the HUD.
  - The Workshop tab has its new icon and the charge bar draws.
  - No console errors.
- **Electron snapshots:**
  - The self-test profile is isolated (a fresh welcome appeared, and the real save was untouched).
  - fps 30, not paused, AUTO size.
  - `KK_DEMO=1` gives a demo cap of 40.
- **Not verified this round:**
  - Real GPU numbers with the new loop and CSS changes. Next round's market tester should rerun `market_probe`.
  - The fullscreen auto-hide in a real fullscreen app. The call returns state 5 (normal) when nothing is fullscreen.

## Watch next round
- Did the GPU drop below 3% at idle? Does fullscreen video or a game hide the strip?
- Is Sanctuary still rare? The typist cast it 9 times in 4 h. It's designed as a "save", but check whether players ever see it.
- Is the demo (cap 40) satisfying, and does the "Demo complete" card land well?
- Pacing after the ultimate buff, the Mage cost cut and compounding Fame.
