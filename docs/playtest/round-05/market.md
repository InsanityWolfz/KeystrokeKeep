# Round 05 — T3 "market" (Steam Market & Reviews Analyst)

## Verdict
**Low-GPU mode, the R4 fix I asked for, ships an empty dungeon.** It is on by default. With it on, every sprite baked at startup is wiped: the heroes, monsters, bosses, chests, skull decorations and the canvas copies of the icons.
- What's left on screen is HP bars, damage numbers, walls and the HUD.
- It reproduces in the dev shell and in the packaged `Keystroke Keep.exe`: every normal low-GPU start here (11 of 11 probe boots plus 2 self-test snapshots). The one run that escaped had my diagnostic preload, which delayed the bake until after the wipe. So it's a race, and on this machine startup loses it every time.
- My R4 report called the low-GPU render "identical". It wasn't: the R4 screenshot `transp_disable_direct_composition.png` already has no knight. That miss is mine.
- The cause is measured. DirectComposition-off makes Chromium fire `contextlost` on GPU-backed 2D canvases about 207 ms after navigation, and `sprites.js` bakes before that.
- The fix is a one-liner, and I measured it.

Everything else from R4 holds:
- **Fullscreen false positives:** both R4 cases are fixed on 3 of 3 monitors, and real fullscreen still hides.
- **Saves:** all the R4 hardening cases pass.
- **Packaged build:** fuses are correct, asar integrity is enforced (a tampered asar is FATAL), RunAsNode is dead, both natives load from `app.asar.unpacked`, and the hook counted 40 of 40 injected keys in the packaged demo.

The honest power picture of low-GPU mode:
- Our GPU column goes 5.5% → 0.0%.
- On a laptop-class core, CPU roughly doubles: about 16 → 32% of one core while typing, which is +4 points of Task Manager CPU on a 4-thread laptop.

As shipped I'd refund it today: "the heroes are invisible" is a first-minute refund. Fix F1 and I'd keep it running. **Rating: 6/10 as shipped, 8.5/10 with F1 and F2 done.**

## Findings (ranked, max 8)

### F1 [severity: blocker] Low-GPU mode (default ON) wipes every sprite baked at startup: the heroes and monsters are invisible on the desktop build
**Evidence (`docs/playtest/round-05/market_probe`):**
- **`KK_PROBE=sprites`, low-GPU on vs off, same save:**
  - The real screen grab (`out/sprites_lowgpu_on_screen.png`) shows an empty corridor: HP bars, "1.7" and "5" damage numbers, and death debris, but no knight, no rat and no alcove skulls.
  - With low-GPU off (`out/sprites_lowgpu_off_screen.png`), the knight, the rat and the skulls are all there.
  - The packaged self-test snapshot looks the same (`out/packaged_selftest_snapshot_lowgpu.png`, from `dist/full/win-unpacked/Keystroke Keep.exe` with `KK_SNAPSHOT`).
- **`KK_PROBE=eval` with `diag_lost.js`:** with low-GPU on, **48 of 48 sprite frames and 25 of 25 icon canvases are blank** (alpha-pixel count 0). With it off, 0 of 48 are blank. `app.getGPUFeatureStatus().gpu_compositing` reads `disabled_software` (on) vs `enabled` (off).
- **`KK_PROBE=losttime` with `diag_preload.js`:** a preload makes 16×16 canvases and polls them every 25 ms.
  - At **t = 207 ms** a `contextlost` event fires.
  - By 282 ms the plain canvas reads 0 pixels. Canvases created with `{ willReadFrequently: true }` and canvases already read once with `getImageData` keep their pixels.
  - With low-GPU off there's no event.
  - `js/sprites.js` bakes at script-evaluation time, before that ~200 ms mark. Nothing in `js/` listens for `contextlost`/`contextrestored` (grep is empty).
- **What else I checked:**
  - Baking again after boot works: `diag_bake.js`, and `KK_REBAKE=1` re-runs `sprites.js` and shows the party (`out/sprites_rebake_lowgpu_on_screen.png`).
  - **`disable-gpu-compositing` (the other switch) does not wipe** (knight 143 px at boot). It costs 2.3–2.9% GPU and the same CPU as DirectComposition-off (table in F2), so it's no better.
- The HUD portraits and icons still look fine, because their data URLs were taken before the wipe. That hid the bug from a quick look.

**Why it matters:**
- The fantasy is "watch your party fight below your work", and the strip shows HP bars fighting nothing.
- The Steam review writes itself: "the heroes are invisible, just floating health bars". That's a refund in the first minute.
- It would also be in every trailer and screenshot recorded from the desktop build.
- T4 tests in the browser, where the switch doesn't exist, so no other tester can see it.

**Proposed fix (30 min, before anything is recorded or published):**
1. In `js/sprites.js`, `canvas()` should create CPU-backed canvases, which are never wiped:
   `function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', { willReadFrequently: true }); return c; }`
   - The first `getContext` call fixes the options.
   - Do the same for every canvas baked once in `render.js`: `makeBiomeArt` (wall, emis, floor), `hollowTint`'s cache, and `light` if it's ever kept between frames.
   - **Measured cost: none.** With exactly this fix (`KK_REBAKE=wrf`, 4 E-cores), typing costs 30.6–37.4% of one core vs 33.3–38.5% for the plain re-bake. That's noise.
