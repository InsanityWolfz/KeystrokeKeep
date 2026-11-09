# Round 07: T3 "market" (Steam Market & Reviews Analyst)

## Verdict
**Every R6 part-3 fix that I could test passes**, on HEAD in the dev shell, on freshly rebuilt packaged builds, or in the headless sim:
- **Handoff:** one dialog even when the owner takes 3 s or 12 s to quit.
- **Pipe:** each Windows user gets their own.
- **Sprite gate:** exits 1 on blank sprites, in dev and in both packaged builds.
- **Battery test:** the bit test is correct.
- **Thumps:** the limiter cuts slam thumps to 18–46 per hour (from 33–126).
- **Wipe sound and banner:** at most one every 5 minutes.
- **Grace:** no knockout before minute 10.

The leftovers are small (F6):
- One race in the save path.
- The low-GPU migration takes effect one launch late.
- Volume 0.2 only applies to new saves.

**The new problem is volume.** The census below runs the real `fx.js` and `audio.js` on sim time. It shows the strip is never quiet and rarely still:
- **Sound:** a sound starts in 94–98% of all seconds.
- **Loud booms:** typists hear **190–380 per hour** from ultimates. That's 7–14 times the thump count the R6 limiter was built for.
- **Flashes and shakes (typist):** a full-strip flash every 14–17 s and a shake every 7–10 s.
- **Signature moves:** 25–63 alerts per hour, each blinking at 4 Hz.

That's fine for a game in a window you chose to look at. It's wrong for a strip that sits under your work for 8 hours. It's the "I had to mute it / it's distracting" review that this niche gets. I'd keep it running tomorrow, but muted and in calm mode. No refund.

**Rating: 8/10** (R6: 8.5). Shipping the caps below should bring it to 9.

## Findings (ranked, max 8)

### F1 [severity: major] The strip is never quiet: 17.6k–36.5k SFX an hour, and a sound starts in 94–98% of seconds, idle or typing
**Evidence:**
- `node docs/playtest/round-07/market_probe/census.js --min 480 --profile idle|typist --seed 1|6 --retire nudge --omen random` (full game), plus `--min 120 --demo`. Output is in `out/census_*.json`; the per-hour table comes from `table.js` (below).
- The census loads the **real `js/fx.js` and `js/audio.js`** into a sandbox on the sim's event bus.
  - `performance.now()` and `setTimeout` run on sim time, so every limiter is exercised.
  - A fake `AudioContext` counts only sounds that actually create nodes, i.e. after the limiters. It also records each sound's peak gain.
- **Total SFX per hour:**
  - Idle: 17.6k in hour 1, 27.5k in hours 7–8.
  - Typist: 25.1k in hour 1, **36.5k** in hours 7–8.
  - Demo: 17.6k–21.9k.
- **Seconds per hour with at least one sound starting:** 3,242–3,530 out of 3,600.
- **Where it comes from** (typist, hours 7–8): hit 9.7k, shoot 6.8k, crit 6.5k, coin 3.4k, hurt 3.1k, cast 3.1k, explode 2.9k, heal 0.9k, die 0.7k. That's about 97% of all SFX.
- **Loud sounds** (peak gain ≥0.1): **ultKnight** (80 Hz sine 0.18 plus noise 0.18) and **meteor** (noise 0.25 plus a 70 Hz sine 0.22), `audio.js:102,105`. Neither has a limiter.
  - Typist: **211/h** in hour 1 and **382/h** in hours 7–8.
  - Slam thumps, after the 8 s limiter: 28–31/h.
  - The R6 fix damped the 0.12 thump. The 0.18–0.25 booms now fire **7–14 times as often**.
- Sound is on by default, and `A.init()` runs on the first global keystroke (`input.js:47`).

**Why it matters:**
- The niche's classic negative review is about sound during calls and focus work: *"Cute, but I had to mute it after 10 minutes."*
- Low-frequency booms are what speakers carry into a call mic.
- A muted companion loses half its charm (the FLOW chord and the boss stinger). A strip that is noisy by default gets uninstalled.

**Proposed fix: an "event sounds only" default for the desktop build, about 1 h of work:**
1. **New setting "Combat sounds" (OFF by default in Electron, ON in the browser and in KK_CAPTURE).**
   - It gates hit, crit, shoot, cast, explode, hurt, die, heal and coin.
   - Expected: about 600–900 SFX/h instead of 17.6k–36.5k, and seconds with sound about 10–15% instead of 94–98%.
2. **Ult booms:** `limited('boom', 30000)` shared by ultKnight and meteor at full volume. Inside that window, play them at about 30% volume (gain 0.18/0.25 → 0.05/0.07). Expected: at most 120/h at full volume, typically about 40.
3. **A loudness budget in `A.play`:** at most one sound with peak ≥0.1 every 20 s, except bossIntro and bossKill.
4. Keep everything that tells a story at full volume: boss intro and kill, recruit, relic, chest, rat, FLOW (already once per 10 min), wipe (already once per 5 min), levelup milestone.

### F2 [severity: major] Visual interruptions are 5–20 times what a calm companion should do; calm mode is off by default and leaves banners, alerts, the blink and the vignette alone
**Measured, per hour, averaged over seeds 1 and 6** (`table.js`):

