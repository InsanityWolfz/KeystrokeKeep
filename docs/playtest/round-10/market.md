# Round 10: T3 "market" (Steam Market & Reviews Analyst)

> HEAD 51310be (Biome 5), working tree clean. All Electron runs used my safe launcher (`market_probe/safe/`, copied from R9 and hardened) on the right-hand 1080p monitor (id 2904106817). Nothing was shown on the primary display; see "Desktop safety" at the end.

## Verdict
The capture gate passes on frame rate. In the 12 gate takes, **379 of 381 measured seconds fall between 59 and 61 real fps** (one 58, one 62), and each take averages 59.0–60.8. That's 3× slower than R9's 193–207 fps, which is right: part 5 fixed the speed-up. In 6 more takes, 23 of 318 seconds were at 58 fps (a 59.0 average), which is F2. **S3 and G1 are frame-identical 3/3.** G5's beats land on the same frame in all 3 takes, and 2 takes are pixel-identical end to end. **G2 still drifts.** I traced it to the sound effects drawing from the gameplay random stream: with audio off, G2 is identical in every take.

The noise caps now pass everywhere except one item carried from R9: hour-1 toasts are 13 (cap 10), or 10 if recruit hints count as tutorial. The new Heartroot alerts add 1–2 an hour.

Biome 5 changes the content story. A typist reaches the Heartroot at **2h01–2h04**, exactly at Steam's 2-hour refund line, and then has new bosses at **4h–4h28** (Rootmother), **9h04–9h20** (Keeper) and **13h–14h** (Echoed Depths). "Content runs out in 3 hours" is no longer true.

I'd keep it running and wouldn't refund it. **Rating: 9/10** (R9: 8.5). It's 9.5 once G2 is deterministic and the store page exists.

## Findings (ranked, max 8)

### F1 [severity: major] G2 takes still diverge: sound effects consume the shared seeded `Math.random`, gated by the real AudioContext
- Evidence (`compare.js`, 3 takes each, real time, default `KK_CAPTURE_AUDIO=sfx`, juice full):

  | Shot | Key events in all 3 | Max beat spread | State digests equal | Canvas hashes equal |
  |---|---|---|---|---|
  | S3 relic pick | 4 | **0 frames**; same cards `map, enter, whetstone` | **11/11** | **6/6** |
  | G1 FLOW → Meteor | 9 | **0 frames** (Meteor lands at frame 380 in 3/3) | **12/12** | **6/6** |
  | G5 demo glimpse | 26 | **0 frames** (glimpse 1620, door 1940, card 1994) | 59/61 (take 3 differs from frame 3600) | 17/31 (take 3 differs from frame 2100; takes 1 and 2 identical 31/31) |
  | G2 Ember shell | 13 | 10 frames (2nd shell 15.1 s vs 14.9 s) | **4/44** (first difference at frame 300) | 2/22 |
  | **G2, audio off** (`KK_CAPTURE_AUDIO=off`) | 19 | **0 frames** | **42/42** | **21/21** |
  | **G5, audio off** | 26 | **0 frames** | **63/63** | **32/32** |

- **Audio off makes both shots frame-identical (3/3, every digest and every pixel hash)**, so the timers are fixed and the remaining source is audio.
- In G2, boss in (frame 7), first shell (145) and the crack (224) are identical. After the crack, the ultimates drift by 0–6 frames: the mage fires at frame 330, 336 or 330. The fight then runs differently, and 8 key events (VICTORY, relic offer, floor 51) occur in only some takes.
- Cause:
  - `A.play` returns early unless `A.ready && A.ctx.state === 'running'` (`js/audio.js:130`). Every sound that does play draws from `Math.random`: `noise()` calls `Math.random() * 0.5` for the start offset (`audio.js:84`), and `hit`, `coin` and `spark` call `U.rand`/`U.pick` (`audio.js:89–95`).
  - Whether the context is running is decided by the real audio thread, not by the frame clock. So the number of draws on the gameplay stream changes from take to take.
  - G2 is the shot with the most combat sounds (juice full, a long boss fight), so it drifts first. G5's late drift (after the DEMO COMPLETE card, take 3 only) disappears with audio off too.
