# Round 03 — T3 "market" (Steam Market & Reviews Analyst)

## Verdict
The R2 power fixes held up under measurement:
- **Idle GPU** fell from ~11% to **~3.2%**.
- **Hidden and locked** now cost **0%** GPU.
- **Fullscreen auto-hide works** on the primary monitor for a browser-style fullscreen window and for a borderless "game" window. It hides the strip in 1.0–1.25 s and brings it back 0.6 s after the fullscreen window closes.

Two problems are still shippable-as-negative-review:
- **Typing still costs ~10% GPU and DWM ~25%.** That is unchanged from R2, and typing is the game's main state. The cause is two CSS `width` transitions. Removing them halves the cost (measured).
- **Fullscreen detection is primary-monitor only.** A strip docked on a second monitor still covers a fullscreen video there. Detecting fullscreen on the primary monitor also hides a strip that sits on a different monitor.

The bigger risk now is calendar, not code. There is still no packaging, no Steamworks, no achievements and no signing. Also, "demo" is a runtime flag that anyone can bypass. I'd keep it running tomorrow and would not refund. **Rating: 7.5/10** (concept 8, shell 7).

## Findings (ranked, max 8)

### F1 [severity: major] Typing still costs ~10% GPU 3D and +15 pts DWM: the fervor and spark bars' CSS `width` transitions recomposite at the monitor refresh rate
- **Setup.** Evidence comes from `npx electron docs/playtest/round-03/market_probe`, including modes `KK_PROBE=2` and `KK_PROBE=3`. The probe loads the real `electron/main.js` with the real uiohook path. Test machine: RTX 3080, primary 2560x1440 at 150% (3840x2160 physical), 160 Hz, 3 displays. Typing is simulated at 5.5 keys/s.

  | State (R3) | Electron 3D % avg (min–max) | DWM 3D % | draws/s | KK ctx-switches/s | CPU % (all KK procs) |
  |---|---|---|---|---|---|
  | Typing, 30 fps (default) | **9.3–10.6** (8.3–11.8) | 24.6–26.7 | 29.8 | 5,665–6,113 | 0.82–0.94 |
  | Typing, 20 fps | 9.6 | 24.4 | 20 | ~5,300 | 0.76 |
  | Typing, 30 fps, size S | 10.2 | 24.0 | 29.8 | 5,730 | 0.76 |
  | Typing, 30 fps, **`.fv-bar i` + `.sparkbar i` transitions off** | **5.4** | 18.8 | 29.8 | 2,450–8,800 | **0.44** |
  | Typing, 30 fps, all CSS motion off | 5.7 | 20.5 | 29.8 | 2,408 | 0.41 |
  | Typing, 12 fps, all CSS motion off | **2.9** | 17.9 | 11.8 | 1,422 | 0.24 |
  | Typing, 30 fps, CSS off + no HUD DOM updates | 6.0 | 21.7 | 29.8 | 2,339 | 0.34 |
  | R2 reference: typing 30 fps | 10.1–11.7 | 27–31 | 27 | – | – |

  - Lowering fps or shrinking the canvas did nothing while the transitions were on. Turning the transitions off cut GPU by 40% and CPU by 50%.
  - The culprits are `css/style.css:166` (`.fv-bar i { … transition: width .1s linear }`) and `css/style.css:143` (`.sparkbar i { … transition: width .15s }`). Both widths are rewritten every frame while you type (fervor and sparks change constantly), so each transition never ends. It also animates `width`, a layout property, at 160 Hz.
  - `document.getAnimations()` showed 1–3 running animations during typing and 0 at idle.
  - With the transitions gone, cost scales with draws: about 0.19% GPU per fps (12 fps ≈ 2.9%, 30 fps ≈ 5.7%).
