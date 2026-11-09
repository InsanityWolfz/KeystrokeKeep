# Round 04 — T3 "market" (Steam Market & Reviews Analyst)

## Verdict
The R3 shell fixes held up under measurement:
- **Idle averages 2.7% GPU** over 9 runs (1.9–3.8%).
- **Typing at the new 24 fps default averages 5.2%** over 7 runs (4.4–5.9%). That is down from 9.3–10.6% in R3, but still at the 5% line, with one-second spikes to 10%.
- **Hidden and locked cost 0.0% GPU** and about 170 wakeups/s (R3: 410–540).
- **Per-monitor fullscreen works on all 3 displays.** Fullscreen elsewhere never hides the strip, and the strip stays hidden when focus moves to another monitor.
- **Saves** are atomic, rotate correctly, recover from a truncated or 0-byte main file, migrate localStorage, and import the demo.

New problems:
- **The fullscreen scan has two false positives.** A maximized window on a monitor without a taskbar (or with an auto-hiding one) hides the strip. So does any topmost click-through overlay (screen dimmers, recorder overlays).
- **"Reset progress" in the full game brings back the demo save.**
- **The packaged exe has every Electron fuse at the default.** I proved `Keystroke Keep.exe` runs arbitrary Node code via `ELECTRON_RUN_AS_NODE=1`. That matters for an unsigned app that installs a global keyboard hook.

One cheap experiment makes the GPU question go away. **`disable-direct-composition` takes the strip to 0.0% GPU** at +0.1 pt CPU with 60–110 MB less memory, and transparency and click-through still work.

I'd keep it running tomorrow, and I wouldn't refund. **Rating: 8/10** (concept 8, shell 8; the packaging and signing calendar is the remaining risk).

## Findings (ranked, max 8)

### F1 [severity: major] Typing still sits at ~5% GPU, and the cost is per composited frame, not any one element. Software compositing (`disable-direct-composition`) makes it 0%
- **Setup.** Evidence comes from `docs/playtest/round-04/market_probe` (modes `perf`, `exp`, `idleexp`, `quick`; raw data in `out/*.json` and `out/ab_dcomp.txt`).
  - Machine: i9-13900K (32 threads) and RTX 3080. Primary display 3840x2160 at 150%, 160 Hz, plus two 1080p displays.
  - The strip is 2560x192 DIP (3840x288 px) with a 3416x256 canvas.
  - Typing is simulated at 5.5 keys/s. Each state is 9–15 one-second samples.
  - "CPU TM" means Task Manager CPU: the sum over all our processes, as % of all 32 threads.

  | State | Our GPU 3D % avg (range) | draws/s | CPU TM % | private MB |
  |---|---|---|---|---|
  | Typing 24 fps (default), 7 runs | **5.2** (4.4–5.9; 1 s spikes to 10.1) | 23.8 | 0.19–0.53 | 303–351 |
  | Typing 30 fps | 5.5 | 29.8 | – | 336 |
  | Typing 12 fps | 2.8 | 12 | – | – |
  | Idle (10 fps), 9 runs | **2.7** (1.9–3.8) | 9.9–15.2 | 0.09–0.32 | 294–332 |
  | Idle, frame loop frozen, window shown | **0.0** | 0 | 0.01 | 291 |
  | Hidden (tray) / locked | **0.0 / 0.0** | 0 | 0.01 | 328 |
  | Muted typing | 6.6 (toasts and FLOW were up) | 23.8 | – | 336 |