| Build / profile / hours | Alerts (sig. moves) | Big banners | Floor banners | Floor fades | Toasts (unsolicited) | Strong flashes (≥0.2 α, full strip) | Shakes (amp ≥2) | SFX | Loud SFX | Thumps | Ult booms | Gold pulses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| demo idle h1 | 27 (25) | 40 | 51 | 60 | 15 | 44 | 81 | 17,721 | 41 | 23 | 9 | 1,372 |
| demo idle h2 | 63 (63) | 132 | 125 | 155 | 31 | 133 | 193 | 18,372 | 85 | 41 | 10 | 4,700 |
| demo typist h1 | 63 (61) | 172 | 141 | 188 | 45 | 232 | 386 | 21,901 | 268 | 35 | 191 | 5,407 |
| demo typist h2 | 37 (37) | **273** | 272 | 357 | **62** | **324** | 394 | 17,605 | 275 | 10 | 192 | 12,222 |
| full idle h1 | 27 (25) | 40 | 52 | 61 | 21 | 44 | 81 | 17,594 | 42 | 23 | 10 | 1,376 |
| full idle h7–8 | 52 (51) | 56 | 75 | 97 | 11 | 72 | 118 | 27,451 | 59 | 31 | 9 | 4,633 |
| full typist h1 | 53 (51) | 132 | 112 | 146 | 40 | 210 | 365 | 25,052 | 266 | 28 | 211 | 4,862 |
| full typist h7–8 | 65 (63) | 71 | 96 | 127 | 13 | 258 | **495** | **36,521** | **437** | 28 | **382** | 6,373 |

**Biggest sources:**
- **Strong flashes** (typist, full game, hour 1): Meteor orange 0.22 (96/h; 149/h late), gold 0.25–0.45 from level milestones and FLOW (81/h), boss kill white 0.4 (22/h), boss spawn 0.5 (15/h), relic 0.35 (13/h).
- **Banners:** **hero level milestone banners are 65 of 134/h** in typist hour 1 ("SIR CLANK LV 20 ×2 DAMAGE!", each with a 0.25 flash and a shake), then VICTORY (13/h).
- **Demo re-delve loop:** typist hour 2 has 273 big banners/h, on screen **576 s/h (16% of the time)**. Recruit, JOINS and level banners replay every lap, about every 5 min.
- **On-screen time** (typist, full game, hours 7–8):
  - FLOW vignette pulsing: 2,066 s/h.
  - Shaking: 210 s/h.
  - Alert plate blinking: 85 s/h.
  - Boss white flicker: 35 s/h.

**Calm mode** (`--calm`, same seed):
- Removes all shakes, hitstop and slow-mo, and caps flashes at 0.06 α.
- Leaves alerts (80/h), big banners (71/h), sounds, the FLOW pulse and every 4 Hz blink unchanged.
- It's off by default (`state.js:22`).

**Why it matters:**
- The game's own design note says it "lives on screen all day" (`fx.js:104`). In the peripheral vision of someone reading a spreadsheet, a full-strip flash every 14 s and a shake every 7 s is what the "distracting" and "gave me a headache" reviews describe.
- The demo players at DCF and Next Fest are exactly the people who keep it open while working.

**Proposed caps** (default "Companion" mix; the current behaviour moves to an opt-in "Full juice", which KK_CAPTURE uses):

| Signal | Measured now (worst hour) | Cap / hour | How |
|---|---|---|---|
| Unsolicited toasts | 62 (demo typist h2), 40 (full h1) | **≤10 in hour 1, ≤6 after** | F5 |
| Big banners | 273 (demo), 134 (full) | **≤20** | Level-milestone banner → floating "LV 20" + pillar only, unless it's the first time that hero reaches that level ever. VICTORY only for a first kill of that boss in this run. Floor and biome banners unchanged. |
| Full-strip flashes ≥0.2 α | 324 / 258 | **≤12** | Only boss kill, trophy, first FLOW in 10 min, recruit. Meteor 0.22 → 0.08; milestone 0.25 → 0; boss spawn 0.5 → 0.25. A global `FX.flash` budget of one strong flash per 60 s. |
| Shakes | 495 | **≤30** | Only boss kill, a meteor that kills ≥2, and the first slam per fight. `FX.shake` no more than once per 10 s. |
| Alert plates (incl. signature moves) | 65 (63) | **≤20** | F3 |
| Loud SFX (peak ≥0.1) | 437 | **≤40** | F1 |
| All SFX | 36.5k | **≤900** (no combat SFX) | F1 |
| 4 Hz blinks (alerts, boss wind-up) | 85 + 35 s/h | **2 Hz, or a steady colour in calm** | `render.js:331` `t*8` → `t*4`; `render.js:518` the same |
| Gold HUD pulse | 12.2k | **≤1 per 2 s** | F7 |

Also make **calm mode ON by default in the Electron build**. Extend it to:
- No 4 Hz blink.
- A static (non-pulsing) FLOW vignette at half alpha.
- Banners on a quieter "minor" style except boss, biome, trophy and FLOW.

Offer "Full juice" as one toggle in Settings and in the first-run modal ("Polite mode: ON").

