# Round 06 — T4 `player` (first-time player, UX & feel)

I played in the browser pane at http://127.0.0.1:5173. Assets were `?v=r6`. The pane was 981x846 by default. For 1:1 text checks I set the viewport to 800x690 (the strip is then exactly scale 2 = size S/AUTO on a 1080p screen). I used 1280x720 for one laptop-width check.

**Setup:**
- **Typing:** a page-level typer sent `keydown` at about 6 keys/s, with a pause every 60 keys.
- **Shopping:** a helper bought the cheapest hero level or Forge item every 1–3 s and saved for recruits. It also took the first relic offered.

**Frozen frames:** to inspect a moment frame by frame I froze it with `KK.paused = true` plus a no-op `KK.fx.update`. I took canvas snapshots (`toDataURL`) at +100/400/800 ms after `chargeWarn`, `warCharge`, `reassemble`, `voidWarn`, `voidSlam` and `bossEnrage`.

**Runs:**
- **(a) Demo, fresh (`?demo`):**
  - Played 1x → 5x → 20x. The boss watcher dropped to 1x for F20 (Bone King) and F40 (Goblin Warlord).
  - F40 was cleared at 53m 12s sim time, which brought up the Demo complete card.
  - First retire (+30), Head Start bought mid-delve, +5 Floors x3, then a 0-Renown re-delve. That gave the "A NEW DELVE BEGINS" banner.
  - On the second delve: Bone King Reassemble, frozen and captured.
  - Checked War Charge at sizes S, M and L.
