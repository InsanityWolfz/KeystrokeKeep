# Round 08 — T4 `player` (first-time player, UX & feel)

I played in the browser pane at http://127.0.0.1:5173. Assets were `?v=r8`.

**Viewport:** 1280x720 (the strip canvas is 1280x128). For pixel checks I copied canvas frames into a corner overlay at 2–3x, and I froze frames with `KK.paused`.

**Demo session (`?demo`, fresh save), as a Fest visitor:**
- **Start:** about 3 minutes of real typing in the notepad. A page typer at ~7 keys/s sent `keydown` events. The tool's own `type` action doesn't count as keystrokes. I also made manual buys.
- **"Mostly idle" phase:** 5x and then 20x warp, with a 60–140-key burst every 30 s real time. A glance helper bought levels and recruits and saved up for recruits.
- **Bosses at 1x:** I watched Brood Mother and the Goblin Warlord fights at 1x.
- **Path:**
  - The 40-min "What waits below" card fired naturally at 40:04 on floors 22–25.
  - First F40 clear at 1h 8m → Glimpse → DEMO COMPLETE → Keep delving → DEMO pill click → retire +30 → Head Start (max 1).
  - Second lap (12m 54s) → +6 → forced 0-Renown re-delve.
- **Two staged Glimpse replays:** one for frame captures, and one to retire during the Glimpse floor.

**Full game (`/`), fresh save, then state set by script:**
- Starting state: 1 retire, record F55, max ever 69, strong heroes, Legacy maxed.
- Retire +106 → omen picker with ★ Ember Tide → HUD pill → reached F70 → Seal toast → Void Lantern appeared in the Workshop.
- Legacy: checked the Codex box and the stat rows.
- Free daily re-delve: button and confirm.
- Retire-box refresh across F86.
- Forced enrage on the Heart of the Keep (F100).
- Web/spark callout.

**Cleanup:** fresh-start reset, warp 1x, viewport preset desktop, navigated to `/`. Floor 1, empty localStorage, welcome modal showing.

## Verdict
The Glimpse is the right idea, and the stone "SEALED" Colossus on orange Magma brick genuinely made me want to see floor 50. In play, though, it barely lands:
- **About 6 seconds on screen.** The Colossus is visible for ~6 s of a 14 s floor.
- **Covered.** First the MAGMA DEPTHS banner sits over it, then the "A SEALED BOSS WAITS" alert plate.
- **No reaction.** The party simply walks through the statue.
- **Hard cut.** The strip then snaps back to Mossy F37, and the card opens over a random floor-37 fight.

Worse, retiring during that floor (the Legacy button is lit with +30 the whole time) creates a **permanent wipe-loop softlock that survives a reload**.

The R7 fixes all hold: re-delve buttons, calm lines, web tearing, move timing, the enrage fuse and wording, the retire box. The week-2 layer works, but its rewards land silently.

**Demo 7/10** (8 once F1 and F2 are fixed). **Full game 8/10.** I'd wishlist. A streamer who retires on the Magma floor would not.

## Findings (ranked, max 8)

### F1 [severity: blocker] Retiring during the Glimpse floor leaves `S.glimpse = true`: endless wipe loop in the Crypt, can't retire, survives reload
- Evidence:
  - **The window:** from arriving at F40 on, Legacy shows "+30 / RETIRE FOR RENOWN" (`maxFloorRun = 40`). The Glimpse floor lasts ~14 s (`floorClear` at +14 s, then `demoComplete`).
  - **Repro:** I retired (+30) through the Legacy button at +2.5 s into the Glimpse.
  - **State after the retire:** `S.glimpse: true, demoDone: false, glimpseDone: true, floor 6`.
  - **What I saw:** floor 6 of THE CRYPT, the stone **SEALED Ember Colossus standing in the Crypt**, and "RETREAT! THE PARTY FALLS BACK A FLOOR" within 3 s.
  - **The loop:**
    - `spawnWave` keeps making Glimpse monsters at level `DEMO_CAP-2` = 38 (`world.js:77-83`) against a fresh Lv 9 knight.
    - Wipes every ~7 s: 3 → 9 → **52 wipes in 15 s at 20x**. Gold stays at 0.
    - `canRetire()` is false: gain is 0 and `canRedelve` needs `demoDone`.
  - **After a reload:** still floor 6, still `glimpse: true`, still wiping (64 wipes). The save is dead.
  - **Cause:** `A.retire` (`state.js:310-`) never clears `S.glimpse` or `W.sealedX`, and `nextFloor` only leaves the Glimpse on a floor *clear*.
