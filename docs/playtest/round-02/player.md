# Round 02 — T4 `player` (first-time player, UX & feel)

I played in the browser pane at http://127.0.0.1:5173 (innerWidth 1024x768, DPR 1, strip AUTO, which is 128 px here, the same as S) from a fresh save.

**What I did:**
- **Typing by hand:** about 5 real minutes in the notepad, in bursts of real sentences. I used the pane's `key` events plus a page-level keydown typer at about 7 keys/s. The pane's `type` action uses insertText and fires no keydown, so it counts **0** keystrokes. That is a tool quirk, not a game bug.
- **Normal play:** I recruited Wren and Mortimer by hand. I bought Spark Jar with Embers, caught a golden rat, and lost to the F10 boss once. I took Echo Rune and Whetstone through the two-step pick.
- **Settings:** I tried Calm mode, 15/30/60 fps, and sizes AUTO/S/M/L. I muted with the new HUD 🔊 button.
- **Retire:** I retired at F24 for +7 Renown and bought Heroic Lineage and Veteran Recruits.
- **Dev tools to go deeper:** I used +Gold, +5 Floors and warp to reach The Hollow Void and floor 87. I fought **Hollowed The Rat King** at F80 and left a relic offer pending with "Decide later".

**Caveats:**
- The pane was **hidden** the whole session. Chrome then throttles requestAnimationFrame to about 46 Hz, and screenshots trail the page state by about one action, so I checked everything important with DOM and state reads.
- Frame-rate numbers below are relative only.

At the end I did a fresh-start reset (welcome modal showing), set warp to 1x with autotype off, and reset the viewport to desktop.

## Verdict
Round 1's biggest problems are fixed:
- No relic popup steals my click any more.
- Calm mode exists.
- The panel no longer jumps.
- Embers turn the Workshop from "broken" into something I check every few minutes.
- The onboarding toasts are good: "Each keystroke makes a Spark…", "Wren can be recruited…", "FLOW STATE! Keep typing…".

What hurts now is mostly polish:
- **Buttons you can't afford look exactly like buttons you can** in the Sparks and Legacy tabs.
- **Boss fights at the small strip size are an unreadable pile** of damage numbers, the boss name and the HUD.
- **Badges bob on 5 of 7 HUD buttons**, so the one that matters (a relic waiting) doesn't stand out.
- **A second boss silently replaces a relic you postponed.**

I'd keep it running tomorrow, in Calm mode. No refund. **7.5/10** (up from 6.5).

## Findings (ranked, max 8)

### F1 [severity: major] Disabled Spark/Renown buttons look enabled (Workshop and Legacy)
- Evidence:
  - In `css/style.css:255-257`, `.buy:disabled` is declared before `.buy.spark` and `.buy.renown`, at the same specificity (0,2,0). The colored background therefore wins, and only the text color changes, to a muted `#7d6fa0` on bright pink or cyan.
  - Measured with 0 Renown: every Legacy "UPGRADE ♛ 2/6/4/8" button is `disabled:true` but still `background: rgb(233,162,255)`.
  - The big disabled **"REACH FLOOR 25 TO EARN RENOWN"** button is the same bright pink call-to-action.
  - In the Sparks tab with 77 Embers, all four UPGRADE buttons (60/100/90/140) were the same bright cyan, although only Spark Jar was affordable.
  - Gold buttons in Party and Forge grey out correctly, so the player learns "bright = buy", and then the Sparks and Legacy tabs lie.
- Why it matters: You click, nothing happens, and it feels broken. On the retire button it reads as "press me". The review line would be: "half the buttons don't work".
- Proposed fix: Move `.buy:disabled` below lines 256-257, or add `.buy.spark:disabled, .buy.renown:disabled { background:#3a2f4f; color:#7d6fa0; box-shadow: inset 0 -3px 0 #2a2140; }`. Give the big retire button a distinct "locked" look (dark fill, dashed border, lock glyph).