- Why it matters:
  - The trailer and G2 GIF are recorded with sound on. A take that differs every time means the editor can't re-record a beat and cut it into an earlier take.
  - The README promises "frame for frame at any CPU load".
- Proposed fix (15 min, no effect on gameplay):
  - Give audio its own stream: in `audio.js`, use a local seeded `arand` (mulberry32, seed 99) for `noise()`'s offset and the SFX pitch picks, and don't touch `Math.random` or `U.rand`.
  - Do the same for render-only randomness (`render.js:208, 370, 582` motes and trails, plus `fx.js` particles) with `U.vrand`. That's the R9 F2b item.
  - Gate: G2 and G5 3/3 with audio on.

### F2 [severity: minor] Capture pacing is 59 or 61 fps per take, not exactly 60: a 30 s clip can run about 1 s long or short
- Evidence:
  - Each take locks to one rate for its whole length. S3 take 1 ran 59.0 every second, G5 take 1 averaged 59.0, and G1 takes averaged 60.8.
  - The 6 audio-off takes averaged 58.98 fps: 23 of 318 seconds at 58, 283 at 59. The machine was otherwise idle.
  - G5 reaches the door (frame 1940) at 33.1 s real in take 1 and at 32.3 s in takes 2 and 3.
  - The loop schedules `1000/60 − work` after each frame (`main.js:63`). Windows timer rounding then settles at 16 or 17 ms.
- Why it matters: OBS records real time while game audio runs on the real clock. A 59 fps take plays 1.7% slow against 60 fps footage, and audio-on takes from different runs won't line up.
- Proposed fix (5 min):
  - In capture mode, pace on an absolute schedule: `next += 1000/fps; later(frame, Math.max(0, next - realNow()))`. Reset `next` if it falls more than 100 ms behind.
  - Gate: mean fps of 60.0 ± 0.1 over 30 s, with no second below 59.

### F3 [severity: major, positive] Biome 5 + Echoed Depths remove the "content runs out in 3 hours" risk
- Evidence (`node tools/playtest.js --retire nudge --omen random`, 20 h):

  | Profile / seed | Hollow Void | **Heartroot** (f101) | **Rootmother** (f120) first kill | **Keeper** (f140) | **Echoed Depths** (f151) |
  |---|---|---|---|---|---|
  | typist 1 | 0h42 | **2h01** | 4h28 | 9h04 | 13h07 (Echoed Crypt) |
  | typist 6 | 1h04 | **2h04** | 3h59 | 9h20 | 13h47, then Echoed Caverns 18h24 |
  | burst 1 (10 h) | 1h29 | 4h02 | 9h51 | | |
  | idle 1 | 1h55 | 5h26 | 15h13 | | |
  | idle 6 | 1h58 | 6h41 | 14h58 | | |

  - R9: a typist saw every biome and boss within 2.1–2.8 h, and 97% of play after hour 8 was in the Hollow Void.
  - Now the first new biome arrives at the refund line and the last boss is a day-2+ event. Idle players get the Heartroot on day 1 and the Rootmother on day 2–3.
  - Census, full typist hours 11–12: 9 alerts an hour, of which OVERGROWTH and LOCKDOWN account for 1–2.
- Why it matters:
  - Steam refunds are "within 14 days of purchase" with "less than 2 hours" played. The question that matters is whether there's something new after the refund window, and now there is: three new milestones across hours 2–14.
  - The likely negative review shifts from "content runs out in 3 hours" to "it's a slow grind to the Keeper". That's a much better review to get for an idle game.
- Proposed fix (store, not code):
  - Store copy v3 (below).
  - Keep the "a new boss every few hours for the first two days" claim honest: it holds for typists, but idle players see the Rootmother on about day 2.