- Why it matters: it's a Fest demo whose save can't be recovered without deleting it. The review line writes itself: "retired right after beating the boss and the game broke."
- Proposed fix:
  1. **In `A.retire`:** `if (S.glimpse) { S.glimpse = false; S.demoDone = true; }`, and add a `retired` listener in `world.js` that sets `W.sealedX = 0`.
  2. **Guard `spawnWave`:** `if (S.glimpse && S.floor > KK.DEMO_CAP)`.
  3. **Load sanitiser:** `if (S.glimpse && S.floor <= KK.DEMO_CAP - 1) { S.glimpse = false; S.demoDone = true; }`.
  4. **Optional:** disable the retire button during the Glimpse with the label "THE DEPTHS ARE SEALED…".
  5. **Smoke test:** add a Glimpse → retire step.

### F2 [severity: major] The Glimpse's money shot is on screen ~6 s, under a banner and an alert, and the party walks through it
- Evidence (1x, frames captured at +0.2/1/2/3/4/5/6.5/9 s; sealed-minus-party distance 219/180/127/74/24/0/−79/−210 px):
  - **Placement:** `W.sealedX = partyX + 230` (`world.js:695`), and the party marches on at ~45 px/s. It reaches the statue at **+5 s** and leaves it behind; it's off screen by +9 s.
  - **Covered at every point:**
    - +0–2.5 s: the "MAGMA DEPTHS / FLOOR 41" banner.
    - From +2.6 s: "THE MAGMA DEPTHS: A SEALED BOSS WAITS IN THE FULL GAME" (`fx.js:343`).
    - At +5 s, the alert plate covers the statue's head and the "SEALED" label, and the knight overlaps its body.
  - **Banner crowding:** the sequence at the kill is VICTORY → "SIR CLANK LV 60 / x1.5 DAMAGE!" (milestone, 0.1 s after the kill) → MAGMA DEPTHS → alert. Four big beats in 5 s.
  - **No reaction:** the statue is never named (no "EMBER COLOSSUS"). It doesn't react: no glow-up, no rumble, no eyes.
  - **Exit:** the floor ends at +14 s. The strip snaps from orange Magma to green Mossy with a plain "FLOOR 37" banner. The DEMO COMPLETE card opens 2.5 s later over a floor-37 fight, and its text says "conquered the Mossy Caverns". It never mentions what you just saw.
  - **Idle players:** anyone working in another window sees nothing of it, only the card.
- Why it matters: this is the single wishlist beat in the demo, and as built it reads as "the party walked past a grey statue".
- Proposed fix:
  - **Stop and look:** while `S.glimpse` and `sealedX − partyX < 60`, the party halts and waves spawn from the left. Keep the statue on screen for the whole floor.
  - **Reveal timing:** at +3 s (after the banner), the statue's eyes ignite (`glow` 0.25 → 0.8), give a 2 px shake, and draw "EMBER COLOSSUS · SEALED" above it. Show the alert only after that, and place it so it doesn't cover the sprite (or skip it and let the label speak).
  - **Hold milestone banners** during the Glimpse.
  - **Open the card on F41** with the statue still in frame, and return to F37 only when the card closes.
  - **Card text:** add a line plus the stone sprite: "You saw the Ember Colossus. It waits on floor 50 of the Magma Depths."

### F3 [severity: major] "What waits below" (40-min card) reuses DEMO COMPLETE copy that's wrong for an unfinished player
- Evidence:
  - **Fired at 40:04 of play** on F22–25 (idle-ish run, 6 retreats).
  - **The heading leads into the wrong thing:** "Your party is still delving (floor 25 so far)… Here's what waits below:" is followed by **the player's own stats** (788 keystrokes / 28 ultimates / 2 bosses / 1m 23s). It reads as if keystrokes wait below.
  - **The footer is wrong:** "every re-delve rerolls your relics, a fresh clear of floor 40 pays +6 Renown, and your best time is your score". This player has never re-delved or cleared F40.
  - **No visual:** it's the same text block as the DEMO COMPLETE card.
  - **What works:** WISHLIST closes the card and toasts "The Steam page link goes here once the store page is live." (`KK.STORE_URL` is still empty), and KEEP DELVING works. It fired only once (`demoPeek`), and the real DEMO COMPLETE card still came at F40.