- **Cost breakdown (`exp`, typing 24 fps, run A = 5.07%).**

  | Experiment | GPU % | Effect |
  |---|---|---|
  | B: `setIgnoreMouseEvents(false)`, which drops `WS_EX_LAYERED` and `WS_EX_TRANSPARENT` | 5.08 | none |
  | C: canvas hidden (HUD DOM only) | 2.70 | |
  | D: HUD hidden (canvas only) | 3.74 | |
  | E: no per-frame HUD writes (`ui.update` no-op) | 4.43 | −13% |
  | F: canvas backing at buffer resolution (854x64 instead of 3416x256) | 4.57 | −10% |
  | H: half-width window | 3.88 | −24% |
  | I vs J: identical experiment windows, transparent vs **opaque** | 4.79 vs **4.59** | transparency is not the cost |
  | Typing at 12 fps | 2.77 | |

  - Cost tracks frames: about 0.19% per fps, plus about 0.5%.
  - The idle 250 ms `blink` toggle made no measurable difference (`idleexp` c).
  - **Conclusion: no single element is left to delete.** Each Chromium GPU frame for a 3840x288 DirectComposition surface costs about 0.2% on this card.
- **Chromium switches (`quick`, A/B/A/B, 16 samples per state):**

  | Switch | Typing GPU % | Idle GPU % | CPU TM % typing | private MB | `gpu_compositing` | transparency pixel |
  |---|---|---|---|---|---|---|
  | none | 5.06 / 5.51 | 2.40 / 2.82 | 0.44 / 0.53 | 303–347 | enabled | (255,0,255) OK |
  | **`disable-direct-composition`** | **0.00 / 0.00** | **0.00 / 0.00** | 0.55 / 0.54 | **236–273** | disabled_software | (254,0,254) OK |
  | `disable-gpu-compositing` | 1.22 | 0.80 | 0.51 | 199–203 | disabled_software | OK |
  | `disable-accelerated-2d-canvas` | 7.34 (worse) | 4.62 | – | 276–281 | enabled | – |

  - Click-through still works: the exstyle stays `0x8080028`, which is LAYERED | TRANSPARENT | TOPMOST | NOACTIVATE.
  - The rendering looks identical (`out/transp_disable_direct_composition.png`).
  - DWM's own 3D stayed between 15 and 23% in every run. The baseline noise without our window is 3–13%, so I can't resolve whether DWM's share rises.
- **Why it matters:** "5% GPU while I type" is defensible. "0% GPU" is a store-page headline, and it's what Task Manager's GPU column will show for the strip. Laptops with iGPUs will read 2–4x higher percentages for the GPU path. CPU TM of 0.5% on 32 threads is about 16% of one core; on a 4-thread laptop that is roughly 4% CPU. That is the number to verify before printing any spec.
- **Proposed fix (½ day, before the Jan 12 submission):**
  1. In `electron/main.js`, before `app.whenReady()`: `if (process.platform === 'win32' && !settings.gpuRender) app.commandLine.appendSwitch('disable-direct-composition')`. Keep a "Rendering: low-GPU (default) / GPU" toggle in Settings, which needs a restart. Read it from the save file synchronously at startup.
  2. Run `KK_PROBE=quick KK_SWITCHES=disable-direct-composition` on **one iGPU laptop at 1080p and 4K**. Gate: CPU TM ≤2% while typing on 4 threads. If CPU loses there, keep GPU compositing and drop typing to 20 fps (predicted ≈4.3%).
  3. Idle bumps: `FX.busy()` counts `coins.length > 0`, so every kill's coin flight lifts idle to 24 fps (idle draws/s 12–15 instead of 10). Cap fx-driven fps at 15 when there's no input, or drop coins from `busy()`. This is worth about 0.5 pt at idle.

