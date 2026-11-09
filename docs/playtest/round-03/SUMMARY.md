# Round 03: Summary

| Tester | R1 | R2 | R3 |
|---|---|---|---|
| Economist | 6 | 7.5 | **8** (full game) / 6.5 (demo) |
| Auditor | 6 | 6.5 | **6.5** |
| Market | 6 | 6.5 | **7.5** |
| Player (demo build) | 6.5 | 7.5 | **7** |

## Headline findings
- **The demo died after the "Demo complete" card.** The floor-40 boss never came back, Renown was capped at 30 forever, the retire button said "REACH FLOOR 41", and the card promised things the game couldn't do.
- **`demoDone` was never saved,** so the card would have replayed on every launch.
- **Font ligature bug in Pixelify Sans:** "fl" and "fi" rendered as an A-like glyph, so every "floor" read "Aoor" and "fire" read "Are".
- **The full game's content cliff moved earlier for players who follow the retire nudge** (last novelty at about 2h30). The auditor designed and simulated 10 Delve Omens to fill hours 2–8.
- **The Hollow was skipped on the first Void visit** because the rotation left it out.
- **Sanctuary was still rare.**
- **The ultimate turn "spun" to the Archer:** idle players got 83% Arrow Storm and no Meteors.
- **Kindling was the new dead Workshop item.** Overcharge took over long-session damage (typist/idle gap 1.44x at 24 h).
- **GPU (measured):**
  - Idle dropped from about 11% to 3.2%. Hidden and locked are about 0%.
  - **Typing still cost about 10%**, because of CSS width transitions on the Fervor and Spark bars.
- **Fullscreen auto-hide** works on the primary monitor but **fails on a second monitor**.
- **The demo was only a runtime flag** (the full game was free from the install folder). Demo and full builds shared an unnamed save folder.
- **Small issues:**
  - Head Start in the demo had a misleading max and description.
  - The charge bar read as a second HP bar.
  - The first-run wall gave no retire hint.
  - The income rate carried over a retire.
  - Echo text overprinted itself.
  - The relic toast covered the TAKE button.

## Changes made

### Demo (Next Fest build)
- **Every delve ends on the floor-40 boss.** After it falls, the party farms floors 37–39 ("depths sealed") until a re-delve.
- **Repeatable Renown:** the first clear pays the record (+30). Each later fresh clear of floor 40 pays +6, so Campfire, Battery and Collector become reachable.
- **Re-delve is always available** after the card. The button reads "CLEAR FLOOR 40 AGAIN FOR +6 RENOWN".
- **Best time to floor 40** is the demo score, shown on the card and in a toast after each re-clear.
- **New "Demo complete" card:**
  - Run stats (keys, ultimates, bosses, FLOW time).
  - What the full game adds, and that the save carries over.
  - A **♥ WISHLIST ON STEAM** button. `KK.STORE_URL` is a placeholder for now; Electron opens only Steam URLs.
- **The retire nudge waits until after the card** and never pops while it's open.
- **A "DEMO · ENDS AT FLOOR 40" pill** shows under the floor from the start.
- **Head Start:** the demo max is 2 and the description is honest. The dev "+5 Floors" button respects the cap.
- **`demoDone`, `runCapCleared`, `bestCapTime` and `runTime` are now in `newState`,** so they persist.
- **Demo flag baked at build time:** `package.json` `kkDemo: true` via `electron-builder --config.extraMetadata.kkDemo=true`. The env var and flag stay for dev only.
- **Explicit save folders:** `%APPDATA%/Keystroke Keep/saves` and `%APPDATA%/Keystroke Keep Demo/saves`. The full game imports a demo save on its first launch.

### Full game
- **Delve Omens:** from the 2nd retire on, pick 1 of 3 (or none). There are 10 omens built from data through `KK.mods()`; new mods are `eHp`, `eAtk` and `renownMult`. Picked in a modal after the retire; not in the demo.
- **Bosses:** floor 70 is always The Hollow. Floors 80 and up rotate the other six bosses, offset by 2 per retire.
- **Sanctuary is a free reaction.** It fires on the first hero KO, or when a boss slam leaves anyone under 50%. Then it has a 25 s cooldown, and the Cleric leaves the Spark rotation.
- **The ultimate turn holds while a hero waits for a target,** so it no longer spins to the Archer.
- **Workshop:**
  - Kindling becomes **Second Wind**: after a break of 60 s or more, the next 4×level keys give +2 Sparks each. It's for light and burst typists.
  - Overcharge cost growth 1.5 → 1.6.
  - Typing-only cards get a "NEEDS TYPING" tag.