- Why it matters: the card meant to hook slow players is the most confusing modal in the demo.
- Proposed fix:
  - When `peek`, drop the stats row (or move it under the teaser).
  - Replace the footer with "Reach floor 40 to glimpse the Magma Depths. The demo's last boss waits there."
  - Show the stone Colossus sprite (same `stoneTint`) beside "The Magma Depths".

### F4 [severity: minor] The DEMO pill is now a hidden store link sitting over the party's heads
- Evidence:
  - **Size and place:** `#hud-demo` is 310x11 px at 1280 px, centred over the party (x 485–795, y 610–621). It has `pointer-events: auto` and `cursor: pointer`.
  - **No affordance:** there's no `title`, and nothing in the text says it's a link ("DEMO · ENDS AT FLOOR 40 · BEST 12m 54s · 2 CLEARS").
  - **Click result:** the placeholder Steam toast. Once `STORE_URL` is set, it launches Steam.
  - **Collisions:** damage numbers ("161K", "1.4K") overprint it all session, and clicks meant for a golden rat or an enemy behind it now open the store.
- Why it matters: a surprise Steam launch from a strip that sits on your desktop reads as "ad"; an invisible link nobody clicks reads as nothing.
- Proposed fix:
  - Make only a "♥ WISHLIST" chip at the end of the pill clickable, with `title="Wishlist Keystroke Keep on Steam"`.
  - Or move the pill into `.hud-right` under the fervor meter (backlog R5).
  - Set `KK.STORE_URL` before the Fest (owner: user).

### F5 [severity: minor] Free daily re-delve: the button wraps and the confirm doesn't explain the deal
- Evidence:
  - **The button:** with `sealDay` open and gain 0, Legacy shows "★ FREE DAILY RE-DELVE (OMEN OF THE DAY)" on 2 lines, next to "+0".
  - **The confirm:** it reuses the demo text, "♛ RE-DELVE? A fresh run with new relics. You have 3 unopened relic chests…". It never says:
    - that it's free once a day,
    - that this delve earns 0 Renown,
    - that today's ★ omen pays +10 Renown at floor 70.
  - **After confirming:** the omen picker shows ★ Ember Tide, `freeDelveDay` is set, and `retires` is 3 (correct).
- Proposed fix:
  - Button: "★ DAILY RE-DELVE: OMEN OF THE DAY".
  - Confirm `<p>`: "Free once a day: start a new delve with today's ★ omen. Reach floor ${A.sealFloor()} for a Seal (+10 Renown). This delve itself pays no Renown."
  - Hide the button while the current omen is already the star and the seal is still open, since re-delving would only throw progress away.

### F6 [severity: minor] Week-2 rewards land silently: Seal is one toast under a boss intro, and the Void Lantern appears without a NEW tag
- Evidence:
  - **Seal:** at F70 (the seal floor, which is also a boss floor), "★ Seal of the Day #1: +10 Renown…" was a 6 s toast that fired with the floor-70 boss intro. "Centenarian" followed 5 s later. The pill quietly changed from "★ EMBER TIDE · ★ FLOOR 70" to "◆ EMBER TIDE".
  - **Void Lantern:** it appeared in the Workshop after F70, slotted 4th in the grid (4.00K Embers; I had 50). No toast and no NEW chip. The other new things in the game get both.
  - **Omen picker:** the ★ badge is a readable 3-line yellow box, but the starred card has no border or glow, so it doesn't stand out from the others.
- Proposed fix:
  - **Seal:** a `FX.banner('★ SEAL OF THE DAY', '+10 RENOWN')`, deferred until `!W.boss && banners.length === 0`. The pill then reads "★ SEALED" for the rest of the delve.
  - **Lantern:** a one-time toast "Void Lantern unlocked in the Workshop" plus the `.new` chip on the card until it's viewed.
  - **Picker:** give the starred omen card a gold border.

### F7 [severity: minor] The "Heart of the Keep" achievement toast spoils the floor-100 boss
- Evidence:
  - The toast "🏆 Achievement: Heart of the Keep" fired on arriving at F100, **3 s before** the "THE HEART OF THE KEEP / BOSS" banner.
  - The cause is `achievements.js:34`: `f100` tests `maxFloorEver >= 100` on `floor`.
