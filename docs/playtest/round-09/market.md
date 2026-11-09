# Round 09: T3 "market" (Steam Market & Reviews Analyst)

> The lead read an in-progress draft of this report. Fixes landed as **2c6e43d** and **bc7ef9e** (at 16:11 local) while I was still measuring.
> - **Old code:** every number marked "HEAD e36437d", up to take `g2_v9det2` (21:10 UTC).
> - **New code:** everything marked "new code", measured after the commits on the same safe launcher. It covers 3 more capture takes per shot, the launch-flash test, the census and first-run.
> - **Unclear:** batch-2 frame-locked takes (`*_det*`/`*_detq*`, 21:02–21:10 UTC) may have run on a half-edited working tree. I don't use them as evidence.

## Verdict
On the new code the calm strip finally meets the caps.
- **Big banners:**
  - 1–14 an hour, except typists' first hour, where 20–26 are all first-ever content (R8: 26–190).
  - Banner screen time 1–59 s/h (R8: 60–441).
- **Sound:** loud sounds 11–31/h (R8: 96–129).
- **Visual calm:** no strong flashes, no shake. The FLOW outline is steady in Calm.
- **Launch flash fixed:** the strip no longer appears on the primary monitor first.
- **"★ SEAL OF THE DAY"** now draws correctly.

I'd keep it running tomorrow and wouldn't refund it.

The new **frame-locked capture clock** brings two regressions, and both hit the store-shot plan:
- It runs the game at **~200 fps, 3.3× real time.** A real-typing G2 take is now impossible: shell to crack is 0.4 s.
- Takes are still **not reproducible frame for frame.** In g1, FLOW fires on frame 82 in one take and 89 in another.

The two scripts adopted from my v9 drafts also carry my own bug: `await bossSpawn` right after `wave` always times out.

**Rating: 8.5/10 → 9 once F1–F3 land.**

## Findings (ranked, max 8)

### F1 [severity: major] New code: capture mode now runs at ~200 fps, 3.3× faster than real time
- Evidence:
  - All 15 new-code takes (`out/batch3.log`) report real frame rates of **193–207 fps**. The old code ran 58–61 fps.
  - g5 Warlord → SEALED now takes 10.3 s of wall time, against 33–34 s before.
  - g2 MAGMA SHELL → SHELL CRACKED is **80 frames = 0.4 s real**.
  - MARK timestamps compress by the same factor. Audio, which runs on the real clock, plays 3.3× as many sounds a second.
  - Cause (`js/capture.js` + `js/main.js`):
    - `KK.onFrame()` advances the overridden `performance.now()` by 1/fps *inside* the frame.
    - The loop's pacing, `setTimeout(frame, max(1, 1000/fps - (performance.now() - now)))`, then sees 16.7 ms already "spent" and waits 1 ms.
- Why it matters:
  - The user records with OBS in real time. Every GIF would come out 3.3× fast with crushed audio.
  - G2 ("type when the plate shows") and the trailer's real-typing beats can't be performed.
- Fix (10 min):
  - In capture.js, keep the real clock: `const realNow = performance.now.bind(performance); KK.realNow = realNow;` before overriding.
  - In main.js, pace on it: `const t0 = KK.realNow ? KK.realNow() : now; …; setTimeout(frame, Math.max(1, 1000/fps - ((KK.realNow ? KK.realNow() : performance.now()) - t0)))`.
  - Gate: 59–61 fps real, with `fpsReal` checked by `run_shot.js`.

### F2 [severity: major] New code: takes are still not reproducible frame for frame. Key beats repeat in g2/g5/s3, but not in g1
- Evidence: `compare.js` over 3 new-code takes per shot.
  - State digest: floor, wave, partyX, enemy HP, gold, sparks and fervor, every 60 frames.
  - Canvas hash: every 120 frames.

  | Shot (new code, adopted script) | Key events in all 3 | Max spread | State digests equal | Pixels equal |
  |---|---|---|---|---|
  | g1 FLOW → Meteor | 13 | 258 frames (FLOW on frame 82 / 89 / …) | **0/30** | 0/5 |
  | s3 relic pick | 6 | 8 frames; **same cards** (spacebar, coffee, keycap) and pick on the same frame in 3/3 | 1/31 | 0/5 |
  | g2 Ember shell (adopted) | 18 | 495 frames | 3/51 | 0/8 |
  | g2 fixed (`g2_v9b`, F3) | 13 | BOSS 7 f, SHELL 147–148 f, CRACK 226–229 f | 3/38 | 0/6 |
  | g5 demo glimpse | 25 | key beats identical (bossSpawn 7, kill 1593, glimpse 1731, door 2030); others ≤188 f | 3/57 | 0/9 |

