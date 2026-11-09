# Round 02 — T3 "market" (Steam Market & Reviews Analyst)

## Verdict
On paper R1 fixed most of the desktop-citizen issues. Clicks no longer take focus, there is no network traffic, sound defaults are sane, the HUD and tray have a mute and a pause, and the welcome-back modal is now a toast. But two headline problems survive measurement:
- **GPU use is unchanged.** Two infinite CSS animations bypass the 30/12 fps cap, so GPU cost is the same as R1 (Electron about 11% of the 3D engine and DWM about 27%, even at "12 fps idle" and even while the strip is hidden).
- **The strip still covers fullscreen apps.** On Windows, `'floating'` is the same `HWND_TOPMOST` as before.

A free competitor (TBH: Task Bar Hero, 526k peak CCU) also now owns "pixel heroes in your taskbar while you work". The pitch therefore has to lead with *typing is the power source* and *offline, private, light*. I would keep it running tomorrow and would not refund. I would also leave a "fan spins up / covers my YouTube fullscreen" review. **Rating: 6.5/10** (concept 8, shell 5.5). Every blocker below is a 1–2 day fix and fits easily before the Jan 18 submission.

## Findings (ranked, max 8)

### F1 [severity: blocker] The fps cap is defeated by two infinite CSS animations: GPU and compositor cost is the same as R1, even while hidden
- Evidence. Probe `docs/playtest/round-02/market_probe/probe.js` loads the real `electron/main.js` under a separate userData folder, so the player's save was not touched. Results are in `out/results.json`. GPU numbers are `\GPU Engine(*engtype_3D)` summed over the Electron PIDs, then DWM. Test machine: 2560x1440 at 150%, 160 Hz.

  | State | draws/s | rAF/s | Electron 3D % | DWM 3D % |
  |---|---|---|---|---|
  | Idle, `targetFps` 12 (R2 default) | 15.2 | **160** | **10.7–11.6** | **26–29** |
  | Same idle, CSS `animation:none` injected | 14.8 | 160 | **1.8–2.8** | 15–17 |
  | Typing, 30 fps | 27 | 160 | 10.1–11.7 | 27–31 |
  | Hidden via tray (`hide()` + power off) | **0** | 160 | **11.0–15.1** | 8–12 |
  | R1 baseline, 160 fps uncapped (for reference) | 160 | 160 | 12.5–13.1 | 26.8 |

  - DWM with no Electron running: 7–14%. The animations measured on → off → on, so the effect is causal.
  - The culprits are the only `iterations: Infinity` animations in the document (from `document.getAnimations()`):
    - `css/style.css:152`: `.wave-pips i.cur { animation: blink 1s steps(2) infinite }`. It is on screen almost always.
    - `css/style.css:184`: `.hbtn .badge { animation: bob 1s ease-in-out infinite }`. It shows whenever something is affordable or a relic is waiting, which is most of the time.
    - `css/style.css:162`: `flowtxt` also runs in FLOW.
  - Chromium composites the whole transparent 2560 px layered window at the monitor refresh rate while any of these run. The JS frame cap never sees it.
  - `backgroundThrottling:false` keeps the page "visible" when hidden. Electron docs: "the visibility state will remain `visible` even if the window is minimized, occluded, or hidden". The probe measured `document.visibilityState = 'visible'` while hidden. So the animations keep compositing in a hidden window, and the `document.hidden` branches in `js/main.js:42` and `js/audio.js:31` are dead code in Electron.
  - The rAF loop itself still wakes **160 times/s in every state, including `targetFps 0`** (`js/main.js:38`, which reschedules before checking fps). That is a CPU wakeup and battery cost on laptops even when nothing is drawn.
- Why it matters: performance is the #1 thing this niche's reviewers check in Task Manager. "GPU 3D 11% for a pixel strip" plus "DWM at 27%" is the exact Rusty's Retirement complaint, and the fps setting will look fake to anyone who measures it.
- Proposed fix (about half a day, pre-fest):
  1. Remove all infinite CSS animations. Drive the pip blink, badge bob and FLOW text from `ui.update()`: toggle a class at 2 Hz, which costs about 2 repaints/s. Alternatively add `html.kk-still * { animation-play-state: paused !important }` whenever `targetFps() <= 12`, the power is off, or the strip is hidden.
  2. Replace `requestAnimationFrame` with a `setTimeout(frame, 1000/fps)` scheduler, or use rAF only when fps ≥ 50. Stop scheduling entirely when `targetFps() === 0` and restart on the `power` event.
  3. Pass/fail gate before the demo build: re-run `npx electron docs/playtest/round-02/market_probe`. Targets: idle Electron 3D below 3%, DWM within 3 points of baseline, hidden 0%.

