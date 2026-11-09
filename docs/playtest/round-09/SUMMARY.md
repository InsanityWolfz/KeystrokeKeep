# Round 09: Summary

| Tester | R7 | R8 | R9 |
|---|---|---|---|
| Economist | 8 / 7.5 | 8 / 7.5 | **8 / demo 8** |
| Auditor | 7.5 | 8 | **8 (8.5 after F1, F2, F5)** |
| Market | 8 | 8.5 | **8.5** |
| Player | 7 / 8 | demo 7 / full 8 | **demo 8 / full 8** |

Built before testing: **achievement progress counters** (e36437d), the R8 auditor's F5. 21 counter achievements show a bar and "cur/goal", and the Legacy summary shows a NEXT line.

## Headline findings
- **Content shape (economist F2 + auditor F4):** this is the launch risk now.
  - A typist sees every biome and boss within 2.1–2.8 h, inside the refund window.
  - After hour 8, 97% of play is in the Hollow Void with the same 3 monsters.
  - Days 2–7 bring no new boss.
  - The auditor scoped a fix: **Biome 5 "The Heartroot" (f101–150) plus "Echoed Depths" (f151+)**, about 2 days of code plus art.
- **Seal of the Day was still farmable with the clock:** 31–37 Seals in 8 hours.
- **Glimpse staging:**
  - The party still walked through the statue.
  - A wipe on the sealed floor left `S.glimpse` set, so the HUD said "Stuck? Retire" while retiring was blocked.
- **The Rat King skipped his move on 57–75% of typist demo laps:** one-shot kills from above 60% HP.
- **The Heart of the Keep (f100 finale)** was the Hollow sprite renamed, and the trophy banner stole its title. Its capstone achievement could be swallowed by the toast cap.
- **Market:**
  - The strip flashed on the primary monitor at every launch before docking on the saved one. This also explains the R8 incident.
  - Capture takes weren't reproducible: the same seed gave different relic cards.
  - The daily banner read "? SEAL OF THE DAY".
  - Typists still saw 28–46 big banners an hour.
  - The FLOW outline still pulsed in Calm mode.

## Fixed this round
- **Part 1, auditor** (847e0d4):
  - Glimpse monsters spawn short of the statue, the door sits before it, and the party stops at the door.
  - The Rat King can't be one-shot before his first summons.
  - The demo shows full-game achievements already earned ("unlock when you buy").
  - Counters past their goal unlock on sight; the Heart counter caps at 99/100.
  - Recruiter: veterans rejoin each delve.
  - The Echo Rune has a cue, and the Lantern's NEW chip clears.
- **Part 2, economist** (7fc2f20):
  - A Seal needs a new calendar day **and** an hour of play since the last one. Earlier dates are ignored.
  - A Seal is claimable under any omen; the starred omen doubles it.
  - Hollowed rotation grows one boss per day played.
  - The Codex goes to 40 ranks (16 kills per rank past 28).
  - Trophies go to floor 300.
  - Quartermaster buys the whole Forge.
  - The "Stuck? Retire" hint doesn't fire at the floor-40 door.
  - The offline toast says what the gold buys and holds the retire nudge.
  - Dynamo and the Lantern are tagged "for idle parties".
- **Part 3, player** (e1046e5):
  - The Heart is red-tinted with a pulsing core, and its own banner is kept.
  - 7 capstone achievements always toast.
  - A wipe on the Glimpse ends it and shows the demo card.
  - Legacy order: retire box, then shop, then Codex, then achievements.
  - "Living Legend" rename.
  - The Centenarian counter never goes backwards; goals read 1K/10K/1h.
  - Live retire number, scroll reset per tab, statue label clamp, demo pill hidden during the Glimpse.
- **Part 4, market** (2c6e43d + this commit):
  - **No launch flash:** main reads the saved monitor before creating the window, and the first show waits for the renderer's settings (2 s max).
  - `KK_CAPTURE_DISPLAY=secondary|<id>`.
  - Retail builds ignore `KK_*` flags unless started with `--kk-dev`.
  - **Frame-locked capture clock:** `performance.now` and `dt` advance 1/fps per frame, and cues, await timeouts and autotype run on frames. A timed-out await prints a MARK. `KK.on` returns an unsubscribe.
  - The tester's event-anchored G2 and G5 scripts are adopted, and every shot runs with `KK_CAPTURE_DISPLAY=secondary`.
  - ★ glyph in the bitmap font, with a warning for missing glyphs.
  - Boss, biome and JOINS banners are big only the first time in a save. LV banners are big only for a new best (and past Lv 20, only every 50).
  - Calm mode: the FLOW outline and tier label are steady.
  - HUD plate behind the floor line, brighter biome label, and a shadow on the embers.
  - The welcome card says where the app lives, how to hide it, and that it never goes online.
  - The Heart fits the strip (about 1.5×, top at y 8).