- Old code, plain wall clock (for reference): spreads of 1.6–4.6 s, digests 0/N, and the S3 cards changed between takes.
- Old code + my frame-locked **timers** prototype (`safe/pre.js --det`), batch 1, clean: **s3 3/3 identical** (digests 10/10, pixels 5/5), **g5 3/3 identical** (62/62), g2 2/2 identical with the same input setting.
- **Why the new code still drifts:** only cues, `await` and autotype moved to frames. Game code still schedules on the real clock, and those callbacks consume the shared `Math.random` stream or change the sim at a real-time-dependent frame:
  - `ui.js` relic toast at 1400 ms. Its frame varies 271/278/276 between takes.
  - `audio.js` 'offer' at 1200 ms, plus SFX `U.rand`/`U.pick`, gated on the real AudioContext state.
  - `fx.js` recruit burst at 50 ms.
  - The seal banner retry at 1500 ms.
  - `whenBooted` polling.
  - Render motes and particle trails also draw from the same stream.
- Fix (30–60 min, capture-only):
  - (a) In capture mode, reroute `window.setTimeout`/`clearTimeout` to `KK.later`, except the frame loop itself (`fn.name === 'frame'`). My prototype does exactly this.
  - (b) Give cosmetic randomness its own seeded stream: `U.vrand` for render, FX and audio.
  - Gate: 3 takes, equal digests.

### F3 [severity: major] The adopted g2/g5 scripts (my v9 drafts) wait 20 s for a boss that has already spawned. Their "BOSS IN" and "SHELL" marks land on the wrong beats
- Evidence:
  - The `wave` cue spawns the boss within the same op, so `bossSpawn` fires *before* the next cue's `await` registers.
  - Every new-code g2/g5 take logs `await bossSpawn TIMED OUT`. "BOSS IN"/"WARLORD IN" lands at frame 1207 instead of 7.
  - In g2 the script then waits for the *third* MAGMA SHELL (frame 1650). The first shell (frame 147) and the first crack go by with no mark.
  - `shots/g2_v9b.json` drops that await and marks BOSS IN after `wave`. 3/3 takes then show BOSS 7 f, SHELL 147–148 f and CRACK 226–229 f.
  - g2's "END" (+12 s after CRACK, frame ~949) also comes before VICTORY (frame 1650–2378), but the `_cut` says to cut on VICTORY.
- Fix (10 min):
  - Remove `{await bossSpawn}` after `wave` in `g2_ember_shell.json` and `g5_demo_glimpse.json`, as in `g2_v9b.json`.
  - Make `await` resolve if the event fired in the current frame. Keep `lastFired[ev] = frameNo` in `KK.emit`.
  - Add a `bossDefeated` event, so G2 can `await` VICTORY instead of guessing +12 s.

### F4 [severity: minor] Noise caps (new code): banners, sound, flashes and the FLOW glow PASS. Alerts and hour-1 toasts are still 1–3 over
- Evidence: `census9.js` on the new code, seeds 1 and 6 (table at the end).
- **Alerts:** demo typist h2 is **21/h** (cap 20): WEB 6, SUMMONS 5, REASSEMBLES 5, WAR CHARGE 5. That's each demo boss at the 10-min ceiling. The 15-min move gate (P9, prototyped on old code: 22 → 15) fixes it.
- **Hour-1 non-tutorial toasts:** 12–13 (cap 10): achievements 5, relic 4, recruit hints 3. Recruit hints are one per hero ever, so count them as tutorial (→ 9–10). Or let the relic toast fire only for the first 2 offers of a save, since the Relics badge carries the rest.
- **Big banners in typists' hour 1:** 20–26. Every one is first-ever (6 first VICTORYs, 5 boss names, 4 biomes, 3 JOINS, LV 10/20, FLOW, first RETREAT, first Seal). Re-define the cap as "≤20/h excluding first-ever", which passes everywhere. I wouldn't cut more.

