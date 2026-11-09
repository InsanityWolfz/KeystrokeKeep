# Round 05 — T4 `player` (first-time player, UX & feel)

I played in the browser pane at http://127.0.0.1:5173. Assets were `?v=r5`. The viewport was 1024x768 (screenshots scaled to 800x600). When I opened the pane it became 981x846, and I used 800x600 briefly to check text at 1:1.

**Typing:** a page-level typer put real sentences into the notepad at about 6 keys/s, with a 1.5 s pause every 60 keys. It dispatches `keydown` exactly as the game reads it.

**Shopping:**
- A helper buys the cheapest hero level or Forge item every 5 s and saves for recruits.
- I picked the first relic by hand (Lucky Coin, two-step pick). After that a helper took the first offered relic.

**What I did (split as briefed):**
- **(a) Demo, fresh (`?demo`), about 40%:**
  - About 6 wall-clock minutes at 1x with typing, then 5x and 20x up to the F39 waves, then 1x for the F40 boss.
  - The Demo complete card, Wishlist, Legacy with the achievements list, and the retire / re-delve.
- **(b) Full game, late, about 60%:**
  - **Head Start check:** fresh save, then state set to "after the 1st retire" (`retires=1`, 51 Renown, `renownFloor=50`). I bought Head Start x3 through the Legacy buttons.
  - **Second retire through the UI:** the Omen modal (I picked Glass Delve).
  - **Late-game setup:** Quartermaster, Veterans x5 and Lineage x4. Heroes Lv 110–130, 5 relics, `floor=68`, `maxFloorEver=72`.
  - **Play to F111:** 5x and 20x, with 1x for The Hollow (F70), the Hollowed Ember Colossus (F80) and F100. I used 16 presses of +Gold and +5 Floors x2 to get past soft walls.
  - **Measurement:** canvas snapshots (`toDataURL`) at warn+0.3/+0.8 s and slam+0.1/+0.5 s, to see exactly what is drawn during a VOID SLAM.
  - **Third retire:** Omen modal #2 (Storm Front).
- **Cleanup:** fresh-start reset, warp 1x, viewport reset to desktop, and navigated back to `/`. The welcome modal shows and localStorage is empty.

## Verdict
**Demo:**
- The first 10 minutes are still the best part:
  - FLOW at 14 s, with an achievement toast.
  - Rat King at 2:20, with the "Cellar Door" achievement and a relic.
  - Mossy Caverns at 6:43 sim time.
  - The full party at about 7:20.
- The Demo complete card is warm and has real stats. But it sells the full game with one grey sentence and "3 more bosses". Behind it, the strip has already snapped back to F37, so the victory moment is gone.
- I'd wishlist on the strength of the hook, not the card: **demo 7.5/10**.

**Full late game:** this round finally has punctuation:
- Depth trophies every 5 floors.
- A gold HEART OF THE KEEP banner.
- A purple pulse every 8 s on Hollowed bosses that actually dents the HP bars.

The problems:
- The void-slam telegraph is overprinted by damage numbers ("!! VOI445M!M !!").
- One Hollowed boss fight (F90) lasted **16.5 sim minutes and about 97 slams**.
- The F100 "Heart of the Keep" boss is a purple Rat King.

I'd keep it running. The review sentence is still "great first two hours, then pretty but samey". **Full game 7.5/10** (late game up from about 6.5).

## Findings (ranked, max 8)