- **Idle Battery** is 6% per rank.
- **Relics:** the floor-30 epic guarantee now uses a flag (`epicGiven`). Hotkey Ring procs outside combat are banked (up to 3).
- **Retire resets the income rate.** The Legacy panel shows the real compounded Fame and the active omen.
- **Copy:** the Workshop header is renamed, the Embers source text is corrected, and the offline copy says "recent kill income".
- **Retire confirm** warns about unopened relic chests. The wall hint "Stuck? ♛ Retire: +N Renown" shows when blocked, and it's hidden while a banner plays.

### Feel and UI
- **Ligatures are disabled everywhere** (`font-variant-ligatures: none`), which fixes "Aoor".
- **Charge bar:** moved under the hero's feet in Spark colours with a pip, and it blinks only when castable. The first-ultimate toast explains it.
- **Echo or a second cast** updates the label to "ARROW STORM x2!" instead of overprinting it.
- **Opening the relic overlay** clears toasts.

### Power and shell
- **Bar transitions removed** from the Fervor and Spark bars. The market tester measured 10% → 5.4% GPU while typing.
- **Frame rate:** default 30 → 24 fps (24 added to the settings), idle 12 → 10 fps. The canvas backing scale uses floor instead of round, so the backing store is never oversized.
- **Wakeups cut:**
  - The music scheduler only runs while music is audible.
  - `slowUpdate` and the native height poll skip while paused.
- **Per-monitor fullscreen detection:** a z-order walk of top-level windows on the strip's monitor. It skips self, hidden, minimised, cloaked, tool and shell windows. A window covering the monitor means fullscreen; the first normal window decides. SHQueryUserNotificationState still covers presentation mode, plus exclusive D3D on the primary monitor.
- **Tray:** the tooltip shows "· strip hidden", and the first-hide balloon is remembered in the save.
- **Desktop saves:** a JSON file with an atomic write (tmp + rename) and a ring of 3 backups rotated every 10 min or more, with fallback through the backups. A localStorage save migrates once.
- **Harness:** `playtest.js` gained `--retire nudge` (retires like the in-game nudge) and `--omen first|none|random`.

## Verification
- **Sim:**
  - Demo: the first retire is 0h27 for +30. Then a re-delve about every 15 min for +6 each; lifetime Renown is 78 after 2.5 h.
  - Typist, `--retire nudge`, 4 h: floor 107, 7 retires, 279 Renown, omens chosen.
  - Idle: floor 85, 6 retires.
  - Demo renown check: first retire after the card gives 30, the next gives 6.
- **Browser (demo, fresh save):**
  - The pill shows, and the card shows stats and the wishlist button.
  - "Floor" renders correctly now.
  - After the card, the retire button reads "RETIRE FOR RENOWN" with "+21% DMG & GOLD FOREVER".
  - After the re-delve: floor 1, income reset, and the button reads "CLEAR FLOOR 40 AGAIN FOR +6 RENOWN".
  - No console errors.
- **Electron (`KK_DEMO=1`):** demo cap 40, Head Start max 2, docks, no errors. The z-order walk works under Node with koffi (193 windows walked, taskbars skipped by class).
- **File saves (R3 early):**
  - The save round-trips through the IPC bridge.
  - A file and a backup are written in the self-test profile.
- **Not verified:**
  - The real GPU after the transition removal and the fps change (needs the market probe).
  - The multi-monitor fullscreen scan inside Electron with a real second-monitor fullscreen window.

## Watch next round
- GPU while typing should now be ≤5%, and idle <3%. Rerun `docs/playtest/round-03/market_probe`.
- Fullscreen on monitor 2.
- Is the demo loop fun past the card? Does the wishlist card land?
- Omen balance with real choices (the auditor's two tuned values were applied: Storm 0.7, Ember Tide 0.85).
- Sanctuary is now an emergency reaction. Typists may almost never see it, because their party rarely drops below 50%.
- Is Second Wind noticeable for light typists?