### F5 [severity: minor] Accessibility: the default strip size is too small on big monitors, and HUD fonts don't scale with S/M/L
- Evidence:
  - `size: auto` → **S (128 px)** on a 1920×1080 monitor. A hero is about 20 px tall on a 1920 px strip (`out/selftest/firstrun_new_13.5s.png`).
  - HUD fonts stay at 9–17 px at every size. Labels such as biome, fervor and embers are 11 px.
  - **Contrast now PASSES in practice:**
    - The new plate behind the floor line and the brighter `#c9b8ea` biome label give a median of 8.5–9.5:1. Over lava (bright 10%) it's 2.2 → 4.6 at S.
    - Gold, sparks, embers and fervor sit on their own dark boxes.
    - My canvas-sampling metric overstates the problem for boxed elements, so I withdraw that half of the old-code F7.
- Fix (30 min): `auto` → M on ≥1440p workAreas, and scale HUD fonts with size (S ×1, M ×1.15, L ×1.3).

### F6 [severity: minor] Trust leftovers for Next Fest (packaged build)
Detail is in the checklist below. The three that still need code:
1. **Chromium data next to the saves.** `%APPDATA%\Keystroke Keep` holds about 8 MB of cache folders (Cache, Code Cache, GPUCache, Dawn*, blob_storage, DIPS…) beside `saves/`, and they survive a Steam uninstall. Fix: `app.setPath('sessionData', <LOCALAPPDATA>\Keystroke Keep)` so Roaming (and Steam Auto-Cloud) holds only `saves/`. Add an FAQ line about saves left after uninstall.
2. **No version in-game.** Add "v0.1.0" in Settings for bug reports and patch notes.
3. **No "Start with Windows" toggle** (post-fest): `app.setLoginItemSettings`, off by default.

### F7 [severity: minor] Localisation readiness: about 400 hard-coded English strings, plus a 3×5 canvas font with A–Z only
- Evidence (`l10n_count.js`, rough and overlapping):
  - About 190 player-visible JS literals: ui 54, data 54, fx 35, achievements 29, world 8, state 6, render 5, main 4.
  - 196 `name`/`desc`-style fields in `data.js` (118) and `achievements.js` (78).
  - 48 HTML text nodes, mostly the browser fake desktop.
  - Canvas banners, alerts and boss names use `font.js`: A–Z, 0–9, about 16 symbols and now ★. No accents, Cyrillic or CJK.
  - The DOM fonts ship latin-only woff2 subsets.
- Recommendation:
  - Fest and launch: English-only. Only tick English on Steam.
  - Post-launch: a `KK.T(key)` string table, plus a fallback that draws canvas text with the DOM pixel font for non-ASCII languages.

### F8 [severity: blocker, owner: user] To-do list update (plain words, sources at the end)
1. **A public trailer and the Coming Soon page by about Dec 1–3,** if you want Desktop Companion Fest (Jan 14–18) featuring.
   - Steam invites games to themed fests automatically, based on the tags on the store page.
   - Registration usually opens "six weeks or more" ahead. The marketing opt-in is "typically 6 weeks prior to event start", so about Dec 3.
   - Marketing consideration needs "at least one publicly visible trailer on your store page".
   - A 30–45 s cut of the FLOW, boss-shell and sealed-colossus shots is enough. Record them after F1 is fixed, or they'll be 3× fast.
   - Registration link: https://partner.steamgames.com/optin/sale/desktop_companion_2027. The DCF info page still shows an error.
2. **Next Fest (Feb 2027) dates:**
   - **Jan 10, 11:59 pm PST:** register.
   - **Jan 18:** Steam takes trailers for the official Next Fest trailer. Keep your newest trailer on the main store page from then on. Jan 18 is also the target for submitting the demo and page for review if you want press preview.
   - **Feb 1:** everything submitted.
   - **Feb 11, 10 am PST:** press preview starts. Feb 11 is also the last day to withdraw trailer permission.
   - **Feb 22, 10 am PST:** Next Fest starts. The demo must be live, or opted out, before then.
   - **Mar 1, 10 am PST:** Next Fest ends.
   - **A game gets only one Next Fest, ever.**
   - The page says the game must release after Mar 1, 2027, but also that release date doesn't matter. Ask Steamworks support if you might launch before March.