2. Belt and braces: listen for `contextlost`/`contextrestored` on `#game`, and on a timer check one sprite (`getImageData` alpha count of `SPR.frames.knight[0]`). If it's ever 0, re-bake (wrap the bake block in `S.build()`) and call `R.init` art again. Driver updates, sleep/resume and RDP sessions can wipe GPU canvases in GPU mode too.
3. Release gate: the `KK_SNAPSHOT` self-test should fail if `SPR.frames.knight[0]` has 0 alpha pixels. Run it on the packaged exe.

### F2 [severity: major] Low-GPU mode's real price: 0% in our GPU column, but about 2× CPU on laptop-class cores
**Evidence (`run_perf.sh`):**
- Setup:
  - 12 one-second samples per state. Typing is simulated at 5.5 keys/s.
  - Low-GPU runs used `KK_REBAKE` so the party is actually drawn.
  - "Laptop proxy" means affinity pinned to 4 or 2 **E-cores** of the i9-13900K (`KK_AFFINITY=F0000` / `30000`). Gracemont cores are a fair stand-in for a mid-range laptop core.
  - "1-core%" is the sum of `% Processor Time` over our processes (100 = one full core). "TM%" is Task Manager CPU on a machine with that many threads.
  - Raw data: `out/perf_*.json`, `out/perf_table.tsv`.

  | Config (runs) | State | Our GPU 3D % | CPU 1-core % | TM % (that machine) | private MB |
  |---|---|---|---|---|---|
  | i9 all 32 threads, low-GPU **off** (2) | idle / typing (muted) / typing 30 fps | 3.3 / 5.5 / 6.3 | 5.3 / 13.0 / 13.7 | 0.2 / 0.4 / 0.4 | 299–320 |
  | i9 all threads, low-GPU **on** (2) | idle / typing / 30 fps | **0.0 / 0.0 / 0.0** | 7.6 / 15.4 / 18.1 | 0.2 / 0.5 / 0.6 | **238–255** |
  | **4 E-cores, off** (2) | idle / typing / 30 fps | 3.3 / 5.6 / 6.4 | 8.6 / **16.1** / 23.4* | 2.1 / **4.0** / 5.8 | 303–327 |
  | **4 E-cores, on** (2, incl. the wrf fix) | idle / typing / 30 fps | 0.0 / 0.0 / 0.0 | 18.2 / **31.9** / 37.9 | 4.6 / **8.0** / 9.5 | 237–254 |
  | 4 E-cores, `disable-gpu-compositing` (1) | idle / typing / 30 fps | 1.3 / 2.3 / 2.5 | 16.4 / 29.1 / 38.5 | 4.1 / 7.3 / 9.6 | 192–219 |
  | **2 E-cores, off** (1) | idle / typing / 30 fps | 3.1 / 5.1 / 5.9 | 4.9 / **13.8** / 16.5 | 2.5 / **6.9** / 8.3 | 320–392 |
  | **2 E-cores, on** (1) | idle / typing / 30 fps | 0.0 / 0.0 / 0.0 | 12.8 / **32.6** / 37.3 | 6.4 / **16.3** / 18.7 | 241–262 |
  | Hidden (tray), every config | – | 0.0 | 0.1–1.6 | ≤0.8 | – |

  \*One of the two "off" 30 fps samples overlapped a DWM CPU spike (31% DWM); the other run read 13.1.

- **The low-GPU price per E-core is +10 points of a core idle and +16 to +19 points while typing.** On a 4-thread laptop that's about 8% Task Manager CPU while typing, against 4% in GPU mode. On 2 threads, 16% against 7%.
- On the i9's P-cores the difference is small: +2–4 points of a core.
- Memory: low-GPU saves about 65 MB private.
- **DWM** 3D was 1–3 points higher with low-GPU on (idle 19.1 vs 15.5, typing 30 fps 20.7 vs 18.3). But the system 3D total swings ±5 between identical runs, so "0% GPU" is true for our Task Manager row, not provably for the machine.
- Wakeups: hidden is unchanged at 170 ctx-switches/s on all threads. Typing is 1,700–2,600/s in both modes.
- Sound on vs muted: the first typing phase (sound on) read higher than muted in most runs. It also overlapped the FLOW and toast onset, so I don't claim an audio cost.

**Why it matters:**
- A desktop GPU owner sees our row at 0% GPU, which is the headline we wanted.
- A laptop owner on battery pays about twice the CPU for an iGPU saving that **software compositing likely loses on power**: CPU raster of a 3840×288 surface 24 times a second, versus an iGPU that composites for nearly free.
- The first "drains my laptop battery" review in this niche is the one that sticks.
- Neither number has been checked on a real iGPU laptop.

**Proposed fix (1 h):**
- Make `settings.lowGpu` tri-state: `'auto'` (default), `true` or `false`.
- `'auto'` means ON only when the machine has no system battery, i.e. a desktop. Detect it before `ready` with koffi: `GetSystemPowerStatus` → `BatteryFlag & 128` (no system battery). Laptops get GPU compositing, which also keeps them clear of F1-type risks.
- Keep the Settings toggle, and label the trade-off honestly: "Low-GPU: 0% GPU, uses more CPU. Best on desktops".
- On battery, `KK.onBattery` already caps at 20 fps. Consider 15 fps while typing on battery: −0.19% GPU per fps in R4's measurement, and proportional CPU savings.
- Before printing a requirements notes line, run `KK_PROBE=perf` on one real iGPU laptop (both modes). Gate: Task Manager CPU ≤3% while typing at 4 threads, in whichever mode `'auto'` picks.