### F3 [severity: major] Signature-move alerts are per cast, not per fight: 25–63 an hour, one every 1–2 minutes all day late
**Evidence:**
- Same census; the "Alerts" column of the F2 table.
- Hour 1, typist, full game: WEB SHOT! 21, MAGMA SHELL 10, SQUEAK! RAT KING 6, WAR CHARGE! 5, SHELL CRACKED! 4, REASSEMBLES 3.
- Hours 7–8, typist: **VOID SLAM INCOMING 34, LAVA RAIN! 31**, MAGMA SHELL 6.
- Idle hours 7–8: VOID 25, LAVA 17, SHELL 6.
- Each alert is a black plate over the party with text that flips colour 8 times a second (`render.js:331`, 4 Hz). Alert plates are on screen 57–85 s/h.
- WEB SHOT! fires every 7 s in every Brood Mother fight (`world.js:472`). LAVA RAIN! fires every 8 s (`world.js:482`). Long Hollowed fights replay them a dozen times.
- The **in-world telegraphs** already exist and read well: lava marks (`fx.js:331`), the web projectile, the boss wind-up flicker. They make the plate redundant after the first time.

**Why it matters:**
- An alert exists to teach the move ("an ultimate cracks it"). The 10th "LAVA RAIN!" of a fight teaches nothing and still blinks over the party.
- The late game is exactly where week-2 players live. That's when the "nags me all day" review gets written.

**Proposed fix (20 min):**
- In `fx.js`, keep a `e.alerted = {}` per boss and show each move's plate **only the first time per fight**: `if (e.alerted[k]) return; e.alerted[k] = 1`.
- Show it at most once per 10 minutes per move type across fights (`lastAlert[k]`).
- Repeat casts keep their in-world FX and a small floating text if needed ("LAVA!", 0.8 s, no plate).
- VOID SLAM INCOMING: plate on the first slam per fight. After that, only the purple ring (already drawn at `fx.js:345`).
- Expected: signature alerts 25–63/h → about 6–12/h.
- Keep ENRAGED and REGROUPS as alerts. They're rare (0–1/h) and they explain a state change.

### F4 [severity: major] Idle demo hour 1: 6–10 wipes (R6: 12–16), none before minute 10, but the grace now ends in a cliff at minute 10–11
**Evidence:**
- `wipes_thumps.js --min 60 --profile idle --demo --retire nudge --omen random`, seeds 1/2/6 → **8 / 10 / 6 wipes**. R6, seeds 6/1/2: 16/12/16.
- Typist: 4 / 3 / 4.
- **First KO is at minute 10 in all 6 runs.** The first wipe is at **10–11 min in 6/6 runs**, e.g. `10m@f15 17m@f20 23m@f24 28m@f26 34m@f28 43m@f30 47m@f30 57m@f20`.
- Individual hero KOs in hour 1: 21–32 (idle).
- **Why the cliff:**
  - The grace (`world.js:160`) props heroes up at 1 HP, so the party overreaches (floor 14–16 at minute 10). Then every hit lands at once.
  - The camp after a normal-floor wipe lifts after **+4 hero levels in total** (`world.js:194`). The 60-second glance buys those within 1–2 minutes, so the party walks straight back into the same wall.
- **Prototype** (`proto_camp.js`, scratch, monkeypatched; no game file touched):

  | Variant | Idle wipes h1 (seeds 1/2/6) | First boss (min) | Typist wipes h1 (1/6) |
  |---|---|---|---|
  | HEAD | 8 / 10 / 6 (avg 8.0) | 6.3 / 6.9 / 7.8 | 4 / 4 |
  | A: camp until +4 levels **per hero** | 7 / 6 / 10 | same | – |
  | B: 3 grace saves on one normal floor → silent camp one floor below | 6 / 11 / 10 | 7.2 / 8.7 / 8.5 | – |
  | **A+B** | **3 / 5 / 4 (avg 4.0)** | 7.2 / 10.2 / 8.5 | **1 / 4** |