3. **Code signing:**
   - Azure Artifact Signing gives a certificate to *individual* developers only in the **USA or Canada**. Organisations qualify in the US, Canada, EU and UK, and some need about 3 years of tax history.
   - Otherwise buy an OV certificate (about $300–500 a year).
   - The packaged exe is still `NotSigned`.
4. **Still open from R8:**
   - Steamworks sign-up and the $100 App ID fee now.
   - Send the lead the App ID and store URL. `KK.STORE_URL` is still empty, so the Wishlist chip shows a placeholder.
   - Dec 8: optional Q&A.
5. **Optional cleanup:**
   - 15 tester profile folders sit in `%APPDATA%` (`kk-market-probe*`, `kk-market-r9-capture`/`-selftest`, `kk-displays`, `kk-fs-helper`, `Keystroke Keep-capture`/`-selftest*`), about 8 MB each. Delete them whenever you like; I didn't, because deleting needs your OK.
   - Your real save is untouched (md5 `d680a06b…b533`, same as R8).

## Verified fixes from last round and this round's fixes (pass/fail, one line each)
- **No launch flash (2c6e43d):** PASS.
  - With the saved display = right monitor, the game's own docking sets bounds to that monitor at 0.33 s and shows there at 0.39 s.
  - The old code showed on the primary at 0.31 s first (my guard refused it).
- **`KK_CAPTURE_DISPLAY=secondary`:** PASS. With no displayId in the save, the strip showed on the left 1080p monitor (x −1920), never the primary. Note that "secondary" picks the *first* non-primary monitor, which may be the one you work on, so name an id in the docs.
- **★ glyph and missing-glyph warning:** PASS by code (`font.js:32–35`). The new census has a "★ SEAL OF THE DAY" banner.
- **Calm: FLOW hero outline steady:** PASS by code (`render.js:468`). The vignette is steady too.
- **Banners big only on first sight (boss, biome, JOINS) and LV only on a new best:** PASS.

  | Run | Big banners/h (R8 → old code → new) |
  |---|---|
  | demo idle h2 | 91 → 25 → **7** |
  | demo typist h2 | 190 → 9 → **1** |
  | full typist h7–8 | 66 → 28 → **2** |
  | full idle h7–8 | 26 → 13 → **2** |

- **HUD plate, biome colour, embers shadow:** PASS. Biome label median contrast 6.0 → 8.5–9.5:1.
- **Welcome card adds tray, hotkey and "never goes online":** PASS. Fresh profile text: "It lives in your tray (the crown icon). Hide it any time with Ctrl+Shift+Alt+K. It never goes online."
- **Frame-locked capture clock:** FAIL as built. 3.3× speed (F1), and not frame-identical (F2).
- **`KK.on` unsubscribe:** PASS.
- **Timed-out `await` prints a MARK:** PASS. That's how F3 showed up.
- **Retail builds ignore `KK_*` without `--kk-dev`:** PASS by code (`electron/main.js:11`). Not run: a packaged exe would need a display override to stay off the primary.
- **R8 `js` cue via the shell:** PASS (cue test, new code): `KK.fx.banner('JS CUE OK')` drew.
- **R8 `flow` cue emits:** PASS: `fervorTier 0->3` and the FLOW STATE banner.
- **R8 `juice` sets both flags:** PASS: `companion` gives calm=true/combat=false, and `full` gives false/true.
- **R8 `wave` cue:** PASS. It jumps to the floor-30 boss in the same frame.
- **R8 no welcome-back toast in capture:** PASS. A staged save with `lastSave` 1 h ago (`s4_old1`) produced no toast, no modal and no offline gold (gold unchanged at boot).
- **R8 ult booms quiet when combat sounds are off:** PASS. Loud SFX 96–129 → 11–31/h. The quiet boom plays up to about 190/h at 0.05 gain.
- **R8 boss/zone/milestone sound rationing:** PASS. SFX 83–404/h.
- **R8 move-alert AND gate and 2 Hz blink:** PASS by code. Demo typist h2 is 21–22 alerts/h, 1–2 over (F4).
- **R8 achievement toasts at most every 10 min:** PASS. Hour-1 non-tutorial toasts are 9–13 (F4).

