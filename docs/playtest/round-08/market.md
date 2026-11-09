# Round 08: T3 "market" (Steam Market & Reviews Analyst)

## Verdict
The calm-strip work landed where it matters most, which is sound. On desktop defaults (calm on, combat sounds off), the strip now starts a sound in **2–13% of seconds**, down from 94–98%. That's **92–562 SFX an hour**, down from 17.6k–36.5k. Strong flashes and shakes are at **0**. Toasts in the late game are down to 5/h.

What still breaks my caps:
- **Banners:** 26–190 big banners an hour, against a cap of 20.
- **Loud sounds for typists:** 96–129 an hour, against a cap of 40.
- **Toasts in hour 1:** 20–24, against a cap of 10.

I'd keep it running tomorrow with sound on, and I wouldn't refund it.

Capture mode works end to end: own profile, 58–61 fps, seeded, MARK output, flags, hotkeys, chroma background. But three gaps stop the two best GIFs from being scripted reliably:
- The `js` cue is dead under the page CSP.
- The `flow` cue skips the FLOW STATE banner.
- Cues can't wait for an in-game event.

Glimpse of the Depths is a good idea and the right demo ending, but as committed it isn't a GIF moment yet (F3).

**Rating: 8.5/10** (R7: 8).

All numbers below were measured on HEAD 592ac10 before the lead's uncommitted R8 edits. The exception is the Glimpse, which I re-tested on the working tree as it stood at about 15:15.

## Findings (ranked, max 8)

### F1 [severity: major] Banners are still 26–190 big banners an hour (cap ≤20); every boss costs three, and the demo replays them every lap
**Evidence:**
- `node docs/playtest/round-08/market_probe/census8.js` is the R7 census updated for the current `A.play` and `ui.js` rules. It runs the real `fx.js` and `audio.js` on sim time, with desktop defaults forced (calm on, combatSfx off).
  - Full game: 8 h idle and typist, seeds 1 and 6.
  - Demo: 2 h.
  - Table: `table8.js`. Breakdown: `breakdown8.js`.
- **Big banners per hour:**

  | Run | Big banners/h | On screen |
  |---|---|---|
  | Demo idle, hour 1 / hour 2 | 43 / 91 | |
  | Demo typist, hour 1 / hour 2 | 108 / **190** | 250 / **441 s/h** (12% of the time) |
  | Full idle, hour 1 / hours 7–8 | 43 / 26 | |
  | Full typist, hour 1 / hours 7–8 | 85 / 66 | |

  R7 measured 273/h for demo typist hour 2 and 71/h for full typist hours 7–8.
- Excluding floor and biome banners it's still **18–138/h**.
- **Per boss** there are 3 big banners: "FLOOR N / A POWERFUL FOE AWAITS", then the boss name, then "VICTORY!". Typists kill 12–42 bosses an hour.
- **Demo typist hour 2** (`breakdown8.js demo typist 1`):
  - FLOOR # 42, VICTORY 42.
  - Each boss name about 11.
  - Each "X JOINS!" about 11.
  - MOSSY CAVERNS 11.
  - Hero level milestones 12.
- **Prototype** (`--proto`, monkeypatched; no game file touched): repeat big banners with the same text and subtitle within 20 min, and level milestones a hero already reached earlier in the save, drop to the minor style.

  | Run | HEAD | Prototype |
  |---|---|---|
  | Demo typist, hour 2 | 190/h | **58/h** |
  | Full typist, hours 7–8 | 66/h | 53/h |
  | Demo idle, hour 2 | 91/h | 45/h |

  The rest is mostly the boss triple.

**Why it matters:** the banner is the strip's biggest interruption: a full-width title over the party, 2–3 s, 100–440 s an hour. "It keeps flashing big text at me" is the polite-companion review we fixed for flashes and sounds, still open for banners. Fest players run the demo loop, which is the worst case.

**Proposed fix (about 1 h):**
- **One big banner per boss.** Merge "FLOOR 50 / A POWERFUL FOE AWAITS" into the boss banner ("EMBER COLOSSUS / FLOOR 50 BOSS"). VICTORY becomes the minor style unless it's the first kill of that boss in the save. Estimate: −2 big banners per boss, about −24 to −80/h.
- **De-duplicate:** a big banner with the same text and subtitle within 20 min goes minor. That covers JOINS!, boss names, MOSSY CAVERNS on demo laps, and level milestones already reached in an earlier run (track the best milestone per hero in the save).
- **Gate:** after both, about 10–25 big banners/h for typists and under 15 for idle. Re-run census8.