### F2 [severity: major] Fullscreen scan: maximized windows on taskbar-less monitors and topmost click-through overlays hide the strip
- **Evidence** (`KK_PROBE=fs`, 21 cases, `out/fs.txt` and `out/fs.json`). Helper windows are separate processes: Electron `setFullScreen`, and DPI-aware WinForms via `market_probe/form.ps1`. Hide and return timings are from the strip's `isVisible()` at 250 ms resolution.

  | Case (strip monitor = test monitor unless noted) | H27P22S primary 150% | ASUS VP247 left | HP 25x right |
  |---|---|---|---|
  | Electron fullscreen (browser/video path) | PASS, hidden 1.0 s, back 0.6 s | flaky* | PASS, hidden 1.0 s, back 0.6 s |
  | Fullscreen on **another** monitor | PASS, stays visible | PASS | PASS |
  | Borderless window covering the monitor (borderless game) | PASS, hidden <0.5 s, back 1.1 s | PASS | PASS |
  | Real maximized window (monitor has a taskbar) | PASS, visible | PASS | PASS |
  | **Maximized-geometry window: rect = monitor + 8 px, `WS_THICKFRAME`** (what a maximized window is on a monitor with **no taskbar or an auto-hide taskbar**) | **FAIL: hidden** | **FAIL** | **FAIL** |
  | **Topmost, click-through, colour-keyed overlay covering the monitor** (screen dimmers, recorder/stream overlays) | **FAIL: hidden for as long as it runs** | **FAIL** | **FAIL** |
  | Fullscreen here, then focus moves to a window on another monitor | PASS, stays hidden | PASS | PASS |

  \*Flaky: the strip hid at 1.0 s. Then my own maximized Claude window came in front of the fullscreen helper, so the strip correctly came back. The fullscreen-then-focus case on the same monitor passed.
  - `scanExplain()` in the probe reports which window decided. For the failures it was the probe window, with `covers: true` (and `topmost: true, clickThrough: true` for the overlay).
  - Scan cost: 0.09 ms per walk. 265 top-level windows here, 32 visible.
  - QUNS stayed 5 for borderless and secondary-monitor cases. Only the per-monitor walk catches them, which confirms the R3 design.
- **Why it matters:**
  - "Taskbar only on the main display" and "auto-hide the taskbar" are common multi-monitor setups. With those, the strip vanishes whenever the user maximizes a window, which reads as "it randomly disappears."
  - A screen-dimmer user never sees the strip at all ("doesn't start, refund").
- **Proposed fix (1 h, `startFullscreenWatch` scan):**
  - Skip, without deciding, any window with `WS_EX_TRANSPARENT` (0x20). A click-through window is never a game. Also skip `WS_EX_NOACTIVATE` topmost windows.
  - Count a covering window as fullscreen only if `!IsZoomed(h) && !(GetWindowLongPtrW(h, GWL_STYLE) & WS_THICKFRAME)`. Chromium and Electron fullscreen and borderless games all drop the frame. A maximized window keeps `WS_THICKFRAME` (0x40000) and `IsZoomed`. This matches Chromium's own `IsFullScreenWindowMode` style test.
  - Re-run `KK_PROBE=fs`: all 21 cases must PASS (the bigframe and overlay rows flip to visible).

### F3 [severity: major] Save system: "Reset progress" resurrects the demo save; corrupt files poison the backup ring; a locked file drops saves silently
- **Evidence** (`run_saves.sh`, isolated `%APPDATA%/kk-market-probe-r4/AppData`, `out/save_*.json`; marker = `floor`):

  | Scenario | Seeded | Result | Verdict |
  |---|---|---|---|
  | localStorage migration | LS floor 17, no files | loads 17, writes `saves/keystroke-keep.json` (907 B); LS copy kept | PASS |
  | Truncated main `{"v":1,"floor":5` + bak1=23, bak2=21 | | loads **23** | PASS |
  | 0-byte main + bak1=23 (power-loss pattern) | | loads 23 | PASS |
  | Same, after the first save | | ring = bak1 **corrupt**, bak2 23, bak3 21 | **FAIL: a corrupt file takes a backup slot** |
  | Full build, main corrupt, no backups, demo=31 | | silently loads the **demo** (31) | weak |
  | Demo → full import (no full save) | demo=31 | loads 31, writes the full file; demo file untouched | PASS |
  | **Full=55 + demo=31 → Settings › Reset (`ui.js:472`) → reload** | | **floor 31: the demo save comes back** | **FAIL** |
  | Rotation (Date.now +11 min per save) | | bak1..3 = the three previous 11-min saves | PASS |
  | Main held open without `FILE_SHARE_DELETE` (AV/backup/sync tools) | | `kk:saveSync` → **false**, `.tmp` left behind; works again after release | **FAIL (silent)** |
  | Demo build (`KK_DEMO=1`), full=55 + demo=31 | | loads 31, `DEMO_CAP 40`; full folder untouched | PASS |
  | Real `%APPDATA%/Keystroke Keep` | | never touched (still empty, mtime 10:01) | – |

  - `readSave()` (`electron/main.js:273-280`) appends `demoSavePath()` on **every** launch of the full build, not only the first. `kk:wipeSave` (`:285`) doesn't delete it.
  - `writeSave` copies `savePath()` into `bak1` without validating it (`:266`).
  - `renameSync` (`:270`) has no retry. The async `kk:save` only `console.warn`s on failure. There is still no `session-end` save, so Windows shutdown relies on the 10 s autosave.