- **Why it matters:** players open Task Manager while they type, because that's when the strip is "doing something". "10% GPU and DWM doubles while I type, for a pixel strip" is the Rusty's Retirement review. Laptops with iGPUs will show far higher percentages than this RTX 3080 does.
- **Proposed fix (½ day, before Jan 18):**
  1. Delete both `transition: width` rules. If smoothing is wanted, lerp the value in JS inside `ui.update()`, which already runs only at the frame rate. Better still, draw both bars in the canvas. Use `transform: scaleX()` with no transition if they stay DOM.
  2. Lower the typing fps default from 30 to 24 (or 20). Expected ≈ 4.5% / ≈ 3.8% at 30 → 24 → 20 by the per-fps slope. Keep 30 for "FLOW STATE" and bosses only.
  3. Idle: 12 → 10 fps gets about 2.5%, comfortably under the <3% gate.
  4. Next experiment for the probe: the canvas backing store is oversampled. `pxScale = round(3 × 1.5) = 5` gives a 4270x320 backing for a 3843x288 physical area (`js/render.js:34`). Try `pxScale = floor(scale × dpr)`, or a buffer-resolution canvas with CSS `image-rendering: pixelated`. Uploading about 25x fewer pixels per frame may halve the per-frame cost again.
  5. Keep the gate: re-run `KK_PROBE=3`. Target typing ≤5% at 24 fps, and idle <3%.

### F2 [severity: major] Fullscreen auto-hide only understands the primary monitor: it fails on a second monitor and misfires across monitors
- **Evidence** (probe timelines in `out/results.json` and `out/results2.json`; QUNS = `SHQueryUserNotificationState` value):

  | Scenario | QUNS | Strip | Correct? |
  |---|---|---|---|
  | Strip on primary; fullscreen window from **our own process** on primary | 5→**2** | hidden after 1.0 s, back 0.6 s after close; screen pixel in the strip row = (0,253,0), the test window | PASS. QUNS_BUSY *is* reported for our own process, so the brief's worry doesn't apply |
  | Strip on primary; **separate process** Electron `setFullScreen` (same path as Chrome/Edge fullscreen video) | 2 | hidden after 1.25 s, back 0.6 s | PASS |
  | Strip on primary; separate process borderless WinForms form covering the monitor (borderless game) | 2 | hidden after 1.25 s, back 0.6 s | PASS |
  | Strip on primary; fullscreen on a **different** monitor | 5 | stays visible | PASS |
  | Fullscreen on primary, then the user clicks into a window on monitor 2 | stays **2** | stays hidden | PASS. A foreground-only fallback would have shown the strip over the video again: my fallback flipped to false here |
  | **Strip docked on monitor 2 (tray Display picker); fullscreen on monitor 2** | **5** | **stays visible on top of the fullscreen window** | **FAIL** |
  | **Strip docked on monitor 2; fullscreen on primary** | 2 | **hidden** although nothing covers its monitor | **FAIL** (false positive) |

  - Exclusive D3D fullscreen (QUNS 3) was not tested, because no game was available.
  - Chromium's own `IsFullScreenMode` also distrusts `QUNS_BUSY`. It uses only states 3 and 4, plus a "foreground window rect == monitor rect, no thick frame" check, and that check is also primary-only (`ui/base/fullscreen_win.cc`).