### F4 [severity: minor] Noise census on HEAD: every cap passes except hour-1 toasts (unchanged from R9)
- Evidence: `census9.js`, seeds 1 and 6, desktop defaults (calm on, combat sounds off). Full runs are now 12 h. Full table at the end.
  - **Alerts:**
    - Demo typist h2: **20/h**, at the cap. That's 5 each of WEB, SUMMONS, REASSEMBLES and WAR CHARGE. R9: 21.
    - Demo idle h2: 18. Full runs: 5–15.
    - Heartroot: OVERGROWTH 1/h, and LOCKDOWN 1–2/h in hours 11–12.
  - **Hour-1 non-tutorial toasts: 13 (typist), 9 (idle). Cap 10.**
    - Typist: achievements 4–5, relic 4, recruit hints 3, plus seal, lantern and trophy for seed 1.
    - Without the 3 recruit hints: 10 and 6, which passes.
  - Big banners (cap 20, not counting first-ever): pass. Typist h1 has 26, but only 5 are repeats. Late game has 1–2.
  - **Sound:**
    - Loud sounds: 11–31/h (cap 40).
    - All sounds: 83–411/h (cap 900).
    - Seconds with any sound: 75–387 (cap 540).
  - **Visuals:** strong flashes 0, shakes 0.
  - **Guard-break sound:** the new 'crit' plays 0 times by default, because `crit` is in the combat-sound set and combat sounds are off. Good choice.
  - **GUARD BROKEN / WARDED / SEALED** float texts: no measurable effect on the popup rate. Late game is dominated by "LV #" (356–827/h) and "WEBBED" (~260/h). Those are existing texts, not new ones.
- Why it matters: hour 1 is when a reviewer decides whether the app is "naggy". 13 toasts is about one every 4.6 minutes.
- Proposed fix (5 min): count recruit hints as tutorial toasts (backlog item). Alternatively, show the relic toast only for the first 2 offers in a save (4 → 2). Either brings typist h1 to 10 or below.

### F5 [severity: blocker, owner: user] Calendar: 3.5 weeks to the Desktop Companion Fest marketing opt-in. No new Steam facts this round
- Re-checked today (sources at the end):
  - Desktop Companion Fest is still **Jan 14–18, 2027**. Its own page still returns "an error occurred".
  - The marketing opt-in is "typically 6 weeks prior to event start", so about **Dec 3**.
  - Marketing consideration needs "at least one publicly visible trailer on your store page".
  - "Unreleased games are welcome to participate". They're listed in an upcoming-games section, but generally not in the official event trailer.
  - **Next Fest Feb 2027** is unchanged:
    - Register by Jan 10, 11:59 pm PST.
    - Jan 18: trailer pull, and the target date for demo and page review.
    - Feb 1: everything submitted.
    - Feb 11: press preview and the trailer opt-out deadline.
    - Feb 22 – Mar 1, 10 am PST: the fest itself.
    - One Next Fest per game, ever. The next edition is June 2027.
- With F1 and F2 fixed, the user can record a 30–45 s trailer (G1, G2, then G5 or the Heartroot) on a free monitor. It's the only blocker left on the code side for the Dec 3 date.
- Still owned by the user:
  - Steamworks onboarding and the App ID. `KK.STORE_URL` is still `''` (`js/state.js:32`).
  - A code-signing certificate. The exe is still unsigned.
- I couldn't re-verify code-signing eligibility this round (search hit a usage limit). The R9 facts stand: individual Azure Artifact Signing is US/Canada only, otherwise an OV certificate.

### F6 [severity: minor] A Heartroot capture shot is missing, and it's the new best GIF for the store page
- Evidence:
  - `tools/capture/shots/` still has only G1, G2, S3, S4 and G5. None of the five stages f101+.
  - The census and sims show OVERGROWTH ("TYPE TO TEAR THE ROOTS") as a typing-reactive moment, the same mechanic as the web, but on the whole party.
- Why it matters:
  - "Your typing tears the roots" is the clearest proof of the store fantasy since G2.
  - The Rootmother and Keeper are the "there's more after hour 2" answer for the store page and for streamers.