- **Why it matters:**
  - A player who resets and gets their demo run back reports "reset doesn't work."
  - A corrupt-on-crash file that pushes good backups out will eventually lose a save, and lost saves are the #1 idle-game rage review.
  - Defender, OneDrive or backup software briefly holding the file is routine on Windows.
- **Proposed fix (1–2 h):**
  1. Import the demo only when none of `savePath()` or `bak1..3` **exist**, regardless of validity. After a successful import, write a marker such as `"importedDemo": true` into the full save. `kk:wipeSave` also writes a tombstone `saves/.reset` that blocks import, or simply sets that flag.
  2. Rotate `main → bak1` only if `validSave(read(main))`. Otherwise rename it to `keystroke-keep.corrupt-<ts>.json` (keep 1).
  3. Retry `renameSync` on `EPERM`/`EACCES`/`EBUSY` five times at 20, 40, 80, 160 and 320 ms (graceful-fs style). Use `fs.openSync` + `writeSync` + `fsyncSync` on the tmp file before renaming on quit and on backup rotation.
  4. Add `win.on('session-end', () => send('kk:flush'))` plus `app.on('before-quit')` flushes.
  5. When a backup or the demo was loaded instead of the main file, show a one-line toast: "Restored your save from a backup (10 min ago)."

### F4 [severity: blocker for Next Fest] Packaged build: fuses wide open, and the shipped exe doubles as `node.exe`
- **Evidence.** `dist/full/win-unpacked` from the lead's new `build` config (electron-builder 26.18.0, Electron 45.2.3):
  - `npx @electron/fuses read --app "Keystroke Keep.exe"` → `RunAsNode Enabled, EnableNodeOptionsEnvironmentVariable Enabled, EnableNodeCliInspectArguments Enabled, EnableEmbeddedAsarIntegrityValidation Disabled, OnlyLoadAppFromAsar Disabled`.
  - `ELECTRON_RUN_AS_NODE=1 "Keystroke Keep.exe" -e "require('.../resources/app.asar/node_modules/uiohook-napi')"` printed `uiohook ok function` and `koffi ok 3.3.7` (node v24.22.2). The shipped exe executes arbitrary JS with our keyboard-hook module.
  - The upside of the same test: both native modules load from inside the asar (the `.node` files in `app.asar.unpacked`) in the packaged layout. The self-test can't show this for uiohook, because `KK_SNAPSHOT` skips `syncHook`.
  - `Get-AuthenticodeSignature` → `NotSigned`. VersionInfo `CompanyName: Keystroke Keep`, `FileVersion 0.1.0`.
  - The asar is clean: index.html, css, js, assets, electron and package.json, no docs or tools. 182 entries, 345 KB, plus 3.5 MB unpacked.
  - Six non-Windows `uiohook-napi.node` prebuilds ship (darwin, linux, loong64, win32-arm64), along with koffi `src/`, `doc/`, `vendor/` and `.lib`, and uiohook `src/` and `libuiohook/`.
  - The `.ico` holds 16–256 px. Unpacked size is 313 MB, of which the exe is 250 MB.
  - Demo and full have different `productName`, so different userData and a different `requestSingleInstanceLock`. **Both can run at once: two strips stacked on the same edge, two keyboard hooks.**