- **(b) Full game, late:**
  - Fresh save, then state set by script: 3 retires, Legacy (Quartermaster, Veterans 5, Head Start 3…), heroes Lv 135–156, 5 relics, F66, Glass Delve.
  - Played to F111: The Hollow F70, trophies F75–F110, Hollowed Bone King F90 (VOID SLAM frozen at S and L), and Heart of the Keep at F100.
  - **Slam pacing on the Heart:** I lowered hero levels to stretch the fight, then measured `flashA` and `shakeT` at each slam.
  - **Enrage:** I forced the 3-minute rule by setting `fightT = 176` and froze the moment.
  - **After the enrage:** wall-hint click, Codex rank-up (I pre-seeded kill counts to 2), the Legacy Codex line, the achievements list while buying, and the omen modal (retire #4).
- **Cleanup:** fresh-start reset, warp 1x, viewport preset desktop, navigated to `/`. localStorage is empty, F1, and the welcome modal is showing.

## Verdict
**Demo:** the two new boss moves give the demo's two milestones a personality:
- The Bone King "dies" and stands back up.
- The Warlord backs off, flashes **WAR CHARGE!** on a black plate and shoves the line back.
- The alert channel works. WAR CHARGE and VOID SLAM INCOMING are readable at S, M and L.
- The re-delve banner "A NEW DELVE BEGINS / BEAT 53M 12S" is exactly right.

But the round's two UI fixes that I can verify by eye did not land in practice:
- **Achievements list:** it still snaps shut on every purchase. CSP blocks the inline `ontoggle` handler.
- **Numbers:** they still lie at 14 px. "Renown: 22" reads "88", and "+20% HP" reads "+80% HP".

**Full game, late:**
- Floor 100 is now a real moment: one toast, no pill over the title, and a named "Heart of the Keep" boss.
- Slam flashes calm down after three, as promised.
- The 3-minute enrage, though, reads as "my healthy party just died, three times RETREAT", with no warning before it.

I'd keep it running. **Demo 7.5/10, full game 8/10** (up from 7.5: the late game finally has set pieces).

## Findings (ranked, max 8)

### F1 [severity: major] Achievements list still closes on every purchase: CSP blocks the inline `ontoggle`
- Evidence:
  - `ui.js:304` renders `<details class="achbox" … ontoggle="KK.ui.achOpen = this.open">`.
  - `index.html:6` CSP is `script-src 'self'`, so the inline handler never runs. The console shows "Executing inline event handler violates … script-src 'self'" (3 times this session).
  - After a real click on the summary, `KK.ui.achOpen` stayed `null`.
  - **Demo:** opened → clicked Head Start UPGRADE → `open:false` 0.8 s later.
  - **Full game:** opened → clicked Lineage UPGRADE → `open:false`, and `#panel-body.scrollTop` jumped to 696.
  - Without a purchase it stays open (10 checks in 5 s were all open), so the bug only bites exactly when you're using the panel.
  - The Electron build loads the same `index.html`/CSP, so it's broken there too.
- Why it matters: The R5 fix is a no-op in both builds. "The achievements list keeps closing" is a visible papercut, and it's the only achievement view before Steam.
- Proposed fix:
  - Drop the inline attribute and add one delegated listener in `UI.init`. `toggle` doesn't bubble, so it must use capture: `$('#panel-body').addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('achbox')) UI.achOpen = e.target.open; }, true);`
  - Also keep `#panel-body.scrollTop` across `buildPanel()` (save it before the `innerHTML` swap, restore it after).
  - Add a grep in the smoke test for `on[a-z]+="` in `js/` (CSP blocks them all).

### F2 [severity: major] Digits still misread at 13–15 px: the font is the problem, not the size
- Evidence, at 1:1 (800x690):
  - **Legacy retire box** (`ui.js:282`, 15 px / 13 px bold, Pixelify Sans):
    - "Deepest floor this delve: **26** · Renown: **22**" reads **"86 · 88"**.
    - "Renown: **30**" reads **"80"**.
    - "Fame **x2.1**" reads **"x8.1"**.
  - **Demo complete card** (`ui.js:515`, 14 px bold): "**53m 12s**" reads **"53m 18s"**.
  - **Omen cards** (`.omen .up/.down`, now 14 px): "+**20**% HP" reads **"+80% HP"**, "x0.**85**" reads "x0.8S", and "x1.**35**" reads "x1.3S".
  - **Glyph test** (canvas, upscaled 4x):
    - Pixelify Sans at 10, 13 and 14 px: 2≈8 and 5≈S.
    - Pixelify Sans at 16 px: the 2 is fine, but the 5 is still S-like.
    - **Silkscreen at 8 and 16 px and system-ui at 14 px are perfectly clean.** Silkscreen is already loaded and used by `#hud-rate`.
- Why it matters: Renown, omen trade-offs and best times are the numbers people decide on and screenshot. "+80% HP" vs "+20% HP" flips an omen choice. "Renown 88" when you have 22 looks like a bug.
- Proposed fix:
  - Render numerals in a crisp font. Add `.num { font-family: Silkscreen, monospace; font-size: 16px; letter-spacing: 0 }` (or `font: 600 14px system-ui`).
  - Wrap every interpolated number in `<b class="num">` in:
    - the retire box (`ui.js:282`, `#retire-gain`);
    - the demo card time and `.demo-stats`;
    - omen `.up/.down` (numbers only);
    - Legacy and Forge `.desc`.
  - If one rule is preferred: never use Pixelify Sans below 16 px for anything that contains digits.

### F3 [severity: major] The 3-minute boss enrage reads as a sudden wipe, triple-says RETREAT, and has no warning
- Evidence:
  - Heart of the Keep at **37% HP**, party at 74–100% HP; `fightT` was set to 176.
  - At 180 s, `world.js:466` calls `W.wipe()`.
  - **Frozen frame at +0.5 s:**
    - The alert plate "THE BOSS IS TOO STRONG: RETREAT" sits on top of the red wipe banner "RETREAT!" / "THE PARTY FALLS BACK A FLOOR". Both are drawn over the party, so the text interleaves.
    - The alert's leading "T" is hidden under the `.hud-left` spark box at 800 px width.
    - The heroes go grey and dead.
  - **Afterwards:**
    - It counts as a wipe (`stats.wipes` +1, `bossBlock = 100`).
    - The wall pill reads "Stuck? ♛ Retire: +123 Renown".
    - The party re-tried 24 s later and won. I'd raised levels, and the next attempt unlocked "Second Try".
  - There is no countdown, timer or tint anywhere before 180 s.
- Fair or confusing? **Confusing.** The rule is fair, but nothing shows it, and it fires even when you're clearly winning (37% left, nobody low). It throws away 3 minutes of progress for no reason the player can see.
- Proposed fix:
  1. **Show the fuse.** From `fightT ≥ 120`, draw a thin red bar or text under the boss bar ("ENRAGE 0:59"). From 165 s, tint the boss red.
  2. **Enrage, don't execute.** At 180 s, multiply the boss's `atk` x3 and `atkSpd` x0.6 and show `FX.alert('THE BOSS ENRAGES!')`. A party that's truly outmatched then wipes naturally within seconds, and a nearly-dead boss can still be finished.
  3. **If you keep the forced retreat:**
     - Pass a `reason` to `W.wipe()` and skip the generic "RETREAT!" banner for an enrage. Use one alert: "THE BOSS ENRAGES · FALL BACK & LEVEL UP".
     - Don't count it toward `stats.wipes`.
  4. Halve the `voidWarn`/`voidSlam`/`chargeWarn` sound volume after the 3rd in a fight (only the flash is damped now, `fx.js:336`). The warning cue is the UI "deny" sound (`audio.js:184-185`), which sounds like a button error.

### F4 [severity: major] Reassemble is hard to read: no bone-pile visual, and "REASSEMBLES!" is a plain floater that gets overprinted
- Evidence:
  - **Snapshots at +100, 400 and 800 ms** after `reassemble`, demo F20, size S:
    - +100 ms: clean "REASSEMBLES!" with a bone burst.
    - +400 ms: the boss's crown overlaps the text and "289" stacks above it.
    - +800 ms: it reads **"REASSEM1289!"**.
  - It is `FX.text` (`fx.js:328`), not `FX.alert`, so it can also be evicted (15-text cap).
  - In the composite it sits right under `#hud-floor` "FLOOR 20".
  - **The sprite never collapses:** `render.js:483-503` only draws 3 one-pixel yellow stun dots while `e.stun > 0`. During the 1.5 s "bone-pile stun" the Bone King just stands there.
  - **First attempt:** I didn't see the moment at all at 1x. The only reliable tell is the boss HP bar jumping from empty to 25%.
- Why it matters: The demo's first boss after the Rat King is the place to teach that "bosses have tricks". Right now most players will read it as "the HP bar glitched".
- Proposed fix:
  - Route the call through the alert channel: `FX.alert('THE BONE KING REASSEMBLES!', '#e8e2d0', 1.5)`.
  - Hide the boss's damage numbers while `e.stun > 0` (same rule as the wind-up).
  - In `drawEnemy`, when `e.reassembled && e.stun > 0`:
    - Draw only the bottom 35% of the sprite (a bone pile) for the first 0.8 s.
    - Then slide it up to full height over the last 0.7 s.
  - The same goes for War Charge: `e.windup` is set (`fx.js:320`) but `render.js` never reads it. Pulse a red/purple tint on the boss sprite at 4 Hz while `e.windup > 0` (both War Charge and Void Slam).

### F5 [severity: minor] Wall hint: false "Stuck?" right after beating the demo, and it can fire mid-fight
- Evidence:
  - The DEMO COMPLETE card opened. Behind it, the strip showed `#hud-farm` "STUCK? ♛ RETIRE: +30 RENOWN" stacked over the demo pill, both at hero-head height.
  - **Cause** (`ui.js:81-82`): the stall timer resets only when `S.maxFloorRun` changes.
    - `maxFloorRun` hit 40 at sim 2963 s. The F40 waves plus the Warlord fight took until 3266 s, so it was "stalled" for more than 300 s at the moment of victory.
    - In the demo, `maxFloorRun` can never rise past 40 again.
  - The same rule fires in the full game whenever one floor (3 waves plus a boss of up to 180 s) takes more than 5 min at 1x, even while you're winning.
  - **Click-through PASS:** clicking the pill opens Legacy with `scrollTop = 0` and RETIRE FOR RENOWN in view.
- Proposed fix:
  - Reset `UI._lastMaxT` on every boss kill (`KK.on('kill', ({e}) => e.boss && (UI._lastMaxT = S.stats.playTime))`).
  - Don't count time while a boss is active.
  - Suppress the stall branch when `KK.DEMO_CAP && S.demoDone`. The demo card and the Legacy re-delve button already cover that.

### F6 [severity: minor] HUD pills: the omen pill still stretches, and the demo pill still lives under the damage numbers
- Evidence:
  - **Omen pill:** with the wall hint visible, `#hud-demo` "◆ GLASS DELVE" is a **225.75 px** box, the same as `#hud-farm`.
    - Cause: `style.css:438` `.demo-pill { align-self: center }`, but the parent `.hud-center` is `display: block`, so `align-self` does nothing.
    - Alone, the pill is correctly narrow.
  - **Demo pill:** "DEMO · ENDS AT FLOOR 40 · BEST 53M 12S · 1 CLEAR" (content PASS) is overprinted all fight long:
    - "3.08K" over "DEMO" at size S.
    - "13.79.09K" stacked over it at F40.
    - At size L the "3.08K" damage number covers "DEMO · ENDS…".
  - **Narrow windows:** below about 1000 css px wide, `.hud-right`'s fervor box overlaps `#hud-floor`.
    - "FLOOR 4[0LOW STATE" at 981 px.
    - Fully covered at 800 px.
    - Fine at 1280 and up.
- Proposed fix:
  - `.demo-pill { display: table; margin: 3px auto 0; }` (or `width: max-content; margin-inline: auto`).
  - Move the demo pill into `.hud-right` above the fervor meter (backlog R5).
  - At `innerWidth < 1050`, let `.hud-center` drop the biome line, or shift `.hud-center` to `left: 40%`.

### F7 [severity: minor] Big banners get crit numbers showing through: "HEART OF! THE KEEP"
- Evidence:
  - At F100 (1280 wide and 800 wide), the gold "HEART OF THE KEEP" title had crits "121B!" and "57.3B!" right on top of it, because the floor-100 waves are still being fought.
  - The banner band is only 40% black (`render.js:575-576`), so the gold crits show through and read as part of the title.
  - Otherwise the floor-100 moment PASSES:
    - One toast ("🏆 Achievement: Heart of the Keep"; the trophy toast is suppressed).
    - `#hud-demo` is hidden during banners.
    - It is queued before "FLOOR 100 / A POWERFUL FOE AWAITS…".
    - The boss is "The Heart of the Keep" (a Hollow), with void slams, and dies.
- Proposed fix: While `FX.banners[0].big`, draw floating texts at `globalAlpha 0.35` and raise the band to 0.65. Or hold the next wave's spawn for the 2.6 s of a trophy banner.

### F8 [severity: minor] Re-delve wording is half done: the confirm still says "RETIRE … +0 RENOWN", and +6 re-delves never show "BEAT"
- Evidence:
  - **Legacy button:** "RE-DELVE (NEW RUN, NEW RELICS)".
  - **Confirm modal:** "♛ RETIRE THE PARTY? … +0 RENOWN … [RETIRE]".
  - **Banner:**
    - The 0-Renown re-delve banner is a PASS: "A NEW DELVE BEGINS / BEAT 53M 12S", and the demo pill hides during it.
    - But `ui.js:452` only uses it when `A.retire()` returns `'redelve'`. The normal demo loop (a fresh F40 clear, +6) shows "A NEW GENERATION RISES / +6 RENOWN", so the time-attack goal disappears exactly when it matters.
  - **Demo card:** "♥ WISHLIST" is now one line (PASS). The pitch line names Magma Depths, Hollow Void, Omens, Codex, depth trophies and 36 achievements (PASS). Behind the card, the strip has still snapped to F37 (backlog: victory pose).
- Proposed fix:
  - In `UI.confirmRetire`, when `KK.DEMO_CAP && KK.S.demoDone`: title "RE-DELVE?", body "New run, new relics. Beat 53m 12s.", and button "RE-DELVE". Show "+6 RENOWN" only if `gain > 0`.
  - Make the demo banner sub-line `(gain ? '+' + gain + ' RENOWN · ' : '') + 'BEAT ' + best`.

## Verified fixes from last round (pass/fail, one line each)
- **VOID SLAM warning readability (R5 F1): PASS.** "VOID SLAM INCOMING" is on a black plate over the party, readable at S (800 px 1:1) and at L. At F90/F100 only a "LV" floater peeks out from behind the plate. The boss's own numbers are hidden during the wind-up.
- **Slam pacing (R5 F2): PASS (visual), PARTIAL (audio):**
  - Slams come every 12 s. On the Heart: 5 slams in 58 s, and the party sat at 30–100% HP, so slams matter now.
  - `flashA`/`shakeT` were 0/0 at slam 4. Slam 5 showed 0.15, from another source.
  - The sounds are not damped (F3 point 4).
  - The enrage cap works, but reads badly (F3).
- **Head Start mid-delve (R5 F3): PASS.** Bought on F1 of a fresh demo delve: F6 with knight Lv 9. The second level put it on F11 with Lv 17, and the archer and mage were recruited at Lv 17.
- **Floor-100 moment (R5 F4): PASS** (single toast, pill hidden, named boss). Minor: crits show through the banner (F7).
- **Achievements list open state (R5 F5): FAIL.** CSP blocks the handler (F1).
- **Digit legibility at 14 px (R5 F6): FAIL.** At 1:1, 2→8 and 5→S persist in Pixelify Sans (F2).
- **Wall hint (R5 F7):**
  - Top-scroll on click: PASS.
  - Stall trigger: PASS (fires), but with false positives (F5).
  - Omen pill width: FAIL when the hint is visible (F6).
- **Demo card (R5 F8):** wishlist label PASS, pitch text PASS. The victory is still stepped on (F37 behind the card), and the pill still sits under the numbers (F6).
- **DEMO combat moments:**
  - War Charge: PASS. "WAR CHARGE!" alert at S/M/L, the shove is visible, and it fires every ~12–13 s.
  - Reassemble: FAIL on readability (F4).
- **Demo pill:** shows best time + clears: PASS ("DEMO · ENDS AT FLOOR 40 · BEST 53m 12s · 1 CLEAR").
- **Hollow Codex:** toast "Hollow Codex: The Hollowed Goblin Warlord rank 1/4. x1.03 damage & gold forever." PASS. The Legacy line "…8 depth trophies, Hollow Codex 1/28" PASS. Note: the Heart of the Keep kill counts toward The Hollow's Codex entry.
- **Low-GPU row:** absent in the browser Settings (Sound, Music, Volume, blips, Calm, Frame rate, Strip size, Count input, Reset): PASS.
- **Console:** the only game error is the CSP inline-handler violation (F1). The rest are the harness's CSP fetch noise and one stale `shop2` ReferenceError from an old tester script.

## Ideas (optional, max 3)
1. **Boss "trick" cards in the Bestiary/Codex.** The first time a signature move fires, pin a one-line toast: "Bone King: rises once at 25%". After that it lives in a small boss list in Legacy. That teaches the mechanic once, and gives the Codex a reason to be opened.
2. **The enrage as a typing moment.** In the last 30 s before an enrage, the fuse bar drains slower while you type (FLOW halts it). "Push through the enrage" ties the late-game wall to the core fantasy instead of a hidden timer.
3. **Victory freeze-frame for every 10th-floor boss.** 0.6 s of slow-mo plus gold rain while the "VICTORY!" banner holds, then the next floor. It's cheap, and it'd also fix the demo card stepping on the F40 win.