### F2 [severity: major] Capture mode: the `js` cue is dead (CSP), the `flow` cue skips the FLOW event, and cues can't wait for a game event, so the boss and Glimpse shots can't be scripted reliably
**Evidence** (dev shell, own `%APPDATA%\Keystroke Keep-capture` profile, driven over CDP by `market_probe/cdp_run.js`; strip docked on a 1080p monitor; screenshots via `Page.captureScreenshot`, strip only):

What passes:
- The ready line prints seed, size, juice and cue count.
- **58–61 fps**, counted on `KK.render.draw`.
- MARK lines carry ISO timestamps.
- `KK_CAPTURE_BG=#00ff00` paints the window green.
- `KK_CAPTURE_JUICE=companion` sets calm on and combatSfx off.
- `KK_CAPTURE_AUDIO=off` sets volume 0 and the AudioContext is suspended.
- `KK_CAPTURE_SIZE=M` gives scale 3. `KK_CAPTURE_FPS=30` gives 30 fps.
- The `size`, `rat`, `toast`, `openPanel`, `relicOffer` and `pickRelic` cues all work.
- Hotkeys 0, 3, 8, 9 and K are registered (`globalShortcut.isRegistered`).
- Hotkey path 8 (sent from main as `kk:capture`): fps 60 → 0 (frozen) → 60.
- The real save's md5 is unchanged (`d680a06b…b533`).

What fails or is missing:
1. **The `js` cue throws** `EvalError … 'unsafe-eval' is not an allowed source of script` (`capture.js:61`; the CSP is in `index.html`). Every `js` cue fails, including G3's `setFsHide`.
   - **Fix:** route it to main. In preload: `exec: (c) => ipcRenderer.send('kk:exec', c)`. In main, only when CAPTURE: `win.webContents.executeJavaScript(c)`. executeJavaScript isn't subject to the page CSP.
2. **The `flow` cue sets `S.fervor = 100`**, but `KK.fervorTier()` advances `curTier` silently on the next render (`state.js:110`). So the FLOW STATE banner, flash and chord never fire.
   - Probe: tier 0 → 3 with no `fervorTier` event. The dry run says the same.
   - **Fix:** `const b = KK.fervorTier(); S.fervor = 100; const a = KK.fervorTier(); if (a !== b) KK.emit('fervorTier', { from: b, to: a });`.
   - My cue works around it: a staged fervor of 80 plus autotype gives the real FLOW event about 1 s in.
3. **Cues run on wall-clock time only.** Same seed, same save: the Ember Colossus spawned **8.0 / 9.1 / 13.7 s** into three takes, because frame-timing jitter changes the order of RNG calls.
   - **Fix:**
     - `{ "do": "await", "v": "bossSpawn" }` pauses the cue clock until that event fires.
     - Or `"after": "magmaShell"` on a cue makes its `t` relative to that event.
     - Plus a `wave` op (`W.wave = W.waves - 1`), so a boss floor starts at the boss.
4. **Staged saves pop "Welcome back! While you were away (3m 20s)…"** with offline gold. `awayCheck` runs in boot, before capture.js swaps `UI.toast`. Seen in the green shot; the R7 report flagged it as "breaks the toasts-off promise".
   - **Fix:** skip `awayCheck` when `kkNative.capture`.
   - Workaround in my saves: `lastSave` = 2100-01-01.
5. **The `retire` cue bypasses the UI**: no "A NEW GENERATION RISES" banner and no omen picker. So S4 and S5 can't be cued.
   - **Fix:** share the confirm handler.
   - Workaround: a save with a pending `omenOffer`; the game opens the picker by itself 1.5 s after boot.
6. **The `juice` cue only sets `calm`.** The env flag also sets `combatSfx`. Fix: do the same in the cue.
7. **make-save gives levels only.** A floor-49 party (84/73/47/62) did **0 progress in 200 s** against floor-50 imps (3.3M HP). I added `sim-save.js`: real sim state up to a floor, with forge, legacy and relics. Adopt it into tools/capture.
8. **Small gaps:**
   - Replay (hotkey 0) doesn't reload the staged save.
   - There's no `KK_CAPTURE_DISPLAY`. Workaround: `settings.displayId` in the save, which `stage.js --display` sets.
   - Demo and full capture share one capture profile.
   - The demo's 40-min peek card isn't suppressed. Workaround: `demoPeek: true` in the save.