- **Why it matters:**
  - Antivirus heuristics score "unsigned, global `WH_KEYBOARD_LL`, can run script as Node" as malware-shaped. An open RunAsNode on a signed binary makes it a living-off-the-land tool.
  - A Defender false positive during Next Fest means a wave of "virus" reviews on the demo.
- **Proposed config (replace `build` in package.json):**
  ```json
  "build": {
    "appId": "com.keystrokekeep.game",
    "productName": "Keystroke Keep",
    "copyright": "Copyright © 2026 <legal studio name>",
    "directories": { "output": "dist/full", "buildResources": "build" },
    "files": [
      "index.html", "css/**", "js/**", "assets/**", "electron/**", "package.json", "!**/*.map",
      "!node_modules/koffi/{src,doc,vendor,lib}/**",
      "!node_modules/@koromix/*/**/*.lib",
      "!node_modules/uiohook-napi/{src,libuiohook}/**",
      "!node_modules/uiohook-napi/prebuilds/{darwin-*,linux-*,win32-arm64}/**"
    ],
    "asar": true,
    "asarUnpack": ["**/*.node"],
    "electronLanguages": ["en-US"],
    "npmRebuild": false,
    "electronFuses": {
      "runAsNode": false,
      "enableNodeOptionsEnvironmentVariable": false,
      "enableNodeCliInspectArguments": false,
      "enableEmbeddedAsarIntegrityValidation": true,
      "onlyLoadAppFromAsar": true,
      "enableCookieEncryption": false,
      "grantFileProtocolExtraPrivileges": true
    },
    "win": {
      "target": ["dir"],
      "icon": "build/icon.png",
      "signExts": [".node"],
      "azureSignOptions": { "publisherName": "<as on cert>", "endpoint": "https://<region>.codesigning.azure.net", "codeSigningAccountName": "<acct>", "certificateProfileName": "<profile>" }
    }
  }
  ```
  - `grantFileProtocolExtraPrivileges` **stays true**: the game loads from `file://`. Electron's docs say to move to a custom protocol before disabling it.
  - `enableEmbeddedAsarIntegrityValidation` is supported on Windows. Verify that the packaged exe still boots after flipping it.
  - Azure signing reads `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` from the environment. Use `signtoolOptions` if you buy an OV certificate instead.
  - Smoke test after packaging:
    - `ELECTRON_RUN_AS_NODE=1 "Keystroke Keep.exe" -e "1"` must open the game, not run as Node.
    - Fuses read as above.
    - `Get-AuthenticodeSignature` is `Valid` on the exe **and** both `.node` files.
    - Upload to VirusTotal.
- **Code-side packaging gotchas (main.js, 30 min):**
  - `app.setAppUserModelId('com.keystrokekeep.game')` at startup. Windows toasts and balloons attribute to it.
  - Demo and full running together: on start, the full game checks for the demo's single-instance lock. Simplest: both builds use the **same** lock name via `app.setPath('userData', ...)` before `requestSingleInstanceLock()`, and keep separate save folders.
  - Show the version in the tray header (`Keystroke Keep 0.1.0 · demo`).
  - Do not ship `steam_appid.txt`.
  - Steam overlay: the strip is transparent and can't take focus. Test a Steam-launched build once. Greenworks' troubleshooting notes overlay plus transparent-window glitches in Electron, and `disable-direct-composition` (F1) is also their workaround.
- **Steam depot layout:**
  - Full app: one Windows depot. `ContentRoot dist/full/win-unpacked`, `FileMapping { LocalPath "*" DepotPath "." Recursive 1 }`, `FileExclusion "*.pdb"`. Launch option `Keystroke Keep.exe` (OS Windows, 64-bit).
  - Demo app (its own App ID): depot from `dist/demo/win-unpacked`, launch `Keystroke Keep Demo.exe`.
  - Auto-Cloud: root `WinAppDataRoaming`, path `Keystroke Keep/saves`, pattern `*.json` (the `.tmp` and `.corrupt` files are excluded by the pattern), quota 1 MB / 10 files. The demo uses `Keystroke Keep Demo/saves` with no shared cloud until the base app is released, because Valve says shared cloud with an unreleased app won't sync.
  - About 110 MB download (Steam compresses).

