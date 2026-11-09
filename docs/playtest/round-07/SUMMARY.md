# Round 07: Summary

| Tester | R5 | R6 | R7 |
|---|---|---|---|
| Economist | 8 / 7.5 | 7.5 / 7.5 | **8 / demo 7.5** |
| Auditor | 7.5 | 7.5 | **7.5** |
| Market | 6 → 8.5 | 8.5 | **8** (new noise census) |
| Player | 7.5 / 7.5 | 7.5 / 8 | **demo 7 (8 once F1 fixed) / full 8** |

## Headline findings
- **[blocker] The 0-Renown RE-DELVE confirm had no buttons,** so the UI softlocked on every capped-demo re-delve.
- **The strip was never quiet.**
  - Sound started in 94–98% of all seconds, with 191–382 boom sounds an hour for typists.
  - Visuals per hour for typists: 210–324 flashes, 365–495 shakes and 132–273 banners.
  - Move alerts fired on every cast.
  - Toasts repeated: 62 an hour in the demo loop.
- **Idle hour 1 failed the gate** (≤4 retreats): 7.9 on average, with a guaranteed wipe at minute 10. Root cause: wiping cost only 2.4 s, so bouncing off the wall was the optimal idle strategy.
- **Quartermaster** never recruited and stalled whenever a hero was unlocked but unaffordable.
- **Dynamo 10 + Idle Battery** made a power floor equal to FLOW (x2.18 vs x2.2).
- **Boss re-kill loop:** retreats and camps landed back on cleared boss floors, giving free relics and Embers.
- **Moves under the banner:** typists mostly saw signature moves hidden under the boss-name banner. "An ultimate tears the web" was essentially never seen.
- **Silent retreats:** normal-floor retreats were silent and the camp state was invisible.
- **Small issues:**
  - The enrage fuse clipped the boss name.
  - The pixel font had no "·".
  - The retire box didn't refresh.
  - The War Charge branch still froze the void-slam timer.
  - Webs persisted across floors.
- **Specs delivered:** the auditor's week-2 layer (Omen of the Day, Void Lantern, trophies 160–200), "Glimpse of the Depths" for the demo, store copy v2, and the KK_CAPTURE spec (market).

## Changes made

### Calm strip (market F1–F3, F5, F7)
- **Sound:**
  - "Combat sounds" is a new setting, OFF by default on desktop: hits, coins and spells.
  - Loud sounds are rationed: one every 20 s, booms at most every 30 s.
- **Visuals:**
  - Calm mode is ON by default on desktop, with "OFF (FULL JUICE)" as the opt-in.
  - Meteor flash is 0.08.
  - Level-milestone banners: at most one every 3 min, and none during a boss.
  - Blinks run at 2 Hz.
- **Move alerts** show once per fight and at most once per 10 min per move type.
- **Toasts:**
  - The relic toast shows only when the queue goes from 0 to 1, and at most every 15 min.
  - The recruit hint shows once per hero.
  - The sealed toast shows only on a new best time.
  - Achievements unlocked together share one toast.
- **Gold pulse** at most every 2 s.
- **Migrations for old saves:** volume 0.3 → 0.2, and `lowGpu: true` → auto.

### Idle first hour (economist F1/F2, market F4)
- **Caution rule:** when no key has been pressed for 30 s, the party plays it safe instead of pushing on:
  - It replays a floor if party HP dropped below 60%.
  - It steps back a floor if HP dropped below 35%.
  - It needs 85% HP before entering a boss floor.
  - A calm "Training on floor N" line shows on the HUD.
- **Camp after a wipe** lasts until every hero has gained 4 levels. Three grace saves on one floor also trigger a camp.
- **Quartermaster v2** recruits when affordable, and only saves gold when 2 minutes of income would cover the recruit.
- **Result:** idle demo hour 1 retreats are 2/1/2/4/0 (seeds 1–5), averaging 1.8, down from 7.9. With 5-minute check-ins: 3/0/4, down from 15.8. The typist demo has 2.

### Week-2 layer (auditor F1)
- **Omen of the Day:**
  - Each calendar day stars one omen.
  - Reaching (record − 15) under it pays a Seal of the Day: +10 Renown.
  - There's a free daily re-delve, and the star shows on the omen card and the HUD pill.
