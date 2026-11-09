# Round 04: Summary

| Tester | R2 | R3 | R4 |
|---|---|---|---|
| Economist | 7.5 | 8 / demo 6.5 | **8 / demo 7.5** |
| Auditor | 6.5 | 6.5 | **7** |
| Market | 6.5 | 7.5 | **8** |
| Player (full game) | 7.5 | 7 (demo) | **7.5** |

## Headline findings
- **The demo's +6-per-clear Renown had no cap.** An imported demo save broke the full game: 24 h of idle demo play reached floor 194 within 2 h of the full game.
- **Omens:** Deep Omen dominated (+27%) and Veterans' Muster was worthless. Glass was free for idle players because defence stops mattering for them.
- **Sanctuary was almost never seen** (1–2% of boss fights). Late game posed no danger.
- **Hours 5–8 were still empty.** No goal after floor 100.
- **Head Start without Veterans sent a level-1 party backwards** (F26 → F9).
- **The omen modal was illegible:** upside and downside in one sentence, and the game kept running behind it.
- **Power (measured):**
  - Typing about 5.2% GPU, idle 2.7%, hidden or locked 0.0%.
  - Turning off DirectComposition measured **0.0% GPU** for a +0.1 pt CPU cost.
- **Fullscreen detection** gave false positives for maximized windows on taskbar-less monitors and for topmost click-through overlays.
- **Saves:**
  - Reset brought the demo save back.
  - A corrupt main file was rotated into the backups.
  - A locked file (antivirus or OneDrive) failed the write with no retry.
  - No save on Windows shutdown.
- **Packaged exe:** Electron fuses were open (RunAsNode let anyone run code with our native modules).
- **Achievements** were still missing. The auditor delivered a sim-tested set of 36 with exact triggers and unlock times.

## Changes made

### Packaging (new)
- **electron-builder 26:**
  - `npm run dist` builds the full game to `dist/full`.
  - `npm run dist:demo` builds the demo to `dist/demo`, with the demo flag baked in.
  - `npm run icon` renders `build/icon.png` from the pixel crown.
- **Fuses:**
  - RunAsNode, NODE_OPTIONS and inspect are off.
  - Asar integrity and OnlyLoadAppFromAsar are on.
  - GrantFileProtocolExtraPrivileges stays on, because the game loads from `file://`.
- **Trimmed natives:**
  - `asarUnpack: **/*.node`.
  - Non-Windows uiohook prebuilds and the koffi docs/vendor folders are excluded.
  - `signExts: [.node]` is ready for signing.
- **Verified:**
  - The packaged exe runs.
  - Fuses read back correctly.
  - `ELECTRON_RUN_AS_NODE` is blocked.
  - koffi and uiohook load from the asar.

### Economy and content
- **Demo Renown capped at 48** (30 for the first clear + 3 re-clears). After that, best time is the score: "DEMO RENOWN MAXED: BEAT YOUR BEST TIME".
- **Demo saves are tagged `demoSave`.** On load, the full game raises `renownFloor` to cover the demo Renown, so it isn't a bonus.
- **Omen changes:**
  - Deep Omen ×1.25 → ×1.12.
  - Glass also slows attacks by 20%.
  - Muster now keeps the last delve's Forge (gold ×0.8).
  - Never re-offers the previous offer's omens.
- **Depth trophies:** floors 75–125 every 5, then 130, 140 and 150. Each is ×1.05 damage and gold forever, from `maxFloorEver`. Floor 100 is "HEART OF THE KEEP" (banner and toast).
- **Sanctuary "Vigil":** the first slam of every boss fight always triggers it. KO and <50% reactions stay.
- **Hollowed bosses and The Hollow get a telegraphed void slam:** a "!! VOID SLAM !!" warning, then 45% of max HP to everyone, every 8 s. The late game now has danger and Sanctuary moments.
- **Head Start** also grants +8 hero levels per rank, and a retreat never goes above the Head Start floor.
- **Second Wind:** triggers after 30 s (was 60) with "SECOND WIND!" text, base cost 120, and a "FOR TYPISTS WHO PAUSE" tag. Static Coins gets the NEEDS TYPING tag.