- Proposed fix (20 min):
  - `g6_rootmother.json`: floor 119, `wave`, `await overgrowth`, mark "TYPE NOW", `autotype` on, `await bossDefeated` (or a +12 s mark), END.
  - Staged by `stage.js g6` from a f118 save with 4 heroes at about Lv 140.
  - Record it after F1, so it's repeatable.

### F7 [severity: minor] Trust checklist: no changes since R9
Only the status column is re-checked. Nothing below changed in the code:
- `sessionData` is still in Roaming: there's no `setPath('sessionData')` in `electron/main.js`.
- There's still no in-game version, credits line, "Delete my data" button or "Start with Windows" toggle.
- `KK.STORE_URL` is still empty.
- The exe is still unsigned.
- `dist/` is still from 15:46 (before parts 4–5 and Biome 5). Per the coordinator, I didn't rebuild this round.
- The only change: P0 "capture at 3.3× speed" is now **PASS on speed** (F2 is a precision note), with **G2 determinism still open** (F1).

| Item | R9 | R10 |
|---|---|---|
| Capture speed (59–61 fps) | FAIL (193–207 fps) | **PASS** (take means 59.0–60.8; 675/699 s in 59–61, 24 s at 58; F2) |
| Capture determinism (S3/G5 3/3) | FAIL | **S3 PASS, G1 PASS. G5 beats PASS (2 of 3 pixel-identical with audio on, 3/3 with audio off). G2 3/3 only with audio off (F1).** |
| Packaged build is current | stale | still stale (rebuild before any packaged check or recording) |
| All other P0/P1/P2 rows | as R9 | unchanged |

## Verified fixes from last round (pass/fail, one line each)
- **Capture runs in real time** (4a1b950, `KK.realNow`/`KK.realSetTimeout`): PASS. 59–61 fps in 379 of 381 s across 12 takes; R9: 193–207.
- **Game `setTimeout`s on frames:** PASS for the timers. S3 shows the same cards and the same pick frame (391) in 3/3, and pixels 6/6. The remaining drift comes from audio RNG (F1), not timers.
- **`await` resolves if its event fired this frame / G5 without the await after `wave`:** PASS. There's no TIMED OUT mark in any take. G5's "WARLORD IN" mark is on frame 7, not the 20 s timeout.
- **G2 uses `g2_v9b`:**
  - PASS: BOSS frame 7, SHELL 145–146, CRACK 224–225 in 3/3. R9's adopted script landed on the third shell.
  - Note: "END" (+12 s after the crack) still comes before VICTORY. Cut on VICTORY.
- **`KK_CAPTURE_DISPLAY=<id>`:** PASS. Every take, run with `KK_CAPTURE_DISPLAY=2904106817`, showed at x 2560 (the right-hand monitor).
- **Launch docks on the saved monitor before first show:** PASS (shows at 0.40–0.42 s on the target, and my guard never fired).
- **Retail ignores `KK_*` without `--kk-dev`:** PASS by code (`electron/main.js:11`). Not run packaged (stale `dist/`).
- **Biome 5 move alerts:**
  - PASS. OVERGROWTH and LOCKDOWN go through `FX.moveAlert` (gated), 1–2/h.
  - The guardBreak 'crit' sound is muted with combat sounds off (the default).
  - "WARDED" and "SEALED" float texts are about 1 s long.
- **R9 over-cap items:**
  - Demo typist h2 alerts: PASS at 20 (it was 21).
  - Hour-1 toasts: FAIL, still 13 (F4).

## Ideas (optional, max 3)
1. **"A new boss on day 2" as a store and community hook.**
   - Typists meet the Rootmother around hour 4 and the Keeper around hour 9. Most players will reach the Keeper on their second or third workday.
   - A Steam community post such as "Who's beaten the Keeper?" can then arrive on day 3 and still be on time.