- **Why it matters:** multi-monitor users are this game's core audience ("video on one screen, work on the other"). They are exactly the people who will dock the strip on a side monitor. "Covers my second-monitor YouTube" or "vanishes whenever I fullscreen something on my other screen" both read as broken.
- **Proposed fix (½ day, before Jan 18).** Per-monitor z-order scan in the same 1.5 s koffi tick, with no callbacks needed:
  1. Walk `GetTopWindow(NULL)` / `GetWindow(h, GW_HWNDNEXT)`.
  2. Skip: our own HWND, `!IsWindowVisible`, `IsIconic`, cloaked windows (`DwmGetWindowAttribute(DWMWA_CLOAKED)`), `WS_EX_TOOLWINDOW`, classes `Progman`/`WorkerW`/`Shell_TrayWnd`/`Shell_SecondaryTrayWnd`, and windows that don't intersect the strip's monitor (`MonitorFromWindow`, `GetMonitorInfoW.rcMonitor`).
  3. A **topmost** window that covers the monitor rect counts as fullscreen (exclusive games are often topmost). A topmost window that doesn't cover it is skipped, so the Discord overlay and sticky notes don't break the check.
  4. The first **non-topmost** window that intersects the monitor decides: if it covers `rcMonitor`, it's fullscreen; otherwise it isn't.
  5. Combine: `hide = zorderFullscreen(stripMonitor) || quns === 4 || (quns === 3 && stripMonitor.primary)`. Drop QUNS_BUSY as a trigger on its own.
  6. The probe's `winInfo()` and `fallbackFs()` (`docs/playtest/round-03/market_probe/probe.js`) already have working koffi declarations for `GetForegroundWindow`, `GetWindowRect`, `MonitorFromWindow`, `GetMonitorInfoW`, `GetClassNameW` and `GetWindowThreadProcessId` that can be copied.
  7. Extend the probe's 7 scenarios as the regression test.

### F3 [severity: blocker for Next Fest] "Demo" is a runtime flag, and demo and full game share one profile
- **Evidence:**
  - `electron/main.js:57` turns demo on only if `KK_DEMO=1` or `--kk-demo` is present. If the Steam demo depot ships the same build with `--kk-demo` as a launch option, double-clicking `Keystroke Keep.exe` in the install folder runs the full game for free.
  - The self-test confirmed the flag path works (`KK_DEMO=1` → `DEMO_CAP=40`, `native=true`).
  - userData comes from the app name. Today that is `%APPDATA%/keystroke-keep`. A packaged build uses `productName`, so dev and playtest saves won't carry into the packaged build. A demo with a different productName gets its own folder. One with the same name lets the full game's floor-100 save load into the demo, and `world.js:504` then forces it back to floors 36–39.
  - Valve: "We recommend that you disable achievements in demos" and grant them from the shared save in the full game. Cloud sharing with an **unreleased** base app does not sync. So before launch, demo → full carry-over is a *local file* problem.
- **Proposed fix (½ day):**
  - Bake the flag in at build time: `electron-builder --config.extraMetadata.kkDemo=true` → `require('../package.json').kkDemo`. Keep the env/arg only for development (`!app.isPackaged`).
  - Pin the folders explicitly at the top of `main.js`: `app.setPath('userData', path.join(app.getPath('appData'), isDemo ? 'Keystroke Keep Demo' : 'Keystroke Keep'))`.
  - The full game imports `…/Keystroke Keep Demo/saves/keystroke-keep.json` on first launch if it has no save of its own.

### F4 [severity: minor] Hidden and paused states still wake ~410 times/s: page `setInterval`s keep running
- **Evidence:**

  | State | Electron 3D % | draws/s | page `frame` timeouts/s | KK ctx-switches/s | CPU % |
  |---|---|---|---|---|---|
  | Baseline (no KK window) | 0 (DWM 10.1, noisy 4.9–13) | – | – | 3.5 | – |
  | Idle 12 fps | **3.2** (2.7–4.1); first run 4.2 incl. an fx burst | 12–19 | 12–19 | 1,414–2,471 | 0.21–0.30 |
  | Idle, CSS motion off (control) | 3.1 | 12 | 12 | 1,436 | 0.23 |
  | **Hidden via tray** (`toggleVisible`) | **0.19–0.35** (R2: 11–15) | **0** | 2 | 412–537 | 0.04–0.05 |
  | Hidden, then lock → unlock | **0** (R2: 18–19% and 27 draws/s) | 0 | 2 | 639 | 0.04 |
  | Locked while shown | **0** | 0 | 2 | 354 | 0.04 |
  | Muted while typing | 10.1 (F1) | 29.8 | – | 5,740 | 0.94; **0 audio nodes created** (R2: 16/s) |
  | Hidden **with page intervals cleared** | 0 | 0 | 0 | **145** | **0.01** |

  - The always-on intervals are:
    - `js/audio.js:135` music scheduler, 60 ms (16.7/s). It runs even though **music is off by default**.
    - `js/native.js:50` `measure`, 120 ms (8.3/s).
    - `js/ui.js:49` `slowUpdate`, 250 ms. It also toggles a class on `<html>` 4x/s, which forces a whole-document style recalc.
    - The `ui.js:521,529,585` nudges and the clock.
  - Clearing them cut OS context switches by about 65% while hidden.