**Why it matters:**
- Fest players install the demo, start it, and go back to work: the idle profile.
- A burst of wipes right after the first boss is the first impression of the "not idle enough" review (Desktop Heroes' main complaint, R5/R6).
- The wipes are quieter now (banner and sound once per 5 min). That helps, but a "RETREAT" alert is still visible.

**Proposed fix (15 min; T1 to sanity-check pacing):**
- In `W.wipe`: `S.campLevels = sumLevels + 4 * partySize`.
- In `W.damageHero`: when the grace saves a hero (`h.hp` clamped to 1) for the 3rd time on the same normal floor, set the camp quietly (`campFloor = floor`, `campUntil = playTime + 480`, the same `campLevels`). No wipe, no alert.
- Gate: idle demo seeds 1/2/6, at most 4 wipes in hour 1 on average and none before minute 10. The prototype meets it: 4.0.

### F5 [severity: minor] Toast spam in the loops that fest players see: one every minute in the demo re-delve loop; relic toasts on every boss kill
**Evidence (census, the toast mirror of `ui.js:48,532–536,566–589`):**
- **Demo typist, hour 2: 62 unsolicited toasts/h.**
  - "The boss dropped a relic! Choose it in ◆ Relics…": **37/h**, one per boss kill.
  - "X can be recruited in ⚔ Party!": **14/h**, repeated every lap, because `ui.js:570` isn't a `once()`.
  - "Floor 40 cleared… The depths are sealed…": **11/h**, every lap.
  - Plus 72/h toasts the player triggered (recruit, relic acquired, retire).
- **Full game, hour 1:** 40/h for typists (achievements 15, relic 12, recruitable 8).
- **Late:** 11–13/h (relic 10–11).

**Why it matters:** toasts pop up above the strip, over the user's work area (`placeToasts`). Toasts are the "notifications" in "too many notifications".

**Proposed fix (10 min):**
- **Relic toast:** only when the queue goes from 0 to 1, and at most once per 15 min. The badge already shows the count.
- **Recruitable toast:** `once('recruitHint_' + id)` per save.
- **Demo sealed:** only on a new best time, or on the first 3 laps.
- **Achievement toasts in hour 1:** merge achievements that unlock within 10 s into one toast ("🏆 3 achievements").

Expected: demo typist hour 2: 62 → about 8/h; full game hour 1: 40 → about 12/h.

### F6 [severity: minor] R6 part-3 leftovers: one save race, a late migration, volume only for new saves, and the pipe-name charset
**Evidence (R7 probe, `%APPDATA%\kk-market-probe-r7`):**
1. **`kk:saveSync` doesn't bump `saveGen`.**
   - The R6 race replayed on HEAD: async 301 hits a 250 ms lock, then saveSync 302 → **301 ends on disk** (sync returned false; the pending retry won). `out/save_async-stale.json`.
   - In the **real quit order** (before-quit `flushSave` bumps the generation, then the beforeunload saveSync): **newest kept** (402). Generations go 1 → 2 → 2. `out/save_async-stale-quit.json`.
   - So it's not reachable on a normal quit, but the fix is one line: `ipcMain.on('kk:saveSync', …) { saveGen++; … }`.
2. **The low-GPU migration lands one launch late.**
   - Laptop proxy (`KK_FAKEBATT=1`), an old save with `lowGpu: true` and no `lowGpuMigrated`:
     - Boot 1: the main process still appends `disable-direct-composition` (switch **on**). The renderer migrates the save to `'auto'`.
     - Boot 2: switch **off**. Correct from then on.
   - `main.js:390` reads the raw value before the renderer migrates it. Fix: `if (v === true && !s.settings.lowGpuMigrated) pref = 'auto'`.
   - Other cases: a player-chosen ON (`lowGpuMigrated: true`) stays on (correct). `auto`/missing → off on the laptop proxy, on on the desktop. `false` → off. 20/20 runs as expected (`out/r7_*.json`).
3. **Default volume 0.2: PASS for new saves only.**
   - Fresh probe saves load with `volume: 0.2`.
   - Existing saves keep their stored value: the user's real save reads `volume: 0.3, lowGpu: true` (read-only check; md5 unchanged).
   - Fix: a one-time `volumeMigrated` that sets 0.3 → 0.2, next to the lowGpu migration.
4. **Pipe name:** `[^A-Za-z0-9_-]` → `_`, so "José" and "Josè" both become `keystroke-keep-Jos_`. That's rare. Using a hex of the username (`Buffer.from(name).toString('hex')`) or the session ID would avoid it.

### F7 [severity: minor, hypothesis] The gold counter's CSS pulse restarts 1.4k–12.2k times an hour, so for typists it's animating most of the time
**Evidence:**
- `ui.js:47` restarts the `.pulse` 0.25 s scale animation (`style.css:140`) on every coin arrival.
- Census `coinArrive`: 1,372/h idle in hour 1, 4.6k–6.4k/h late, **12.2k/h** in demo typist hour 2. That's 0.4–3.4 restarts a second, i.e. a pulse running 10–85% of the time.
- `style.css:381` itself notes that CSS animations force the window to recomposite at the monitor's refresh rate. That's the R2 GPU-drain finding.
- **Not measured this round** (no perf pass). It may be part of the typing-time CPU/GPU numbers.

**Fix (2 min):** pulse at most once per 2 s (`if (now - lastPulse > 2000)`), or swap it for a canvas-drawn glint. Re-measure with the R6 perf probe.

### F8 [severity: blocker, owner: user] Calendar and store facts as of Nov 9 (re-checked today)
- **Desktop Companion Fest (Jan 14–18):** the Steamworks page still errors. The upcoming-events page lists the dates and the theme ("games that sit on your desktop and keep you company").
  - The R6 estimate of about Dec 3 for opt-in (6 weeks before) stands.
  - App ID + tags still need to be in place by about Dec 1.
- **"Desktop Companion" is a real Steam tag.** Keyboard Hero (app 4401110) carries it, still Coming Soon, F2P, with a demo and no reviews yet. Its tags: Casual, Incremental, Typing, Pixel Graphics, 2D, Artificial Intelligence, … Desktop Companion (last).
- **Tags:** Valve: "we recommend you add up to 20"; "only the top 20 are visible"; "Some store filters prioritize the first 15 tags".
- **Capsule text:** base capsules may only carry "game artwork, the game name, and any official subtitle". No review scores, awards, calls to action or "other miscellaneous text"; event text only via 14-day localized Artwork Overrides.
  - **So the capsule taglines below must not go on capsule art.** Use them as the first line of the short description, the trailer end card, event-post headers and social posts.
- **Short description:** Valve's doc says "a few hundred characters". Third-party guides say the editor enforces 300. Draft v2 below is 277.
- **Next Fest Feb 2027:** registration closes Jan 10, 11:59 pm PST. Valve's page is unchanged since R6.

## Verified fixes from last round (pass/fail, one line each)
- **Handoff, slow-quit double dialog:** PASS.
  - Owner busy 3 s in before-quit: **1 dialog**. The demo relaunched 0.10 s after the full game exited.
  - Owner busy 12 s (beyond the 10 s loop): still **1 dialog**. The requester relaunched 1.1 s after the exit, because each probe connect blocks while the pipe is busy.
  - Baseline: 1 dialog, full game exits 0.17 s after Close.
  - Logs: `out/instance_log.jsonl`, `out/instance_log_slow12.jsonl`.
- **Per-user pipe:** PASS. Pipe `\\.\pipe\keystroke-keep-SHAUN`. Two simulated users (`os.userInfo` override + separate profiles): "alice" and "bob" own `keystroke-keep-alice` / `-bob`, Bob starts with **no dialog**, both strips are visible. (Simulated; no second real account.)
- **Stale save retry dropped:** PASS on the real quit order (402 kept). The raw R6 sequence still loses to the retry (F6.1).
- **Sprite gate exit code:** PASS.
  - Dev: ok → exit 0 (143 px), blanked knight → **exit 1**.
  - **Packaged full and demo, rebuilt 14:37 from HEAD:** auto → 0, blank → **1**.
  - The asar `main.js` contains the per-user pipe, `saveGen`, `app.exit(px > 0 ? 0 : 1)` and the battery bit test.
- **lowGpu migration of old saves:** PASS, one launch late on laptops (F6.2).
- **Battery bit test:** PASS. This PC reports `BatteryFlag 128` → no battery → low-GPU on.
  - The truth table is right for 0 (33–66%, no bits), 1, 2, 4, 8, 9, 10 → battery; 128, 255 → none; 136 → none (an equality test would get this one wrong).
- **Thump rate limit (8 s):** PASS. Raw triggers (bossSlam + warCharge + first 3 voidSlams) vs played:
  - Idle: 33–126/h → 18–46/h.
  - Typist: 50–109/h → 22–44/h.
  - In the full census, the thump plays 23–41/h. (But see F1: the booms are louder and more frequent.)
- **Wipe sound/banner limit (5 min):** PASS. Idle hour 1, seed 6: 6 wipes → 4 wipe sounds and 4 RETREAT! banners; the other 2 are quiet "RETREAT" alerts.
- **Default volume 0.2:** PASS for new saves; existing saves keep 0.3 (F6.3).
- **Onboarding grace (no KO before the first boss or 10 min):** PASS. First KO at minute 10 in 6/6 runs. The cliff right after it is F4.
- **Real save folders:** untouched. md5 of `%APPDATA%\Keystroke Keep\saves\keystroke-keep.json` is `d680a06b…b533` before and after. All runs used `kk-market-probe-r7*` or `-selftest` profiles. I did not run real packaged launches this round, so no backup/restore was needed.

## Store page copy v2 (claims checked against HEAD)
**Rules I kept to:**
- No Steam Cloud and no "Steam achievements" claims until Steamworks is integrated. Those lines are marked **[after Steamworks]**.
- No "relaxing" or "quiet" claim until F1–F3 land. Marked **[after caps]**.
- Footprint numbers are from the R6 measurements (desktop, low-GPU mode).

### Short description (277 chars)
> A tiny party of pixel heroes delves a dungeon in a strip at the bottom of your screen. They fight on their own; every key you type and every click charges their ultimates. Idle when you're away, unstoppable when you're in the flow. Counts keys, never records them. No internet.

### Capsule / end-card taglines (not for capsule art: Valve allows only artwork + name + subtitle)
1. **Your work is their adventure.**
2. **Type. They fight. Nobody gets distracted.** [after caps]
3. **A whole dungeon, one strip tall.**

### About This Game: bullet list (first block, above the fold)
- **Lives under your work.** A frameless strip docks at the bottom of any monitor and never steals focus. Click it to manage, or forget it's there.
- **Your typing is their fuel.** Every keystroke and click becomes a Spark. Sparks fire ultimates: Earthshatter, Arrow Storm, Meteor, Sanctuary. Keep typing and the dungeon lights up into FLOW STATE (up to x2.2 power).
- **Fully idle when you're not.** The party delves, levels and earns on its own, and keeps earning while the PC is asleep (up to 12 hours). Typing makes it faster, never required.
- **Four heroes, seven bosses, six signature moves.** The Rat King summons, the Bone King pulls himself back together, the Brood Mother webs your healer, the Goblin Warlord charges the line, the Ember Colossus hardens its shell, the Magma Lord rains lava, and The Hollow slams with the void.
- **Retire for Renown, delve again faster.** A Hall of Legends, Delve Omens that twist every run, 17 relics, a Forge and a Workshop.
- **Deeper than it looks.** Four biomes, floor 100 and the Heart of the Keep, Hollowed bosses beyond it, a 28-rank Hollow Codex, 14 depth trophies and 36 achievements ([after Steamworks]: Steam achievements).
- **Counts, never records.** Only "a key was pressed" or "a click happened" reaches the game. No key is stored, logged or sent. No account, and no network access at all. Pause counting from the tray at any time.
- **Polite by design.** Hides itself behind fullscreen video and games, pauses when locked or hidden, hide hotkey Ctrl+Shift+Alt+K, calm mode, S/M/L sizes, pick your monitor.

### Long description (section headers for About This Game)
**YOUR WORK IS THEIR ADVENTURE**
Sir Clank, Wren, Mortimer and Sister Pell live in a strip at the bottom of your screen. While you write, code, design or answer email, they fight their way down through the Crypt, the Mossy Caverns, the Magma Depths and the Hollow Void. You don't play Keystroke Keep so much as keep it company.

**EVERY KEY COUNTS**
Each keystroke and click becomes a Spark. A hero with enough Sparks unleashes an ultimate: the Knight shatters the ground, the Archer calls an arrow storm, the Mage drops a meteor, the Cleric raises the fallen. Type for a while and the party heats up from Focused to In the Zone to FLOW STATE.

**AND WHEN YOU STOP, THEY DON'T**
Lunch break? Meeting? The party keeps delving on its own and earns gold while you're away. Come back, spend it in a few clicks, and get back to work.

**BOSSES WITH A TRICK**
Every tenth floor holds a boss with its own signature move, and each can be beaten by brute force or by timing your ultimates. Too strong for now? The party retreats, keeps the wounds it dealt, and comes back stronger.

**RETIRE, RETURN, GO DEEPER**
When the climb slows, retire your party for Renown and spend it in the Hall of Legends. Pick a Delve Omen to twist the next run. Collect relics from bosses. Past floor 100 the bosses return Hollowed, and the Hollow Codex rewards every one you put down.

**BUILT TO RUN ALL DAY**
- Hides automatically behind fullscreen apps, video and games; pauses when the screen is locked or the strip is hidden.
- Measured on a desktop in its default low-GPU mode: about 0% GPU and about 200 MB of RAM while you type.
- One strip per PC; choose the monitor and the size.
- Calm mode turns off shake and flashes. [after caps: "Polite mode is on by default."]

**IS THIS A KEYLOGGER?**
No. Keystroke Keep uses a global input hook only to count. The game receives the word "key" or "click", nothing else. Key codes are used only in memory to ignore auto-repeat; they are never stored, logged or sent. The game blocks all network access. You can pause counting from the tray, which removes the hook entirely.

**TRY THE DEMO**
The free demo covers floors 1–40 (the Crypt and the Mossy Caverns, four bosses, five achievements). Your demo save carries over to the full game.

**Price line (store/press):** $4.99, a one-time purchase. No ads, no microtransactions, no account.

### 20 tags, in order
1. Desktop Companion
2. Idler
3. Incremental
4. Pixel Graphics
5. Dungeon Crawler
6. Typing
7. RPG
8. Party-Based RPG
9. Casual
10. Clicker
11. Fantasy
12. 2D
13. Singleplayer
14. Loot
15. Relaxing [move to 9 after caps; drop it if F1–F3 don't land]
16. Retro
17. Cute
18. Colorful
19. Family Friendly
20. Indie

Notes:
- The first 5 say what it is. "Some store filters prioritize the first 15 tags."
- Typing at 6 shares Keyboard Hero's search space. Their F2P and Artificial Intelligence tags are the contrast.
- No "Auto Battler" tag: on Steam it means TFT-likes. No "Roguelite" tag: it would invite the wrong expectations.

## KK_CAPTURE mode spec (for the lead)
**Goal:** record store screenshots, GIFs and the trailer from the **real Electron strip over a real desktop**, reproducibly, at 60 fps, with no dev UI and without touching any player save.

### Flags (environment variables; no UI, never active unless set)

| Flag | Default | Behaviour |
|---|---|---|
| `KK_CAPTURE=1` | off | Enables capture mode. Uses its own profile: `app.setPath('userData', … + '-capture')` and saves in `%APPDATA%\Keystroke Keep Capture\saves`, the same pattern as `-selftest`. Never imports the demo save. Never writes outside that folder. |
| `KK_CAPTURE_SAVE=<file.json>` | none | Staged save copied into the capture profile at boot (and on `reset` cues). Stored next to the cue file in `tools/capture/`. |
| `KK_CAPTURE_SCRIPT=<cues.json>` | none | Timeline of cues (below). Starts after the boot fade. |
| `KK_CAPTURE_FPS=60` | 60 | Fixed frame rate. Ignores battery, idle and low-input drops (`main.js:32–37`). Low-GPU forced OFF unless `KK_LOWGPU=1`. |
| `KK_CAPTURE_SEED=<n>` | 1 | Seeds `Math.random` in the renderer (mulberry32, as in `tools/headless.js`) so takes repeat frame for frame. |
| `KK_CAPTURE_SIZE=S\|M\|L` | L | Strip size. |
| `KK_CAPTURE_DISPLAY=<index>` | primary | Monitor to dock on. |
| `KK_CAPTURE_JUICE=full\|companion` | full | Which FX/SFX mix to record (after F1/F2 land). The trailer uses full; the "it's calm" GIF uses companion. |
| `KK_CAPTURE_AUDIO=sfx\|music\|both\|off` | sfx | Volume forced to 0.6 for a clean trailer mix. |
| `KK_CAPTURE_TOASTS=0\|1` | 0 | 0 = no tutorial, offline, store-link or achievement toasts; only cue-requested toasts. |
| `KK_CAPTURE_DUMP=<dir>` | none | Optional lossless strip-only frames via `webContents.beginFrameSubscription` → PNG sequence with alpha (for pixel-perfect GIFs). Off by default (CPU heavy). |
| `KK_CAPTURE_BG=#rrggbb` | transparent | Makes the window opaque in that colour, for chroma or flat GIF backgrounds. |

**Always in capture mode:**
- The welcome modal is skipped and `tutorial` is all done.
- The fullscreen auto-hide is OFF (OBS and editors shouldn't hide the strip).
- Always on top.
- The hide hotkey still works.
- The real input hook stays on, so real typing drives shot G1.
- No tray "Open dev tools" item.
- The DEMO pill only appears if `KK_DEMO=1`.

**Hotkeys** (registered only in capture mode; Ctrl+Shift+Alt+digit, so they don't type into the editor being filmed):
- 1: autotype on/off (about 5.5 keys/s bursts, `input.js:53`).
- 2: warp 1x / 5x / 20x.
- 3: fill Sparks.
- 4: +5 floors (the `ui.js:651` handler without its "DEV SKIP" banner).
- 5: jump to the next boss floor −1.
- 6: spawn the golden rat.
- 7: force FLOW (fervor to tier 3).
- 8: pause/resume the sim (freeze frame for screenshots).
- 9: toggle the panel (Party / Relics / Legacy) for UI shots.
- 0: replay the cue script from the start (reload the staged save).

### Cue script format (`tools/capture/<shot>.json`)
```json
{ "save": "f19_party.json", "seed": 7, "cues": [
  { "t": 0,   "do": "warp", "v": 20 },
  { "t": 0,   "do": "floor", "v": 19 },
  { "t": 4,   "do": "warp", "v": 1 },
  { "t": 4.5, "do": "sparks", "v": "full" },
  { "t": 6,   "do": "autotype", "v": true },
  { "t": 20,  "do": "mark", "v": "CUT" }
] }
```
Ops:
- `warp`, `floor` (sets floor, clears the wave), `sparks` (`full` or n), `autotype`, `flow`, `rat`, `relicOffer` (rolls an offer), `openPanel` (`party` / `relics` / `legacy` / `settings`), `pickRelic` (index), `retire`, `omen` (id), `size`, `juice`, `pause`, `js` (escape hatch: renderer JS for odd setups), `mark` (writes a timestamped line to stdout so the editor can find cut points).

A staged-save maker, `tools/capture/make-save.js --floor 19 --levels 40,35,30,20 --relics 3 --renown 0 --out f19_party.json`, builds saves with the headless sim (`KK.S` → JSON) so nobody grinds for a shot.

### Recording script per shot
**Setup:**
- OBS at 1920×1080, 60 fps, CQP 16. Window capture of the editor, plus a second "Window capture" source of the strip window, or a display capture cropped to the bottom 260 px for GIFs.
- A real, clean desktop: no notifications, taskbar auto-hide on, a neutral wallpaper.

**Screenshots** (gameplay only, ≥1920×1080):

| # | Save / cues | Action | Capture |
|---|---|---|---|
| S1 the hook | `f12_party.json`; autotype on at t0; `flow` at t8 | Full-screen VS Code with real code on screen; the strip at L under it, in FLOW | Pause (hotkey 8) right after the "FLOW STATE! x2.x POWER" banner; full-screen still |
| S2 boss kill | `f19_party.json`, warp 20 → 1 at floor 20 | Bone King fight; ult at 30% HP | Pause on the VICTORY frame (coin shower) |
| S3 relic offer | `f29_party.json`; `relicOffer`, `openPanel relics` | Three cards over a spreadsheet | Still |
| S4 Delve Omen | `retire_ready.json`; `retire` | Omen cards (▲/▼) | Still |
| S5 Legacy | same; after the omen pick, `openPanel legacy` | "A NEW GENERATION RISES" + the Hall of Legends | Still |
| S6 The Hollow | `f79_hollowed.json`, warp 1 | Void slam warning + Sanctuary | Pause on the purple ring with the party standing |
| S7 floor 100 | `f99.json`; boss kill | "HEART OF THE KEEP" banner | Still |
| S8 sizes / multi-monitor | `f40.json`; `size S/M/L` | Three stills composed side by side, or the strip on monitor 2 next to work | 3 stills |

**GIFs** (≤3 MB each; MP4/WebM where the page allows; strip crop 1920×260 → 960×130 at 30 fps):

| # | Save / cues | Length | Notes |
|---|---|---|---|
| G1 type → FLOW → Meteor | `f12_party.json`, seed 7: real typing for 6 s (the hook is on), then `sparks full` at t5; Mortimer casts at t6 | 6–8 s | First GIF on the page. Record with juice `full`. |
| G2 War Charge | `f39_party.json` → floor 40 | 5 s | Telegraph → shove → ult → Warlord falls (the demo's last boss) |
| G3 fullscreen hide | any; play a fullscreen video, then alt-tab | 5 s | Display capture of the whole screen: the strip vanishes and returns. **Must run with the auto-hide ON**, so add the cue `{ "do": "js", "v": "kkNative.setFsHide(true)" }` or a flag override |
| G4 golden rat | `f15_party.json`; `rat` | 3 s | Click → coin shower |
| G5 calm proof | `f60_party.json`, juice `companion`, autotype on | 8 s | Strip next to a spreadsheet: shows what the default looks like (after F1–F3) |

**Trailer (30 s, R5 shot list):** record each beat as its own cue file (`trailer_01_hook.json` … `trailer_08_endcard.json`) with `mark` cues at cut points. Captions are burned in later (readable on mute). End card: tagline 1 + "Wishlist on Steam" (fine in a trailer, not on capsules).

## Ideas (optional, max 3)
1. **"Polite mode" as the first-run question:**
   - "Keep it calm while I work (recommended)" = companion mix + calm.
   - "Full juice" = today's mix.

   It answers F1–F3's review risk before anyone writes it. The page bullet becomes true ("Polite by design").
2. **A "highlights only" sound pack:** about 12 distinct sounds an hour (boss intro and kill, FLOW, relic, recruit, rat, trophy). That makes the strip feel like a companion that speaks up when something happens, not a game running in the background. Pair it with a soft ambient bed under the music toggle.
3. **DCF event post hook:** "Desktop Companion Fest patch: polite by default." Ship F1–F5 as the visible demo patch for Jan 14. It's a news beat that answers the niche's #1 and #2 complaints (idle deaths, noise) on our own page.

## Measurement notes
**Scripts** (all in `docs/playtest/round-07/market_probe/`):
- `census.js`: the real fx.js + audio.js on sim time; counts per hour.
- `breakdown.js`, `table.js`.
- `wipes_thumps.js`: hour-1 wipes/KOs, raw vs limited thumps.
- `proto_camp.js`: F4 prototype, scratch.
- `probe.js`: the R6 probe patched by `patch_probe.js`. Adds `KK_FAKEUSER`, `KK_UD`, `KK_FAKEBATT`, `KK_WINWAIT`, and the scenarios `async-stale-quit`, `lowgpu-legacy-true`, `lowgpu-chosen-true`; `relaunch` now records the settings.
- `run_saves.sh`, `run_instances.sh`, `packaged_gate.ps1`. Outputs are in `out/`.

**What the census counts:**
- Toasts mirror `ui.js` triggers. ui.js itself is DOM-bound.
- "Strong flash" = an `FX.flash` with effective α ≥0.2 (after the calm cap). "Shake" = amp ≥2 with calm off. "Loud SFX" = a sound whose loudest component has gain ≥0.1.

**Limits:**
- Sim profiles, not humans. The 60-second glance buys and picks relics, so "player toasts" are an upper bound.
- `FX.timeScale` (hitstop / slow-mo) doesn't slow the headless sim, so there are slightly more events than real play (under 1%).
- Gold pulses assume every coin reaches the HUD, as in the real game.

**Packaged builds:** rebuilt with `npm run dist` / `npm run dist:demo` at 14:37 from HEAD 4eb20cb (plus the lead's `index.html` bump). Only the self-test gate ran against them.

**Real `%APPDATA%` save:** read once, read-only (settings check). md5 unchanged.

**Hardware:** one desktop (i9-13900K, RTX 3080, 3 monitors). Battery cases were simulated (`KK_FAKEBATT`). The multi-user case was simulated (`os.userInfo` override + separate profiles).

## Sources
- Steamworks graphical asset rules (capsule text limits, Artwork Overrides 14 days, localized): https://partner.steamgames.com/doc/store/assets/rules
- Steamworks tags ("up to 20", "only the top 20 are visible", "first 15 tags" for filters): https://partner.steamgames.com/doc/store/tags
- Steamworks description doc (short description "a few hundred characters"): https://partner.steamgames.com/doc/store/page/description
- 300-char short-description limit (third-party, unverified): https://www.steampageanalyzer.com/blog/steam-short-description-guide
- Upcoming events (DCF Jan 14–18, theme): https://partner.steamgames.com/doc/marketing/upcoming_events
- DCF 2027 page (still errors on fetch): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/desktop_companion_2027
- Next Fest Feb 2027 (registration Jan 10): https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- Keyboard Hero (Coming Soon, F2P, demo, tags incl. Desktop Companion and Artificial Intelligence): https://store.steampowered.com/app/4401110
- Capsule rule coverage: https://www.pcgamesn.com/steam/game-art-new-rules-valve ; https://gamedeveloper.com/marketing/valve-to-stop-devs-from-including-accolades-and-marketing-copy-on-steam-graphics