### F3 [severity: major] The packaged demo shares the full game's Chromium profile and single-instance lock, so the demo-vs-full dialog never shows: the second app quits silently
**Evidence:**
- `dist:demo` sets `--config.productName="Keystroke Keep Demo"`. That renames the exe (VersionInfo ProductName "Keystroke Keep Demo"). But the `package.json` inside `dist/demo/.../app.asar` still says `"productName": "Keystroke Keep"` (I extracted it), and Electron's `app.name` and `userData` come from that file.
- My packaged demo run (below) wrote its Chromium profile (`Preferences`, `DIPS`, `Network/`, `Session Storage/`, all timestamped 11:40) into **`%APPDATA%\Keystroke Keep`**, the full game's folder. Its saves correctly went to `Keystroke Keep Demo\saves`.
- So `requestSingleInstanceLock()` (`main.js:359`) uses the **same lock** for demo and full.
  - Starting the full game while the demo runs fails the lock, and `app.quit()` runs silently **before** the R4 named-pipe dialog (`main.js:365-375`) can explain anything.
  - There is no `app.on('second-instance')` handler, so the running app doesn't react either.
  - Same build, launched twice: the second exits with no feedback (measured: `secondInstanceExited: true`), even when the strip is hidden in the tray.
- I didn't re-launch the full exe against the real folder to watch this happen; it follows from the shared lock path above.

**Why it matters:**
- Someone who just bought the game after the demo presses Play in Steam with the demo still in the tray, and nothing happens. "Full game won't launch" is a refund review on launch day.
- Same-build relaunch while hidden: "I click the icon and nothing happens."

**Proposed fix (20 min):**
1. In `dist:demo`, add `--config.extraMetadata.productName="Keystroke Keep Demo"` (keep `kkDemo`). The demo then gets its own `userData` and lock, and the pipe dialog becomes reachable. Re-check with my `packaged_demo_test.ps1`: the profile must land in `Keystroke Keep Demo`.
2. Add `app.on('second-instance', () => { sys.userShown = true; applyVisibility(); tray && tray.displayBalloon({ title: 'Keystroke Keep is already running', content: 'Here it is!' }); })`.
3. In the pipe dialog, offer **"Quit the demo and start the full game"**: write `quit` to the pipe, and have the owner `app.quit()` when it reads `quit`. Then retry the listen for 3 s.

### F4 [severity: minor] Fullscreen filter: both R4 false positives are fixed, but the new maximized/thick-frame rule misses two real "fullscreen" styles
**Evidence (`KK_PROBE=fs`, 30 cases on 3 monitors, `out/fs.txt`; helper windows are separate processes):**
- **PASS on 3 of 3 monitors:**
  - Electron fullscreen hides (0–1 s) and returns (0–1.1 s).
  - Borderless covering window hides.
  - **Topmost borderless game window** (new case) hides.
  - Fullscreen on another monitor stays visible.
  - Real maximized window stays visible.
  - **Maximized geometry on a taskbar-less monitor** (R4 FAIL) now stays visible.
  - **Topmost click-through overlay** (R4 FAIL) now stays visible.
  - Fullscreen, then focus to another monitor: stays hidden.
- **FAIL on 3 of 3 (new cases), strip stays visible over a fullscreen app:**
  - **Borderless window that is maximized** (`0x17010000`, `IsZoomed`). This is the WinForms/WPF/kiosk "fullscreen" idiom, and it covers the taskbar.
  - **Borderless window with `WS_THICKFRAME`** covering the monitor (`0x16050000`). That's WPF `WindowStyle=None` + `ResizeMode=CanResize`, which many launchers and video players use.
- `scanExplain` logged the styles. **One rule classifies all 7 shapes correctly:** "covers the monitor rect **and** has no full caption (`(style & WS_CAPTION) !== WS_CAPTION`, `WS_CAPTION = 0xC00000`)".

  | Window shape | caption | thickframe | zoomed | covers | No-caption rule |
  |---|---|---|---|---|---|
  | Electron fullscreen | no | no | no | yes | fullscreen ✓ |
  | Borderless game | no | no | no | yes | fullscreen ✓ |
  | Topmost borderless game | no | no | no | yes | fullscreen ✓ |
  | Kiosk (borderless + maximized) | no | no | yes | yes | fullscreen ✓ |
  | WPF thick borderless | no | yes | no | yes | fullscreen ✓ |
  | Maximized, no taskbar (bigframe) | **yes** | yes | no | yes | not fullscreen ✓ |
  | Normal maximized | yes | yes | yes | no (work area) | not fullscreen ✓ |

**Why it matters:** this is low-frequency. A player who watches video in a WPF player sees the strip sitting over the bottom of the film, which is the "covers fullscreen" complaint the R2/R3 work was meant to end. The R4 false positives were worse, because there the strip vanished, and they're gone.

**Fix (10 min, `main.js:157`):** replace `covers && !W.zoomed(h) && !(style & 0x00040000)` with `covers && (style & 0x00C00000) !== 0x00C00000`, keep the overlay skip, and re-run `KK_PROBE=fs`. All 30 cases should pass.

### F5 [severity: minor] Saves: all the R4 cases pass; three small edges remain
**Evidence (`run_saves.sh`, 18 scenarios, isolated `%APPDATA%\kk-market-probe-r5`, `out/save_*.json`):**