2. **Heartroot capsule variant:** the party under a giant red-rooted heart, in the strip's green and gold palette. It sets the Steam capsule apart from the purple Void shots that every other screenshot already uses.
3. **Polite-by-default store bullet**, now with numbers that hold through 12 hours: "about one soft sound every 10 s while you type, no flashes or shake, a big banner only for something new".

## Store copy v3 (updated bullets and pitch)
**5-second capsule pitch:** *"A tiny dungeon at the bottom of your screen. Your typing is their adventure."*

**Short description (≤300 chars):** *Keystroke Keep is a tiny idle dungeon crawler that lives in a strip at the bottom of your screen. Every keystroke you type at work powers your party: ultimates, FLOW STATE, boss-breaking moves. It only counts keys, never records them, and it never goes online.*

**Bullets:**
- **Your work is their adventure.** Typing charges Sparks, fills ultimates and lights FLOW STATE (a damage multiplier for steady typing). Stop typing and they keep delving at an idle pace.
- **Five biomes and the Echoed Depths.** From the Crypt to the Hollow Void and the new **Heartroot**, with **10 bosses** that each have a signature move you answer by typing: tear the web, crack the magma shell, rip through the Overgrowth. Past floor 150 the Echoed Depths loop the old biomes, harder.
- **Built to sit beside your work.** Calm by default: no flashes, no shake, soft sounds, call-safe. It hides itself for fullscreen games and video, sleeps when you lock the PC, and lives in the tray.
- **Retire, choose an Omen, come back stronger.** Renown, a Legacy tree, 10 Delve Omens with an Omen of the Day, Seals, the Codex (40 ranks) and depth trophies to floor 300.
- **43 achievements**, and progress you can see.
- **Private by design.** It counts keys and never reads them, makes no network connections, and you can pause counting from the tray.

(Numbers checked on HEAD: 5 biomes + Echoed Depths, 10 named bosses plus Hollowed variants, 25 monsters, 18 relics, 4 heroes, 10 omens, 43 achievements per `playtest.js`. Before publishing, re-check "10 bosses" against how the store counts the Hollowed variants.)

## Noise census vs the caps (HEAD 51310be; desktop defaults; average of seeds 1 and 6)

| Build / profile / hour | Alerts (of which Heartroot) | Big banners (repeats) | Toasts non-tutorial (excl. recruit) | Strong flash | Shakes | SFX | Loud SFX | Seconds with sound | Alert plate s/h | Big banner s/h |
|---|---|---|---|---|---|---|---|---|---|---|
| demo idle h1 | 5 | 14 (2) | 9 (6) | 0 | 0 | 83 | 11 | 75 | 6 | 30 |
| demo idle h2 | 18 | 7 (2) | 8 (8) | 0 | 0 | 189 | 31 | 179 | 24 | 16 |
| demo typist h1 | 15 | 20 (3) | 13 (10) | 0 | 0 | 352 | 26 | 338 | 20 | 44 |
| demo typist h2 | **20** | 0 | 4 | 0 | 0 | 411 | 22 | 387 | 25 | 0 |
| full idle h1 | 5 | 14 (2) | 9 (6) | 0 | 0 | 83 | 11 | 75 | 6 | 30 |
| full idle h7–8 | 10 | 2 (1) | 4 | 0 | 0 | 108 | 19 | 99 | 13 | 5 |
| full idle h11–12 | 8 (0) | 2 (1) | 3 | 0 | 0 | 95 | 17 | 88 | 10 | 3 |
| full typist h1 | 15 | 26 (5) | **13 (10)** | 0 | 0 | 310 | 21 | 298 | 18 | 59 |
| full typist h3–4 | 13 (1) | 6 (3) | 8 | 0 | 0 | 343 | 25 | 323 | 17 | 12 |
| full typist h7–8 | 7 (1) | 1 (0) | 4 | 0 | 0 | 307 | 19 | 296 | 10 | 2 |
| full typist h11–12 | 9 (2) | 1 (1) | 4 | 0 | 0 | 321 | 17 | 302 | 11 | 2 |
| **Cap** | ≤20 | ≤20 excl. first-ever | ≤10 h1, ≤6 after | ≤12 | ≤30 | ≤900 | ≤40 | ≤540 | | |
| **Result** | **PASS** (at cap in demo h2) | PASS | FAIL by 3 in typist h1 (PASS without recruit hints) | PASS | PASS | PASS | PASS | PASS | | |