### F2 [severity: blocker] It still covers fullscreen video and games: `'floating'` is `HWND_TOPMOST` on Windows
- Evidence:
  - The probe read the strip's extended style: `0x8280028`, **TOPMOST=True** and NOACTIVATE=True.
  - Electron's docs say levels `floating` through `status` differ from the higher levels only in being placed **below the taskbar**. Every level is still topmost.
  - The comment in `electron/main.js:63` ("below fullscreen apps and games") is wrong on Windows.
  - Fullscreen test: a non-topmost fullscreen window (`setFullScreen(true)`, like browser-fullscreen YouTube or a borderless game) was opened and the screen captured (`out/fullscreen_test.png`). The strip draws **on top of it**, and it floats 48 px above the bottom edge, because it docks to `workArea` and the taskbar is hidden during fullscreen. Pixel at the top centre = (0,253,0), the fullscreen window. Pixel in the strip row = (29,24,42), the dungeon.
  - The tray "Always on top" toggle exists, but nobody will find it mid-video.
- Why it matters: "it sits on top of my fullscreen Netflix/game HUD" is a top-3 complaint in this niche and makes for an instant negative review. TBH: Task Bar Hero docks *inside* the taskbar and avoids it.
- Proposed fix (pre-fest, 1 day):
  - Add fullscreen auto-hide in main. Every 1.5 s, call `SHQueryUserNotificationState` through `koffi`. States 2 (busy), 3 (D3D fullscreen) and 4 (presentation) mean a fullscreen app is in front. As a fallback, compare the `GetForegroundWindow` rect with its monitor's bounds.
  - When fullscreen is detected, `hide()` and send power off. Restore with `showInactive()`.
  - Add a Settings toggle "Hide when an app is fullscreen", default ON, and fix the comment.
  - Post-fest: a real AppBar (`SHAppBarMessage`) so maximized windows stop above the strip.

### F3 [severity: major] Silent and hidden states still do work: lock/unlock while hidden resumes drawing and audio, and muting leaks audio nodes
- Evidence:
  - **Power state is not combined with visibility.** `electron/main.js:157-161` sends `power('on')` on `unlock-screen` and `resume` even when the strip was hidden with Ctrl+Alt+K or the tray. The probe sequence was hide → emit `lock-screen` → emit `unlock-screen`. Result: **27 draws/s, AudioContext `running`, GPU 18–19%** while the window is invisible. Sleep → resume does the same. Any SFX that fires then plays from an invisible app.
  - **Muted audio keeps creating nodes.**
    - `A.play` and `tone()` only check `A.ready` (`js/audio.js:52,124`). They do not check that the context is running.
    - With sound off (context `suspended`), the probe counted **78 oscillator/buffer sources created in 5 s** at 5x warp in FLOW, about 16/s. At 1x warp that is likely still thousands per hour.
    - `currentTime` is frozen while suspended, so every node is scheduled at the same instant. Started scheduled sources are kept alive until they play, so this is a slow memory leak for anyone who mutes. On unmute they would most likely all fire together as a burst. That last point is inferred from the Web Audio spec and was not listened to.
  - Hiding the strip freezes the sim (`targetFps 0`), and the time is then paid at the offline rate (40–80%). Hiding during a meeting therefore costs progress. That is defensible, but it isn't communicated.
- Why it matters: "RAM keeps growing" and "it made a noise while hidden during my call" are the kind of one-off reviews that sink a $4.99 game with 40 reviews.
- Proposed fix (2 hours):
  - In main, compute `effective = win.isVisible() && !locked && !suspended && !fullscreenApp` and only ever send that value.
  - Add `if (!A.ctx || A.ctx.state !== 'running') return;` at the top of `tone()`, `noise()` and `A.play`.
  - Optionally keep the sim stepping at 2–4 Hz without drawing while the strip is hidden, so hiding is never punished. Otherwise tell the player: "Hidden: heroes rest at offline speed".