### F5 [severity: minor] Every mouse move wakes the main process through the uiohook mouse hook, even though only clicks count
- **Evidence** (`KK_PROBE=mouse`, `out/mouse.txt`; `market_probe/mouse.ps1` injects about 650 Hz ±1 px moves):
  - Hook on: 5,042 JS `mousemove` events for 5,056 injected moves, at 4,936 ctx-switches/s.
  - Hook removed (counting paused): 0 events, at 2,908 ctx-switches/s.
  - The CPU TM difference is below noise on the i9 (0.25 vs 0.29).
- **Why it matters:** gaming mice report at 1,000 Hz. That is about 1,000 extra wakeups/s on laptops while the mouse moves, for data we throw away. It's battery, not Task Manager.
- **Proposed fix (post-fest):** count clicks without a `WH_MOUSE_LL` move stream. Options:
  - Raw Input (`RegisterRawInputDevices` with `RIDEV_INPUTSINK` on a message-only window, read via koffi or `win.hookWindowMessage(0x00FF)`), keeping keys from uiohook.
  - A fork of uiohook-napi that drops `MOUSE_MOVED` before `napi_call_threadsafe_function`.

  Raw Input also avoids the "global hook" AV heuristic for keys.

### F6 [severity: minor] Idle sometimes runs at 24 fps with no input: coin flights count as "busy"
- **Evidence:**
  - `main.js:34` drops to 10 fps only when there's no input, no boss, fervor 0 and `!KK.fx.busy()`. `fx.js:108` counts `FX.coins.length > 0`, and coins fly on every kill.
  - Measured idle draws/s were 9.9–15.2 across runs, with GPU 1.9% at 10 draws/s vs 3.4% at 15.2.
  - Bosses are only 5% of an idle player's time (`docs/playtest/round-04/boss_time.js`: idle, 3 h, floor 29).
- **Fix (10 min):** in the idle branch, `fps = Math.min(fps, KK.fx.busy() ? 15 : 10)`, and drop `coins` from `busy()`. This holds idle at ≤2.5% (and 0% with F1).

### F7 [severity: minor] Store-copy honesty: "never which keys" vs the code
- **Evidence:**
  - Tray tooltip: "counting keystrokes (never which keys)".
  - `main.js:181-186` keeps keycodes in an in-memory `Set` to ignore auto-repeat. That's legitimate, but a privacy FAQ that says "we never see which key" can be shown false by anyone reading the asar, which is unencrypted.
  - Network: `onBeforeRequest` cancels all http(s) and ws(s) requests (`:310`). `kk:openStore` only accepts `store.steampowered.com` and `steam://` (`:240-242`). Both PASS.
- **Fix:** use the wording in the FAQ below ("the key code is used for a split second to ignore held-down repeats, then discarded"), and keep the network block. Once Steamworks lands, the FAQ must say "talks only to your local Steam client."

## Verified fixes from last round (pass/fail, one line each)
- **Typing GPU ≤5% at 24 fps: BORDERLINE.** 5.2% average (4.4–5.9) vs 9.3–10.6% in R3; draws 23.8/s. 0% with F1.
- **Idle <3%: PASS on average.** 2.7% (1.9–3.8); F6 for the spikes.
- **Bar transitions gone: PASS.** `runningAnims` is 0 while typing except during toasts.
- **24 fps default and 10 fps idle: PASS.** `targetFps` reads 24 and 10.
- **Hidden and locked → 0: PASS.** 0.0% GPU, 0 draws, about 170 ctx-switches/s (R3: 412–639), CPU TM 0.01%.
- **Page intervals skip while paused: PASS.** 2 timeouts/s while hidden (the frame poll).
- **Per-monitor fullscreen: PASS** for real fullscreen on 3/3 monitors, other-monitor 3/3 and focus-elsewhere 3/3. New false positives in F2.
- **Explicit save folders, atomic write, backups, migration, demo import, demo isolation: PASS.** Reset, corrupt-file rotation and locked-file handling FAIL (F3).
- **Baked demo flag: PASS.** The packaged `package.json` has no `kkDemo`, and `dist:demo` sets `extraMetadata.kkDemo` and `productName`.
- **Tray "· strip hidden" and the persisted first-hide notice: PASS** (code: `main.js:200`, `:96-97` → save → `kk:settings`).
- **Packaging exists: PASS.** It loads both native modules from the asar. Fuses and signing are F4.