## Verified
- **Sims:**
  - Typist seed 3: f88 in 2 h, 16/39 achievements.
  - Idle seed 2: maxEver 50.
  - Demo typist: the Glimpse plays, then demoComplete.
- **Glimpse wipe:** recover() sets floor 36, ends the glimpse and shows the card once. canRetire is false, so the hint stays hidden.
- **Browser** (127.0.0.1:5173, `?v=r10`):
  - The ★ banner draws with no glyph warnings.
  - The second banner with the same `first` key is minor.
  - `KK.on` returns a function.
  - The HUD plate and biome colour are applied, and the `kk-calm` class toggles.
  - Legacy order is shop (1455) < Codex (9747) < achievements (10544).
  - At f100 the Heart is fully inside the strip, red, and its Void Slam telegraph reads.
- **Not verified on this PC:** the launch-flash fix and the frame-locked capture both need the Electron shell on a second monitor. The R10 market tester re-runs them with the safe launcher.

## Market tester's final pass (after part 4)
- **Verified in the Electron shell (safe launcher, side monitors):**
  - Launch flash fixed: the strip docks on the saved monitor at 0.33 s and shows at 0.39 s. Before, it showed on the primary at 0.31 s.
  - `KK_CAPTURE_DISPLAY` works.
  - ★ glyph, steady Calm FLOW, HUD plate, welcome line, `KK.on` unsubscribe and the await timeout MARK all pass.
  - Big banners are down to 1–14 an hour. The exception is typists' hour 1 at 20–26, and all of it is first-ever content.
- **Regressions caused by part 4, fixed in part 5:**
  - **Capture ran about 3.3× fast (193–207 fps).** The overridden `performance.now` also paced the loop. The loop now paces on the real clock (`KK.realNow`, `KK.realSetTimeout`).
  - **Takes still drifted,** because game timers ran on wall-clock time. In capture mode every `setTimeout` now runs on frames.
  - **The adopted G2/G5 scripts timed out on `await bossSpawn` right after `wave`.** `await` now resolves if the event fired this frame, G2 uses the tester's `g2_v9b`, and G5 drops that await.
  - **The README** recommends a display id over `secondary`, because the first non-primary monitor may be the one the user works on.
- **Not run here:** the part-5 pacing fix needs the Electron shell. **R10 market gate:** capture at 59–61 real fps, and 3/3 identical state digests for S3 and G5.
- **Still open:**
  - Demo typist hour-2 alerts are 21/h (cap 20).
  - Hour-1 toasts are 12–13 (cap 10); counting recruit hints as tutorial makes it 9–10.
  - Default size is S on 1080p.
  - Chromium cache in Roaming.
  - No in-game version.
  - The packaged `dist/full` predates part 4 and needs a rebuild before any recording.

## Market tester: desktop incidents (relayed to the user)
The tester's safe launcher never showed a window on the primary display. Before its guards were complete there were two short incidents:
- **About 20:42 UTC:** a bare `electron.exe` start may have shown a default window or dialog on the primary display for about 60 s.
- **About 20:44–20:45 UTC:** a launcher syntax error likely showed Electron's error dialog for about 46 s.

No input was injected. The real save is unchanged (md5 `d680a06b…b533`).

18 tester profile folders (`kk-market-*`, `Keystroke Keep-capture`/`-selftest*`, about 8 MB each) remain in `%APPDATA%`. They're safe to delete; that needs the user.

## Carried to the backlog
- **[major, launch] Biome 5 "The Heartroot" + Echoed Depths.** Full spec in auditor.md F4. Candidate to build before R10's testing.
- **[major, store] Store copy v2 corrections** (auditor F3): 39 achievements, trophies to 300, FLOW multiplier, Hollowed from f80, Codex 40.
- **[minor] HUD font scale with S/M/L, and `auto` → M on ≥1440p** (market F7).
- **[minor] Cosmetic RNG on its own stream** (market F2b). Only if the frame-locked timers aren't enough in R10.
- **[minor] Recruit hints count as tutorial toasts; move-alert gate 15 min** (both about 1 over their caps).
- **[P2] Trust items:**
  - Chromium cache to `%LOCALAPPDATA%`.
  - "Delete my data" button.
  - In-game version and credits.
  - "Start with Windows" toggle.
- **[user] New dates:**
  - Public trailer plus Coming Soon page by about **Dec 1–3** for Desktop Companion Fest marketing.
  - Next Fest: trailer pull Jan 18; press preview and trailer opt-out Feb 11; fest Feb 22 – Mar 1 at 10 am PST.
  - Code signing: individual Azure signing is US/Canada only, otherwise an OV certificate.