- **Void Lantern:** a Workshop item, −8% void-slam damage per level. Costs 4000 ×1.8, max 5, hidden until floor 70.
- **Depth trophies** to floor 200.
- **Achievements:** Faithful (7 Seals), Devout (30 Seals) and Bottom of the Keep (floor 150), for 39 in total.
- **Legacy and stats:**
  - A Codex box in Legacy shows the rank, multiplier, next-rank countdown and 28 pips.
  - The stat box shows chests, retreats and Seals.

### Bosses, combat and UI (auditor F3–F7, player F1–F8)
- **Re-delve confirm:** has its buttons. Every modal now closes on Esc or a backdrop click, except the omen picker.
- **Boss floors cleared this delve don't respawn the boss** (`S.slain`), so there's no re-kill farm.
- **Regroup** has its own timer (`regroupUntil`), and `campFloor`/`campLevels` clear on retire.
- **Void-slam timer** moved above the War Charge branch, so charges no longer freeze it.
- **Webs:**
  - Any damaging ultimate tears every web.
  - Each keystroke shaves 0.5 s off a web.
  - Webs clear on KO, floor change and recovery.
- **Typing callouts:** the alerts read "TYPE: AN ULTIMATE TEARS/CRACKS IT", and the Spark box glows while a web or shell is up.
- **Signature moves** wait until the boss-name banner finishes. The alert plate moves above the banner band.
- **The boss bar names the active move** (SHELLED, CHARGING, REASSEMBLING, VOID SLAM).
- **Enrage:** the fuse is drawn above the bar. The alert reads "ENRAGED! FALL BACK - BOSS STAYS AT N% HP".
- **Dynamo** max is 6, with Embers refunded for levels 7–10.
- **Pills** hide while an alert plays. The retire box refreshes when a re-delve becomes available. Canvas strings use "-" instead of "·".
- **Demo:**
  - The card lists "3 new bosses, 6 Hollowed returns, the Heart of the Keep, 60+ more floors…".
  - The achievement list shows the full-game achievements greyed out with a FULL GAME tag.

### Capture mode (market spec)
- **KK_CAPTURE=1:**
  - Its own profile and save.
  - Staged save (`KK_CAPTURE_SAVE`) and cue scripts (`KK_CAPTURE_SCRIPT`).
  - Fixed 60 fps and seeded randomness.
  - Size, juice and audio flags, toasts off, optional chroma background.
  - Fullscreen auto-hide off; no instance pipe.
- **Hotkeys** Ctrl+Shift+Alt+0–9.
- **Cue ops:** warp, floor, sparks, autotype, flow, rat, relicOffer, openPanel, pickRelic, retire, omen, size, juice, pause, toast, js, mark. `mark` prints timestamps for the editor.
- **Tooling:** `tools/capture/` has the README, `make-save.js` (`npm run capture:save`) and an example `flow-meteor.json`.

### Shell leftovers
- `kk:saveSync` bumps the save generation.
- The pipe name hex-escapes non-ASCII usernames.

## Verification
- **Sim:**
  - Idle demo hour-1 gate passes (above).
  - Typist 8 h: max floor 140, 12 wipes.
  - Idle 8 h: max floor 106, 10 wipes.
  - Typist 10 h: omens, 30/39 achievements, 13 trophies.
- **Browser (demo):**
  - The 0-Renown RE-DELVE confirm shows "NOT YET / RE-DELVE" and Esc closes it.
  - Re-delve works: retires +1, floor 1, modal closed.
  - The console TypeError is the tester's old one from before the fix (stack from a panel click).
- **Electron capture mode:**
  - "[capture] ready" with seed 7, size L, full juice, 7 cues.
  - MARK printed; fps 60; FLOW STATE lit on floor 12.
  - The sprite check passed.
  - Staged-save maker writes valid saves.

## Not done this round (backlog)
- "Glimpse of the Depths" in the demo (auditor F2: the best single wishlist driver; spec ready).
- Store copy v2 is written in round-07/market.md. The user decides where it goes; taglines can't go on capsule art (Valve rule).
- Achievement progress counters (`goal`/`cur`) and Steam progress mirroring.