## Ideas (optional, max 3)
1. **"Polite by default" as a store bullet, with real numbers.** "Calm out of the box: no flashes or shake, about one soft sound every 10 s while you type, call-safe booms, a big banner only for something new." Every clause is now measured.
2. **Ship the deterministic capture as a press kit.** Once F1 and F2 land, the 5 cue scripts plus the safe launcher idea (secondary monitor only, no hook) let a streamer or curator reproduce the FLOW → Meteor beat on their own PC.
3. **Make the sealed Colossus clickable** for the Wishlist (carried over), once `KK.STORE_URL` exists.

## Noise census vs the caps (new code; desktop defaults: calm ON, combat sounds OFF; average of seeds 1 and 6)

| Build / profile / hour | Alerts | Big banners | Toasts (non-tutorial) | Strong flash | Shakes | SFX | Loud SFX | Seconds with sound | Gold pulses | Big banner on screen (s/h) | Alert plate (s/h) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| demo idle h1 | 5 | 14 | 12 (9) | 0 | 0 | 83 | 11 | 75 | 537 | 30 | 6 |
| demo idle h2 | 16 | 7 | 8 (8) | 0 | 0 | 185 | 31 | 176 | 645 | 16 | 22 |
| demo typist h1 | 16 | 20 | 17 (12) | 0 | 0 | 379 | 22 | 360 | 821 | 44 | 22 |
| demo typist h2 | **21** | 1 | 4 (4) | 0 | 0 | 404 | 22 | 375 | 1,166 | 1 | 25 |
| full idle h1 | 5 | 14 | 12 (9) | 0 | 0 | 83 | 11 | 75 | 537 | 30 | 6 |
| full idle h7–8 | 8 | 2 | 3 (3) | 0 | 0 | 99 | 23 | 93 | 229 | 3 | 11 |
| full typist h1 | 15 | 26 (all first-ever) | 18 (**13**) | 0 | 0 | 331 | 20 | 317 | 668 | 59 | 18 |
| full typist h7–8 | 9 | 2 | 4 (4) | 0 | 0 | 287 | 21 | 276 | 563 | 3 | 13 |
| **Cap** | ≤20 | ≤20 (excl. first-ever) | ≤10 h1, ≤6 after | ≤12 | ≤30 | ≤900 | ≤40 | ≤540 | ≤1,800 | | |
| **Result** | FAIL by 1 | **PASS** | FAIL by 2–3 in h1 | PASS | PASS | PASS | **PASS** | PASS | PASS | | |

- **FLOW glow in calm:** steady (PASS). Typists spend 1,620–2,302 s/h in FLOW; it was pulsing until 2c6e43d.
- **Old code (HEAD e36437d) for comparison:**
  - Big banners 9–46, typist late game 28.
  - Alerts 5–22.
  - Hero outline pulsing 1,576–2,444 s/h.
  - Other columns within ±10%.
- **P9 prototype** (old code, `--proto9`): late-game big banners 28 → 4, demo alerts 22 → 15. The banner half is now shipped.
- **Next offenders, in order:**
  1. Demo boss move alerts (F4).
  2. The hour-1 relic and recruit toasts (F4).
  3. Quiet "softBoom" ult variant: up to about 190/h, 0.05 gain. Harmless, but it's the most frequent sound left.
  4. Faint 0.06 one-frame flashes: 44–372/h. Keep them.

## Capture shots: what I ran and what to fix (priority 2)
**Safe launcher** (`docs/playtest/round-09/market_probe/safe/`, `safe2/`):
- The game's own `electron/main.js` runs behind a proxy of the `electron` module.
- The window is created and shown only on a non-primary display (the right-hand 1080p, id 2904106817), and re-checked every 250 ms. Any bounds touching the primary are refused and the run aborts.
- `uiohook-napi` is a dummy, so nothing reads or injects input.
- The tray is fake: the tooltip and menu are recorded, no icon or balloons appear.
- `globalShortcut` calls are recorded, never registered.
- Audio is muted at the Chromium level, so sounds still consume RNG as in a real take.
- Own profiles: `%APPDATA%\kk-market-r9-capture` / `-selftest`.
- A probe at document start logs events, digests and pixel hashes relative to the first cue.
- `run_shot.js` and `run_selftest.js` syntax-check the launcher before every start.