### F4 [severity: major] Trust: an invisible keyboard-hook process, unsigned, with a tray "Open dev tools"
- Evidence:
  - `skipTaskbar:true` together with `focusable:false` means there is no taskbar button and no Alt-Tab entry (Electron also forces skipTaskbar for unfocusable windows on Windows).
  - Windows 11 puts new tray icons in the hidden overflow by default.
  - After Ctrl+Alt+K, the app is completely invisible and `uIOhook` keeps counting keystrokes. `fwd()` in `electron/main.js:83` ignores visibility.
  - "Pause" only stops forwarding. The low-level keyboard hook stays installed (`uIOhook.stop()` is only called on quit).
  - The build is still unsigned and has no VirusTotal check. No "what we count" panel exists yet (R1 backlog).
  - The tray ships "Open dev tools" (`electron/main.js:116`).
- Why it matters:
  - Bongo Cat (free, hugely popular) still has keylogger accusations among its most-helpful negative reviews (R1 sources).
  - TBH: Task Bar Hero's main criticisms now include data-collection concerns.
  - A hidden process with a global hook and no window is the exact pattern EDR tools and Reddit threads flag.
- Proposed fix (pre-fest):
  1. When "Count keystrokes" is OFF, call `uIOhook.stop()`, and start it again when the setting is turned back on. The store FAQ can then say "Pause removes the hook entirely".
  2. The first time the strip is hidden, show a balloon/tray notification: "Keystroke Keep is hidden and still counting. Ctrl+Alt+K or the tray icon brings it back." The tray tooltip should show the state ("Hidden · counting" / "Paused").
  3. Code-sign the demo (Azure Trusted Signing or OV), scan it with VirusTotal, and submit any flags to Microsoft WDSI before Jan 18.
  4. Remove "Open dev tools" from release builds (behind `!app.isPackaged`).
  5. Add an in-game "What we can see" panel: a live counter of `key`/`click` events only, plus "0 network requests" (verified below).

### F5 [severity: major] Positioning: a free 500k-CCU competitor now owns "pixel heroes in your taskbar", so the store page must sell typing as power, privacy and lightness
- Market evidence:
  - **TBH: Task Bar Hero**: free-to-play, released May 27 2026, peak **526,572 CCU** (Jun 14 2026). Steam reviews: **Mixed, 62% of 8,814** (recent 58%). Its tags include Idler and **Desktop Companion**. Minimum spec is 8 GB RAM, a GTX 750 Ti and broadband internet. Criticism centres on server outages, cheating crackdowns and data collection.
  - The Idler tag had 1,566 releases in 2026 to Sep 27 (+150% year on year), and Desktop Companion 136 vs 19 (partly a re-tag artefact). The median Idler price is $3.99. Free Idler games reach 1,000 reviews at 26.1%, and under-$5 paid games at only 2.5%.
  - Desktop Heroes ($3.99, Mostly Positive) is the other "heroes in a strip" game (R1).
- Implication: a $4.99 strip of pixel heroes reads as "paid TBH" unless the first frame shows the **keyboard → spell** link.
  - Keystroke Keep's real differentiators are exactly TBH's weak spots: fully offline (no servers, no trading, no cheating economy), counts but never records, and light (once F1 lands, about 2% GPU).
  - Price: $4.99 is fine. Avoid F2P comparisons in copy. Add a $3–4 Supporter Pack (R1 idea).