- **Why it matters:** this is a laptop battery issue, not a Task Manager one. It's cheap to fix, and it lets the store page truthfully say "sleeps completely when hidden".
- **Proposed fix (1 h):**
  - Start the music interval only when `music && ctx.state === 'running'`, and clear it otherwise.
  - Replace the `measure` poll with a `ResizeObserver` and `MutationObserver` on `#panel`, `#relic-offer`, `#toasts` and `#modal-root`, or skip it while `kk-paused`.
  - Return early from `slowUpdate` while `kk-paused` (and only toggle `.blink` when something blinkable is visible).

### F5 [severity: major] Next Fest readiness: what the demo build still lacks, with dates
Today is Mon Nov 9, 2026. All Valve dates are PST and were re-fetched today.

**Timeline:**

| Date | What |
|---|---|
| Dec 8 | Q&A |
| **Jan 10, 11:59pm** | Registration deadline. Marketing up to date |
| **Jan 18** | Trailers pulled; demo build and store page submitted for review (Press Preview) |
| **Feb 1** | All items submitted |
| Feb 11 | Press Preview |
| **Feb 22, 10am** | Festival starts. The demo must be live |
| Mar 1 | Wrap-Up |

**Requirements and lead times:**
- Eligibility: the store page must be published and public, and a public demo must exist by Feb 22. A game gets one Next Fest only.
- Coming Soon page: it must be up at least 2 weeks before release, and should be submitted ≥7 business days before you want it live.
- Build and store reviews take "3–5 business days", but plan for 7.
- Steam Direct release wait: 30 days on Valve's page (some sources say 21).
- Tax and bank paperwork: 15–30 days.