### F2 [severity: major] A second boss kill silently overwrites a postponed relic offer
- Evidence:
  - `A.rollRelics` (`js/state.js:224-238`) always does `S.relicOffer = out`.
  - The new flow ("DECIDE LATER (IT'LL WAIT IN ◆ RELICS)") invites you to postpone, but a pending offer isn't queued. If you keep working past the next boss, the old three cards are gone with no message.
  - I left the F80 offer (Whetstone / Hotkey Ring **epic** / Enter Amulet) pending. I couldn't reach the F90 boss in time to watch it happen live (stuck on a 2.7B-HP Void Knight), so this one is **code evidence**.
  - The HUD badge suggests a count ("1"), which makes players expect stacking.
- Why it matters: The fix for "relic interrupts work" turned into "relic disappears if you don't interrupt your work". Losing an epic you saved for later feels worse than the old misclick.
- Proposed fix: Make `S.relicOffer` a queue (`S.relicOffers = [[...],[...]]`). The badge shows the count, and the overlay header says "1 of 2". At minimum, if an offer is pending when a boss dies, keep the old offer and don't roll a new one.

### F3 [severity: major] Boss fights and late-game crits are unreadable at the small strip size (text pile-up over the HUD)
- Evidence: Zoomed screenshots at 128 px strip:
  - **F20 Bone King:** "EARTH…" + "1.2K" + "2.42K" + the canvas boss HP bar + "THE BONE KING / BOSS" banner all sit on top of each other. The boss name and HP bar are drawn over the HUD's "THE CRYPT" label.
  - **F80 Hollowed Rat King:** six stacked "51.9M" numbers, and "HOLLOWED THE RAT KING" overlapping "THE HOLLOW VOID".
  - **F81–87 with Keen Edge:** every hit crits. The crit text is scale 2 (`fx.js:141`), so "134M!" / "143M!!" is about 120 px wide and covers the whole party and the enemy.
  - **F9 and F67:** "⚠ BOSS TOO STRONG: FARMING. LEVEL UP!" collides with the "RETREAT! / THE PARTY FALLS BACK A FLOOR" banner and the damage numbers.
  - M (192 px) and L (256 px) look good. AUTO picks 128 px on a 1080p-tall screen, so most players see the cramped version.
- Why it matters: "Who's winning?" can't be answered during the moments that matter most (bosses). It reads as visual noise in the corner of your eye, which is the opposite of Calm.
- Proposed fix:
  - Crit scale 2 → 1.4. Above ~10 hits/s, show one merged per-target number instead of per-hit numbers.
  - Clamp floating text to x ranges that avoid `#hud-center`.
  - Draw the boss name and HP bar at the right edge of the play band (under the HUD buttons), not centered under FLOOR.
  - Suppress floating hint texts while a banner is active (one text channel at a time).
  - Make AUTO pick M when the screen is ≥ 900 px tall.

### F4 [severity: minor] Badge fatigue: 5 bobbing badges, so the relic badge doesn't stand out
- Evidence: Mid-run, Party "!", Forge "!", Sparks (orange "!"), Relics (purple "1") and Legacy (purple) all bob at once (`.hbtn .badge { animation: bob 1s infinite }`, `style.css:181-187`). The relic-waiting signal is only a ~6 s toast plus the same small bobbing square. After the toast fades I'd miss it. Calm mode doesn't stop the bobbing.
- Why it matters: It's constant motion in peripheral vision, and the one important call to action is lost among routine "you can afford something" hints.
- Proposed fix:
  - Routine "affordable" badges become a static dot with no animation.
  - Only the Relic badge animates. Give it a slow 2 s glow and the gem icon.
  - Better (R1 idea): a small chest prop on the strip that sits by the party until opened.
  - Calm mode disables all badge animation.

