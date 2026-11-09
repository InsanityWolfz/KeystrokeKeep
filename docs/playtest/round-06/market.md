# Round 06 — T3 "market" (Steam Market & Reviews Analyst)

## Verdict
**The R5 blocker is fixed: the party is on screen in low-GPU mode on the dev shell and on both packaged builds.**
- All 48 sprite frames, 144 tints and 25 icons are intact; in R5 all 48 frames were blank.
- `lowGpu: 'auto'` correctly picks low-GPU on this battery-less desktop.
- The demo and the full game now have separate profiles. The "close the other one" dialog works on the real packaged builds in both directions.
- The new fullscreen rule passes **30 of 30** cases on 3 monitors.
- The new save behaviours work: newer `.tmp` wins, the marker is written after the first own save, and async retries no longer block.
- `willReadFrequently` costs nothing measurable (same-session A/B).

What's left is mostly small and cheap:
- The self-test gate prints FAILED but exits 0.
- The cross-build handoff can show its dialog twice.
- An async retry can overwrite a newer save.

The two things that now matter most for reviews and wishlists are:
- **The calendar.** Steamworks tax verification can take up to 30 days, and Desktop Companion Fest registration is about 6 weeks before Jan 14. The user has to start onboarding this week.
- **The idle demo's first hour:** 12–16 party wipes, the first at minute 2.

I'd keep it running tomorrow and wouldn't refund. **Rating: 8.5/10** (R5: 6/10 as shipped).

## Findings (ranked, max 8)