- **Store page, capsule and trailer plan (pre-fest):**
  - **Header capsule 920x430 / main capsule 1232x706.**
    - Top third: a close-up of a mechanical keycap mid-press, with a spark trail arcing down.
    - Bottom: the strip, with the Mage's Meteor landing on the Bone King.
    - Logotype "KEYSTROKE KEEP" in the pixel font. Valve allows no text except the title.
    - Do not show a Windows taskbar. That is TBH's visual.
  - **Small capsule 462x174:** a logo that nearly fills the frame, plus one glowing keycap. It must read at 120x45.
  - **Vertical capsule 748x896:** keyboard on top, a vertical slice of the dungeon below.
  - **Screenshots (min. 5, 1920x1080, gameplay only, mark 4 as all-ages):**
    1. The strip under a real code editor mid-Meteor.
    2. The FLOW STATE banner.
    3. A boss fight (Bone King).
    4. A two-step relic pick.
    5. A Magma/Void biome.
    6. Legacy/Retire.

    Crop to the strip plus a sliver of desktop context. Copy belongs in the description, not in the images.
  - **Short description:** "Type anything. Your keystrokes fire their spells. A tiny offline dungeon party lives under your work, never records a key, and barely touches your GPU."
  - **Trailer (35–45 s, a 16:9 cut and a 9:16 cut):**
    - 0–3 s: real hands typing with real key sound. Every press sends a spark into the strip.
    - 3–8 s: pressing Enter on an email → Meteor kill. On-screen text: "Your work is their adventure".
    - 8–25 s: biomes, bosses, FLOW, relics.
    - 25–35 s: trust beat: "Counts, never records · 100% offline · ~2% GPU". Make these claims only after F1 passes.
    - End card: Wishlist plus the Next Fest dates.
    - The 9:16 cut stacks a keyboard cam over a 3x crop of the party, because the strip's 13:1 aspect is unusable in vertical feeds.
  - **GIF and capture mode:** idle drops to 12 fps after 45 s without input. Walking and scrolling at 12 fps looks choppy in captures and to someone watching a video beside it. Add a hidden "capture mode": 60 fps, no idle drop, fixed camera crop around the party, optional HUD off. Consider an idle floor of 15–20 fps once F1 has removed the real cost.
  - **Outreach:** programming, writing and typing-test streamers ("my code review killed the Bone King"), not only cozy channels. Rich presence in the demo ("Delving floor 42 · FLOW STATE").

### F6 [severity: major] Next Fest schedule (re-verified) and the Steam-integration items that must be in the demo
- Evidence. Valve's Feb 2027 page, fetched 2026-11-09. All times PST.

  | Date | What |
  |---|---|
  | Dec 8, 10–11am | Live Q&A on Zoom (optional) |
  | **Jan 10, 11:59pm** | **Registration deadline.** Also the recommended date for marketing materials to be up to date, so the game can be considered for the official Next Fest trailer |
  | **Jan 18** | **Submit the demo build and store page for review** to be live at the start of the Press Preview. Steam also pulls trailers for the official trailer on this date |
  | **Feb 1** | All required items submitted (final cutoff) |
  | Feb 11 | Trailer-permission opt-out deadline. Press Preview starts at 10am |
  | **Feb 22, 10am → Mar 1, 10am** | Festival. The demo must be set live before 10am Feb 22 |
  | Mar 1 | Wrap-Up featuring the **most-played demos** |

  Eligibility: the store page must be **published and public**, and a publicly playable demo must exist by the start of the festival.
  - The R1 dates are confirmed exactly. GDD line 13 ("demo locked by Jan 10") is conservative. The real lock date is Jan 18, but the *public page plus trailer* should be live by Jan 10 for official-trailer consideration.
  - Still not done: saves are still localStorage (`js/state.js:6,262`), and there is no Steamworks, achievements or rich presence.
- Why it matters: a missed public page or a lost save can't be fixed after the event, and only one Next Fest is allowed per game. Always-on demos are built for the "most-played" Wrap-Up.
- Proposed fix (pre-fest):
  - Register this month.
  - Get the placeholder Coming Soon page public by about Dec 1 (it needs Valve review, and wishlists only accrue while it is live), with the real capsule and trailer by Jan 10.
  - Write file saves to `userData/save.json` (atomic rename plus 3 backups), in the same format the demo and full game use, so the demo carries over.
  - Make the demo endless at its content cap.
  - Add rich presence.
- **Top 5 launch achievements.** Each is reachable by an idle player too, has no grind thresholds, and teaches a mechanic:
  1. **"Spark of Genius"**: your typing fires your first ultimate (teaches the core link).
  2. **"In the Flow"**: reach FLOW STATE.
  3. **"Bone Dry"**: defeat the Bone King, the first boss.
  4. **"Rat Catcher"**: catch a golden rat.
  5. **"Honourable Retirement"**: retire once and spend Renown.

  Add 30–40 more for 1.0 (biomes, one per hero ult, relic codex). None should need more than about 20 h of running, and none should need a second save.