**Why it matters:** the two GIFs that sell the hook most are typing → FLOW and typing cracks the boss's shell. Right now they need hand timing, and the user will record alone, close to the deadline.

**Deliverable:** 5 ready cue scripts plus staged saves in `docs/playtest/round-08/capture_cues/` (list below). All 5 were run in the real shell. G1, S3 and S4 are fully scripted. G2 and G5 are scripted up to the event, and the cut notes say which banner to cut on.

### F3 [severity: major] "Glimpse of the Depths" is the right demo ending but not yet a GIF: the colossus is hero-sized, the party walks through it, and the card opens over the wrong biome
**Evidence:**
- **HEAD 592ac10** (`glimpse_trace.js`, headless typist):
  - The statue spawns at the *start* of floor 41 (+230 px).
  - The first wave fights on top of it from 3 to 12 s. The party walks past it at 9 s. It's off-screen by about 16 s at size L.
  - Then 18 s of generic combat, a snap back to Mossy floor 37, and the card 2.5 s later.
- **Working tree at about 15:15** (the lead's uncommitted edit: statue at door+30, 3 s hold, a "SEALED: THE EMBER COLOSSUS WAITS IN THE FULL GAME" plate on `glimpseDoor`).
  - Real shell, demo, `g5_demo_glimpse.json`, shots `market_probe/out/g5_*.png`:
    - The Glimpse floor lasts **15.6 s**. The SEALED plate shows for 3.2 s.
    - `walkParty` still runs during the hold. Statue minus party in headless: +43 → −5 → −101 px over the hold. In `g5_43.png` the knight stands inside the statue.
    - The statue is drawn 1:1 (32 px, hero-sized) in a low-contrast stone tint over orange brick.
    - After the plate, the strip snaps to the green floor 37, so the DEMO COMPLETE card (`g5_49.png`) frames the Mossy Caverns, not the tease.
  - The **MAGMA DEPTHS / FLOOR 41** reveal (`g5_31.png`, red brick after two green and purple biomes) is the best 3-second still in the demo.
- **Reach time** (census8, demo): typists 30–35 min. Idle 73–77 min, with the 40-min peek card in HEAD; the working tree only peeks below floor 36.

**Store and trailer call:**
- **Main trailer: no.** Use G2 instead (the real Ember Colossus, MAGMA SHELL, typing cracks it). It shows the same boss and proves "your typing matters", which a statue can't.
- **Demo page and Fest event posts: yes**, as a 4–6 s GIF ("the depths are sealed… for now") and as the closing beat of a 15 s DCF/Next Fest clip, after these four fixes:
  1. During the hold, stop the party 24–40 px before the statue (no `walkParty` while `S.glimpse && W.partyX >= W.sealedX - 40`), facing it.
  2. Draw the statue at 1.5x (48 px of the 64 px strip) with a 1-px dark outline and pulsing ember cracks. It should read as a colossus at 960×130 GIF size.
  3. Open the card on floor 41 at the end of the hold, and drop to floor 37 only when it closes.
  4. Two weak waves instead of three: about 10 s total.

**Why it matters:** this is the frame the demo ends on, and the image Fest players take away. "The demo ends, then shows me the wrong biome" is a lost wishlist moment.

### F4 [severity: major] Loud sounds for typists: 96–129 an hour (cap ≤40); the rationed ult booms are still 46–71 an hour
**Evidence (census8, peak gain ≥0.1 counted after `A.play`):**

| Run | Loud SFX/h | Ult booms/h (ultKnight + meteor) | Boss intro + kill/h |
|---|---|---|---|
| Full typist, hour 1 | 96 | 65 | 25 |
| Full typist, hours 7–8 | 108 | 71 | 29 |
| Demo typist, hour 2 | 129 | 46 | **84** (5 bosses a lap) |

- Idle runs pass (21–36/h).
- R7 measured 437 and 382/h, so the 20 s / 30 s rationing works. It's just a looser cap than the target.
- **Prototype P4** (ultKnight and meteor share one 60 s slot; boss stingers at most every 3 min): typists 68–75/h. Still over 40.

**Why it matters:** the low booms (a 70–80 Hz sine at 0.18–0.22) are what a call mic picks up. "Thumps during meetings" is a known complaint in this niche.

**Proposed fix (20 min):**
- When `combatSfx` is off, play ultKnight and meteor in a "companion" variant with peak gain ≤0.08: drop the 0.18/0.22 sine and halve the noise.
- Boss stingers at full volume at most every 3 min. In between, a short 0.06 version.
- Expected: loud SFX = slams plus 1–2 stingers per 3 min, about 20–40/h. PASS.

### F5 [severity: minor] Hour-1 toasts: 20–24 an hour (cap ≤10); achievements unlock steadily all hour
**Evidence:**
- Unsolicited toasts per hour:

  | Run | Toasts/h | Excluding the 5 one-time tutorial toasts |
  |---|---|---|
  | Full typist, hour 1 | 24 | 19 |
  | Demo typist, hour 1 | 20 | 15 |
  | Demo typist, hour 2 | 11 | |
  | Full idle, hour 1 | 14 | |
  | Late game | 5 | |

- Sources in full typist hour 1: achievement batches **13/h** (the 600 ms batching rarely merges anything), relic 4, recruit hints 3.
- Demo laps: "Floor 40 cleared … new best" 3–7/h, because early laps keep beating the best time.
- **Prototype P3** (achievement toasts at most every 5 min; sealed toast only on the first 2 laps or a gain of 60 s or more): demo typist hour 2 is **11 → 4**. Hour 1 is still 19–22.

**Proposed fix:**
- Achievement toasts at most once per 10 min. Collect the rest on a 🏆 +N badge on the Legacy button.
- Sealed toast only for laps 1–2, or a 60 s improvement.
- Exempt the one-time tutorial toasts from the cap.
- Expected: hour 1 has 8–10 non-tutorial toasts. PASS.

### F6 [severity: minor] Move alerts use OR, not AND; "REASSEMBLES" isn't gated; the plate text still blinks at 4 Hz; the FLOW vignette still pulses in calm
**Evidence:**
- **The gate in `fx.js` `FX.moveAlert` is OR.** It returns only if the move was already shown *this fight* AND within 10 min. So the first cast of every fight always shows.
  - The R7 spec was the reverse: the first time per fight AND at most once per 10 min per move type.
  - Alerts per hour: 5–24 in the full game (PASS), but **40 in demo typist hour 2**. Rat King 11, REASSEMBLES 11, WEB 10, WAR CHARGE 9.
- **The Bone King's REASSEMBLES calls `FX.alert` directly**, so no gate applies.
- **Prototype P2** (AND gate): 40 → 26/h. Gating REASSEMBLES too gives about 15.
- **The alert plate's text flips colour 8 times a second** (`render.js:342`, `a.t * 8`). Only the boss wind-up moved to 2 Hz.
- **The FLOW vignette pulses** (`render.js:321`, `sin(t*5)`) for **1,600–2,030 s/h** for typists, with calm on.

**Fix (10 min):**
- moveAlert: `if (e.alerted[type] || now - (FX.moveSeen[type] ?? -1e9) < 600000) { e.alerted[type] = true; return; }`. Route reassemble through it.
- `a.t * 4`, or a steady colour in calm.
- In calm, draw the vignette at a fixed 0.15.

### F7 [severity: minor] Event-sound chatter: the "IN THE ZONE" chime 83–88 an hour and the level-milestone arpeggio 17–136 an hour aren't rationed
**Evidence:**
- Census8, typists:
  - `zone`: 83–88/h. It fires on every rise to tier 2.
  - `milestone`: 58/h in full hour 1, **136/h** in demo hour 2 (every lap re-levels heroes 1→40). It isn't in COMBAT and isn't limited.
  - `chest`: 25–58/h.
  - offer + relic: one each per boss.
- Total SFX is fine (≤562/h, PASS ≤900). But at one sound every 6–12 s it's still busier than "speaks up when something happens".
- **Prototype P4** (milestone at most every 3 min; zone chime at most every 5 min): SFX 316 → 192/h. Seconds with sound 296 → 181/h.

**Fix:** `limited('mile', 180000)` and `limited('zoneChime', 300000)` in `A.play`. Optionally, a chest chime only for chests the player can see happen (it already plays per chest).

### F8 [severity: blocker, owner: user] This week's user to-dos (it's Mon Nov 9), in plain words, for the lead to relay
1. **Finish Steamworks sign-up and pay for the game's App ID (this week).**
   - Go to https://partner.steamgames.com/. Accept the agreement, then fill in bank details, the tax interview and identity verification.
   - Pay the **$100 Steam Direct fee** for the full game ([fee page](https://partner.steamgames.com/doc/gettingstarted/appfee)).
   - Steam's checks can take days to weeks, and nothing below can happen without the App ID. The demo is created later as a child app of that ID.
   - **Send the lead the App ID and store URL** so `KK.STORE_URL` can be set. Today the DEMO pill and the WISHLIST button show "The Steam page link goes here".
2. **Order the code-signing certificate (this week).** Azure Artifact Signing or an OV certificate. Identity validation takes days. Unsigned plus a global input hook means SmartScreen and antivirus warnings, the "is this a keylogger?" review.
3. **Put these dates in the calendar:**
   - **Late Nov (~Nov 23):** Coming Soon page submitted. Valve reviews store pages in 3–5 business days and recommends submitting **at least 7 business days early** ([review process](https://partner.steamgames.com/doc/store/review_process)).
   - **~Dec 1:** page live with the "Desktop Companion" tag, for **Desktop Companion Fest, Jan 14–18** ([upcoming events](https://partner.steamgames.com/doc/marketing/upcoming_events)). DCF's registration page still errors, so the opt-in date is unknown. Check that page weekly; my estimate stays about Dec 3.
   - **Dec 8, 10–11 am PST:** optional Next Fest Q&A on Zoom.
   - **Jan 10, 11:59 pm PST:** **Next Fest registration closes.**
   - **Jan 18:** demo build and store page submitted for review, so the demo is live for Press Preview.
   - **Feb 1:** all required Next Fest items submitted.
   - **Feb 22 – Mar 1:** Next Fest. The store page must be published and public. ([Next Fest Feb 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027))
4. **When the page exists:** record the store shots with the cue scripts below, on a 1080p monitor, with notifications off.

Nothing else needs the user this week.

## Verified fixes from last round (pass/fail, one line each)
- **Combat sounds OFF by default on desktop:** PASS. SFX/h 17.6k–36.5k → 92–562. Seconds with sound 3,242–3,530 → 80–478 per hour.
- **Loud sounds rationed (20 s / 30 s):** PASS as built. Ult booms 382 → 46–71/h, but the cap of 40 still FAILS (F4).
- **Calm ON by default on desktop:** PASS (`state.js:23`). Strong flashes 0 (was 258–324). Shakes 0 (was 365–495).
- **Meteor flash 0.08:** PASS. In calm everything is capped at 0.06. There are 44–580 faint flashes/h, one frame each.
- **Level-milestone banner at most once per 3 min, none during a boss:** PASS. 7–12/h.
- **Blinks at 2 Hz:** PARTIAL. The boss wind-up is 2 Hz. The alert-plate text is still 4 Hz (F6).
- **Move alerts once per fight / 10 min:** PARTIAL. The OR gate lets demo typist hour 2 reach 40/h (F6).
- **Relic toast only 0 → 1, at most every 15 min:** PASS. 37 → 4/h.
- **Recruit hint once per hero:** PASS. 14 → 0–3/h.
- **Sealed toast only on a new best:** PASS, but still 3–7/h on early laps (F5).
- **Achievement batching:** PASS (one toast per burst). Still 5–13 toasts/h in hour 1 (F5).
- **Gold pulse at most once per 2 s:** PASS. 206–1,105/h, from 12.2k.
- **R6 F6 leftovers** (checked by code, not run):
  - `kk:saveSync` bumps `saveGen`: PASS.
  - Pipe name hex-escapes non-ASCII: PASS.
  - Low-GPU migration on the first launch (`main.js` treats `true && !lowGpuMigrated` as auto): PASS.
  - Volume 0.3 → 0.2 migration (`calmMigrated`): PASS.
- **Capture mode:** PASS for profile isolation, 60 fps, seed, MARK, flags, chroma and the hotkey registration and path. FAIL for `js`, `flow` and the boot toast (F2).

## Ideas (optional, max 3)
1. **A "Polite by default" demo patch for DCF.** Ship F1, F4 and F5 together and announce it in the Jan 14 event post: "Desktop Companion Fest patch: one banner per boss, call-safe sound." Then the "Relaxing" tag can move from 15 to about 9.
2. **G2 is the trailer's money shot.** Typing in a real editor while the boss is SHELLED, the plate says "TYPE", the shell cracks. Cut the trailer around it, not around the Glimpse.
3. **Turn the sealed colossus into a wishlist button.** Clicking the stone colossus on floor 41 (or the card's image) opens the store page. It's the moment of highest curiosity, and the DEMO pill already has the plumbing.

## Noise census vs the R7 caps (desktop defaults, average of seeds 1 and 6)

| Build / profile / hour | Alerts | Big banners | ...excluding floor and biome | Toasts (unsolicited) | Strong flashes | Shakes | SFX | Loud SFX | Ult booms | Seconds with sound | Gold pulses | FLOW pulse (s/h) | Banner on screen (s/h) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| demo idle h1 | 5 | 43 | 25 | 12 | 0 | 0 | 92 | 21 | 6 | 80 | 534 | 0 | 102 |
| demo idle h2 | 21 | 91 | 66 | 8 | 0 | 0 | 256 | 57 | 7 | 215 | 653 | 0 | 213 |
| demo typist h1 | 20 | 108 | 74 | 20 | 0 | 0 | 395 | 99 | 53 | 354 | 715 | 1,596 | 250 |
| demo typist h2 | **40** | **190** | 138 | 11 | 0 | 0 | 562 | **129** | 46 | 478 | 1,105 | 1,710 | **441** |
| full idle h1 | 5 | 43 | 25 | 14 | 0 | 0 | 92 | 21 | 6 | 80 | 538 | 0 | 102 |
| full idle h7–8 | 10 | 26 | 18 | 5 | 0 | 0 | 101 | 36 | 5 | 93 | 206 | 0 | 60 |
| full typist h1 | 14 | 85 | 57 | **24** | 0 | 0 | 335 | 96 | 65 | 301 | 609 | 1,698 | 194 |
| full typist h7–8 | 24 | 66 | 47 | 5 | 0 | 0 | 316 | 108 | 71 | 296 | 719 | 2,030 | 150 |
| **R7 cap** | ≤20 | ≤20 | | ≤10 in h1, ≤6 after | ≤12 | ≤30 | ≤900 | ≤40 | | ~10–15% (≤540) | ≤1,800 | static in calm | |
| **Result** | FAIL in the demo loop | FAIL | FAIL | FAIL in h1 | PASS | PASS | PASS | FAIL for typists | | PASS | PASS | FAIL | |

R7 baseline for the same rows (calm off, all sound on): SFX 17.6k–36.5k, loud SFX 41–437, strong flashes 44–324, shakes 81–495, big banners 40–273, toasts 11–62.

**Prototype `--proto` (P1–P4 together)**, demo typist hour 2 and full typist hours 7–8:

| Measure | Demo typist h2 | Full typist h7–8 |
|---|---|---|
| Big banners | 190 → 58 | 66 → 53 |
| Alerts | 40 → 26 | 24 → 17 |
| Toasts | 11 → 4 | |
| SFX | 562 → 317 | 316 → 192 |
| Loud SFX | 129 → 75 | 108 → 69 |

The banner (merge the boss triple) and loudness (companion booms) fixes in F1 and F4 aren't prototyped. Their effect is estimated.

## Capture cues delivered (`docs/playtest/round-08/capture_cues/`)
Each JSON carries `_shot`, `_run` and `_cut` notes. The saves come from `node docs/playtest/round-08/capture_cues/stage.js all [--display <id>]`, which uses `tools/capture/make-save.js` plus a new `sim-save.js`. All saves have `lastSave` = 2100 (no offline toast) and `demoPeek` (no peek card).

| File | Shot | Status in the real shell |
|---|---|---|
| `g1_flow_meteor.json` + `saves/g1_f16_flow.json` | G1/S1: typing → **FLOW STATE banner** (+1.5 s after the script starts) → Earthshatter (+2.3) → Arrow Storm (+3.4) → **Meteor lands (+6.2)**. 8 s. | Scripted. One take in the shell, plus 4/4 dry-run seeds that land the meteor at 6.9–7.7 s. |
| `g2_ember_shell.json` + `saves/g2_f56_ember.json` | G2: Ember Colossus **MAGMA SHELL**, type (or hotkey 3), the ultimate cracks it, VICTORY. 8–12 s. | Staged. The boss arrives 8–14 s in (drift, F2.3); the operator types when the plate shows. Tested, relative to the spawn: shell +2.3 s, crack +5.3 s, VICTORY +13.3 s. |
| `s3_relic_pick.json` + `saves/s3_f29_relic.json` | S3: three relic cards ("THE BOSS DROPPED A RELIC! CHOOSE ONE"), then a pick with the purple burst | Scripted. Still window 1.5–6.5 s. |
| `s4_omen_choice.json` + `saves/s4_omen_offer.json` | S4: CHOOSE AN OMEN with Gilded (★ Omen of the Day), Storm Front (NEW) and Quiet Halls | Scripted through the save. The picker opens by itself 1.5 s after boot. |
| `g5_demo_glimpse.json` + `saves/g5_demo_f38.json` (KK_DEMO=1) | G5: War Charge, Warlord VICTORY, the MAGMA DEPTHS reveal, SEALED colossus, DEMO COMPLETE card | Staged. Tested: Warlord kill 27 s, glimpse 30 s, SEALED 40 s, card 48 s. Wants F3's fixes before final recording. |

Recording tips:
- Size L on a 1920×1080 monitor. At S the HUD (DOM, not scaled) dwarfs the 2x sprites.
- Chroma `#00ff00` works; the window above the strip is green too.
- Never use the `js` or `flow` cues until F2 lands.

## Measurement notes
- **Scripts** (all in `docs/playtest/round-08/market_probe/`):
  - `census8.js` (`--full` for calm off and combat on, `--proto` for P1–P4), `table8.js`, `breakdown8.js`.
  - `glimpse_trace.js`.
  - `shot_check.js`: a headless dry run of a save plus a cue file.
  - `cdp_run.js` + `probe.js`: Electron over CDP with a renderer probe, main-process checks, screenshots of the strip page only.
  - `displays/`: lists Electron display ids.
  - `run_capture.ps1`: superseded, see below. Outputs are in `out/`.
- **Limits:**
  - Sim profiles, not humans. Toasts the player triggered aren't counted against the caps.
  - The census ran on HEAD before the lead's uncommitted R8 edits (for example, the boss banner went 2.6 → 1.8 s).
  - Glimpse findings cover HEAD and the working tree at about 15:15.
- **Desktop impact (please relay):**
  - My first capture run (`t1`, about 15:07) used `run_capture.ps1`. It docked the strip on the **primary 4K display for 16 s**, while a fullscreen game was in front. It also injected **two Ctrl+Shift+Alt+8 presses**, which the capture hotkey registered and consumed.
  - Its two desktop screenshots captured the game rather than the strip. **I deleted them.**
  - Every later run docked on the right-hand 1080p monitor and used CDP strip screenshots. No key injection, no desktop capture.
- **Saves:**
  - Real `%APPDATA%\Keystroke Keep\saves\keystroke-keep.json` md5 is `d680a06b…b533`, before and after.
  - `Keystroke Keep Demo` was untouched (empty since 13:23).
  - All runs used `%APPDATA%\Keystroke Keep-capture`.
  - No backup or restore was needed.

## Sources
- Steamworks upcoming events (DCF Jan 14–18, Next Fest Feb 22 – Mar 1, Winter Sale Dec 17 – Jan 4): https://partner.steamgames.com/doc/marketing/upcoming_events
- Next Fest Feb 2027 (Dec 8 Q&A, Jan 10 registration, Jan 18 review for Press Preview, Feb 1 required items, store page must be public): https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- DCF 2027 registration page (still errors): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/desktop_companion_2027
- Steam Direct fee ($100 per app, recoupable after $1,000 AGR): https://partner.steamgames.com/doc/gettingstarted/appfee
- Review timing (store and build review 3–5 business days; submit at least 7 business days early): https://partner.steamgames.com/doc/store/review_process
- 2027 H1 calendar coverage: https://www.pcgamer.com/games/steam-reveals-all-the-sale-dates-and-themed-events-for-the-first-half-of-2027/