## Store page draft (for the Coming Soon page, ~Nov 23)

**Short description (258/300 chars)**
> A tiny pixel-art dungeon crawler that lives in a slim strip at the bottom of your screen. Every keystroke and click you make while you work powers your party of heroes. It counts how much you type, never what you type, and steps aside when you go fullscreen.

**Features**
- **Your work is their adventure.** Every keystroke charges Sparks that fire your heroes' ultimates. Keep typing to climb from Focused to FLOW STATE for double power and a lit-up dungeon.
- **Lives at the bottom of your screen.** An always-on-top strip that never steals focus. Clicks pass through empty space, and you can dock it on any monitor and size it S, M or L.
- **Idle when you're not.** Reading, in a meeting, away for the night? The party keeps fighting and banks offline gold when you return.
- **Retire, return stronger.** Retire for Renown, spend it in the Hall of Legends, then roll Delve Omens that twist each new run. There are 4 heroes, 19 monsters, 7 bosses and 17 keyboard-themed relics.
- **Polite on your PC.** It freezes completely when hidden, locked or behind a fullscreen game or video. There's a hide hotkey (Ctrl+Shift+Alt+K) and a mute button. *Add "~0% GPU" only once F1 ships and is verified on a laptop.*
- **Private by design.** No account and no internet connection. One tray click pauses counting and removes the keyboard hook entirely.

**FAQ: "Is this a keylogger?"**
1. **Does Keystroke Keep record what I type?**
   - No. It listens for "a key went down" and "a mouse button was clicked," and passes only the words *key* or *click* to the game.
   - The key code is used for a split second to ignore held-down repeats, then discarded. It is never stored, logged or sent anywhere.
   - The game makes no internet connections at all; the code blocks every web request.
2. **Why might my antivirus mention a keyboard hook?**
   - Counting typing in other apps uses the standard Windows low-level input hook, the same one used by hotkey tools and stream overlays.
   - Our builds are code-signed (once F4 ships). If your scanner still flags it, please report the false positive and tell us.
3. **Can I turn it off?**
   - Yes. Tray icon → uncheck *Count keystrokes & clicks* removes the hook from Windows entirely, and the party keeps adventuring idle.
   - *Hide strip* (or Ctrl+Shift+Alt+K) hides it.
   - It also hides itself automatically during fullscreen games and videos on its monitor.