### F1 [severity: blocker, owner: user] The calendar moved earlier: start Steamworks onboarding this week; app ID + "Desktop Companion" tag by ~Dec 1
**Evidence (web, Nov 9):**
- **Onboarding:** tax information is checked by a third party and "may take up to 30 days". There is a 21-day wait between paying the app fee and releasing (first titles). Store and build reviews take 1–5 days (onboarding doc). For store pages, submit "at least 7 business days" ahead; reviews "typically take 3-5 business days" (review-process doc).
- **Themed fests:**
  - Invitations go out automatically by store tags, by email, to accounts with "Receive Steamworks communications".
  - "Partners usually have six weeks or more to register". Marketing opt-in and discount deadlines are "typically 6 weeks prior to event start".
  - Unreleased games get an upcoming section, and demos get their own section (themed-sales doc).
  - For Desktop Companion Fest (Jan 14–18, Valve's calendar) that puts the window at **~Dec 3**. The event's own page returned an error on every fetch today; R5 read it as tag-based, with Valve's trailer on Jan 8.
- **Next Fest Feb 2027 (re-fetched):**
  - Q&A Dec 8, 10–11am PST.
  - **Registration closes Jan 10, 11:59pm PST.**
  - **Jan 18:** demo + store page in review for the Press Preview; Valve pulls trailers.
  - Feb 1: final submissions.
  - Feb 11, 10am PST: Press Preview.
  - **Feb 22 – Mar 1**: the fest itself.
  - One Next Fest per game; the store page must be public.
- **New direct competitor: Keyboard Hero** (Steam app 4401110).
  - Free-to-play, Coming Soon, **demo out**, tagged **Desktop Companion**.
  - "Every keystroke makes your heroes stronger", up to 99 heroes, Steam-friend heroes, characters generated from photos (**"Artificial Intelligence" tag**).
  - It will very likely sit in the same Desktop Companion Fest upcoming/demo shelves.
- **The rest of the field:** Desktop Heroes is unchanged at 70% of 104 ($5.99). Idle Squire still has 6 reviews ($4.99, demo).

**Why it matters:**
- If the app ID and the tag aren't in place when invitations go out, the one on-niche fest before Next Fest is lost.
- Keyboard Hero makes the "keystrokes power heroes" hook a commodity, and it's free.
- Our page has to win on **premium + no network at all + hand-made pixel art + idle-first depth**. Their AI and online features are the contrast.

**Fix:** the week-by-week plan below. The USER column is the critical path.

### F2 [severity: major] Idle demo, first hour: 12–16 party wipes, the first at minute 2 — exactly the "not idle enough" review
**Evidence:**
- `node docs/playtest/round-06/market_probe/wipe_floors.js --min 60 --profile idle|typist --seed 6|1|2 --demo --retire nudge --omen random` (real sim, scripted player).
- **Idle wipes in hour 1: 16 / 12 / 16** (seeds 6/1/2).
  - **First wipe at 2 min on floor 4–5.**
  - Then about one every 3–4 min: e.g. `2m@f5 5m@f7 8m@f10 9m@f10 14m@f15 19m@f20 21m@f20 23m@f20 …`.
  - Repeated wipes at the Bone King (f20) and f25–30.
- **Typist: 8 / 4 / 11.**
- `alert_rate.js` (8 h, full game, seed 6, HEAD 3adcda5): idle **16 wipes in hour 0** but only 7 in hours 1–7 together. The pain is front-loaded into the first impression.
- The wipe runs above are on HEAD too. The new "regroup after 3 boss losses" helps only at bosses; most first-hour wipes are on normal floors (f4–f8, f15, f25–f27).
- Every wipe plays the `wipe` SFX and FX (`audio.js:204`, `fx.js:249`).

**Why it matters:**
- Next Fest and Desktop Companion Fest players install the demo and go back to work, which is the idle profile.
- Desktop Heroes' visible negative reviews are about 8/10 "not idle enough" (R5).
- The sentence this produces: *"I leave it running and my heroes just keep dying."*
- R5's heal cap was right for the late game. In the first 20 minutes, the same danger reads as punishment.

**Proposed fix (T1 should tune the numbers):**
1. **Grace period:** no hero can die before the first boss kill (floor 10) or 10 minutes of play. Lift the heal cap below floor 10, or clamp damage to leave 1 HP.
2. **Auto-camp after 2 wipes on the same floor.** Hold the party 1 floor below (the `bossBlock`/`campUntil` path at `world.js:647` already exists) until power is up 15%. Show a calm "TRAINING 62% → retry" pill instead of throwing the party at the wall again.
3. Cap wipe SFX/FX to 1 per 5 minutes.
4. Gate: idle demo, seeds 1/2/6, at most 4 wipes in hour 1 and none before minute 10.

### F3 [severity: minor → major on calls] The loudest SFX still fires about 1–1.6 times a minute in boss-heavy hours; only void slams are damped now
**Evidence:**
- `alert_rate.js` counts events per hour. I re-ran it on HEAD 3adcda5, after the lead's R6 part 1/2 commits landed mid-round.
- **Already fixed on HEAD:** void-slam audio plays only for the first 3 per fight, and the warning is the softer 'zone' (`audio.js:191`).
- **Not damped:**
  - `bossSlam` (every 4th boss attack): **42–64 per hour**, idle 8 h, seed 6.
  - War Charge: 'deny' wind-up + `slam` impact, up to **31 per hour** (idle hour 1).
  - That's **up to 95 `slam` thumps an hour.**
- **Demo, typist hour 0:** 33 boss slams + 7 charges.
- `'slam'` is the loudest SFX: a 70 Hz sine at vol 0.12 plus noise at 0.10 (`audio.js:122`). Hits are 0.04–0.05. `slam` has no `limited()` gate.
- **The enrage** (0.3–1 per hour, now "keeps its wounds") and **the War Charge shove** are visual and readable. They're not a review risk.

**Why it matters:**
- Low-frequency thumps are what speakers carry into a call mic and what headphones make "feel" loud.
- The sound-during-calls review is the niche's classic one: *"have to mute it every meeting"*.
- Sound is ON by default.

**Proposed fix (15 min):**
- Apply the void-slam rule to `bossSlam` and `warCharge`: full volume for the first 3 per fight, then skip or 25%.
- Add `limited('slam', 8000)`.
- Play the charge 'deny' only for the first 3 per fight.
- Consider a default SFX volume of 0.2 instead of 0.3 for the desktop build.

### F4 [severity: minor] The release gate prints "SPRITE CHECK FAILED" but exits 0, so a script can't fail on it
**Evidence:**
- `packaged_gate.ps1` ran 8 packaged self-tests (`out/packaged_gate.json`):

  | Build | lowGpu | Gate | Exit | GPU process `--disable-direct-composition` |
  |---|---|---|---|---|
  | full | auto | ok (143 px) | 0 | **true** |
  | full | 1 | ok (143 px) | 0 | true |
  | full | 0 | ok (143 px) | 0 | false |
  | full | **blanked knight** (`KK_SNAPSHOT_JS` clears it) | **SPRITE CHECK FAILED (0)** | **0** | true |
  | demo | auto / 1 / 0 | ok (143 px) | 0 | true / true / false |
  | demo | blanked | **FAILED (0)** | **0** | true |

- Dev shell: `KK_SNAPSHOT=… KK_SNAPSHOT_JS=<blank> node_modules/electron/dist/electron.exe .` also prints FAILED and exits **0**.
- `main.js:457` sets `process.exitCode = 1`, then `app.quit()`. Electron exits 0 regardless.

**Why it matters:** F1 of R5 lived a whole round because nothing checked pixels automatically. The gate exists now, but CI and `npm run` wrappers can't see it fail.

**Fix (2 min):**
- Replace `app.quit()` in the snapshot block with `app.exit(px > 0 ? 0 : 1)`, after the PNG is written.
- Optional: check every frame + tint + icon (my `diag_r6.js` census) instead of `knight[0]` only.

### F5 [severity: minor] Demo↔full handoff: fixed 1.5 s wait → second identical dialog when the owner quits slowly; the pipe name is machine-wide
**Evidence:**
- **Packaged, real launches** (`packaged_instances.ps1`, `out/packaged_instances.json`):

  | Case | Result |
  |---|---|
  | Full running, demo launched | Dialog after 0.2 s: "Keystroke Keep is already running (demo or full game)." with buttons "Close the other one and start the demo" / "Cancel" |
  | → Close | Full exited **0.66 s** later and wrote its save. Demo strip visible at **2.44 s**. 0 extra dialogs |
  | Demo running, full launched → Cancel | Full exits, demo keeps running and stays visible |
  | → Close | Demo exits after **0.63 s** (save written to `Keystroke Keep Demo\saves`). Full strip visible at **2.36 s** |

- **Dev shell** (`run_instances.sh`, `out/instance_log.jsonl`): the same flows PASS. The full probe's live floor 77, never autosaved, was on disk after the handoff, so the quit path saves the newest state.
- **Slow owner** (`KK_SLOWQUIT=3000`, simulating a save flush stuck behind AV/OneDrive): the relaunched demo found the pipe still owned and **showed the same dialog a second time** (log at 14:10:31). It started only on the second "Close".
- **Code reading:**
  - `main.js:420` waits a fixed 1,500 ms before `app.relaunch()`.
  - `\\.\pipe\keystroke-keep-instance` (`main.js:407`) lives in the machine-wide pipe namespace, not per session. On a shared family PC, user B's strip would see user A's (even in a disconnected session) and could never start; connecting to quit A should fail on the pipe's default DACL.
  - The multi-user case is from the Win32 pipe-namespace rules. I had no second account to test it.

**Fix (20 min):**
- Owner: on `quit`, call `srv.close()` first, then `flushSave(); app.quit()`.
- Requester: after sending `quit`, poll `connect` every 100 ms until ENOENT (up to 10 s), then relaunch.
- Pipe name: `keystroke-keep-instance-${os.userInfo().username}` (or the session ID).

### F6 [severity: minor] Saves: the R5 edges are fixed; one new race — a pending async retry can overwrite a newer quit save
**Evidence (`run_saves.sh`, 21 scenarios, `%APPDATA%\kk-market-probe-r6`; `readSaveAtStart` = what `main.js` hands the renderer):**

| Scenario | Result | Verdict |
|---|---|---|
| tmp newer than main (61 vs 60) | loads **61** | PASS (R5 edge 2 fixed) |
| tmp older (59 vs 60) | loads 60 | PASS |
| corrupt tmp newer | loads main 60 | PASS |
| tmp only, no main | loads 61 | PASS |
| Full saved once (marker `own save <ts>` written), then main corrupt with no backups, demo = 31 | `readSave()` → **null** (no demo import) | PASS (R5 edge 3 fixed) |
| Marker present, main corrupt, demo = 31 | fresh floor 1, **no "Welcome to the full game" toast** | PASS |
| **Async save vs locks of 100 / 300 / 600 / 1000 / 2000 ms** | main process blocked **0–1 ms**, max event-loop lag **2–4 ms** (R5: 305 ms). Lands after 147 / 634 ms; longer locks are superseded by the next autosave, or the newer `.tmp` wins on reboot | **PASS (R5 edge 1 fixed)** |
| **Async save (floor 301) hits a 250 ms lock; a sync save (302, the quit path) lands meanwhile** | sync wrote 302, then the pending retry wrote **301** over it | **FAIL (new)** |
| Corrupt / 0-byte main → restore toast, ring stays clean; demo import; reset → floor 1; rotation; session-end (71 of live 72); lock-short (sync) | same as R5 | PASS |
| `lowGpu` false / true / 'auto' / missing / corrupt file | off / on / on / on / on (auto on this desktop) | PASS |
| Real `%APPDATA%\Keystroke Keep\saves\keystroke-keep.json` | md5 `d680a06b…b533` before and after the whole round | untouched |

**Why it matters:**
- The window is narrow: a lock at quit time, and up to 10 s of progress lost.
- It also resets `lastSaveText` to the older text.

**Fix (5 min):**
- Keep `let saveGen = 0`; every `writeSave` call does `const g = ++saveGen`.
- A retry runs only if `g === saveGen`.
- Small extra: `readSave()` should set `loadSource = 'none'` when it returns null. It currently keeps the previous value (`readAfterCorrupt.source: "main"`).

### F7 [severity: minor] Low-GPU re-measured: willReadFrequently costs nothing; the trade-off is still about 2× CPU, now applied only on desktops
**Evidence (`run_perf.sh` + A/B):**
- Setup: 12 one-second samples per phase. Typing is in-page at 5.5 keys/s. "E4" = pinned to 4 E-cores (laptop proxy, as in R5).
- **"nowrf" = the sprite canvases re-baked without `willReadFrequently`**, i.e. the pre-fix GPU-backed canvases, in the same mode.
- Raw data: `out/perf_*.json` and `out/perf_table.tsv`.

| Run | Our GPU 3D % idle / typing | CPU 1-core % idle | typing (TM %) | **typing muted** | 30 fps | private MB |
|---|---|---|---|---|---|---|
| all threads, **auto** (→ on) | 0.00 / 0.00 | 10.5 | 24.2 (0.76) | 18.7 | 22.5 | 188 |
| all, on ×2 | 0.00 / 0.00 | 7.7–11.2 | 23.1–25.3 | 19.9–21.0 | 22.4–24.7 | 190–239 |
| all, on **nowrf** | 0.00 / 0.00 | 12.3 | 24.6 | 19.2 | 24.5 | 193 |
| all, **off** | 3.1 / 5.0–5.7 | 4.6 | 30.6* | **9.4** | 13.9 | 277–290 |
| **E4, on ×2** | 0.00 | 14.6–17.6 | 34.0–39.9 (**8.5–10.0**) | **30.0–32.0** | 35.7–36.4 | 187 |
| E4, on **nowrf** | 0.00 | 16.2 | 40.8 (10.2) | 33.2 | 38.2 | 189 |
| **E4, off** | 2.9 / 4.8–6.7 | 4.0 | 28.8* (7.2) | **19.5** | 12.3 | 269–288 |
| hidden in the tray (all runs) | 0 | 0.1–0.7 | – | – | – | – |

\* Those phases overlapped DWM CPU spikes of 29–31%, so read the muted column.

- **wrf vs nowrf: no difference beyond run-to-run noise.** The 89f4651 fix is free.
- **Low-GPU price is unchanged:**
  - GPU 0.0% vs 5%.
  - **CPU about 2× while typing** (9 → 19–21% of a core on P-cores; 19.5 → 30–32% on E-cores).
  - About 90 MB less private memory.
- All-thread "on" CPU reads higher than R5's run (15.4 → 19–25), but the nowrf A/B reproduces it in this session. It's machine state (other testers' sims were running), not the fix.
- **auto:** `hasBattery()` = false here (`perf_auto_all.json`). The switch is on and `gpu_compositing` = `disabled_software`. Correct.

**Small issues:**
1. **No migration:** R4/R5 saves stored `lowGpu: true` (the old default), and `main.js:386` honours it. Any tester laptop stays forced ON. Fix: on load, if `settings.lowGpu === true && !settings.lowGpuChosen`, set it to `'auto'`, and set `lowGpuChosen` when the player clicks the toggle.
2. **BatteryFlag is a bit field.** Use `(o.BatteryFlag & 128) === 0 && o.BatteryFlag !== 255`.
3. **UPS desktops** report a battery, so they get GPU mode. That's harmless; just note it.
4. **Still unmeasured:** a real iGPU laptop in GPU mode (the mode 'auto' gives laptops).

**Requirements notes line for the page (desktop):** "Designed to run all day. Pauses itself when hidden, locked or behind fullscreen apps. On desktops: 0% GPU, under 3% CPU on an 8-thread PC, about 200 MB RAM while you type." (Measured: 19–25% of one core while typing, which is 0.8% Task Manager CPU on this 32-thread i9.)

### F8 [severity: minor] Store, legal and trust leftovers before the demo goes public on Jan 14
- **NotSigned.** Both rebuilt exes and both `.node` files report `NotSigned` (`Get-AuthenticodeSignature`).
  - Valve, the FBI and the press spent 2026 on Steam games that shipped malware (Notebookcheck, March 2026).
  - Keystroke-reading apps get asked "is this a keylogger?" (Bongo Cat's own discussions).
  - An unsigned global-hook exe on a public demo page in that climate invites AV flags and "keylogger" threads.
  - **The signing certificate is now on the critical path for Jan 14, not launch.**
- **Copyright:** the exe VersionInfo reads `Copyright © 2026 Keystroke Keep` (U+00A9 confirmed). That's still a placeholder; put the legal name that matches the Steamworks company identification.
- **Screenshots:** Valve's review rule is "Your screenshots must only contain gameplay". Drop R5's "Task Manager next to the strip" screenshot and put the footprint claim in text.
- **Demo identity:** the demo asar `package.json` now carries `productName: "Keystroke Keep Demo"` and `kkDemo: true`. The packaged demo self-test profile is `%APPDATA%\Keystroke Keep Demo-selftest`, which proves `app.name`. The full asar has no `kkDemo`.

## Verified fixes from last round (pass/fail, one line each)
- **Low-GPU sprites, dev:** PASS.
  - Census `diag_r6.js`: 0/48 frames, 0/144 tints and 0/25 icons blank, knight 143 px (R5: 48/48 blank).
  - The screen grab shows the knight, rat and skull alcove (`out/sprites_auto_lowgpu_on_crop.png`).
- **Low-GPU sprites, packaged full + demo:** PASS. The self-test gate reads 143 px in auto/on/off, and `gate_full_auto.png` shows the party.
- **Sprite gate:** PASS at detecting blank sprites (prints FAILED on a blanked knight). **FAIL at signalling it:** exit code 0 (F4).
- **lowGpu 'auto' → on for this desktop:** PASS. `hasBattery()` false; switch on in the dev probe and on the packaged GPU process command line.
- **KK_LOWGPU=1/0 for self-tests:** PASS. The GPU process gets / doesn't get `--disable-direct-composition`.
- **Demo profile folder:** PASS. Asar productName "Keystroke Keep Demo"; separate `-selftest` profile; the demo save is in `Keystroke Keep Demo\saves`.
- **second-instance shows the strip:** PASS, dev and packaged. Hidden by the hotkey → second launch exits → strip visible again.
- **Demo↔full "close the other one" dialog:** PASS in both directions on the packaged builds (0.6 s quit, 2.4 s to the new strip). Cancel works. Slow-quit double dialog (F5).
- **Fullscreen `style & 0xC00000` rule:** PASS on **30/30** cases × 3 monitors, including the R5 FAILs (borderless-maximized kiosk and WPF thick borderless). Hides in 0–1.3 s, returns in 0–1.0 s.
- **Async save retries:** PASS (0–1 ms main-process block vs 305 ms). New stale-retry race (F6).
- **Newer .tmp wins:** PASS (4/4 cases).
- **Import marker after first own save:** PASS. No false demo import or "Welcome" toast after a later corruption.
- **Copyright set:** PASS technically; still a placeholder name (F8).

## Launch-window plan: Nov 9 2026 → Mar 1 2027 (week by week)
**Critical path:**
1. Steamworks tax verification ("may take up to 30 days").
2. App ID.
3. The **Desktop Companion** tag live in Steamworks before fest invitations and registration (**~Dec 3**, "6 weeks prior").
4. Coming Soon review submitted **Mon Dec 7**.
5. Page live **~Dec 16**, before the Winter Sale and the holiday review slowdown.
6. Demo reviewed **before Jan 14** (DCF).
7. Next Fest registration **by Jan 10**.
8. Demo + page reviewed **by Jan 18** (Press Preview).
9. The fest, **Feb 22 – Mar 1**.

**USER** = only the user can do it (accounts, money, legal identity, art commissions, sending messages). **LEAD** = the lead can build it.

| Week of (Mon) | USER: accounts, money, art, outreach | LEAD: can build | Gate / date |
|---|---|---|---|
| **Nov 9** (today) | Start Steamworks onboarding **this week**: sign the NDA + distribution agreement, **pay the $100 app fee**, bank, **tax interview** (up to 30 days), identity. The legal name must match bank + tax (no DBA). Pick the studio name for `build.copyright`. **Start code signing** (Azure Artifact Signing identity validation, or order an OV cert). Brief a pixel artist for the capsule set (5 capsules + library hero/logo; GDD budget $200–600). | Fix F3–F6 (about 1 h total). Add a **capture mode** (`KK_CAPTURE=1` in the dev Electron build: warp/autotype/+floors on hotkeys + a staged save) so the real strip can be filmed over a real desktop. | – |
| **Nov 16** | Create the app → **app ID**. Draft the page: name, short description (R5 draft), **tags with Desktop Companion first** (R5 order), the "Is this a keylogger?" FAQ inside About This Game. Turn on "Receive Steamworks communications". | Record capture set A (S1–S8, G1–G5 below). Set `KK.STORE_URL`. Start Steamworks integration behind the app ID: init, achievements mirror, rich presence, Auto-Cloud on `keystroke-keep.json` + `demo-imported.flag` only. | Auto-Battler RPG Fest Nov 16–23: no page yet, skip |
| **Nov 23** | Approve capsule sketches. Proof the page copy (US Thanksgiving week). | Trailer rough cut (R5 30-s shot list) + 6-s vertical FLOW→Meteor clip. F2 grace period / auto-camp. Signing wired into electron-builder once the cert exists. | **DCF invitation / registration window (~6 weeks out)** |
| **Nov 30** | **Register for Desktop Companion Fest** from the email (one checkbox). No invite → file the appeal at the bottom of the event's registration page. Final capsules in. | Final screenshots/GIFs on final art. Achievements uploaded (36 + icons), cloud config. VirusTotal on the signed exe; report false positives to Microsoft. | **~Dec 3: DCF opt-in deadline (confirm on the event page; it errored all day today)** |
| **Dec 7** | **Mon Dec 7: "Mark as ready for review"** (≥7 business days; leaves one resubmit before the sale). Watch the Next Fest Q&A **Dec 8, 10–11am PST**. | Demo app in Steamworks: depots, SteamPipe upload, launch options, demo page text. | Coming Soon review |
| **Dec 14** | **Coming Soon live ~Dec 16.** Announce with GIF G1 (r/incremental_games, r/IdleGames, Bluesky/X, a vertical clip on TikTok/Shorts). **Register for Next Fest now** (deadline Jan 10; holidays eat time). | Fix review notes. **Submit the demo build + demo page for review by Fri Dec 18.** | Winter Sale Dec 17 – Jan 4 (the page earns wishlists from sale traffic) |
| **Dec 21** | Holiday. Optional: a streamer/press list (desktop-companion and idle creators). | Bugfixes from the demo review only. | Valve reviews slow down |
| **Dec 28** | – | Polish from R6/R7. Draft the DCF Steam event post (GIF header). | – |
| **Jan 4** | Approve the DCF event post. Send demo links to creators (the user sends). | **Last safe demo resubmit: Mon Jan 4** (7 business days before Jan 14). Final 30-s trailer with captions (readable on mute). | Winter Sale ends Jan 4 |
| **Jan 11** | **Jan 8:** Valve's DCF trailer → announce participation. **Jan 10, 23:59 PST: Next Fest registration closes** (should already be done). **Jan 14–18: Desktop Companion Fest with the demo LIVE**: answer every perf / keylogger / fullscreen thread daily. | Hotfix lane (perf, fullscreen, AV). | **DCF Jan 14–18**; **Jan 18: Next Fest demo + page reviewed; trailers pulled** |
| **Jan 18** | Make the final trailer the **first** trailer on the base page (gameplay first). | Demo patch from DCF feedback. | – |
| **Jan 25** | Press kit page; email press with the Feb 11 Press Preview hook. | Submit the demo patch (3–5 business days). | Shop Keeper Fest Jan 25 – Feb 1 (not ours) |
| **Feb 1** | – | **Everything for Next Fest submitted.** Demo code freeze. | **Feb 1 final** |
| **Feb 8** | Book 1–2 Next Fest livestream slots: a real work session with the strip, never the fake desktop. | Livestream scene + standby branch. | **Feb 11, 10am PST Press Preview** (also the trailer opt-out deadline) |
| **Feb 15** | Final outreach; pin the FAQ in the demo discussions. | Hotfix only. | – |
| **Feb 22** | **Next Fest**: daily replies, one mid-fest event post, livestreams. | Watch for "won't launch", AV, fullscreen and battery reports first. | **Feb 22 – Mar 1, 10am PST** |
| **Mar 1** | Pick the release date: after Mar 1, not Spring Sale week (Mar 18–25). The 21-day app-fee wait has long passed if the fee was paid in November. | Release candidate. | Next Fest Wrap-Up |

### Captures and GIFs for the page (record from week of Nov 16)
**How to record:**
- Use the **Electron dev build** over a real desktop at 1920×1080 (or 4K at 150%, downscaled).
- Never record the browser's fake desktop.
- Low-GPU recording is safe now (sprites verified on screen).
- Until the lead ships capture mode, use the dev tray item "Open dev tools" and run in its console:

```js
const K = KKdebug.KK;
K.input.autotype(true);          // ≈5 keys/s: fills Sparks hands-free
K.warp = 20;                     // 1 / 5 / 20 / 60x
K.gainGold(1e6, 'dev');          // buy the party into shape
K.S.sparks = K.mods().sparkCap;  // instant ult for the Meteor shot
KKdebug.W.spawnRat();            // golden-rat beat
// +5 floors = the #dev-floor handler (ui.js:645); expose it as K.devFloors(n) in capture mode
```

**Screenshots** (Steam rule: gameplay only; ≥1920×1080, 16:9):

| # | Moment | How to stage it |
|---|---|---|
| S1 | **The hook:** a code editor fills the screen; the strip below is in FLOW STATE (gold light, "FLOW STATE! x2.2 POWER") | Real typing for 60 s |
| S2 | "VICTORY! Bone King falls" + coin shower | Warp to f19, then 1x for the kill |
| S3 | Relic offer: three cards over a spreadsheet | Warp until the offer |
| S4 | Delve Omen cards (▲/▼) | Retire with seeded gold |
| S5 | "A NEW GENERATION RISES +N RENOWN" + the Legacy panel | Same session |
| S6 | The Hollow: "VOID SLAM INCOMING" plate + Sanctuary save | Late save + warp |
| S7 | "HEART OF THE KEEP" floor-100 banner | Save at f99 |
| S8 | Strip sizes S/M/L, or the strip on monitor 2 next to work | Settings |

**GIFs for About This Game** (≤3 MB each; MP4/WebM where Steam allows it):

| # | Clip | Length |
|---|---|---|
| G1 (first) | **Type → Sparks fill → FLOW → Meteor wipes the pack** | 6–8 s |
| G2 | War Charge telegraph + shove → the Warlord falls (the demo's final boss) | 5 s |
| G3 | Alt-tab into fullscreen video: the strip vanishes and comes back | 5 s |
| G4 | Golden rat click → coin shower | 3 s |
| G5 | Tray menu "Count keystrokes & clicks" + the privacy line (for the FAQ block) | 4 s |

**Trailer:** R5's 30-s shot list is unchanged. Valve's DCF trailer is Jan 8; Next Fest pulls trailers Jan 18.

**Positioning vs Keyboard Hero (F1).** First two About bullets:
1. "Fully idle: typing makes it faster, never required. No account, no internet, nothing you type is ever stored."
2. "Hand-made pixel art. 4 heroes, 7 bosses with signature moves, Delve Omens, 100+ floors."

Price $4.99 premium (no ads, no online) against their F2P + AI.

## Ideas (optional, max 3)
1. **"Polite mode" bundle** as a first-run question: SFX volume 0.2, slam thumps damped, calm mode. It answers the sound and call reviews before they're written, and makes a good store bullet.
2. **Make the self-test a release script** (`npm run gate`): packaged full + demo × lowGpu auto/0, the `diag_r6.js` census, `Get-AuthenticodeSignature` = Valid, fuses read. Fail on any miss, using the exit code from F4.
3. **Enter DCF with a demo patch note ready:** ship the F2 grace period as the visible "idle-friendly" change during DCF week. It's a news hook for the Steam event post and answers Desktop Heroes' #1 complaint on our page.

## Measurement notes
- **Probe:** `docs/playtest/round-06/market_probe/`. It's the R5 probe ported (`patch_probe.py`) plus R6 modes:
  - `hold`/`noop` instance tests (`KK_AUTODIALOG`, `KK_SLOWQUIT`, `KK_HIDE`, `KK_HOLD`).
  - Save scenarios `tmp-*`, `marker-then-corrupt`, `own-marker-corrupt-with-demo`, `async-lock`, `async-stale`, `lowgpu-auto`.
  - `KK_REBAKE=nowrf` (A/B).
  - The demo probe uses its own `userData-demo`, mirroring the new separate lock.
- **Scripts:** `run_perf.sh`, `run_saves.sh`, `run_instances.sh`, `packaged_gate.ps1`, `packaged_instances.ps1`, `alert_rate.js`, `wipe_floors.js`, `diag_r6.js`. Outputs are in `out/`.
- **Packaged builds:** rebuilt with `npm run dist` and `npm run dist:demo` at 13:31 from 89f4651.
- **Code versions:** the lead committed R6 parts 1 and 2 (13:55, 13:58) while I was running.
  - `electron/main.js` is unchanged since 89f4651, so the shell findings F4–F6 apply to HEAD.
  - The first perf matrix straddled the commits (dev runs read `js/` live). The wrf/nowrf A/B pairs all ran after 13:58 on the same code.
  - `wipe_floors.js` and the final `alert_rate.js` ran on HEAD 3adcda5.
- **Real save folders:**
  - `packaged_instances.ps1` launched the **real (non-snapshot) packaged builds**, which always use `%APPDATA%\Keystroke Keep` and `%APPDATA%\Keystroke Keep Demo`.
  - Before the run, both folders were copied with robocopy (68 files) to my scratchpad. Afterwards they were deleted and restored byte-for-byte with timestamps.
  - The real save's md5 was `D680A06B343DB55E16CF6D3B88B4B533` before and after, and the restore check passed (`restoredOk: true`).
  - Everything else ran in `%APPDATA%\kk-market-probe-r6` or the `-selftest` profiles.
- **Caveats:**
  - One desktop (i9-13900K, RTX 3080, 3 monitors).
  - E-cores are only a laptop CPU proxy.
  - Other testers' sims were running during perf (that's why on-mode numbers shifted up vs R5; the in-session A/B controls for it).
  - The multi-user pipe case (F5) is from documentation and wasn't run.
  - The DCF event page errored on every fetch today; its details are from R5's fetch and the themed-sales doc.

## Sources
- Steamworks onboarding (tax check up to 30 days, 21-day app-fee wait, reviews 1–5 days): https://partner.steamgames.com/doc/gettingstarted/onboarding
- App fee ($100, recoupable): https://partner.steamgames.com/doc/gettingstarted/appfee
- Review process (3–5 business days, submit ≥7 business days ahead, "screenshots must only contain gameplay"): https://partner.steamgames.com/doc/store/review_process
- Coming Soon (≥2 weeks before release, ≥7 business days): https://partner.steamgames.com/doc/store/coming_soon
- Themed sale events (tag-based auto-eligibility, invitations, 6-week registration, upcoming and demo sections): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales
- Upcoming events (DCF Jan 14–18, Winter Sale Dec 17 – Jan 4, Shop Keeper Jan 25 – Feb 1, Next Fest Feb 22 – Mar 1, Spring Sale Mar 18–25): https://partner.steamgames.com/doc/marketing/upcoming_events
- Next Fest Feb 2027 (Dec 8 Q&A, Jan 10, Jan 18, Feb 1, Feb 11, Feb 22 – Mar 1): https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027
- DCF 2027 event page (errored today; see R5): https://partner.steamgames.com/doc/marketing/upcoming_events/themed_sales/desktop_companion_2027
- Calendar coverage: https://www.pcgamer.com/games/steam-reveals-all-the-sale-dates-and-themed-events-for-the-first-half-of-2027/ ; https://insider-gaming.com/2027-steam-sales-revealed-for-first-half-of-the-year/
- Third-party DCF planning note (treated as unverified): https://gamineai.com/blog/steam-desktop-companion-fest-2027-what-indies-lock-before-jan-14
- Keyboard Hero (F2P, Coming Soon, demo, Desktop Companion + AI tags): https://store.steampowered.com/app/4401110
- Desktop Heroes (70% of 104, $5.99): https://store.steampowered.com/app/3734200
- Idle Squire (6 reviews, $4.99): https://store.steampowered.com/app/3982800
- Steam malware games / FBI (2026 trust climate): https://www.notebookcheck.net/FBI-investigates-Steam-games-containing-malware-with-Valve-encouraging-victims-to-assist.1249862.0.html
- GIFs in About This Game (secondhand): https://indiegamejoe.com/?p=116