### Achievements (new, `js/achievements.js`)
- **35 triggers** taken from the auditor's sim-verified table. Five are in the demo set: Cellar Door, Flow State, Fellowship, A New Generation, Gatekeeper.
- **Stored in the save:** unlock times in `S.ach`, progress in `S.achP`. Each unlock fires `achievement` (for the future Steam layer) and shows a toast. A collapsible list sits in Legacy; the demo shows only its 5.
- **Sim:** a typist following the nudge unlocks 30 of 35 in 8 h, an idle player 23 of 35. The demo gets 17 internally.
- **Dropped as impossible or trivial:** flow10, keys1m, f150 and others.

### UI and feel
- **Omen modal:**
  - Each card shows a green ▲ upside and a red ▼ downside.
  - The dungeon pauses while you choose (`KK.paused`).
  - An omen pill shows on the HUD ("◆ STORM FRONT").
  - A pending choice reopens after a restart.
  - After picking, Legacy opens scrolled to the achievements.
- **Visible rewards:** Ember floaters (+10 from bosses, +25 from rats), a trophy banner, and Pell's card shows Sanctuary as FREE.
- **Wall hint:** a readable dark pill you can click (opens Legacy when a retire pays, Party otherwise).
- **Less late-game noise:** hit-flash is limited to once per 0.25 s, so the Hollowed tint stays visible. Past level 100, milestone banners and sounds come only every 50 levels.
- **Small fixes:** the "chest(s)" plural, and "LEVEL UP" no longer wraps.

### Shell, power and saves
- **Low-GPU mode, default on:** `disable-direct-composition` on Windows, read from the save before startup. A Settings toggle applies after a restart.
- **Idle frame rate:** coin flights no longer force 24 fps; idle caps at 15.
- **Fullscreen scan:** skips click-through (`WS_EX_TRANSPARENT`) and topmost no-activate overlays. A covering window counts only if it isn't maximized and isn't resizable (`WS_THICKFRAME`).
- **Saves:**
  - Only a valid main file joins the backup ring; a corrupt one is renamed `.corrupt-<ts>.json`.
  - Renames retry on EPERM/EACCES/EBUSY (5 tries).
  - Durable fsync on quit.
  - Flush on `session-end` and `before-quit`.
  - The demo import happens only once, with a marker file; reset writes the marker too, so the demo never comes back.
  - "Restored from backup" and "Demo progress came with you" toasts.
- **Shell details:** AppUserModelId is set. The tray says "nothing typed is stored", which is honest about in-memory repeat filtering.

### Harness
- `playtest.js` handles the demo like the game: it waits for the card and re-delves on clear. It prints achievements, trophies, demo laps and best time.
- The headless loader includes `achievements.js`.

## Verification
- **Sim (seed 5, `--retire nudge --omen random`):**

  | Profile | 8 h result | Sanctuary casts |
  |---|---|---|
  | Typist | max f135, 12 trophies, 30/35 achievements | 121 |
  | Idle | max f106, 7 trophies, 23/35 achievements | 103 |
  | Demo (3 h) | Renown stops at 48, 5 laps, best f40 6.3 min | – |

- **Browser:**
  - The second retire shows the omen modal: three cards with ▲/▼ lines, and the game paused.
  - Picking Storm Front works: the HUD pill shows "◆ STORM FRONT" and the game unpauses.
  - Achievements show 2/35 (retire1, omen1).
  - Pell's card shows FREE.
  - No console errors.
- **Packaged exe:**
  - Fuses read back correctly, `ELECTRON_RUN_AS_NODE` is blocked, and the native modules load.
  - 311 MB unpacked, almost all of it Electron.
- **Not measured yet:**
  - GPU with low-GPU mode in our build. The market probe A/B was 5.1–5.5% → 0.0%.
  - The CPU cost of low-GPU mode on an iGPU laptop.
  - The new fullscreen filter against real overlays.

## Watch next round
- Is the void slam fun or punishing? It's 45% of max HP every 8 s, with Vigil Sanctuary on the first one.
- Trophy snowball: typist max f135 at 8 h (was about 128).
- Re-measure GPU with low-GPU mode; save edge cases on the real build.
- Remaining Next Fest blockers (owner: user):
  - Steamworks account and app id.
  - Code-signing certificate.
  - Store page assets and trailer.
- Steamworks code integration once there's an app id.