### F5 [severity: minor] Golden rat is still very hard to catch: it sits at the very bottom and crosses the strip in about 9 s
- Evidence:
  - Rat y = 56 (world), so it renders at about 551/600 in my screenshots, under the heroes' feet.
  - Its screen speed was about 58 px/s in the throttled pane at a sim ratio of about 0.63, so roughly 90 px/s real. The walk speed went down (28), but the camera scrolls with the party, so the rat's speed relative to the screen is still about R1's.
  - I missed **5 times**, including a 3-click spread, and only caught it after freezing the sim.
  - The reward (+155 gold, more than my bank) and the toast "A GOLDEN RAT! CLICK IT BEFORE IT ESCAPES!" are great.
- Proposed fix:
  - Spawn the rat at a fixed screen position (rat x relative to `KK.view.left`), not in world space.
  - Or make it run *with* the camera, or use the R1 "peek from a crack for 10 s" idea.
  - Raise it to y ≈ GROUND-10 and widen the hitbox to 18.

### F6 [severity: minor] Embers and Sparks naming is still muddled
- Evidence:
  - The tab and HUD button are called **"Sparks"**, but the Workshop is bought with **Embers**. The header says "77 EMBERS".
  - The Retire confirm says "Keeps: Renown, Legacy, Spark Workshop, Sparks" and doesn't mention Embers (the thing that is actually kept).
  - The HUD never shows Embers, so you only see them in the tab.
  - Embers pile up fast with steady typing: 71 after ~340 keys, and 980 unspent after ~25 min of autotype because I didn't look.
  - The explainer line ("Every 4 Sparks your heroes spend on ultimates leave behind 1 Ember…") is clear, and I understood it on first read.
- Proposed fix:
  - Rename the tab and button tooltip "Workshop".
  - Show "🔥 N" Embers as a small sub-line in the spark box.
  - Retire confirm text: "Keeps: Renown, Legacy, Workshop upgrades and Embers."

### F7 [severity: minor] Card titles wrap so "LV 0" breaks across two lines (Forge, Sparks, Legacy at 1024 px)
- Evidence:
  - "SHARPEN / BLADES" with "LV / 0", "RIVET / ARMOR", "OVERCHARGE LV / 0", "STATIC / COINS LV / 0", "HEROIC / LINEAGE LV / 1".
  - Party cards also change height when a "LV 40: x1.5" line appears, so the LEVEL UP button moves between y≈357 and y≈370.
  - The MAX button switches between one-line and two-line "X31 / 3.69K" labels.
  - This is unchanged from R1.
- Proposed fix: Put the LV badge on its own row under the name (or `white-space:nowrap` with a smaller name font). Give `.card` a fixed footer (`margin-top:auto` on the button) so buttons never move.

### F8 [severity: minor] Small things
These are each under 5 minutes to fix:
- **(a) Hollowed boss naming:** The boss name reads "**HOLLOWED THE RAT KING**" / "Hollowed The Bone King". Use "THE HOLLOWED RAT KING" (insert after "The") or "RAT KING, HOLLOWED".
- **(b) First-retire wording:** The Legacy text says "Renown is paid for beating your deepest record (**Floor 0**)" on the first run. Use "(no record yet)".
- **(c) Boss kill flash outside Calm:** It is still a 0.85 white full-strip flash plus shake 6 (`fx.js:161-162`). Boss spawn is 0.5, wipe 0.6, and the first FLOW 0.45. R1 asked for a cap of about 0.25 outside Calm. The routine ult flashes did get softer.
- **(d) Biome name clipping:** `#hud-biome` (x 458–566) overlaps `#hud-fervor` (starts at 564), so the last letter is clipped ("MOSSY CAVERN", "THE HOLLOW VOI"). Add 6 px of gap, or set `max-width` with ellipsis.
- **(e) Frame pacing:** `main.js:43-46` sets `last = now` after a frame passes the `1000/fps - 2` gate. At 30 fps on 75 Hz or 100 Hz monitors this gives 25 fps, and about 23 fps on the throttled 46 Hz pane (measured 20.7 draws/s at setting 30, 11/s at 15). The cadence is uneven. Use an accumulator: `last += interval; if (now - last > interval) last = now;`.
- **(f) Stuck-fight hint:** At F75 a Void Knight with 2.7B HP took about 160 s to kill and the party never died, so no "FARMING" hint appeared and nothing visibly happened (this was caused by my dev skip). Consider a "this fight is slow: level damage" hint when a non-boss fight lasts more than 60 s.
- **(g) Mute icon:** The HUD mute button uses OS emoji (🔊/🔇) next to pixel-art icons. It works (sound and the taskbar icon toggle together), but it looks off-style. Use a pixel speaker sprite.

