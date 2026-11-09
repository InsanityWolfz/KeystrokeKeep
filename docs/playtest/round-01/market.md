# Round 01 — T3 "market" (Steam Market & Reviews Analyst)

## Verdict
The hook sells: "your typing powers a tiny dungeon party above your taskbar" is a clear, GIF-able pitch in a proven niche. Rusty's Retirement sold ~330k copies at $7 and Bongo Cat peaked near 194k concurrent players. In its current state, though, the desktop shell would earn the reviews this niche is known for. It renders at the monitor's full refresh rate forever (I measured 160 fps and about 13% of an RTX 3080's 3D engine while idle on the welcome screen). It sits above fullscreen video and games with no way to move it. It plays music by default at 0.55 volume. It fetches Google Fonts while claiming it "never sends anything over the network". And all of the content is seen in about 2 hours of an app people will leave running 8 hours a day. I would keep it running tomorrow only after shrinking it and muting it, and I would refund it if it showed up in a Teams screen share. **Rating: 6/10** (concept 8, shell 4). All of these problems can be fixed before Next Fest, and most of the fixes are cheap.

## Findings (ranked, max 8)

### F1 [severity: blocker] The strip renders every frame at the monitor's refresh rate, forever, and the audio graph never stops: GPU, battery and sleep complaints
- Evidence:
  - `js/main.js:27-39`: the `requestAnimationFrame` loop draws on every frame with no frame cap and no idle or dirty check.
  - `electron/main.js:39`: `backgroundThrottling: false`. Per Electron's docs this keeps the page "visible" even when it is hidden or occluded, so the loop most likely keeps running after "Show / hide strip" in the tray. I have not verified that.
  - Measured in snapshot mode (4K at 150% DPI, 160 Hz, RTX 3080) with an in-page probe: **fps = 160.0**, `R.draw` = 0.12 ms, backing canvas **4270x320**.
  - GPU counters (`\GPU Engine(*engtype_3D)`): Electron process **12.5–13.1%** of the 3D engine. DWM was 26.8% with the strip up and 5.6–13.7% after it quit.
  - CPU was low on this 32-core box (about 1.6% of one core). The cost is in the GPU and the compositor, which is exactly the shape of the complaints Rusty's Retirement got.
  - Audio: `js/audio.js:127` schedules oscillators every 60 ms for as long as the app runs. Muting only sets the gain to 0 (`applySettings`), and `ctx.suspend()` is never called.
  - An `AudioContext` that keeps running holds an "audio stream in use" request, which can stop Windows from going to sleep on idle (`powercfg /requests`).
  - No `powerMonitor` handling: nothing changes on battery, on lock-screen or when the display turns off.
- Market evidence:
  - Rusty's Retirement's top performance thread reports DWM jumping to about 20% CPU, stuttering YouTube, and a "37 FPS cap on both screens" on high-res and multi-monitor setups. The developers acknowledged "performance issues on hi-res monitors".
  - One of Bongo Cat's top negative reviews says it climbs to "60% of resources" after 30–60 minutes inactive.
  - Ropuka's Idle Island is praised specifically for being light: "doesn't impact PC performance at all".
- Why it matters: the strip runs 8 hours a day on work laptops with integrated GPUs. Expect reviews like "My laptop fan spins up and the battery dies 2 hours early because of a pixel strip" and "my PC never sleeps any more". Performance is the first thing reviewers in this niche check in Task Manager.
- Proposed fix (pre-fest, about 1 day):
  1. Cap rendering at **30 fps**, using an accumulator in `frame()` and skipping `R.draw` on off-frames. Drop to **10 fps** after 60 s with no input and nothing on screen. Go back to 30 on any input, ult, boss or rat. The sprites animate at 8–14 fps, so this costs no visible quality.
  2. Stop drawing completely while the window is hidden from the tray, the screen is locked (`powerMonitor` `lock-screen`/`unlock-screen`), or the system is suspended. The sim can keep stepping at 2–5 Hz, or catch up through the existing `awayCheck` path.
  3. Call `A.ctx.suspend()` whenever sound and music are both off or the volume is 0, after 5 min with no input, and on lock. Call `resume()` on the next input.
  4. On battery (`powerMonitor.isOnBatteryPower()`), use a 20 fps cap.
  5. Add an FPS option in Settings (Low 15 / Normal 30 / Smooth 60).
  6. Re-run this measurement as a pass/fail check: a target under 3% GPU, and `powercfg /requests` clean when muted.

### F2 [severity: blocker] It covers work and play with no escape: always on top above fullscreen apps, maximized windows slide under it, 192 px default, primary monitor only, clicks steal focus, and it shows up in screen shares
- Evidence:
  - `electron/main.js:42`: `setAlwaysOnTop(true, 'screen-saver')`. The strip draws over borderless-fullscreen games and browser-fullscreen video (YouTube, Netflix, slides). There is no fullscreen detection.
  - `dockBounds` uses `workArea`, so with an auto-hidden taskbar the strip sits on the bottom pixels and **blocks the hover trigger that reveals the taskbar**.
  - The strip is not an AppBar, so maximized windows extend underneath it and lose 192 px: editor status bars, terminal last lines, Excel sheet tabs.
  - Default size M is 64 x 3 = **192 CSS px** (`render.js:28`). That is 18% of a 1080p screen and 25% of a 768p laptop.
  - Primary display only (`screen.getPrimaryDisplay()`, line 15). There are no `display-added`/`display-removed` handlers and no monitor choice. The README admits this.
  - The window is focusable. Clicking the golden rat or a HUD button moves keyboard focus into the strip, so the next sentence the user types goes nowhere. The game still counts it, which makes it worse.
  - No `setContentProtection`: the dungeon appears in every Teams, Zoom or Meet screen share.
  - No hotkey to hide it quickly. Hiding needs the tray.
  - `skipTaskbar: false` puts a permanent taskbar button and Alt-Tab entry on screen for an always-running widget.
- Market evidence:
  - Rusty's Retirement ships an always-on-top **toggle**, vertical and horizontal ("taskbar"/"sidebar") placement, and resize keys (GameSkinny guide). Its users still report bugs where always-on-top pushes the window off-screen.
  - Desktop Heroes (the closest competitor, see F8) is criticized because "the screen space is too demanding".
  - Rusty's negatives include "too large to run comfortably alongside other windows".
- Why it matters: "Never in the way" is pillar 2 of the GDD. Expect reviews like "It covers the bottom of my YouTube fullscreen and my game HUD", "it showed up in my screen share at work", "can't put it on my second monitor", and "clicking it eats my keystrokes".
- Proposed fix:
  - **Pre-fest (about 2 days):**
    - (a) Auto-hide while a fullscreen app is in front. Poll `SHQueryUserNotificationState` every 2 s; values 3, 4 and 2 (D3D fullscreen / presentation / busy) mean "fullscreen app in front". Call it through `koffi` (prebuilt FFI, nothing to compile), or compare `GetForegroundWindow` bounds with the monitor bounds. Add a Settings toggle "Hide when an app is fullscreen", default ON.
    - (b) Default size S (128 px). Auto-pick the size so the strip takes no more than about 12% of `workArea.height`. Add an XS (scale 1.5, about 96 px) "ticker" option.
    - (c) Tray menu "Display ▸" listing `screen.getAllDisplays()`. Save the chosen display id, fall back to primary on `display-removed`, and re-dock on `display-added`/`display-metrics-changed`.
    - (d) Make the strip non-activating: `focusable: false` (on Windows this sets WS_EX_NOACTIVATE and clicks still work), plus `showInactive()` at launch. Make it focusable only while the Settings slider has focus.
    - (e) `win.setContentProtection(true)` by default, with a tray and Settings toggle "Visible to screen capture (streamers/OBS)". It is one line and very on-brand for "at work".
    - (f) A global hide hotkey (`globalShortcut`, e.g. Ctrl+Alt+K) and a tray "Always on top" toggle.
    - (g) Leave a 2 px click-through gap at the bottom edge when the taskbar is auto-hidden.
    - (h) `skipTaskbar: true` (the tray is the home).
  - **Post-fest:**
    - Reserve the space as a real AppBar (`SHAppBarMessage ABM_NEW/ABM_SETPOS` via koffi) so maximized windows stop above the strip. That would be a genuine differentiator.
    - Top-edge and vertical-sidebar docking.
    - An opacity slider.

### F3 [severity: blocker] Trust: the "it's a keylogger" fear is not handled, and the build currently breaks its own privacy promise
- Evidence:
  - `index.html:6-9` loads **Google Fonts from fonts.googleapis.com and fonts.gstatic.com on every launch**, and the CSP explicitly allows it.
  - The GDD (section 3) promises "never send anything over the network", and the welcome modal says the game "never records what you type". The first person who runs GlassWire, a firewall prompt or Wireshark on the "global keyboard hook game" will see it contacting Google.
  - Pause state is split and not persisted:
    - The tray "Pause counting input" sets `paused` in the main process (`electron/main.js:81`). It is not saved and resets to counting on relaunch.
    - Settings "Count my keystrokes" sets `countInput` in the renderer (`state.js:99`).
    - Neither shows the other's state.
    - The strip HUD has no "counting is paused / active" indicator.
  - The build is unsigned and has no packaging (README).
  - `uiohook-napi` installs a `WH_KEYBOARD_LL` hook. An unsigned process that owns a global LL keyboard hook is a classic EDR/AV heuristic signal.
- Market evidence:
  - **3 of the 10 most-helpful negative Bongo Cat reviews** call it a keylogger or allege data transfers, even though it is free, wildly popular and only counts input.
  - Community "is it safe" guides exist because the developer's own explanation is hard to find.
  - Electron apps have been caught by Defender false positives such as Behavior:Win32/Hive.ZY.
- Why it matters: this audience plays at work, on laptops managed by IT with CrowdStrike/Defender for Endpoint. One "my IT department flagged this as a keylogger" review on a $4.99 game with 50 reviews tips the score from Very Positive to Mixed.
- Proposed fix:
  - **Pre-fest:**
    - (a) Bundle both fonts locally and set the CSP to `default-src 'self'`.
    - (b) In `main.js`, block every non-`file:` request with `session.defaultSession.webRequest.onBeforeRequest`. Write the "zero network traffic" claim only after checking it with a firewall.
    - (c) Merge the two pause states into one persisted setting. Mirror it in the tray menu, the Settings panel and a small HUD lock icon (open = counting, closed = paused) that can be clicked.
    - (d) Code-sign the demo with Azure Trusted Signing (about $10/month) or an OV certificate. Before Feb 11, run the packaged exe through VirusTotal and submit it to Microsoft WDSI as a false positive if anything flags.
    - (e) Store-page FAQ plus an in-game "What we can see" panel showing a live log of the only two messages the renderer ever gets: `key` and `click`.
  - **Post-fest:**
    - Open-source `electron/main.js` input handling, `preload.js` and `js/input.js` in a tiny public repo linked from the FAQ.
    - Add an "only count while these apps are focused / never in these apps (password managers, banking)" filter.
    - Write a one-paragraph "for IT departments" note.

### F4 [severity: major] Content runs out in about 2 hours of an app that runs 8 hours a day
- Evidence:
  - `node tools/playtest.js --min 240 --profile typist --strategy smart --seed 1`:
    - All 4 biomes by **1h57m** (Void at 1h57m).
    - Every boss type killed by 2h47m.
    - "monsters never seen: none".
    - Every Legacy upgrade bought at the **first retire (0h41m)**, matching the R0 backlog item.
  - `--min 480 --seed 2`: Void reached at **1h37m**. Then 7 retires of the same 4 biomes, ending on floor 109.
  - Idle profile: retires at 43, 95 and 151 min and reaches floor 50 by about 2.5 h, so it sees everything on day 1–2.
  - After that the only novelty is relic RNG (17 relics) and bigger numbers.
- Market evidence:
  - Rusty's Retirement's most common negative theme (5 of the 10 most-helpful negatives) is "finished in days / nothing to do with resources / no endgame", from players with 35–99 h of playtime.
  - Desktop Heroes' negatives: "numbers go up but no different from the first 15 minutes", "no prestige", "progression feels flat".
  - In this niche, playtime counts in days, not hours. Steam will display "312 hrs on record" next to a "Not Recommended: nothing to do after day one" review.
  - The Steam refund window (2 h / 14 days) closes in a morning, so this risk shows up as **bad reviews, not refunds**.
- Why it matters: price versus hours is fine at $4.99 (see Ideas), but only if novelty lasts at least about 20–40 hours of running time.
- Proposed fix:
  - **Pre-fest:** the demo can stay short on content. Follow the GDD plan: 2 biomes, floor 30, 1 retire. But **do not hard-stop it** (see F6): at the cap, keep the party farming the deepest demo floor, keep relics, rat and Legacy working, and show a soft "The Magma Depths await in the full game" door.
  - **Post-fest:** pace for wall-clock days, not hours.
    - Gate biomes 3 and 4 behind Renown thresholds.
    - Cost Legacy so the first retire buys 2–3 of 9 nodes (R0 backlog).
    - Add long-tail collection goals (relic codex, bestiary, a "floors in FLOW" ledger) and 30–50 Steam achievements.
    - Add a daily dungeon modifier (GDD section 14).
    - Plan one new hero per update (GDD section 4) on a visible roadmap. "Abandoned" is the other classic review in this niche.

### F5 [severity: major] Sound and interruptions at work: music on by default, a tick on every keystroke, stingers, no quick mute, a modal at launch
- Evidence:
  - `state.js:19` defaults are `sound: true, music: true, volume: 0.55`. GDD section 8 says "volume defaults low because people play this at work". 0.55 is not low.
  - `input.js:47` calls `KK.audio.init()` on the first **global** keystroke, so for a returning player the music starts the moment they type anything after logging in.
  - `audio.js:165` plays the `spark` SFX on **every counted keystroke** (rate limit 70 ms, so up to about 14 blips/s).
  - The rat chirp plays every 3–6 min. The boss intro is a 2 s 55 Hz sawtooth drone. Boss kill and FLOW have fanfares.
  - In the desktop build, muting means opening the ⚙ panel. The 🔊 button only exists on the fake browser taskbar (`ui.js:476`), and the tray has no Mute.
  - There is no call or microphone detection.
  - On launch after more than 90 s away, `UI.offline` opens a modal that needs a COLLECT click. `native.js:25` grows the window to about 632 px tall over the user's work (seen in the snapshot: a 3840x948 capture).
  - Recruit toasts (`ui.js:415`) have no `once` guard, so they repeat on every run after each retire.
- Why it matters: expect "It started playing music in the middle of my Zoom call" and "the keyboard blips drive me nuts". Spirit City and Rusty's succeed because they are ambient.
- Proposed fix:
  - **Pre-fest:**
    - Native defaults: music OFF, SFX ON at volume 0.25. Drop the per-keystroke `spark` sound, or play it at most once per second only in FLOW.
    - Add a HUD mute icon (one click) and a tray "Mute".
    - Turn the offline modal into an auto-collect toast ("While you were away: +12.4K gold"). It must never grow the window over the user's work.
    - Guard the recruit toast with `once` per hero across runs.
    - Add a "Calm mode" toggle (no screen flash or shake, quieter stingers) for open-plan offices.
  - **Post-fest:** auto-mute while any app uses the microphone. Poll `HKCU\Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone\*\LastUsedTimeStop == 0`.

### F6 [severity: major] Next Fest dates: Jan 10 is the *registration* deadline, not the demo deadline, and the demo should be built to be left running
- Evidence:
  - Valve's Feb 2027 Next Fest page:
    - **Registration deadline Jan 10, 11:59 pm PST.**
    - **Jan 18:** submit the demo build and store page for review to be live for Press Preview, which starts **Feb 11**.
    - **Feb 1:** all items submitted.
    - Festival **Feb 22 – Mar 1**.
    - The store page must be published and public.
    - A game gets only **one** Next Fest.
    - The Wrap-Up on Mar 1 features **the most-played demos**.
  - The GDD roadmap treats Jan 10 as "demo locked & submitted" and says to "check the deadlines today". The real dates give about 1–3 extra weeks for the demo build, but the public store page cannot slip.
- Why it matters: a desktop strip that runs 8 h/day is unusually well suited to "most played" rankings, and Bongo Cat's CCU is itself its marketing. A demo that hard-stops at floor 30 after about 40 min wastes that edge.
- Proposed fix:
  - **Pre-fest:**
    - Register before Jan 10.
    - Get the "Coming Soon" page public as early as possible: wishlists only accrue while it is live, and Valve has to review the page.
    - Submit demo and page by Jan 18 for Press Preview.
    - Make the demo endless at its content cap (F4).
    - Put Steam rich presence in the demo if possible. "Delving floor 42 · FLOW STATE" in friends lists is free visibility for an always-on app.
  - **After:** run demo-to-full save carry-over (F7) and send the wishlist email at launch.

### F7 [severity: major] No Steam integration and saves live in localStorage: no Cloud, no achievements, no demo carry-over
- Evidence:
  - The README lists Steamworks, packaging and file saves as not done.
  - Saves go to Chromium localStorage (leveldb inside `%APPDATA%`). Steam Auto-Cloud cannot sync that cleanly, and "clear cache" wipes it.
  - The save is written every 10 s (`main.js:41`).
- Market evidence: Bongo Cat's negatives include escalating, unachievable achievements. Rusty's negatives include tedious grind achievements (a 250k-harvest one). Achievements are expected in this niche, and badly tuned ones get reviews.
- Why it matters: missing Cloud and achievements is a common "Not Recommended" footnote. Losing a save is a one-star review.
- Proposed fix:
  - **Pre-fest (half a day):** write the save as JSON to `app.getPath('userData')/save.json` through the preload bridge. Write to a temp file and rename it, and keep 3 rotating backups. Use the same format the full game will read, so the demo save carries over. Advertise "your demo progress carries over".
  - **Post-fest (launch):**
    - `steamworks.js` with Auto-Cloud on that file.
    - About 40 achievements with sane thresholds: no 25-million-keystroke achievements, and no achievement that needs multiple save files.
    - Rich presence.

### F8 [severity: minor] Positioning: the hook is strong but the 1:1 "my keystroke did that" moment is too subtle for a GIF, a direct competitor already owns "tiny heroes at the bottom of your screen", and there is nothing for streamers
- Evidence:
  - Typing visibly matters in the sim. Typist profile: ults 5.6/min and 51% of time in FLOW. Idle profile: ults 0.1/min, but still reaches floor 50 in about 2.5 h, so idle players are not punished. That avoids Desktop Heroes' top complaint ("not idle enough", 7 of 10 visible negatives).
  - The per-keystroke feedback is a faint rising spark and a 0.01-volume blip, while the payoff (an auto-cast ult when the jar is full) is delayed. A viewer watching a 5 s clip of someone typing sees almost no cause and effect.
  - **Desktop Heroes** (Telazer, Oct 2025, $3.99, Electron + Phaser) is an idle RPG of pixel heroes in a strip at the bottom of the screen, rated Mostly Positive (about 69–73%). The capsule must not look like it.
  - Rusty's Twitch integration (viewers spawn on the farm), Pirate Software's stream and TikTok reels drove much of its launch.
- 5-second capsule pitch: **"Type anything. Your keystrokes fire their spells."** Show a split frame: a keyboard or code editor on top, the strip below, and a Meteor landing on the exact keypress that fills the jar.
- Proposed fix:
  - **Pre-fest (about 1 day):**
    - Every counted keystroke launches a visible spark that flies from the bottom edge into the jar or the front hero. In FLOW, every 10th key triggers a mini "keystrike" hit on the front enemy with a number.
    - Shout the ult cast's cause: "YOUR TYPING → METEOR!" for the first few casts.
    - Add a FLOW-today counter on the HUD ("1h12m in FLOW today"). It is the shareable stat the GDD asks about in section 14.
    - Trailer and first GIF as the GDD says, but open on the keyboard, not the dungeon.
  - **Post-fest:**
    - Streamer mode: capture-visible (F2e), a chroma background option, and Twitch chat lines count as Sparks or name the monsters.
    - Shareable end-of-day card: keystrokes, FLOW time, floors and bosses.
    - Pitch to programming and writing streamers, NaNoWriMo and typing-test communities ("my code review killed the Bone King") rather than only cozy-game channels.

## Verified fixes from last round (pass/fail, one line each)
- None. This is round 01 for T3, and no market findings have been fixed yet.

## Ideas (optional, max 3: things that would make it more fun, not just less broken)
1. **"Shift report" at the end of the day.** When the screen locks after 5 pm, or from the tray, show a pixel scroll: "Today you typed 14,203 keys, spent 1h48m in FLOW, slew the Bone King twice and found the Echo Rune." Make it one-click save to PNG or Steam screenshot. It is the viral loop and the "productivity" angle in one asset.
2. **Keystroke-category relics, privacy-safe.** Count only the categories Enter, Backspace, Space and "other", never characters. Examples: "Enter Amulet: every Enter launches an arrow volley" (sending an email fires a volley) and "Backspace Boots: every correction gives +walk speed". This makes the work-to-adventure link concrete. Explain it in the "What we can see" panel (F3e).
3. **Price and positioning.** Keep $4.99 (Desktop Heroes $3.99, Ropuka about $4, Rusty's $7). Add a $3–4 Supporter Pack with the cosmetic Pet Dragon hero from GDD section 4. Rusty's Supporter Pack had about 11% attach (36k units, $111k), a meaningful revenue share for a small game.

## Pre-fest vs post-fest summary
| # | Must do before Press Preview (Jan 18 submit) | After Next Fest |
|---|---|---|
| F1 | 30 fps cap, 10 fps idle, stop on hide/lock, suspend AudioContext, battery cap | Per-frame dirty rendering, opaque strip window |
| F2 | Fullscreen auto-hide, S default + auto-size, display picker, non-focusable, content protection, hide hotkey, skipTaskbar | AppBar reservation, top/side dock, opacity |
| F3 | Local fonts + network block, unified persisted pause + HUD lock icon, code signing, VirusTotal/WDSI, FAQ | Open-source input module, per-app filter, IT note |
| F4 | Endless demo at the content cap | Day-scaled pacing, Legacy costs, codex/achievements, roadmap |
| F5 | Music off / vol 0.25, no per-key blip, HUD/tray mute, offline toast not modal, calm mode | Mic-in-use auto-mute |
| F6 | Register by Jan 10, public page ASAP, submit by Jan 18, rich presence | Wishlist email at launch |
| F7 | File save + backups, carry-over | Steamworks Cloud, achievements |
| F8 | Visible per-key sparks, ult cause banner, FLOW-today stat, keyboard-first trailer | Streamer mode, Twitch chat, share card |

## Measurement notes
- Snapshot runs: `KK_SNAPSHOT=… KK_SNAPSHOT_DELAY=16000 electron .` plus a `KK_SNAPSHOT_JS` probe counting rAF calls over 8 s.
- Result: `fps=160.0 drawMs=0.12 dpr=1.5 inner=2560x192 canvas=4270x320 hidden=false`.
- GPU via `Get-Counter '\GPU Engine(*engtype_3D)\Utilization Percentage'`, summed over the Electron PIDs: 12.8, 12.5, 13.1.
- DWM: 26.8 with the strip running, 13.7 / 12.9 / 5.6 after it quit.
- Caveats: single machine (RTX 3080, 4K at 160 Hz plus a second 1080p display) and the welcome screen only. Re-measure on an integrated-GPU laptop after the fps cap.
- Side note for T4: at 150% DPI, `pxScale = round(3*1.5) = 5`, so the 4270 px backing canvas is downscaled to about 3840 device px. This is a non-integer scale and the pixel art may shimmer.

## Sources
- Rusty's Retirement performance thread (DWM, hi-res): https://steamcommunity.com/app/2666510/discussions/0/4200238454189981549
- Rusty's Retirement negative reviews: https://steamcommunity.com/app/2666510/negativereviews/?browsefilter=toprated&filterLanguage=english
- Rusty's Retirement sales, price, Twitch integration, Supporter Pack (GameDiscoverCo): https://newsletter.gamediscover.co/p/how-rustys-retirement-idle-farmed
- Rusty's Retirement settings (toolbar position/size): https://www.gameskinny.com/tips/how-to-resize-the-toolbar-in-rustys-retirement/ and https://steamcommunity.com/app/2666510/discussions/0/4200238240348048392
- Bongo Cat negative reviews (keylogger claims, resource use): https://steamcommunity.com/app/3419430/negativereviews/?browsefilter=toprated&filterLanguage=english
- Bongo Cat safety guide: https://bongocatdb.vercel.app/guides/is-bongo-cat-safe ; peak CCU: https://tracker.gg/population/steam/3419430 ; PC Gamer coverage: https://www.pcgamer.com/gaming-industry/game-development/top-10-steam-game-bongo-cat-is-actually-losing-us-money-says-dev-which-is-fine-because-its-been-great-for-business-before-we-knocked-on-50-doors-now-they-are-coming-to-us
- Desktop Heroes (competitor): https://store.steampowered.com/app/3734200 ; negative reviews: https://steamcommunity.com/app/3734200/negativereviews/?browsefilter=toprated&filterLanguage=english ; Electron/Phaser write-up: https://www.pulse.bot/gaming/news/desktop-heroes-shipping-an-idle-rpg-on-steam-with-phaser-and-electron-fbf6ea0b-e6e0-49b9-9971-dbc7806ce8eb/
- Ropuka's Idle Island (praised for low resource use): https://www.wasdland.com/game/ropukas-idle-island-3416070 and https://gamesradar.com/games/simulation/this-cozy-farming-sim-is-just-a-sleepy-frog-that-idly-grinds-on-your-desktop-all-day-and-its-the-best-usd4-ive-spent-in-ages
- Desktop-pet trend: https://www.pcgamer.com/games/the-most-surprising-cozy-game-trend-this-year-was-the-desktop-pet-renaissance
- Next Fest Feb 2027 dates: https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- AudioContext blocking sleep: https://www.purebasic.fr/english/viewtopic.php?p=650171 , https://bugzilla.mozilla.org/show_bug.cgi?id=1863193
- Electron backgroundThrottling semantics: https://ayakael.net/mirrors/electron/src/commit/038e261069a5f64baa5bc69ee27f0f59e2ee2ac0/docs/api/browser-window.md
- Electron Defender false positive (Hive.ZY): https://www.windowscentral.com/software-apps/windows-11/windows-defender-is-reporting-a-false-positive-threat-behaviorwin32hivezy-its-nothing-to-be-worried-about
- Steam refund policy (2 h / 14 days): https://mcvuk.com/steam-offers-refunds-for-games-played-under-two-hours/