### F7 [severity: minor] Ctrl+Alt+K is a bad global default: AltGr layouts and a popular VS Code extension
- Evidence:
  - Windows treats AltGr as Ctrl+Alt, and `RegisterHotKey` (Electron `globalShortcut`) swallows the combination system-wide.
  - **AltGr+K types "ł" on the Hungarian and Croatian layouts** (kbdlayout.info KBDHU/KBDCR, and Slovenian/Bosnian share the Croatian layout). Those users would lose a letter and hide the game every time they type it.
  - The VS Code **Bookmarks** extension (alefragnani, multi-million installs) uses Ctrl+Alt+K for "Toggle Bookmark". Programmers are a target audience.
  - `globalShortcut.register` *returns false* when the combination is taken; it does not throw. `electron/main.js:166` ignores the result, yet the tray still advertises "(Ctrl+Alt+K)".
  - The probe confirmed registration succeeded on this machine (`hotkeyRegistered: true`).
- Proposed fix:
  - Default to **Ctrl+Shift+Alt+K**, or no default with an opt-in.
  - Make it rebindable in Settings.
  - Check the boolean result and show "hotkey unavailable" in the tray and Settings.

### F8 [severity: minor] Side effects of `focusable:false` and docking gaps
- Evidence:
  - NOACTIVATE was confirmed, which was the goal.
  - Esc-to-close (`js/ui.js:39`) can never fire now because the window never receives keyboard focus, yet the close button's tooltip says "Close (Esc)" (`index.html:60`). There is also no keyboard path to any control, which is an accessibility note for the store page.
  - Raymond Chen (2024) documents that a `WS_EX_NOACTIVATE` window can still be activated via `WM_MOUSEACTIVATE`. Needed: **one manual test**. Type in Notepad, click the rat and a HUD button, keep typing, and confirm the text still lands in Notepad. I did not inject real input.
  - No `display-added` handler (`electron/main.js:58-59`). After undocking and re-docking a laptop, the strip stays on the fallback display until the next metrics change.
  - The strip still docks over an auto-hidden taskbar's reveal edge (R1 F2g).
  - No `setContentProtection`, so it still appears in Teams/Zoom shares (R1 F2e, deferred).
- Proposed fix:
  - Drop "(Esc)" from the tooltip.
  - Add `screen.on('display-added', redock)`.
  - When `workArea.height === bounds.height` on the docked edge, leave a 2 px gap.
  - Post-fest: a content-protection toggle (one line).

## Verified fixes from last round (pass/fail, one line each)
- **30 fps cap / 12 idle / 20 battery (JS side): PASS.** Measured 27 draws/s typing, 15 idle, 20 on battery. **Outcome: FAIL.** GPU is unchanged at about 11% / DWM 27% because of the CSS animations, and rAF still wakes 160 times/s (F1).
- **Stop rendering when hidden, locked or asleep: PARTIAL.** Draws drop to 0, but the GPU stays at 11–15% while hidden, and lock/unlock while hidden resumes drawing (F1, F3).
- **Audio suspends when muted, hidden or locked: PASS** (`suspended` measured). **Leak: FAIL.** Nodes keep being created into the suspended context (F3).
- **Focus stealing (`focusable:false`): PASS** (`WS_EX_NOACTIVATE` set, `isFocusable()` false). A manual click test is still owed (F8).
- **Always-on-top level `'floating'`: FAIL** for the intended goal. It is still TOPMOST and draws over fullscreen windows (F2).
- **Tray controls (show/hide, count, sound, always on top, display picker): PASS** (code review; 3 displays detected).
- **Hide hotkey: PASS** (registered). Default needs changing (F7).
- **No network: PASS.** Fonts are local (Pixelify and Silkscreen `loaded`). The CSP is `default-src 'self'` / `connect-src 'none'`. An external image was blocked. There were 0 TCP connections and 0 UDP endpoints owned by Electron PIDs during the run.
- **Single persisted pause setting: PASS.** Saved in `settings.countInput`, mirrored in the tray, and the HUD shows "PAUSED". The hook stays installed (F4).
- **Sound defaults: PASS.** Music off, volume 0.3, key blips off, HUD mute button present.
- **Offline modal → toast: PASS.** Returning after 3 h shows the toast with no modal (`out/offline_return.png`). The window grows by about 54 px for 7 s, but that area is click-through.
- **skipTaskbar / AUTO size: PASS.**