| Scenario | Result | Verdict |
|---|---|---|
| Corrupt main + bak1 = 23, bak2 = 21 | Loads 23, `saveInfo` = `backup`, **toast "Your save was damaged, so it was restored from a backup."** The main file is renamed `.corrupt-<ts>.json`. 11 min later the ring is bak1 23 / bak2 23 / bak3 21 (**no corrupt file in the ring**) | PASS (R4 FAIL) |
| 0-byte main + bak1 = 23 | Loads 23, same toast, quarantined | PASS |
| Demo import (no full save) | Loads 31, toast "Welcome to the full game! Your demo progress came with you.", marker written | PASS |
| Relaunch after the import | Loads the full save (`main`), no second import | PASS |
| Marker present, full save deleted, demo = 31 | Fresh game (floor 1) | PASS |
| **Full 55 + demo 31 → Settings › Reset → reload** | **Floor 1**; only `demo-imported.flag` is left | **PASS (R4 FAIL)** |
| Rotation (+11 min per save) | Ring = the 3 previous 11-min saves | PASS |
| File locked 100 ms / 250 ms | Write succeeds after a 147 / 305 ms retry | PASS (R4 FAIL) |
| File locked 600 ms / 2 s / 5 s | `kk:saveSync` false, `.tmp` left; the next write after the lock clears succeeds | Bounded: the next 10 s autosave retries |
| `session-end` emitted | Flushes the **last text the renderer sent** (floor 71; the unsaved live floor 72 is lost) | PASS as designed (≤10 s of loss) |
| `lowGpu` false / true / no settings / corrupt file | Switch off / on / on / on (`gpu_compositing` enabled vs disabled_software) | PASS |
| Demo build with full = 55 + demo = 31 | Loads 31, full folder untouched | PASS |
| localStorage migration | Loads 17 | PASS |
| Real `%APPDATA%\Keystroke Keep\saves\keystroke-keep.json` | md5 `d680a06b…` before and after, mtime 10:46 | Untouched |

Edges, in order of value:
1. **The retry blocks the main process for up to 305 ms** (`Atomics.wait`) on every failed save. During a long OneDrive or AV lock that's a freeze every 10 s, and the hook callbacks queue behind it. Better: no sleep in the async `kk:save` path. Schedule the retry with `setTimeout` (20/40/80/160/320 ms). Keep the sync retry only for quit.
2. **A failed rename leaves a newer `.tmp` that `readSave()` ignores.** In `readSave()`, try `keystroke-keep.json.tmp` first when it's valid and newer than the main file.
3. **A corrupt main with no backups imports the demo in a full-game install that never imported** (no marker), and greets the player with "Welcome to the full game!". Write the marker on the first successful full-game save as well. Then the demo can only be imported into a game that has never saved.
4. **Steam Auto-Cloud:**
   - My R4 note was wrong. The quarantine file is `keystroke-keep.corrupt-<ts>.json`, which **matches the `*.json` cloud pattern**, and so do the `.bak` files.
   - Use the pattern `keystroke-keep.json` only (plus `demo-imported.flag`).
   - Or rename the quarantine file to `keystroke-keep.json.corrupt-<ts>`.

### F6 [severity: minor] Packaged build: verified end-to-end; signing is the remaining gap
**Evidence:**
- **Fuses** (`npx @electron/fuses read`):
  - Off: RunAsNode, NODE_OPTIONS, `--inspect`, CookieEncryption.
  - On: **EmbeddedAsarIntegrityValidation** and **OnlyLoadAppFromAsar**.
  - GrantFileProtocolExtraPrivileges is on, which `file://` needs.
  - A ninth fuse reads "undefined is Enabled": @electron/fuses doesn't know its name yet. Harmless.