**System requirements (honest, from this round's measurements)**
- **Minimum:**
  - OS: Windows 10 64-bit. Electron 23+ dropped Windows 7, 8 and 8.1.
  - Processor: 2 cores / 4 threads, x64.
  - Memory: 4 GB RAM. The game uses about 300 MB, or about 250 MB in low-GPU mode.
  - Graphics: any DirectX 11 GPU or integrated graphics.
  - Storage: 400 MB (313 MB installed).
- **Notes line:** "Designed to run all day: freezes when hidden or behind fullscreen apps. Typical use on a desktop test PC: under 1% CPU, ~5% GPU while typing." Replace the GPU figure with the F1 number once it is measured on an iGPU laptop.
- **For comparison:** Rusty's Retirement lists Windows 10, i3, 4 GB, DX9 and 256 MB. Our 313 MB footprint is fine.

## Ideas (optional, max 3)
1. **"Low-GPU mode: 0%" as a feature, not a footnote.** If F1 holds on a laptop, put a Task Manager screenshot of 0.0% GPU next to the strip in screenshot #5. Nobody in the bottom-of-screen niche advertises this, and it pre-empts the first negative review.
2. **Target the Bottom-Of-Your-Screen bundle** (Steam, curated by Rusty's Retirement's developer; the listing is now 17 games, with Rusty's at 97% of 6,625 reviews). Apply after launch. It's the niche's main cross-promotion lever, and our "work powers the game" twist is the differentiator in it.
3. **Turn the probe into the release gate.** Run `KK_PROBE=fs` (all 21 PASS), `run_saves.sh` (all PASS) and `quick` (thresholds) against every release candidate. Run it once on an iGPU laptop before Jan 12.

## Measurement notes
- **How to run** (from the project dir; outputs go to `docs/playtest/round-04/market_probe/out/`):
  - `npx electron docs/playtest/round-04/market_probe` runs `perf`.
  - `KK_PROBE=exp|idleexp|quick|mouse|fs` selects the other modes. `KK_SAMPLES=N` sets one-second samples per state. `KK_SWITCHES=a,b` appends Chromium switches.
  - `sh docs/playtest/round-04/market_probe/run_saves.sh` runs the save scenarios.
  - `node docs/playtest/round-04/market_probe/sum.js` prints a summary table.
- **Isolation.** R4 `main.js` uses explicit `%APPDATA%/Keystroke Keep[ Demo]` folders, so the R3 app-name trick no longer isolates. The probe now calls `app.setPath('appData' | 'userData')` to `%APPDATA%/kk-market-probe-r4/…` before compiling the real `main.js` in memory. The real `%APPDATA%/Keystroke Keep` was verified untouched.
- **Metrics:**
  - GPU = `\GPU Engine(*)\Utilization Percentage` (3D and all engines) for our PIDs, DWM and the system.
  - CPU TM = `\Process(electron*)\% Processor Time` / logical CPUs.
  - Wakeups = `\Thread(electron*)\Context Switches/sec`.
  - Page counters come from the injected `render.draw` / `setTimeout` / MutationObserver.
- **Caveats:**
  - One desktop machine. DWM and system GPU baselines are noisy (3–13% and 23–37%).
  - Lock is simulated with `powerMonitor.emit`.
  - Exclusive D3D fullscreen and an iGPU were not tested.
  - The maximized-without-taskbar case is a geometric simulation (sizable window at monitor rect + 8 px). I couldn't change taskbar settings on this machine.
  - The packaged exe was inspected (asar, fuses, RunAsNode, signature) but not run against the real save folder.

## Sources
- Electron fuses (defaults, `grantFileProtocolExtraPrivileges` and `file://`, asar integrity on Windows): https://www.electronjs.org/docs/latest/tutorial/fuses
- electron-builder 26.18.0 schema (local `node_modules/app-builder-lib/scheme.json`: `FuseOptionsV1`, `azureSignOptions`, `signExts`; fuses flipped before signing in `platformPackager.js`): https://www.electron.build/configuration
- Electron dropping Windows 7/8/8.1 (Electron 23+): https://electronjs.org/blog/windows-7-to-8-1-deprecation-notice
- SteamPipe build scripts (`ContentRoot`, `FileMapping`, `FileExclusion`, launch options): https://partner.steamgames.com/doc/sdk/uploading
- Steam Cloud / Auto-Cloud roots (`WinAppDataRoaming`), Shared cloud APP ID with an unreleased base app doesn't sync: https://partner.steamgames.com/doc/features/cloud
- Steam overlay with Electron (transparent window, `--disable-direct-composition` / `--in-process-gpu` workarounds): https://github.hscsec.cn/greenheartgames/greenworks/wiki/Troubleshooting ; https://www.github.com/ceifa/steamworks.js/issues/95
- Rusty's Retirement store page (requirements, 97% of 6,625 reviews, Bottom-Of-Your-Screen bundle of 17 games): https://store.steampowered.com/app/2666510/Rustys_Retirement/
- Bottom-Of-Your-Screen bundle background: https://www.gamegrin.com/news/new-games-have-been-added-to-the-bottom-of-your-screen-bundle
- R3 sources (Next Fest dates, review times, code-signing options) still apply: see `docs/playtest/round-03/market.md`.