**Takes:**
- 30 old-code takes (batch 1).
- 24 in batch 2. The g1/s3 and v9 takes before 21:10 UTC are old code; `g5_v9wall2` and later are new code. The `--det`/`--detq` frame-locked takes are mixed (see the note at the top).
- 15 new-code takes (batch 3).
- 1 cue test.
- 6 self-tests: first-run old and new, launch test old and new, `KK_CAPTURE_DISPLAY` with and without capture.

| Shot | Old code (wall clock) | New code (frame-locked) | Fix-ups needed |
|---|---|---|---|
| g1 FLOW → Meteor | Meteor 6.2 / 9.0 / 6.5 s; 0/12 digests | FLOW frame 82 vs 89; 0/30 digests; 3.3× fast | F1 + F2 (timers on frames, cosmetic RNG) |
| g2 Ember shell | spawn ±1.65 s, shell ±1.9 s | adopted script: `await bossSpawn` times out; first shell (147 f) unmarked; "SHELL" lands on the 3rd shell (1650 f). Fixed script `g2_v9b`: BOSS 7, SHELL 147–148, CRACK 226–229 f in 3/3 | F3 (drop the await; add `bossDefeated`); F1 (0.4 s real from shell to crack) |
| s3 relic pick | **different cards between takes** | **same cards, same pick frame, 3/3** (later drift only) | none for the still. F2 for a pixel-identical GIF |
| s4 omen picker | cards from the save, stable | stable | none |
| g5 demo glimpse | ±4.2 s | key beats identical in frames, 3/3; "WARLORD IN" mark at the 20 s timeout | F3; F1 |

**Fully reproducible frame for frame on the new code: none yet.**
- Reproducible for the beats that matter: s3 and s4 (stills), g5 (beats), and g2 with the `g2_v9b` script.
- On old code with my timer prototype: s3 and g5 were fully identical, 3/3.

## Trust & polish checklist (packaged build, priority 3)
`npm run dist` → `dist/full/win-unpacked`:
- 311 MB, `app.asar` 704 KB + 1.3 MB natives.
- Fuses applied. Exe metadata 0.1.0, "Copyright © 2026 Keystroke Keep". **NotSigned.**

It was built at HEAD e36437d, before 2c6e43d, so rebuild before the fest. I didn't run the packaged exe on screen: with no display override it would dock on the primary. The checks below use the same app code in self-test mode on the side monitor, plus file inspection.

| Item | Status (new code) | Next Fest priority | Fix |
|---|---|---|---|
| Unsigned exe + global input hook | FAIL until the certificate arrives | **P0 (user)** | Certificate → `win.azureSignOptions`; VirusTotal and Microsoft false-positive submission of the signed build |
| `KK.STORE_URL` empty: the Wishlist chip shows "The Steam page link goes here" | FAIL | **P0** (needs the App ID) | Set it the day the page exists |
| Capture at 3.3× speed (F1) and not frame-identical (F2/F3) | FAIL | **P0 before recording the trailer (~Dec 1)** | F1–F3 |
| Strip on the wrong monitor at launch | PASS (fixed) | | |
| "? SEAL OF THE DAY" | PASS (fixed) | | |
| First run: welcome card | PASS | | Covers privacy ("only counts… never records"), tray, hide hotkey, "never goes online" and one START button. Calm ON, combat sounds OFF, volume 0.2, music off, 24 fps by default. |
| Tray | PASS | | Tooltip "Keystroke Keep: counting keystrokes (nothing typed is stored)", or "…input counting PAUSED". Menu: Hide (hotkey), Count, Sound, Always on top, Hide during fullscreen, Display, Quit. "Open dev tools" is dev-only. |
| Strip size and HUD font scale (F5) | partial | P1 | `auto` → M on ≥1440p; scale HUD fonts |
| Uninstall: no installer (Steam handles the folder); no registry, autostart or services | PASS | | |
| Uninstall: Chromium cache next to the saves in Roaming (F6) | gap | P2 | `sessionData` → LOCALAPPDATA; FAQ line; "Delete my data" button |
| Retail ignores `KK_*` flags without `--kk-dev` | PASS (code) | | |
| In-game version | missing | P2 | Settings footer |
| Credits / licences | OFL fonts, uiohook/koffi MIT in the asar, Electron/Chromium licences in the folder | P2 | One Credits line |
| Localisation (F7) | English-only | post-launch | String table + canvas font plan |