### F1 [severity: major] VOID SLAM telegraph is unreadable: damage numbers overprint it, and the text can be evicted
- Evidence:
  - The `voidWarn` text is drawn at the boss head (`fx.js:317`, `y = e.y - e.def.h - 10` = world y 12, the same band where `dmgText` spawns).
  - Canvas snapshots during the Hollowed Ember Colossus warning read **"!!3VOI445M!M !!"** at +0.3 s and **"!! VOI445s194M!"** at +0.8 s.
  - The purple ground ring around the party is the only clean signal.
  - `FX.text` keeps only 15 texts and `shift()`s the oldest (`fx.js:96`). At late-game hit rates the 1.0 s warning is among the first to be evicted.
  - In the composite view, the warning also sits directly under the DOM HUD centre ("FLOOR 80 / THE HOLLOW VOID") and the `#hud-demo` omen pill, because the boss stands at screen centre.
  - The slam itself is clear: purple flash, shake, burst, and the first slam always brings the Sanctuary pillars ("SANCTUARY!").
- Why it matters: A telegraph you can't read is just a random screen shake every 8 s. "Telegraphed" was the whole point of the R4 change.
- Proposed fix:
  1. Draw warnings in a separate `FX.alerts` list that is never evicted, drawn last with a 1 px black plate behind the text.
  2. Anchor the warning over the **party** (x = `W.partyX - 20`, y ≈ 22), not the boss head, because that's where the player looks for "am I about to get hit".
  3. During the 1 s wind-up, suppress non-crit damage numbers on that boss and tint the boss sprite red-purple (pulse 3 Hz).
  4. Optionally show a thin fuse bar under the boss HP bar (`#boss` bar) that fills over the last 2 s of `voidT`.

### F2 [severity: major] Hollowed boss fights run long with constant slams: F90 took 16.5 sim min and about 97 slams; danger is still cosmetic
- Evidence (party Lv 146–194 with +Gold help, Glass Delve, i.e. *lower* HP than normal):
  - **Fight lengths:**
    - The Hollow F70: about 25 s at 1x, 3 slams.
    - Hollowed Ember Colossus F80: 2.1 sim min, 12 slams.
    - **Hollowed Magma Lord F90: 45.7 → 62.2 sim min, 97 slams, 31 Sanctuary casts in total over the session.**
    - Hollowed Rat King F100: 0.8 min, 4 slams.
  - **HP samples:** a slam takes everyone to 0.32–0.55, then heals bring them back to 0.9–1.0 within about 1–1.5 s, every time. Wipes: 2 in about 120 sim min (both from my Head Start setup). Normal floors F81–F111 had the party at 0.95–1.00 HP and took 2–8 sim min per floor (slow kill, never danger).
  - At 1x that's a purple flash + shake + slam sound every 8 s for 16 minutes while you work.
  - Calm mode removes the shake and flash (`fx.js:103-104`), but nothing suggests it, and the sound remains.
- Why it matters: The slam is fair, because it can never kill a full-HP hero (45% of max HP). That's also why it's pure noise after the first two: no outcome changes. Over a long fight it becomes "my strip blinks purple every 8 seconds", the kind of always-on annoyance T3 warns about.
- Proposed fix:
  - **Fewer, stronger slams:** every 15 s instead of 8, but 70% of max HP, so a hero who just took boss hits can actually go down and Pell's revive matters. Alternatively scale with boss HP lost: slam at 75/50/25% boss HP (3 per fight, a clear arc).
  - **Cap fight length:** if a boss fight passes 3 min, count it as a wall. Set `bossBlock`, retreat and show the wall hint, instead of an endless slam loop.
  - **Calm the repeats:** after the 3rd slam in a fight, drop the screen flash/shake to 30% and play the slam sound at half volume.

### F3 [severity: major] Head Start bought mid-delve still drops a Lv 1 knight onto F16 (the R4 F2 fix only covers the next delve)
- Evidence:
  - After a retire, I bought Head Start x3 through Legacy. The party jumped to **F16 with knight Lv 1**. The card said "heroes 8 levels higher (now floor 16, +24 levels)".
  - Wren then recruited at **Lv 25**, higher than the knight. Two wipes at F16; it didn't go below F16 (the retreat clamp works).
  - Cause: `A.buyLegacy` raises existing heroes only for `veterans` (`state.js:238`). `headstart` only moves the floor (`state.js:237`). `startLvl` reaches the knight only on the next retire or omen pick.