## Ideas (optional, max 3)
1. **"Lightweight" as a feature.** Once F1 passes, add a tiny tray "Resource use" line (fps, the GPU target) and say it on the store page. Being light is Ropuka's most praised trait and a weak spot for TBH (8 GB RAM minimum).
2. **"Shift report" card at lock time after 5 pm** (R1 idea): keystrokes, FLOW time, bosses. One-click PNG. It is the shareable asset and doubles as the trailer's end card.
3. **Offline-first as identity.** "No servers, no trading, no anti-cheat, your save is a file you own." This contrasts directly with TBH's reviews without naming it.

## Pre-fest checklist (submit by Jan 18; public page and trailer by Jan 10)
| # | Must do | Effort |
|---|---|---|
| F1 | Kill infinite CSS animations, add a timer-based scheduler, stop it at fps 0, pass the probe gate (<3% GPU) | ½ day |
| F2 | Fullscreen auto-hide (koffi + `SHQueryUserNotificationState`), default ON | 1 day |
| F3 | Effective power = visible && !locked; audio early-return when not running | 2 h |
| F4 | `uIOhook.stop()` on pause, hidden-state notice and tooltip, code signing + VirusTotal, remove dev tools | 1 day + cert |
| F5 | Capsule set, 6 screenshots, 35–45 s trailer (16:9 + 9:16), capture mode, short description | art budget |
| F6 | Register, public page by about Dec 1, file saves + carry-over, endless demo cap, rich presence, top-5 achievements | 1–2 days |
| F7 | Ctrl+Shift+Alt+K, rebindable, check the register result | 1 h |
| F8 | Tooltip fix, `display-added`, auto-hide taskbar gap, manual focus test | 1 h |

## Measurement notes
- Probe: `npx electron docs/playtest/round-02/market_probe` from the project dir. It runs about 2 min, opens a green fullscreen test window for 2.5 s, and exits by itself.
  - It uses app name `kk-market-probe`, so its profile is `%APPDATA%/kk-market-probe` and the real `keystroke-keep` save is never touched.
  - It runs in snapshot mode (no input hook). Typing is simulated in-page through `KK.input.event`.
  - Outputs: `out/results.json`, `out/console.txt`, `out/fullscreen_test.png`, `out/offline_return.png`.
- Caveats:
  - One machine: RTX 3080, 2560x1440 at 150%, 160 Hz primary, 3 displays.
  - Lock, unlock, suspend and battery were simulated by emitting `powerMonitor` events or sending `kk:battery`.
  - GPU percentages are per-engine utilisation, and the DWM baseline is noisy (7–14%).
  - `powercfg /requests` needs admin and was not checked.

## Sources
- Steam Next Fest Feb 2027 dates: https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- Steam store graphical asset specs and rules: https://partner.steamgames.com/doc/store/assets/standard
- Electron BrowserWindow (`setAlwaysOnTop` levels vs taskbar, `backgroundThrottling` visibility, `setContentProtection`): https://www.electronjs.org/docs/latest/api/browser-window
- Electron: on Windows `focusable:false` implies skipTaskbar: https://ayakael.net/mirrors/electron/commit/50f18370976410abb33d94bbb76946b482f050dd
- WS_EX_NOACTIVATE window can still be activated (Raymond Chen, 2024): https://devblogs.microsoft.com/oldnewthing/?p=110283
- TBH: Task Bar Hero store page (reviews, price, min spec, tags): https://store.steampowered.com/app/3678970/ ; CCU and review themes: https://allthings.how/task-bar-hero-tops-526000-concurrent-steam-players-amid-mixed-reviews/
- Idler / Desktop Companion niche stats (Sep 2026): https://www.steampageanalyzer.com/niches/idler
- Croatian / Hungarian AltGr+K = ł: https://kbdlayout.info/kbdcr , https://kbdlayout.info/kbdhu ; AltGr = Ctrl+Alt shortcut conflicts: https://bugzilla.processing.org/665 , https://synwrite.sourceforge.net/forums/viewtopic.php?p=18487
- VS Code Bookmarks extension (Ctrl+Alt+K toggle): https://github.com/alefragnani/vscode-bookmarks , https://www.choge-blog.com/?p=87607
- R1 sources (Rusty's Retirement, Bongo Cat, Desktop Heroes, Ropuka) remain valid: see `docs/playtest/round-01/market.md`.