| # | Item | Status in build | Minimal plan | Effort | Do by |
|---|---|---|---|---|---|
| 0 | Steamworks onboarding | unknown | Pay the $100 fee and do tax/bank this week. Create the base app plus an app of type *Demo* linked to it | 1 h + 15–30 days of waiting | **Nov 13** |
| 1 | **File saves** | **Landed this round.** `<userData>/saves/keystroke-keep.json` with tmp+rename and 3 backups (verified in the probe profile); localStorage migration | Pin userData names and demo import (F3). Save on `win.on('session-end')`, because Windows shutdown skips `beforeunload`. Steam **Auto-Cloud** (zero code): root `WinAppDataRoaming`, subdir `Keystroke Keep/saves`, pattern `*.json`, quota 1 MB / 10 files, *Shared cloud APP ID* on the demo | ½ day | Dec 4 |
| 2 | **Packaging (electron-builder 26.x)** | none: no `build` section, not in devDependencies | `npm i -D electron-builder`, then in `build`: `appId`, `productName: "Keystroke Keep"`, `files` (index.html, css, js, assets, electron, minus docs/tools), `asarUnpack: ["node_modules/uiohook-napi/**","node_modules/koffi/**"]` (auto-detection should work; verify `app.asar.unpacked`), `win.target: "dir"` (Steam wants a folder, not NSIS), 256 px `.ico`, prune koffi's non-win32 prebuilds, Electron fuses (`runAsNode:false`, `enableNodeCliInspectArguments:false`, `onlyLoadAppFromAsar:true`, asar integrity), FileDescription/CompanyName set. Two scripts: `dist:full` and `dist:demo` (extraMetadata). Smoke test with `KK_SNAPSHOT` against the packaged exe | 1 day | Nov 20 |
| 3 | **Steamworks** | none | Use **steamworks-ffi-node** (0.11.3, Sep 2026, built on koffi, which is already a dependency; it lists achievements, Rich Presence and Cloud). The alternative is **steamworks.js** (0.4.0, last published Aug 2024, N-API). Init **in the main process only**: the steamworks.js README's renderer route needs `contextIsolation:false`, so don't use it. If init fails, keep running (dev, itch). `steam_appid.txt` in dev only. **No overlay**: the strip is unfocusable and transparent, and overlay injection costs GPU. Expose one whitelisted IPC, `kk:achieve(id)`. Rich presence: upload a localization file with tokens (`#Delving` "Floor %floor% · %state%"), and update it on floor change/FLOW, max once per 30 s | 1–1.5 days | Dec 18 |
| 4 | **Achievements** | none | `D.ACHIEVEMENTS` table in `js/data.js` and a DOM-free checker in the sim on existing events, emitting `achieve`. The UI shows its own toast, since there is no overlay to show Steam's. Store unlocks in the save. **Demo: track but don't unlock on Steam**; the full game grants on load (Valve's guidance). Launch 5 (R2 F6): first ult from typing, FLOW, Bone King, golden rat, first retire. Then about 35 for 1.0. Icons 256x256 PNG (64 min); Steamworks can auto-generate the locked versions | 1 day + icon art | Jan 6 |
| 5 | **Code signing** | unsigned | Steam installs don't get Mark-of-the-Web, so SmartScreen rarely triggers for Steam players (secondary source). AV/EDR heuristics still flag an unsigned exe that installs `WH_KEYBOARD_LL`. Options: **Azure Artifact Signing** at about $9.99/mo (individuals: US/Canada only; organisations: US/CA/EU/UK; identity validation takes a few business days), or an **OV certificate** at $150–300/yr on an HSM/USB token. EV no longer skips SmartScreen (since 2024), so don't pay for it. Sign the exe **and** the `.node`/`.dll` files (`signExts`). Upload every release candidate to VirusTotal and file false positives with Microsoft WDSI. Add a store FAQ on the input hook | ½ day pipeline + validation lead time | start Nov 13, signed RC by Jan 9 |
| 6 | Store page (R2 F5) | none | Capsules, 5+ screenshots, short description. Submit the Coming Soon page about **Nov 23** so it's public about **Dec 3**. Trailer on the page by Jan 8 (Valve pulls trailers on Jan 18) | art budget | Nov 23 / Jan 8 |
| 7 | Demo RC | demo mode exists (cap 40, farms 37–39) | Build-time flag (F3), version string in tray, "Start with Windows" opt-in (`app.setLoginItemSettings`; launching via the exe triggers Steam's restart-through-Steam). Submit the demo build and store page for review **Jan 12** (one fix-and-resubmit cycle before Jan 18) | ½ day | Jan 12 |

### F6 [severity: minor] Tray tooltip doesn't say "hidden"; the first-hide balloon is per launch
- **Evidence:**
  - Tooltips measured: counting `Keystroke Keep: counting keystrokes (never which keys)` and paused `…input counting PAUSED` (PASS).
  - While hidden, the tooltip still reads "counting keystrokes" (`electron/main.js:146`). R2 asked for "Hidden · counting".
  - The balloon fired exactly once on the first hide (`"Keystroke Keep is still running" … "press Ctrl+Shift+Alt+K"`), and not on the second hide (PASS).
  - `hideNoticeShown` is not persisted, so the balloon comes back every launch for daily users.
  - Fullscreen auto-hide correctly shows no balloon.
- **Proposed fix (15 min):**
  - Append `· hidden` or `· hidden for fullscreen` to the tooltip.
  - Persist the notice flag in settings, so it shows once ever (or once per version).

### F7 [severity: minor] Working set is about 500 MB summed across Electron processes
- **Evidence:** `app.getAppMetrics()` working set summed over all Electron processes: 495–548 MB in every state. Shared pages are counted more than once, so Task Manager's "Memory" column will show less, but players add up the group.
- **Why it matters:** RAM is the second Task Manager number reviewers quote, after GPU. TBH: Task Bar Hero's 8 GB minimum spec is a weakness we can contrast against.
- **Proposed fix (post-fest unless cheap):**
  - Measure private bytes in the probe.
  - Try `spellcheck:false`, disabling `SpareRendererForSitePerProcess` and `CalculateNativeWinOcclusion`, and `--js-flags=--max-old-space-size=64` (the heap is only 9.5 MB).
  - Publish a single honest number on the store page ("~150 MB RAM") only after measuring it.

### F8 [severity: minor] New hotkey checks out; one keyboard-layout note
- **Evidence:**
  - `Control+Shift+Alt+K` registered (`hotkeyOk:true`, `isRegistered:true`). The old `Ctrl+Alt+K` is free.
  - The tray label adds the combo only when registration succeeded.
  - Ctrl+Shift+Alt = Shift+AltGr. On the Hungarian layout, Shift+AltGr+K is unassigned (kbdlayout.info), so no letter is lost.
  - The combo is still not rebindable, and there's no Settings UI for "hotkey unavailable".
- **Proposed fix:** a rebind field in Settings (post-fest).

## Verified fixes from last round (pass/fail, one line each)
- **No infinite CSS animations / idle GPU <3%: PARTIAL.** `infiniteAnims: []`. Idle measured 3.2% (2.7–4.1); R2 was 10.7–11.6. It is just over the gate, and typing is still 10% (F1).
- **Sleeping `setTimeout` loop: PASS.** No rAF. The loop wakes exactly fps times/s (12/30), and 2/s when off.
- **Hidden → 0 draws and ~0 GPU: PASS.** 0 draws/s, 0.2–0.35% GPU (R2 11–15%).
- **Combined visibility model (lock/unlock while hidden stays off): PASS.** Power sequence on/off as expected, 0 draws, 0% GPU.
- **Locked while visible → frozen: PASS** (0 draws, 0% GPU, `kk-paused` set).
- **Muted audio leak: PASS.** 0 nodes created while suspended (R2 ~16/s). The music *interval* still ticks (F4).
- **Fullscreen auto-hide: PASS on the primary monitor** (own process, separate Electron, borderless WinForms: hidden in 1.0–1.25 s, back in 0.6 s, verified by screen pixels). **FAIL** on secondary monitors (F2).
- **Hook removed on pause: PASS.** `hookRunning` true → false → true. Main-process threads 49 → 48 → 49. Injected F24 taps forwarded 2 → 0 → 2.
- **Ctrl+Shift+Alt+K plus register check: PASS.**
- **Tray tooltip shows count/paused: PASS.** It doesn't show hidden (F6).
- **First-hide balloon: PASS** (once; F6 for persistence).
- **Dev tools hidden when packaged: PASS.** With `app.isPackaged` forced true, the menu has no "Open dev tools".
- **display-added redock: PASS.** One listener; emitting it re-docks a displaced window.
- **Self-test `-selftest` profile: PASS.** `KK_SNAPSHOT` wrote to `%APPDATA%/keystroke-keep-selftest/saves`, and the real `%APPDATA%/keystroke-keep` was untouched. `KK_DEMO=1` gives `DEMO_CAP=40`.
- **File saves (new): PASS** in the probe profile (`saves/keystroke-keep.json` plus `.bak1`).

## Ideas (optional, max 3)
1. **"Resource use" line in the tray** (fps · state · "GPU target <3% idle"), once F1 lands. It turns lightness into a visible feature and screenshot material for the store FAQ.
2. **Make the probe a release gate.** Have `npm run gate` run the three probe modes against the *packaged* exe and fail when typing is above 5%, idle above 3%, or hidden above 0.5%, or when any fullscreen scenario is wrong. Run it on one iGPU laptop before Jan 12.
3. **A multi-monitor "dock on the monitor I'm *not* fullscreen on" option.** With per-monitor detection (F2), the strip could hop to a free monitor instead of hiding, so a game on screen 1 still shows the party on screen 2. That is a streamer-friendly differentiator.

## Measurement notes
- **How to run:**
  - `npx electron docs/playtest/round-03/market_probe`: full pass, about 3 min.
  - `KK_PROBE=2 …`: fps, size and interval experiments, plus the multi-monitor fullscreen cases.
  - `KK_PROBE=3 …`: CSS-transition cost while typing.
  - Outputs go to `out/results*.json`, `out/console*.txt` and `out/fs_*.png`.
- **Isolation:**
  - App name `kk-market-probe-r3`, so the profile is `%APPDATA%/kk-market-probe-r3`.
  - The probe compiles the real `main.js` with closure exports appended in memory. The file on disk is not edited.
  - It runs **without** `KK_SNAPSHOT`, so the real uiohook path is used.
  - It opens up to 4 fullscreen test windows for about 6 s each, plus one normal window. Helper: `market_probe/fsapp`.
  - It taps F24 four times.
- **Metrics:**
  - GPU = `\GPU Engine(*engtype_3D)\Utilization Percentage` summed over Electron PIDs, and separately for DWM.
  - Context switches = `\Thread(electron*)\Context Switches/sec`, summed over our PIDs. This is the OS-level wakeup measure.
  - Each state is 4–5 one-second samples.
- **Caveats:**
  - One machine with a noisy DWM baseline (4.9–13%).
  - Lock and unlock were simulated with `powerMonitor.emit`.
  - Exclusive D3D fullscreen and a real browser video were not tested; Electron `setFullScreen` is Chromium's own fullscreen path.
  - The per-process context-switch breakdown in `KK_PROBE=2` came back empty (counter-path parsing), so only the totals are reported.

## Sources
- Steam Next Fest Feb 2027 (dates, eligibility): https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- Steam review times (3–5 business days, plan 7): https://partner.steamgames.com/doc/store/review_process
- Coming Soon page (≥2 weeks before release; submit ≥7 business days ahead): https://partner.steamgames.com/doc/store/coming_soon
- Steam Direct (30-day wait after the fee): https://partner.steamgames.com/steamdirect
- Demos (separate app ID; disable achievements in demos and grant from the shared save): https://partner.steamgames.com/doc/store/application/demos
- Steam Cloud / Auto-Cloud (root paths, Shared cloud APP ID, no sync with an unreleased base app): https://partner.steamgames.com/doc/features/cloud
- Achievement icons (256x256 recommended, 64 min, auto-generated locked icons): https://partner.steamgames.com/documentation/bootstrap_achieve
- steamworks.js (Electron overlay helper, renderer needs `contextIsolation:false`): https://github.com/ceifa/steamworks.js. npm: 0.4.0, last published 2024-08-06 (`npm view steamworks.js`)
- steamworks-ffi-node (Rich Presence, Cloud, achievements; 0.11.3, 2026-09-24): https://dev.to/arty_prof/steamworks-ffi-node-a-steamworks-sdk-library-for-javascript-game-frameworks-15h1
- Windows code-signing options (Artifact Signing ~$9.99/mo and its geography, OV $150–300, EV no SmartScreen bypass since 2024): https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- Steam-installed files carry no MOTW, so no SmartScreen prompt (secondary source): https://bugnet.io/blog/how-to-fix-windows-protected-your-pc-smartscreen-warning-for-your-game ; MOTW background: https://en.wikipedia.org/wiki/Mark_of_the_Web
- electron-builder (asarUnpack auto-detects native modules; Windows targets): https://www.electron.build/app-builder-lib.interface.windowsconfiguration , https://electron.build/nsis
- QUERY_USER_NOTIFICATION_STATE: https://learn.microsoft.com/en-us/windows/win32/api/shellapi/ne-shellapi-query_user_notification_state ; Chromium `IsFullScreenMode` (QUNS 3/4 plus primary-monitor foreground-rect check): https://chromium.googlesource.com/chromium/src/+/HEAD/ui/base/fullscreen_win.cc
- Hungarian layout (AltGr+K = ł, Shift+AltGr+K unassigned): https://kbdlayout.info/kbdhu