- Why it matters: Buying Head Start right after a retire is the most common first Legacy purchase. It still produces a fight-losing knight and a stream of "RETREAT" text. It's milder than R4 (no backward slide), but still feels broken.
- Proposed fix: In `A.buyLegacy`, apply the same loop for `headstart` as for `veterans`:
  - `if (id === 'veterans' || id === 'headstart') for (const h of D.PARTY_ORDER) if (S.heroes[h] && S.heroes[h] < 1 + m.startLvl) S.heroes[h] = 1 + m.startLvl;`

### F4 [severity: major] The "HEART OF THE KEEP" moment is covered by HUD pills, and the F100 boss is a purple Rat King
- Evidence:
  - **Composite screenshot at F100:**
    - The canvas banner "HEART OF THE KEEP / FLOOR 100: x1.05 FOREVER" is drawn under the DOM `#hud-demo` omen pill ("◆ GLASS DELVE"), so it reads "HEART [◆ GLASS DELVE] KEEP".
    - The subline collides with the HUD `#hud-floor` "FLOOR 100".
    - The clean canvas snapshot shows the banner itself looks good: gold, with a ring and burst.
  - **Toasts:** two arrive in the same frame saying the same thing: "HEART OF THE KEEP! Depth trophy: x1.05…" and "🏆 Achievement: Heart of the Keep".
  - **The boss:** BAN log "FLOOR 100 / A POWERFUL FOE AWAITS…" → "THE HOLLOWED RAT KING / BOSS", the F10 boss in purple. It died in 0.8 sim min.
  - **Banner queueing works:** trophy, then floor, then boss, no overlap. The farm-tag already hides during banners (`ui.js:84`), but `#hud-demo` doesn't.
- Why it matters: Floor 100 is the screenshot moment. Right now the screenshot shows a pill over the title, followed by the tutorial boss.
- Proposed fix:
  - Hide `#hud-demo` while `KK.fx.banners.length > 0` (same line as `#hud-farm`).
  - On a trophy, suppress the duplicate achievement toast when `def.id` matches the trophy floor (`f100`, `f125`), or merge both into one toast.
  - Make F100's boss a fixed one: The Hollow re-cast as "The Heart" with 1.5x sprite scale (R4 F8f) and its own name. It must never come from the Hollowed rotation.

### F5 [severity: minor] Achievements list in Legacy snaps shut whenever anything is bought (Quartermaster makes it unusable)
- Evidence:
  - Demo: I opened `<details class="achbox">` and it was closed again within 3 s while my shop helper bought levels. With the helper stopped, it stayed open for 12 s.
  - Full game: it opened, then a level-up (Quartermaster spending gold) closed it within 1.5 s.
  - Cause: any `dirty` event sets `UI.dirty`, and `refreshPanel` → `buildPanel` rebuilds `#panel-body` with a closed `<details>` (`ui.js:301`, `ui.js:174`).
- Why it matters: This is the only place to see achievements before Steam. With Quartermaster (a must-buy) you can't read the list.
- Proposed fix: Keep `UI.achOpen` in a `toggle` listener and render `<details class="achbox"${UI.achOpen ? ' open' : ''}>`.

### F6 [severity: minor] Numbers in the pixel font are misread: 5 reads as S or 8, and 2 reads as 8 at 12 px
- Evidence:
  - At 1:1 (800x600 viewport), the omen cards read:
    - "Walk 80% faster and attack 18% faster" (actual 50% / 15%).
    - "monsters hit 28% harder" (25%).
    - "party HP x0.8S" (0.85).
    - "attacks 80% slower" (20%).
  - A 48 px glyph test of "Pixelify Sans" at 12 px rendered "0123456789 25% x0.85" as "…28% x0.8S".
  - The Demo complete card's "1h 20m" read "1h 80m" in a scaled screenshot.