- **RunAsNode:** `ELECTRON_RUN_AS_NODE=1 "Keystroke Keep.exe" -e "console.log('NODE_RAN')" --inspect=9339` (with `KK_SNAPSHOT` so it stayed in the self-test profile) **booted the game and wrote a snapshot**. No `NODE_RAN`, no debugger. PASS (R4 FAIL).
- **Asar integrity:** a copy of `win-unpacked` with one byte of `app.asar` flipped → `FATAL: asar_file_validator.cc:129 Failed to validate block`, no window. PASS.
- **Packaged demo, real launch** (`packaged_demo_test.ps1`; it runs only when `%APPDATA%\Keystroke Keep Demo` doesn't exist and deletes it afterwards):
  - 4 processes, 499 MB working set / **243 MB private**.
  - Loaded modules include `app.asar.unpacked\...\koffi.node` and `...\uiohook-napi.node`.
  - **40 injected F24 key presses → `stats.keys = 40`**.
  - Second launch exited.
  - Graceful `taskkill` quit in 0.2 s and wrote a 1,037-byte save (`demoSave: true`).
  - Folder cleaned up.
  - As described in F3, its Chromium profile went to `%APPDATA%\Keystroke Keep`. The save file there was untouched, as verified by md5.
- **Size:** `win-unpacked` is 310 MB (exe 250 MB).
  - `app.asar` is 666 KB, 84 entries: `index.html`, `css`, `js`, `assets/fonts` and `electron`, plus `koffi`, `uiohook-napi` and `node-gyp-build`. No docs, tools or maps.
  - `app.asar.unpacked` is 1.3 MB: the two win32-x64 `.node` files only (R4 shipped 6 foreign prebuilds).
- **Not done:**
  - `Get-AuthenticodeSignature` → **NotSigned** on the exe and both `.node` files. This is still the backlog blocker.
  - Copyright reads "Copyright c 2026 Keystroke Keep". Put the legal studio name in `build.copyright` before the Steam build.
- **Note:** `KK_SNAPSHOT` self-tests read the low-GPU flag from the **real** save (`main.js:353` ignores the `-selftest` profile). It's read-only, but self-test results then depend on the player's setting. Read it from `saveDir()` instead.

### F7 [severity: major for marketing] Store page: there is now an exact-fit Steam event five weeks before Next Fest, and the lane got crowded
**Evidence:**
- **Steam Desktop Companion Fest runs Jan 14–18, 2027.** Its description is "games that sit on your desktop and keep you company while you do other things."
  - Eligibility hinges on the **Desktop Companion** tag.
  - The page lists Coming Soon titles and demos as their own sections.
  - Discounts are optional.
  - Valve's announcement trailer goes out Jan 8.
- **Next Fest February 2027:**
  - Registration closes **Jan 10**.
  - **Jan 18** is the deadline for demo plus store page review if you want to be in the Feb 11 Press Preview, and the same day Valve pulls trailers for the official Next Fest trailer.
  - The fest runs **Feb 22 – Mar 1**.
- A Coming Soon page has to be live **≥14 days** before release, and the review request goes in **≥7 business days** before you want it public.
- **Competition:**
  - Desktop Heroes (Oct 2025, $5.99, a bottom-of-screen idle party RPG that also pitches "as you type emails, write code") sits at **70% of 104, Mostly Positive**. Its top visible negative reviews say it's not idle enough (about 8 of 10) and shallow after a few hours (about 6 of 10). None mention performance.
  - Idle Squire (May 2026, $4.99: "every time you press a key, your squire attacks") has 6 reviews.
  - Corner Dungeon (free, 2027, playtest) already carries Desktop Companion as its #1 tag.

**Why it matters:**
- Desktop Companion Fest is the one Steam event built for exactly this game, and it falls before Next Fest. Missing it wastes the best free visibility of the launch window.
- The keypress hook is no longer unique, so the store page has to sell the **payoff** (FLOW → Meteor → boss) and the idle-first, deep-progression design that Desktop Heroes' reviewers are asking for.

**Fix:** the checklist, tags and trailer shot list below. **Coming Soon review request by ~Dec 7, page live by ~Dec 18.**

### F8 [severity: minor] R4 F5 and F6 are still open (mouse-move wakeups; idle at 15 fps during coin flights)
- Idle `targetFps` read **15** in 3 of 12 idle phases (`on_all_2`, `off_e4_2`, `onwrf_e4`), so the R4 cap works (15, not 24). Coin flights still lift idle above 10.
- The mouse-move wakeup work (Raw Input) is post-fest, as already backlogged.
- Nothing new here. It's listed so the backlog stays honest.

## Verified fixes from last round (pass/fail, one line each)
- **Low-GPU switch read from the save before ready:** PASS. lowGpu false → `gpu_compositing: enabled`; true, missing or corrupt → `disabled_software`. **But it renders no sprites (F1).**
- **Low-GPU GPU cost:** our GPU drops from 5.5% to **0.0%** while typing and from 3.3% to 0.0% idle; private memory is about 65 MB lower. **CPU is about 2× on E-cores (F2).**
- **Fullscreen false positives (maximized with no taskbar; topmost click-through overlay): PASS on 3 of 3 monitors.** Real fullscreen, borderless and topmost-borderless still hide: PASS. New misses in F4.
- **Corrupt main quarantined, not rotated: PASS.** Ring stays clean after 11 min. Restore toast shows via `kk:saveInfo`.
- **Locked-file retries: PASS** for locks ≤250 ms; locks over about 300 ms still fail that one write (the next autosave recovers).
- **Reset doesn't bring back the demo: PASS.** One-time import with the marker: PASS. Relaunch after the import: PASS.
- **Session-end / before-quit flush: PASS** (flushes the last renderer save; ≤10 s of loss). The packaged graceful quit wrote its save in 0.2 s.
- **Fuses closed, RunAsNode blocked, asar integrity on: PASS** (tamper → FATAL).
- **Trimmed natives: PASS** (1.3 MB unpacked, win32-x64 only).
- **Natives load and the hook works in the packaged layout: PASS** (40 of 40 keys counted).
- **Demo and full at once blocked: FAIL in practice.** The shared userData lock pre-empts the pipe dialog, and the second app quits silently (F3).
- **Signing: still not done** (NotSigned).

## Store-page readiness: "Coming Soon" checklist (target: live by Dec 18; see dates)

### Calendar this has to hit (Steamworks, Nov 9 2026)
| Date (PST) | What | Source |
|---|---|---|
| **~Dec 7** | Submit store page for review ("Mark as ready for review"): Valve asks for **≥7 business days** before you want it live; budget a resubmit | coming_soon doc |
| **Dec 8** | Next Fest Feb 2027 live Q&A (Zoom) | Next Fest Feb 2027 page |
| **~Dec 18** | Coming Soon page live (wishlists start; needed for both events below) | – |
| **Jan 8** | Desktop Companion Fest announcement trailer goes out; you may announce participation | DCF 2027 page |
| **Jan 10, 23:59** | **Next Fest registration deadline** | Next Fest Feb 2027 page |
| **Jan 14–18** | **Steam Desktop Companion Fest** (themed event, Coming Soon titles and demos have their own sections; *requires the "Desktop Companion" tag*) | DCF 2027 page |
| **Jan 18** | Demo build + store page submitted for review (to be live at Press Preview); Valve pulls trailers for the official Next Fest trailer | Next Fest Feb 2027 page |
| Feb 1 | Last day to submit everything for Next Fest | same |
| Feb 11, 10:00 | Press Preview | same |
| **Feb 22 – Mar 1** | **Steam Next Fest** | same |

The LOOP backlog's "Coming Soon ~Nov 23, trailer Jan 8, deadline Jan 18" is still right in spirit, but **Desktop Companion Fest (Jan 14–18) is a new, exactly-on-niche event five weeks before Next Fest**. A Coming Soon page with the Desktop Companion tag (and ideally the demo) by Jan 14 gets a second featured window for free.

### Graphical assets
Sizes are from Steamworks "Store Graphical Assets" (the August 2024 sizes; the old sizes are rejected).

Capsule rules (Steamworks asset rules):
- Capsules carry **only artwork plus the game name or official subtitle**.
- Not allowed: review quotes, award laurels, "Wishlist now", "Demo available", discount text.
- Library hero: no words at all.
- Library logo: the logotype only, as a transparent PNG.

| # | Asset | Size (px) | Required | What to put on it |
|---|---|---|---|---|
| 1 | Header capsule | **920 × 430** | yes | Logo top-left. The party mid-Meteor in a FLOW-lit crypt, with a keyboard edge peeking in at the bottom (the hook: keys under the dungeon). Must still read at half size. |
| 2 | Small capsule | **462 × 174** | yes | Logo and one hero only. This is the tile in Next Fest and Desktop Companion Fest lists, so test it at 231 × 87. |
| 3 | Main capsule | **1232 × 706** | yes | The header art, wider: the strip floating over a blurred desktop (code editor or spreadsheet). |
| 4 | Vertical capsule | **748 × 896** | yes | Used in seasonal sales. Stacked logo, Knight and Meteor. |
| 5 | Screenshots | **≥1920 × 1080, 16:9**, at least 5 | yes | See the list below. |
| 6 | Page background | 1438 × 810 | optional | Skip it for Coming Soon, or use the dark brick wall at 20% brightness. |
| 7 | Library capsule | **600 × 900** | yes | Logo and the party on a tall crypt column. |
| 8 | Library hero | **3840 × 1240** | yes | No text. Crypt wall, torches, banners, the party walking. Render it at 4K from the game's own canvas. |
| 9 | Library logo | **1280 wide and/or 720 tall**, transparent PNG | yes | Pixel crown plus "KEYSTROKE KEEP". |
| 10 | Library header | **920 × 430** | yes | Same as #1. |
| 11 | Shortcut icon | **256 × 256** .ico or .png | yes | `build/icon.png`, the pixel crown, exported at 256. |
| 12 | App icon | **184 × 184** .jpg | yes | The same crown on a dark background. |
| 13 | Trailer | up to 1920 × 1080, 16:9, 30 or 60 fps, **5,000+ kbps**, H.264/AAC .mp4 | recommended for Coming Soon; needed by Jan 18 | The shot list below. Whichever trailer is listed first must be gameplay. |

**Screenshots** (1920 × 1080). Every one shows the real strip over a real desktop.
1. **The hook:** a code editor or Google Docs fills the screen, and the strip below it is in FLOW STATE (gold light, the "FLOW STATE! x2.2 POWER" banner).
2. **Boss kill:** the "VICTORY! Bone King falls" banner with a coin shower.
3. **Relic pick:** three cards over a spreadsheet.
4. **Omen choice:** the cards with green ▲ and red ▼ lines.
5. **After a retire:** "A NEW GENERATION RISES +N RENOWN", with Legacy and the achievement list open.
6. **Late game:** The Hollow, with the "!! VOID SLAM !!" warning and a Sanctuary save. This proves there is a late game.
7. **Polite on your PC:** sizes S, M and L, or the strip on a second monitor while a game runs fullscreen on the first (the auto-hide story).
8. **Footprint:** Task Manager next to the strip. Only after F1 is fixed and the number is honest.

Every screenshot must show the party. With low-GPU mode on (today's default), a capture of the real strip shows an empty dungeon (F1).

### Copy fields
| Field | Limit | Draft |
|---|---|---|
| Short description | 300 chars | "A tiny pixel-art dungeon crawler that lives in a slim strip at the bottom of your screen. Every keystroke and click you make while you work powers your party of heroes. It counts how much you type, never what you type, and hides itself when you go fullscreen." (262 chars) |
| About This Game | – | The R4 feature list, with counts checked against `js/data.js` this round: **4 heroes, 12 monsters and 7 bosses, 4 biomes, 17 relics, 10 Delve Omens, 14 depth trophies, 35 achievements**. |
| Privacy FAQ | – | The R4 "Is this a keylogger?" FAQ, unchanged. Put it inside About This Game, not only in a discussion thread. |
| Languages | – | English (interface only). |
| Release date | – | "Coming soon" or "Q1 2027". Don't commit to a day before the build is signed. |
| Content survey and AI disclosure | – | Mild fantasy violence. Answer the AI question truthfully. Idle Squire discloses AI art, so hand-made pixel art is a selling point if true. |
| System requirements | – | Windows 10/11 64-bit, 2 cores / 4 threads, 4 GB RAM, DirectX 11 or integrated graphics, 400 MB. Write the notes line from F1/F2 numbers once they're fixed. |
| Price | – | $4.99. That matches Idle Squire, is under Desktop Heroes ($5.99) and under Rusty's Retirement ($6.99). |

### Tags
Steamworks rules:
- Up to 20 tags. The top 5 should describe the game, and the first 15 feed store filters.
- The tag wizard lives under Edit Store Page → Basic Info → Tags.
- **Desktop Companion Fest eligibility depends on the "Desktop Companion" tag.**

Comparable pages, top tags as shown on Steam today:

| Game | Release / price | Reviews | Top tags |
|---|---|---|---|
| Rusty's Retirement | Apr 2024, $6.99 | 97% of 6,625 | Idler, Farming Sim, **Desktop Companion**, Automation, Management, Simulation, Relaxing … |
| Desktop Heroes (bottom-of-screen idle party RPG; "as you type emails, write code…") | Oct 2025, $5.99 | **70% of 104, Mostly Positive** | Nature, Idler, Pixel Graphics, Cute, Casual, Relaxing, Simulation, Side Scroller, 2D, RPG … |
| Idle Squire ("every time you press a key, your squire attacks") | May 2026, $4.99 | 6 reviews, no score | Casual, Incremental, Idler, RPG, Roguelike, Auto Battler, Dungeon Crawler … |
| Corner Dungeon (free desktop idle battler) | 2027, playtest | – | **Desktop Companion**, Idler, Loot, Free to Play, Incremental … |
| Idlewood Outpost (pixel heroes patrol the bottom of the screen) | – | – | Idler, Cute, Relaxing, Pixel Graphics, Cozy, RPG … |

**Proposed order:**
1. Desktop Companion
2. Idler
3. Incremental
4. Dungeon Crawler
5. RPG
6. Pixel Graphics
7. Auto Battler
8. Relaxing
9. Casual
10. Fantasy
11. 2D
12. Side Scroller
13. Loot
14. Roguelite
15. Typing
16. Singleplayer
17. Cute
18. Party-Based RPG
19. Indie
20. Retro

Why this order:
- **Desktop Companion** comes first: it decides fest eligibility, and it is the niche's own browse tag.
- **Idler and Incremental** are what this audience filters on.
- **Dungeon Crawler and Auto Battler** separate us from the farming and cozy majority.
- **Typing** is honest, but it also attracts typing-tutor buyers. Keep it at 15, outside the first 5.
- Don't use Cozy, Nature or Farming.

**Lane warning:** the bottom-of-screen idle RPG lane went from empty to crowded in 2025–26.
- Desktop Heroes is the closest match. Its visible negative reviews say:
  - "not idle enough / needs constant attention": about 8 of 10.
  - "shallow after a few hours": about 6 of 10.
  - "too expensive for the content": 2 of 10.
  - Performance: 0 of 10.
- Idle Squire already sells "every keypress attacks" at $4.99 and has 6 reviews. **The typing hook alone doesn't sell.** The capsule and trailer have to show the payoff: FLOW STATE turns the dungeon gold and Meteor wipes a screen.
- Our advantages on those review themes are idle-first design, offline progress, retire/omen depth and auto-hide. Say them in the first two feature bullets.

### Trailer: 30 seconds, gameplay first, readable on mute
Valve's guidance: you may have under 10 seconds to make an impression, and many viewers watch without sound.

How to record:
- Capture the real Electron strip over a real desktop at 1920 × 1080; 150% scaling keeps the pixels crisp.
- Use T4's warp, autotype and +floors tools for staging, but **never record the browser's fake desktop**.
- Fix F1 first. Today's default renders an empty dungeon on camera.

| t (s) | Shot (in-game moment) | On-screen text (big, ≤2 s) | Audio |
|---|---|---|---|
| 0–3 | Full desktop: someone types in a code editor. Below, the strip at idle, Knight walking | YOUR WORK… | Real keyboard clacks |
| 3–6 | Typing speeds up. The Spark bar fills, and the tier climbs Focused → Inspired | …IS THEIR ADVENTURE | Clacks, music fades in |
| 6–9 | **FLOW STATE!** banner, the dungeon lit gold, "x2.2 POWER" | – | FLOW sting |
| 9–12 | **Meteor** (Mage ultimate, 800%) wipes a pack; coins fly to the counter | EVERY KEY POWERS AN ULTIMATE | Impact |
| 12–16 | "A POWERFUL FOE AWAITS…", then the **boss kill**: "VICTORY! Bone King falls" and a coin shower | – | Boss hit, fanfare |
| 16–19 | **Relic** pick: three cards over a spreadsheet; the cursor takes the epic Flow Pendant | 17 RELICS | Chime |
| 19–22 | Retire: "A NEW GENERATION RISES +N RENOWN", then the **Omen** modal (▲/▼) | RETIRE. RETURN STRONGER. | – |
| 22–25 | The Hollow: "!! VOID SLAM !!" and a Sanctuary save, then the **"HEART OF THE KEEP" depth trophy** banner | 100+ FLOORS DEEP | Low boom |
| 25–28 | Alt-tab into a fullscreen game: the strip vanishes. Back to work: it returns. Tray menu: "Count keystrokes & clicks" | HIDES FOR GAMES. NEVER RECORDS WHAT YOU TYPE. | – |
| 28–30 | Logo over the strip, then "Wishlist on Steam" (the call-to-action ban covers capsules, not trailers) | KEYSTROKE KEEP | Sting |

Also cut a 6-second vertical version (1080 × 1920) of seconds 3–12 for social posts. The FLOW → Meteor beat is the clip that sells this game.

### Requirements notes line (only after F1 and F2)
- **Desktop (low-GPU):** "Designed to run all day: freezes when hidden or behind fullscreen apps. Typical desktop use: 0% GPU, under 1% CPU, about 250 MB RAM."
- **Laptops:** don't print a number until the iGPU laptop run exists. The E-core proxy predicts 4% Task Manager CPU while typing in GPU mode on 4 threads.

## Ideas (optional, max 3)
1. **Enter Desktop Companion Fest with the demo live.** It runs Jan 14–18, before the Next Fest crowd.
   - Ship the demo publicly then, rather than holding it for Feb 22. Next Fest allows demos that are already public.
   - Five weeks of demo reviews and wishlists before Next Fest is how the niche's breakouts built momentum.
2. **Answer Desktop Heroes' reviews on our page.** Their top complaints are "not idle enough" and "shallow after a few hours", which are exactly our strengths.
   - First feature bullet: "Fully idle. Typing makes it *faster*, never required."
   - Second: "Retire, roll Delve Omens, chase 14 depth trophies past floor 100".
3. **Add a self-check to the release gate** (`KK_SNAPSHOT`), next to my probe gates:
   - Fail the build if the knight sprite has 0 pixels.
   - Fail if fuses read wrong.
   - Fail if `stats.keys` doesn't go up when the packaged demo test injects F24.

   F1 lived for a whole round because no automated check ever looked at a pixel.

## Measurement notes
- **How to run** (from the project dir; outputs go to `docs/playtest/round-05/market_probe/out/`):
  - `sh .../run_perf.sh`: the low-GPU on/off × all / 4 E-core / 2 E-core matrix.
  - `KK_PROBE=fs`, `sh .../run_saves.sh`.
  - `KK_PROBE=sprites|losttime|eval` (see the `probe.js` header).
  - `powershell -File .../packaged_demo_test.ps1`.
  - `node .../asar_list.js <app.asar>`.
  - `node .../perf_table.js`.
- **R5 probe change:** the R4 probe compiled `main.js` **after** `ready`, which is too late for the new low-GPU `appendSwitch`. The R5 probe seeds its save and compiles `main.js` before `ready`; `R.lowGpuSwitch` and `gpu_compositing` confirm which mode actually ran. Isolation is unchanged: `appData` and `userData` are redirected to `%APPDATA%\kk-market-probe-r5`.
- **Real save:** `%APPDATA%\Keystroke Keep\saves\keystroke-keep.json` was never written (md5 `d680a06b343db55e16cf6d3b88b4b533` and mtime 10:46:01 before and after).
  - The packaged **demo** run did write Chromium profile files (`Preferences`, `DIPS`, `Network`, `Session Storage`) into `%APPDATA%\Keystroke Keep`, because of F3. No save data was involved, but it wasn't the isolation I intended. I didn't launch the packaged full exe outside the self-test mode.
- **Caveats:**
  - One desktop machine (i9-13900K, RTX 3080, 3 monitors, 3840×2160 at 150% primary).
  - The E-core affinity runs are a proxy for laptop CPU only. They don't model an iGPU, power limits or battery.
  - DWM and system GPU noise is ±5 points between identical runs.
  - Other testers' node sims were idle during the perf matrix (checked).
  - Typing is simulated in the page. The packaged hook test used real injected keys.

## Sources
- Steam store graphical assets (sizes, required list): https://partner.steamgames.com/doc/store/assets
- Graphical asset rules (capsule text bans, library logo/hero rules): https://partner.steamgames.com/doc/store/assets/rules
- Coming Soon (≥14 days before release, review ≥7 business days): https://partner.steamgames.com/doc/store/coming_soon
- Tags (20 visible, top 5 describe, first 15 for filters, tag wizard): https://partner.steamgames.com/doc/store/tags
- Trailers (≤1920×1080, 30/60 fps, 5,000+ kbps, gameplay first, <10 s to impress, viewers without sound): https://partner.steamgames.com/doc/store/trailer
- Upcoming events (Desktop Companion Fest Jan 14–18, Next Fest Feb 22 – Mar 1, others): https://partner.steamgames.com/doc/marketing/upcoming_events
- Desktop Companion Fest 2027 rules (tag-based eligibility, Coming Soon/demo sections, Jan 8 trailer, discount deadline): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/desktop_companion_2027
- Next Fest Feb 2027 (Jan 10 registration, Jan 18 press preview/trailer pull, Feb 1, Feb 11, requirements): https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- Press coverage of the 2027 H1 event calendar: https://www.pcgamer.com/games/steam-reveals-all-the-sale-dates-and-themed-events-for-the-first-half-of-2027/
- Rusty's Retirement (tags, 97% of 6,625, $6.99): https://store.steampowered.com/app/2666510/Rustys_Retirement/
- Desktop Heroes (tags, 70% of 104, $5.99) and its negative reviews: https://store.steampowered.com/app/3734200 ; https://steamcommunity.com/app/3734200/negativereviews/
- Idle Squire (keypress attacks, $4.99, AI disclosure): https://store.steampowered.com/app/3982800
- Corner Dungeon (Desktop Companion #1 tag, 2027): https://store.steampowered.com/app/4846310
- Idlewood Outpost demo (bottom-of-screen pixel heroes): https://store.steampowered.com/app/3914120
- Electron fuses: https://www.electronjs.org/docs/latest/tutorial/fuses
- Chromium canvas `willReadFrequently` (CPU-backed 2D canvas) and `contextlost`/`contextrestored` events: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext ; https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/contextlost_event