- Proposed fix: grant it on the Heart's kill (`on: 'kill'`, `ev.e.heart`), or rename it "Floor 100" and delay the toast until after the boss banner.

### F8 [severity: minor] Esc on a confirm closes the confirm and the Legacy panel together
- Evidence: in both the RETIRE? and RE-DELVE? confirms, one Esc removed the modal and set `#panel` to `closed`. Pressing "NOT YET" keeps the panel open, so the two exits behave differently.
- Proposed fix: in the Esc handler, close only the topmost layer (the modal if present, otherwise the panel).

## Verified fixes from last round (pass/fail, one line each)
- **Re-delve confirm buttons + Esc: PASS.** The 0-Renown demo re-delve shows "NOT YET / RE-DELVE". Esc closes it, though it also closes the panel (F8). Confirming → F6 (Head Start 1), retires +1, no console error.
- **Calm retreat lines: PASS.**
  - "TRAINING ON FLOOR 6: GATHERING STRENGTH" at minute 2 of idling.
  - "REGROUPING BELOW FLOOR 19 - +2 LEVELS TO GO" after the F19 wipe.
  - Both use the grey calm style. A falling floor counter now explains itself.
- **Camping on boss floors: PASS (not reproduced).** 6 wipes on F17–24 produced no boss re-spawn. `S.slain` blocks the second Rat King/Bone King/Brood/Warlord in a delve.
- **Moves wait for the banner: PASS.** WEB SHOT came +4.4 s after the "BROOD MOTHER" banner, and WAR CHARGE +2.6 s and +4.3 s after "GOBLIN WARLORD" (two laps). No overlap.
- **Web tearing: PASS.** 3 web shots and 3 `webTorn` within ~1 s each (ults torn).
- **"TYPE:" callouts: PASS.** The alert reads "WEB SHOT! TYPE: AN ULTIMATE TEARS IT", shown once for 3 shots.
- **Spark glow: PASS.** `#hud-spark` gets `.callout` while a hero is webbed, with a cyan outline and glow (static).
- **Pills vs alerts: PASS.** The DEMO pill was hidden during the Glimpse banner and alert. New issue: the pill is now clickable (F4).
- **Enrage fuse above the bar: PASS.** An orange fuse line above the bar at 76 s. "GOBLIN WARLORD" is clean (no "GUBLIN").
- **Enrage wording: PASS.** "ENRAGED! FALL BACK - BOSS STAYS AT 69% HP" (forced on the Heart of the Keep).
- **"-" instead of "?" in banners: PASS.** "A NEW GENERATION RISES / +30 RENOWN - BEAT 1h 8m".
- **Retire box refresh: PASS.** With Legacy open, crossing F86 switched "REACH FLOOR 86 TO EARN RENOWN / +0" to "RETIRE FOR RENOWN / +4" live.
- **Glimpse bookkeeping: PASS.** `maxFloorRun` and `maxFloorEver` stayed at 40 (no trophy or record from F41). +30 Renown is offered. `glimpseDone` holds, so lap 2 goes straight to "Floor 40 cleared in 12m 54s (best 12m 54s)…" and the 37–39 loop. Demo Head Start is MAX at 1 ("now floor 6, +8 levels").
- **Calm defaults in the browser** (`calm: false, combatSfx: true`): the R7 caps feel right. One move alert per fight, achievement toasts batch, and few toasts overall. The busiest thing left is the per-floor "FLOOR N" banner (every 20–40 s at 1x). The one crowded moment is the F40 kill (F2).
- **Console: clean for r8.** No errors from `?v=r8`. The shop2, CSP inline-handler and R7 TypeError lines all predate this session (`?v=r7` stacks).

## Ideas (optional, max 3)
1. **A sealed gate on every lap.** On each later F40 clear, show a 3 s beat where the party stops at a cracked stone door with the Colossus's ember eyes behind it ("SEALED: FULL GAME"). Re-delvers get the tease every lap, not once.
2. **A wax-seal stamp.** When the Seal of the Day lands, stamp a tiny pixel wax seal onto the omen pill with a soft chime. A daily ritual should have its own sound and shape.
3. **The demo card as a postcard.** Render the card's header from the live canvas: the party in front of the stone Colossus on Magma brick. Streamers screenshot cards. Make that screenshot the store pitch.