**What a reviewer would screenshot as a negative now, ranked:**
1. SmartScreen "Windows protected your PC" (unsigned).
2. The Wishlist chip's placeholder toast.
3. Tiny heroes at auto-S on 1440p/4K.
4. A sped-up trailer GIF, if it's recorded before F1 lands.

## Measurement notes
- **Scripts** (`docs/playtest/round-09/market_probe/`):
  - Census: `census9.js` (`--proto9`), `table9.js <''|new|proto>`, `breakdown9.js`, `breakdown9new.js`.
  - Capture: `safe/`, `safe2/`, `run_shot.js`, `run_selftest.js`, `compare.js`, `batch.sh`, `batch2.sh`, `batch3.sh`.
  - Accessibility and localisation: `a11y_eval.js`, `l10n_count.js`.
  - Scripts in `shots/`: `g2_v9.json`, `g5_v9.json` (adopted), `g2_v9b.json` (fixed), `cuetest.json`.
  - Outputs in `out/`: `shots/`, `selftest/`, `c9_*`, `c9_new*`, `compare.txt`.
- **Limits:**
  - The census uses sim profiles, not humans.
  - The contrast sampler reads canvas pixels, so it overstates the problem for HUD elements with their own boxes.
  - 3 takes per shot, on one PC.
- **Desktop safety (please relay):**
  - Every game window was created and shown only on a side monitor (right-hand 1080p; the left one once, via `KK_CAPTURE_DISPLAY`).
  - The guard refused a primary-display show twice. Both were the old-code launch-flash test, working as intended.
  - No input was injected, no input hook ran, no global hotkeys were registered, and the tray stayed hidden. Audio was muted.
  - **Two incidents before the guards were complete, both my fault:**
    1. About 20:42 UTC: a debugging command started the bare Electron binary with a bad argument (`electron.exe -e 1`) outside the launcher. Electron's default window or an "app not found" dialog may have shown on the primary display for up to about 60 s, until I stopped the task. I couldn't see the screen to confirm.
    2. About 20:44–20:45 UTC: a syntax error in my launcher likely showed Electron's "A JavaScript error occurred in the main process" dialog on the primary display for about 46 s, until the runner's timeout closed it.
  - Since then: syntax pre-checks before every start, and errors are trapped instead of shown as dialogs.
  - An attempt to stop stray `electron.exe` processes by name was (rightly) refused. Nothing was left running.
  - The real save is unchanged: `%APPDATA%\Keystroke Keep\saves\keystroke-keep.json`, md5 `d680a06b343db55e16cf6d3b88b4b533`, 981 bytes, modified 10:46. The demo save folder was untouched.

## Sources
- Steamworks Next Fest Feb 2027 (Dec 8 Q&A, Jan 10 registration, Jan 18 trailer pull and review target, Feb 1 required items, Feb 11 press preview and trailer opt-out, Feb 22 / Mar 1 10 am PST, one Fest per game, public store page, release-date wording): https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- Steamworks upcoming events (DCF Jan 14–18 and registration link): https://partner.steamgames.com/doc/marketing/upcoming_events
- Steamworks themed sales (auto-invite by tags, "six weeks or more" to register, marketing opt-in "typically 6 weeks prior", a publicly visible trailer required for marketing, unreleased games welcome): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales
- DCF 2027 page (still errors): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/desktop_companion_2027
- Azure Artifact Signing eligibility: https://learn.microsoft.com/azure/artifact-signing/quickstart
  - Community report: https://learn.microsoft.com/en-us/answers/questions/5810735/cant-create-a-new-trusted-signing-individual-ident
  - OV cost estimate: https://learn.microsoft.com/en-sg/windows/msix/package/signing-package-overview