## Verified fixes from last round
- R1-F1 FLOW too cheap and loud: **PASS (mostly).**
  - FLOW now takes about 75 keys (~11 s of steady typing). You fall out after a pause of about 9 s.
  - The full banner, flash and burst are gated to once per 10 min (`fx.js:246-260`). Re-entries get a small "FLOW!" text and ring.
  - It's still quick to reach. R1 asked for 25–40 s. Acceptable.
- R1-F2 flash, shake and text noise, no calm option: **PARTIAL.**
  - Calm mode works (shake, hitstop and slow-mo off; flash ≤ 0.06). Routine ults are softer. Keystroke blips default off with their own toggle.
  - Boss kill is still a 0.85 flash outside Calm, and text pile-ups remain in boss fights (F3).
- R1-F3 relic popup interrupts and misclicks: **PASS.**
  - No auto-open; a toast and badge appear instead.
  - Clicking a card within 600 ms of opening was ignored (tested).
  - Select → "TAKE ECHO RUNE" is clear, and "Decide later" works.
  - New bug: offer overwrite (F2).
- R1-F4 Sparks Workshop unusable: **PASS.** Embers accrue fast and the Spark Jar was bought in minute 4. Display bug: F1.
- R1-F5 panel jumps: **PASS.** The panel has a fixed height and the tab row and X stay put. They only move with strip size, which is expected.
- R1-F6 HUD collisions and size S: **PARTIAL.** The biome now sits under the floor (2 px clip, F8d). The canvas boss name and HP bar still collide with the HUD center (F3). There is no compact HUD at S.
- R1-F7 pillars hide the party and enemies have low contrast: **PASS / NOT DONE.** I never saw a pillar over a hero. Enemy outlines are not done, but the Void Knight was readable.
- R1-F8 retire flow and Renown visibility: **PARTIAL.**
  - "REACH FLOOR 25 TO EARN RENOWN" is clear and so is "+21% dmg & gold".
  - Renown is pinned in the Hall of Legends header (♛ 7).
  - Veterans applied immediately (knight 1 → 6).
  - The Hall of Legends is still below the retire box and stats, so you must scroll to spend.
- Tester reset instructions: **PASS** (in LOOP.md).
- Golden rat: **FAIL** (F5).
- Fractional gold costs: **PASS** for costs. The HUD bank still shows "1.2" or "1.5" gold early on, which is cosmetic.
- Card wrapping: **FAIL** (F7).
- `buildPanel` crash: **PASS.** No game errors.
- Console: the only messages are 32 pre-existing CSP "Fetch API cannot load /js/*.js" errors, one per asset. No `fetch(` exists in the repo, so they come from the harness or another tester's probe, not from the game. Nothing came from my play.

## Ideas (optional, max 3)
1. **Relic chest on the strip:** The boss drops a chest that sits by the party with a faint glow, and clicking it opens the offer. Unopened chests stack (up to 3) next to the door. This fixes F2 and F4 at once, and it's anticipation, not interruption.
2. **"Session card" when you stop typing for 5 min:** A small toast like "Today: 3.4K keys · 14m in FLOW · F24 → F31 · 1 relic". It makes the typing → progress link visible, and it's shareable.
3. **AUTO size picks M on screens 900 px or taller:** M (192 px) was where the game looked best. The art and FLOW glow read well, and the boss fight is legible.
