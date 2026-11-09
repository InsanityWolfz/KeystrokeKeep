# Playtest Loop

An endless improve cycle: **4 specialist playtesters play → report → we triage → fix → verify → log → commit → repeat.**
Each round lives in `docs/playtest/round-NN/` (one report per tester + `SUMMARY.md`). This file holds the process, the tester briefs, and the running backlog, so any round can be resumed cold.

## Round procedure (for the lead / orchestrator)

1. Read this file + the last round's `SUMMARY.md`. Next round number = highest existing `round-NN` + 1.
2. Bump the `?v=rNN` asset version in `index.html`. Make sure the browser preview server is up (`keystroke-keep` in `.claude/launch.json`, http://127.0.0.1:5173). Only **Tester 4** may drive the browser.
3. Spawn the 4 testers **in parallel**, each with: its brief below, the round number, the "Fixed since last round" list, and the open backlog. Each writes `docs/playtest/round-NN/<id>.md` and returns its top findings.
4. Triage: merge duplicates, score each finding (impact on reviews/retention × confidence ÷ cost). Pick a fix set that fits one round (typically 4–8 changes). Prefer root-cause fixes over band-aids. Record the rest in the backlog with a reason.
5. Implement. Keep the code style (vanilla JS, `KK` namespace, sim DOM-free).
6. Verify: `node tools/playtest.js` for typist/idle/burst profiles (pacing must not regress wildly; first boss ≈5 min, first retire 35–60 min), plus a browser smoke test (no console errors; the changed UI renders).
7. Write `round-NN/SUMMARY.md` (findings → decisions → changes → before/after numbers), update the backlog below, commit locally (`Playtest round NN: ...`). Never push.
8. Schedule the next round.

## Tools the testers get

* `node tools/playtest.js --min 120 --profile typist|idle|heavy|burst|afk --strategy smart|greedy|random --glance 60 --stuck 8 --seed 1 [--sessions 3 --offline 8] [--bal '{...}'] [--json out.json]`
  Plays the real sim as a scripted player and prints a timeline, key events, prestige runs, pacing (stalls, droughts, purchases/10 min), fervor-tier time, spark waste, **content coverage** (first affordable / first bought per upgrade), relic offer/pick counts, biomes reached and monsters never seen.
* `require('./tools/headless')({ seed, bal })` returns a live `KK` in node, for custom scenario scripts. Put scratch scripts in your round folder, never in `js/`.
* `node tools/sim.js` (older, simpler balance sim).
* `npx electron docs/playtest/round-02/market_probe` (T3): measures GPU/DWM/fps of the real Electron shell under its own profile; briefly opens a fullscreen test window.
* Desktop self-test: `KK_SNAPSHOT=out.png [KK_SNAPSHOT_JS=...] [KK_DEMO=1] npx electron .` uses a separate `-selftest` profile (never touches the real save).
* Demo mode: `?demo` in the browser, `KK_DEMO=1` for Electron, `--demo` for playtest.js. `playtest.js --retire nudge` retires like the in-game nudge; `--omen first|none|random`.
* Market probe (T3): `npx electron docs/playtest/round-04/market_probe` (modes in its README/probe.js; uses its own %APPDATA%/kk-market-probe-r4 folders).
* Packaged build: `npm run dist` / `npm run dist:demo` → `dist/*/win-unpacked/*.exe`.
* Source: `js/*.js` (data in `js/data.js`, economy in `js/state.js`, combat in `js/world.js`, UI in `js/ui.js`), desktop shell in `electron/`, design in `docs/GDD.md`.
* Tester 4 only: the browser pane at http://127.0.0.1:5173 (fake desktop + dev tools: autotype, time warp, +gold, +floors, rat). Fresh start: run `KK.resetting = true; localStorage.clear(); location.reload()` (a plain `localStorage.clear()` gets re-saved by the unload handler). Asset URLs carry `?v=rNN`; the lead bumps it each round so the browser never runs stale code. Dev server: `python tools/serve.py` (no-cache). The page blocks all fetches by CSP, so don't probe with `fetch()`.

## Report format (every tester)

```
# Round NN — <Tester name>
## Verdict (2–3 sentences: would you keep it running tomorrow? would you refund? star rating /10)
## Findings (ranked, max 8)
### F1 [severity: blocker|major|minor] <title>
- Evidence: <command + numbers, file:line, or what you saw>
- Why it matters: <retention / review / refund risk, the Steam review sentence it would cause>
- Proposed fix: <concrete change, with numbers where relevant>
## Verified fixes from last round (pass/fail, one line each)
## Ideas (optional, max 3: things that would make it more fun, not just less broken)
```

Testers do **not** edit game files. They only write their report (and scratch scripts in their round folder).

## Tester briefs

### T1 — `economist`: Incentive & Economy Designer
You design idle/incremental economies for a living (think Cookie Clicker, Antimatter Dimensions, Melvor, NGU, Realm Grinder). Your job: make every currency and every button matter.
* Are there dominant strategies or no-brainer purchases (if the right choice is always obvious, it's not a choice)?
* Currency sinks and faucets: does gold, Sparks, and Renown each always have something worth buying? Do any currencies pile up unused or never accumulate?
* The prestige loop: is the first retire well timed, does the second run feel dramatically faster, does Renown create real choices or does one retire buy everything?
* Does activity (typing) feel rewarded without making idle players feel punished? Check the typist-vs-idle ratio.
* Long-term curve: run 4–8 hours with `--stuck` variations. Where does it wall, where does it trivialize?
Run plenty of `playtest.js` configs and at least one custom scenario script. Numbers over vibes.

### T2 — `auditor`: Content & Pacing Auditor (dead-content hunter)
You find what nobody sees and what nobody uses. Content that exists but is never reached, never bought, never offered, or never matters is wasted dev time and a "shallow" review.
* Content coverage: every hero, monster, biome, boss, relic, Forge/Workshop/Legacy upgrade. When does a normal player first see it? Which never appear in 2/4/8 hours?
* Upgrades whose effect is too small to notice, or that are strictly worse than another option.
* Pacing of novelty: is there something new (a hero, biome, boss, mechanic, relic) at least every ~10 minutes in hour 1, every ~30 minutes in hours 2–5? Where are the dead stretches?
* Ending/long tail: what happens after the last biome? Is there a reason to keep it running in week 2?
* Also read code for unreachable branches or features that are wired but invisible to the player.

### T3 — `market`: Steam Market & Reviews Analyst
You know the desktop-companion / idle-strip niche on Steam (Rusty's Retirement, Bongo Cat, Ropuka's Idle Island, Spirit City: Lofi Sessions, Desktop Mates-style apps, Melvor Idle, Idle Champions, Cookie Clicker on Steam) and *why these games get negative reviews and refunds*: CPU/GPU/RAM use while idle, battery drain, it covers taskbars/fullscreen apps, multi-monitor problems, antivirus flags or "keylogger" fears from global input hooks, no achievements/cloud saves, "content runs out in 3 hours", "it's a mobile game", nag/notification fatigue, sound annoyance during calls, price vs. hours, abandoned updates.
* Audit this build against each of those pitfalls with evidence from the code (`electron/main.js`, `js/native.js`, `js/main.js` render loop, audio) and the GDD.
* Rate the hook/positioning: does the store-page fantasy ("your work is their adventure") hold up in play? What's the 5-second capsule pitch and what would make a streamer/YouTuber feature it?
* For each risk, say how to account for it before the Next Fest demo (Jan 10) vs. after.
Use web search if available to check facts about the market; cite what you found.

### T4 — `player`: First-Time Player & Feel (UX/juice)
You are a fresh, slightly impatient player who installed this after seeing a GIF. You are the only tester who uses the **browser pane** (http://127.0.0.1:5173). Start from a cleared save.
* First 10 minutes: is it obvious what to do and why typing matters? Where were you confused or bored? What did you not notice?
* Readability at strip size: can you tell what's happening at a glance (HP, who's winning, what to buy)? Is the HUD legible at S/M/L sizes?
* Juice and feel: do hits, ults, bosses, FLOW STATE, relic picks feel good? Anything noisy, flashy or annoying for something that sits on screen while you work?
* UI friction: buttons that do nothing, unclear costs, too many clicks, modals that interrupt work.
* Use dev tools (warp, autotype, +floors) to reach later content and check it still looks right.
Take screenshots of problems and describe them precisely (what, where, which panel). Check the console for errors.

## Backlog (open items carried between rounds)

Format: `- [round found] [severity] item: status/reason`

### Fixed
- [R0/R1] Workshop never affordable → Embers currency (R1).
- [R0/R1] First retire bought every Legacy upgrade → repriced (R1); re-check.
- [R1] Re-retire Renown exploit, shallow farming optimal → record-based Renown (R1).
- [R1] Offline > online → 80% cap (R1).
- [R1] Meteor/Sanctuary starved → ult round-robin (R1).
- [R1] Content ends at The Hollow → Hollowed bosses cycle from floor 70 (R1, partial: see finale below).
- [R1] 160 fps render, audio never suspends, focus stealing, Google Fonts, relic misclicks, offline modal, FLOW spam → fixed (R1).

### Fixed in R2
- Spark Jar dead → Ember Crucible; Overcharge multiplicative; idle Embers from bosses/rats; Fame compounds; offline uses 10-min avg; relic queue; disabled-button styling; boss bar/crit readability; screen-space rat; fullscreen auto-hide; CSS-animation GPU drain; sleeping frame loop; muted audio leak; hook removed on pause; hotkey Ctrl+Shift+Alt+K; demo mode (cap 40).

### Fixed in R3
- Dead demo end (re-delve loop, repeatable +6, best time), demoDone persistence, ligature "Aoor" bug, Delve Omens, Hollow at f70, Sanctuary reaction, ult-turn spin, Second Wind, Overcharge growth, CSS bar transitions (GPU), 24 fps default, per-monitor fullscreen scan, baked demo flag + explicit save folders + demo→full import, file saves with backups.

### Fixed in R4
- Packaging (electron-builder, fuses, trimmed natives, icon), achievements (35), depth trophies, demo Renown cap + import conversion, omen balance + modal, Vigil Sanctuary + void slam, Head Start levels/retreat floor, Second Wind feedback, low-GPU mode, fullscreen false positives, save hardening (validated rotation, corrupt quarantine, retries, shutdown flush, one-time demo import).

### Fixed in R5
- Heal scaling, achievement bugs (Hands Off, Speedrunner, Blitz), ember floater amounts, re-delve banner, Head Start mid-delve levels, void slam readability (alert channel) and pacing, floor-100 boss + banner, Codex for week 2, two signature moves, demo/full instance lock.

### Fixed in R6
- Enrage bug + wound carry-over + regroup, all 4 remaining signature moves, Reassemble visibility, Codex cadence, Dynamo, Blitz, digit font, achievements list open state, re-delve wording, false stall hint, omen pill tooltip/width.

### Open (ranked)
- [R4] [check] Measure GPU/CPU with low-GPU mode on (default) incl. an iGPU laptop if possible; fullscreen filter vs real overlays; save edge cases on the packaged build (market probe in docs/playtest/round-04/market_probe).
- [R3] [blocker, owner: user] Steamworks onboarding (fee/tax/bank), app id, Coming Soon page (~Nov 23), trailer (Jan 8), demo + page review submission (~Jan 12, deadline Jan 18). Set `KK.STORE_URL`.
- [R3] [blocker, needs app id] Steamworks in main (steamworks-ffi-node or steamworks.js): init, achievements mirror of `S.ach` (full game only; demo grants on import), rich presence, Auto-Cloud on `%APPDATA%/Keystroke Keep/saves/*.json`, overlay test.
- [R3] [blocker, owner: user] Code-signing certificate (Azure Artifact Signing or OV); then `win.azureSignOptions`/certificate config; VirusTotal + Microsoft submissions.
- [R5] [check] R5 market report arrived after the write-up: fold its findings in (power low-GPU on/off, fullscreen filters, save hardening, packaged build, store checklist + trailer shot list in round-05/market.md).
- [R6] [blocker, owner: user] Steamworks onboarding NOW (tax up to 30 days); app id + Desktop Companion tag by ~Dec 1 for Desktop Companion Fest (Jan 14-18, opt-in ~Dec 3); Coming Soon page submit Dec 7; demo build review Dec 18; dated plan in round-06/market.md.
- [R6] [major] Idle first hour still ~10 quiet retreats (target <=4); consider a softer f11-30 curve for parties without the Cleric.
- [R6] [major] KK_CAPTURE mode (60 fps, no idle drop, fixed crop, no dev UI) for store GIFs/trailer; shot list in round-06/market.md.
- [R6] [major] Week-2 layer: Omen of the Day + Void Lantern + trophies at 160-200 (final numbers and code locations in round-06/auditor.md; prototype: typist beats after 8 h 22-28 -> 40-45).
- [R6] [minor] Alert priority (only the newest alert draws); Codex progress line in Legacy; achievement progress counters; chests/wipes in the stat box.
- [R5] [minor] Demo card: hold floor 40 in a victory pose until dismissed; sprite teasers; move the DEMO pill to .hud-right.
- [R5] [minor] Progress display for counter achievements; chests/wipes in the stat box.
- [R4] [minor] Mouse-move events wake the main process ~650 Hz (uiohook); post-fest Raw Input or a fork that drops moves.
- [R4] [minor] Late-game number soup: rolling per-target totals above 1K/s; stacked floor labels on biome change; The Hollow sprite too small for a finale.
- [R1] [minor] Boss signature moves for the early bosses; second frames for Golem/Ember Colossus; real boss + capsule art (artist).
- [R1] [minor] Idle fallbacks for typing relics; Backspace Boots rework; repeated commons across offers.
- [R1] [minor] Compact HUD at size S; enemy outlines; pixel mute icon; rebindable hide hotkey; content-protection toggle; AppBar mode.

## Round history

| Round | Date | Headline changes | Commit |
|---|---|---|---|
| R0 | 2026-11-09 | Prototype v0.1 + playtest harness | 6e4709e, 2c070ea |
| R1 | 2026-11-09 | Record-based Renown, Embers, offline cap, ult rotation, Hollowed bosses, 30 fps cap + power/audio suspend, no network, calm mode, two-step relic pick | eedfe92 |
| R2 | 2026-11-09 | Ember Crucible, ult buff, compounding Fame, relic queue, charge bar, retire nudge, demo mode, fullscreen auto-hide, sleeping loop, CSS-animation GPU fix, hook off on pause | e4068a6 |
| R3 | 2026-11-09 | Demo re-delve loop + card, Delve Omens, Sanctuary reaction, ligature fix, file saves, per-monitor fullscreen, baked demo flag, 24 fps, bar transitions removed | 220510d |
| R4 | 2026-11-09 | Packaging + fuses, achievements, depth trophies, demo Renown cap, omen rebalance + modal, Vigil + void slam, low-GPU mode, save hardening | 40214c3, d42bbc9 |
| R5 | 2026-11-09 | Heal cap, Dynamo, Hollow Codex, War Charge + Reassemble, alert channel, Heart of the Keep, achievement fixes, demo cap 120, cross-build instance lock | 44379dd, 89f4651 |
| R6 | 2026-11-09 | Enrage keeps wounds + regroup, all six boss signature moves, Codex per 8 kills, Dynamo 10%, digit font, achievements open state, quiet first-hour retreats, handoff/save hardening | ce6b6d1, 3adcda5 + (this round) |