Final states:
- Full typist after 12 h: maxFloorEver 149–150, 14–15 retires.
- Full idle after 12 h: maxFloorEver 118–119. Idle players haven't met the Rootmother at 12 h.
- Demo: every run finishes the Glimpse and demoDone.

## Measurement notes
- **Scripts** (`docs/playtest/round-10/market_probe/`):
  - Launcher: `safe/` and `safe2/`, copied from R9. Profile renamed to `kk-market-r10`. Added: `dialog.*`, `shell.*` and `Notification` stubs that log and never show, and a `listOnly` mode that lists displays without loading the game or creating a window.
  - Capture runners: `run_shot.js` (now passes `KK_CAPTURE_DISPLAY=<id>` and syntax-checks `main.js` and `pre.js` before every start), `list_displays.js`, `gate.sh`, `gate2.sh`.
  - Analysis: `compare.js` (mode `r10_`), `census9.js`, `census.sh`, `table10.js`.
  - Outputs in `out/`: `shots/`, `c10_*.json`, `pt_*.txt`, `gate.log`, `gate2.log`, `displays.json`.
- **Takes:** 1 smoke, 12 gate takes (S3, G5, G1, G2 × 3), and 6 audio-off takes (G2, G5 × 3). No aborts in any of the 19.
- **Limits:**
  - The census uses scripted sim players, not humans.
  - 3 takes per shot, on one PC. Census sims ran before the audio-off takes. Capture takes ran with no other load.

## Desktop safety (please relay)
- Every game window was created hidden and shown (`showInactive`) only on the right-hand monitor (x 2560, id 2904106817).
  - The launcher refuses any bounds that touch the primary display and re-checks every 250 ms. It never had to refuse anything this round.
  - The display list came from a windowless Electron run, after a check with the Windows API.
- No input was injected. The input hook was a dummy (`hookStart` blocked in every take). No global hotkeys were registered (the 11 calls were recorded only). There was no tray icon or balloon. Audio was muted at the Chromium level.
- Every launch was syntax-checked first. There were no error dialogs and no bare `electron.exe` starts. I didn't kill any processes. **No incidents this round.**
- Own profiles only: `%APPDATA%\kk-market-r10-capture` (new, about 8 MB). The real save is unchanged: `%APPDATA%\Keystroke Keep\saves\keystroke-keep.json`, md5 `d680a06b343db55e16cf6d3b88b4b533`, 981 bytes, modified 10:46. The demo save folder doesn't exist and wasn't created.
- The R9 tester profile folders are still there (safe to delete whenever you like; that needs your OK).

## Sources
- Steamworks Next Fest Feb 2027 (Jan 10 registration, Jan 18 trailer pull and review target, Feb 1, Feb 11 press preview and trailer opt-out, Feb 22 – Mar 1 at 10 am PST, one Fest per game, next edition June 2027): https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027 (fetched 2026-11-09)
- Steamworks upcoming events (Desktop Companion Fest Jan 14–18, 2027; Winter Sale Dec 17 – Jan 4): https://partner.steamgames.com/doc/marketing/upcoming_events (fetched 2026-11-09)
- Steamworks themed sales (tag-based invites, "six weeks or more" to register, marketing opt-in "typically 6 weeks prior to event start", a publicly visible trailer required, "Unreleased games are welcome to participate"): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales (fetched 2026-11-09)
- DCF 2027 page (still "Sorry, an error occurred"): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/desktop_companion_2027
- Steam refund policy (14 days, under 2 hours played): https://store.steampowered.com/steam_refunds (known policy, not re-fetched this round)
- Code-signing eligibility: R9 sources in round-09/market.md (not re-checked this round)