- Why it matters: Omen and upgrade choices are decided by these numbers. Misreading +80% as +50% is a choice made on wrong information.
- Proposed fix:
  - Wrap numerals in a `<span class="num">` styled with the body font (`font: 600 12px system-ui`), or bump `.omen .up/.down`, `.desc` and `.demo-stats` to 14 px.
  - Alternatively, write the numbers in words where it matters ("half again faster").

### F7 [severity: minor] Wall hint pill: readable and clickable, but it only appears after a boss wipe and opens Legacy scrolled past the Retire button
- Evidence:
  - `#hud-farm` "STUCK? ♛ RETIRE: +214 RENOWN" is a proper dark pill now (PASS).
  - Clicking it opened Legacy, but `#panel-body.scrollTop` stayed at 235 from an earlier visit, so the RETIRE box was off-screen and only the Hall of Legends showed.
  - It only shows when `bossBlock` is set (`ui.js:81`). My natural late stall (F111 for more than 20 sim min, 0 wipes, slow kill) never showed it.
  - When it's visible, the `#hud-demo` omen pill below it stretches to the same 225 px width (column flex stretch), an empty-looking box.
- Proposed fix:
  - **Click:** the click handler (`ui.js:41`) should `UI.open('legacy'); $('#panel-body').scrollTop = 0;` or scroll to `[data-action=retire]`.
  - **Soft walls:** also show the pill when `S.floor` hasn't increased for 5 min and `renownGain() >= 10`.
  - **Pill width:** add `align-self:center` (or `width:max-content`) to `.demo-pill`.

### F8 [severity: minor] Demo complete card: the victory gets stepped on, and the pitch is one grey sentence
- Evidence:
  - **Victory overwritten:** the card arrives 2.5 s after the F40 kill. By then the strip has already reset to **F37** (`world.js`: `S.floor = DEMO_CAP - 4`), so behind the "DEMO COMPLETE!" card you see a fresh F37 wave instead of a victory.
  - **Stray toasts:** the F40 relic toast and the "Gatekeeper" toast sit under the modal.
  - **Wording:** "Your party conquered the Mossy Caverns in 1h 20m" is accurate but sounds slow (this demo run used 20x warp, so a real typist will see about 35–60 min).
  - **The pitch:** "3 more bosses, Delve Omens and endless Hollowed depths". Nothing visual, no mention of the 35 achievements or the depth trophies / Heart of the Keep.
  - **Buttons:** "♥ WISHLIST ON STEAM" wraps to two lines next to a one-line KEEP DELVING. With no store URL it shows a placeholder toast (expected; STORE_URL backlog).
  - **Bright spots:** Legacy shows "ACHIEVEMENTS 4/5 (demo set: they unlock on Steam in the full game)", then 5/5 after the retire. That's a nice "carry it over" hook. The re-delve hint "CLEAR FLOOR 40 AGAIN FOR +6 RENOWN" is clear.
  - **Demo pill:** the "DEMO · ENDS AT FLOOR 40 · BEST 1H 20M" pill sits at hero-head height and is overprinted by ult names and damage numbers all demo long ("ARROW STORM!4043", "FLOOR 12" over it).
- Proposed fix:
  - **Victory:** hold the strip on F40 (a victory pose, gold rain) until the card is dismissed, then reset to F37.
  - **Pitch:** add 3 small sprite "teasers" (Magma Lord, The Hollow, a trophy) with one line each, plus "35 Steam achievements · depth trophies to floor 150".
  - **Buttons:** shorten to "♥ WISHLIST".
  - **Pill:** move `#hud-demo` into `.hud-right` above the fervor meter, or hide it while ult or damage text is active nearby.

## Verified fixes from last round (pass/fail, one line each)
- **Late-game danger (R4 F1):** PARTIAL.
  - The void slam fires every 8 s for 45% of max HP, and the first slam always triggers Sanctuary ("SANCTUARY!" pillars).
  - Cleric ults: 31 casts this session (R4: 0).
  - But HP is back to full within about 1.5 s and normal floors are still at 0.95–1.00 HP. See F1/F2.
- **Head Start + levels, no backward wipes (R4 F2):** PARTIAL.
  - Retreat never goes below the Head Start floor (stayed at F16 through 2 wipes), and after a retire or omen pick the knight starts at Lv 75 (Veterans 5 + Head Start 3).
  - But a mid-delve purchase leaves the knight at Lv 1 (F3).
- **Omen modal clarity (R4 F3):** PASS, with notes.
  - Green ▲ and red ▼ lines.
  - "The dungeon waits while you choose": `KK.paused = true` was verified, and simTime stayed frozen at 75.34 for 5 s.
  - No repeats across offers ({fever, march, glass} → {gilded, storm, muster}).
  - HUD pill "◆ STORM FRONT".
  - Legacy opens at the achievements box.
  - Still missing: hover/selected state (one click commits), "for typists / idlers" tags, and a tooltip on the HUD omen pill (`#hud-demo` has no `title`). Digit legibility: F6.
- **Trophies (R4 F4):** PASS.
  - F75/80/85/90/95/100 each fired one gold "DEPTH TROPHY / FLOOR N: x1.05 FOREVER" banner plus a toast "(N total)".
  - The banners queue cleanly before "A POWERFUL FOE AWAITS".
  - About 1 per 5–15 sim min at this depth feels rewarding, not spammy. The only spam is the F100 trophy + achievement double toast (F4).
- **Number soup: hit-flash cap and fewer milestone banners (R4 F5):** PARTIAL.
  - **Hit-flash cap:** the purple Hollowed tint is visible in most frames. Only post-slam frames showed a white boss.
  - **Milestone banners:** only at Lv 150 (3 banners in the same instant after my bulk +Gold buy; Quartermaster would spread them out).
  - **Still open:** crits like "413M!", "957M!" and "1.50M" still draw over `#hud-floor` / `#hud-biome`, and they overprint the VOID SLAM text (F1). Small "LV 140 LV 141" texts stack over the party.
- **Wall hint pill (R4 F6):** PASS for legibility and click. PARTIAL for when it appears and where the click lands (F7).
- **Plural fix (R4 F8b):** PASS. "You have 1 unopened relic chest. It will be lost." / "You have 2 unopened relic chests. They will be lost." There's still no OPEN CHEST button in the confirm.
- **LEVEL UP wrapping (R4 F8e):** PASS. "LEVEL UP x10 | 73.3T" is single-line (`white-space: nowrap`, button height 30 px) at x1 and x10.
- **Legacy after a retire (R4 F8a):** PASS (after an omen it scrolls to the achievements and Hall). In the demo retire, the Hall header shows but its cards are still below the fold at 768 px.
- **Console:** no game errors. Only the harness CSP "Fetch API cannot load /js/*.js" lines, plus one ReferenceError from my own helper script.

## Ideas (optional, max 3)
1. **"Void meter" instead of a timer.** Put a small purple meter on the Hollowed boss bar that fills with *your idle time*, and let typing push it back. Typists then visibly "hold back the void", which ties the late-game danger to the core fantasy (your work is their adventure) instead of a fixed 8 s metronome.
2. **Trophy shelf on the strip.** Each depth trophy adds a tiny gold item (cup, skull, crown) to a shelf drawn into the tavern or background behind the party. A screenshot of the strip then shows how deep you've been, and Heart of the Keep gets a big glowing heart. That's free long-term visual progress for an always-on app.
3. **Demo ending as a cliffhanger.** After the F40 kill, have the floor crack open, show a 2 s glimpse of the Magma Depths palette and a silhouette of the Magma Lord, then the card: "The depths are sealed… for now." It's more wishlist-y than any sentence on the card.
