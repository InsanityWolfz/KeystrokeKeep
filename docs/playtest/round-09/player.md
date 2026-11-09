# Round 09 — T4 `player` (first-time player, UX & feel, "Steam reviewer after ~3 h")

I played in the browser pane at http://127.0.0.1:5173 (assets `?v=r9`), viewport 1280x720 (strip canvas 1280x128). For pixel checks I copied canvas frames into a 2–3x corner overlay.

**Full game (`/`, fresh save), about 3 hours of simulated play:**
- **First minutes:** real typing in the notepad (a page typer sent ~7 `keydown`/s, 60 s), manual Party buys, and a manual relic pick (Caps Lock Crown).
- **The rest of hour 1:** dev autotype at 5x and then 20x warp. Hidden-pane throttling made this effectively an idle profile. A "glance" helper every 5 s real time recruited first, then bought hero levels and Forge (cheapest first) and one Workshop item per glance.
- **First retire:** at 67 min game time, F36, +22 Renown, done through the Legacy button and confirm.
- **Legacy spend:** I bought Quartermaster and Veteran Recruits by clicking. Head Start, Lineage and Treasury I bought by script.
- **Delve 2:** reached F38 in 16 min, watched the F40 Warlord at 2x and the Magma entry at 1x. Second retire at F55 for +43.
- **Omens and Seal:** omen picker → ★ Ember Tide → Seal at F51 (+15). I staged a second Seal (`S.sealDay = null`) to see the banner.
- **Void and Hollow:** the Void from F61, The Hollow at F70 at 1x (52 s, 1 wipe), the Void Lantern NEW tag. Third retire at F75 (+63), then Glass Delve.
- **Hollowed bosses:** Hollowed Rat King at F80 at 1x.
- **State edits for the Heart of the Keep:**
  - +5 Floors x3 (F81 → F96).
  - About 30x +Gold with glance buys.
  - **`S.legacy.lineage = 30`**: the party was stuck at F96 with 68 s per kill.
- **Heart of the Keep (F100) at 1x.** The fight took ~75 s.
- **Week-2 layer:** retired at +117, then set `S.sealDay = null` (a "new day"). The omen picker showed ★ Ember Tide at F96 for +20; I picked NO OMEN. At F45 I checked the daily re-delve button, its confirm and Esc.
- **Totals at the end:** 17/39 achievements, 2 Seals, 4 retires, 3h 10m game time.

**Demo (`?demo`, fresh save twice):**
- **Peek card:** forced with `playTime = 2400`.
- **Pill:** checked its DOM.
- **Glimpse, two staged runs:**
  1. +5 Floors x8 and `S.heroes` set directly. Only the knight entity existed, which led to the wipe in F1.
  2. +5 Floors x7, then +Gold and glance buys for a proper four-hero party. The F40 Warlord at 1x, then a 400 ms timeline of statue distance, banner, alert and modal through the Glimpse.

**Cleanup:** fresh-start reset, warp 1x, viewport preset desktop, navigated to `/`. Floor 1, empty localStorage, welcome modal showing. Console: no errors from `?v=r9`. The shop2, CSP and R7 TypeError lines predate this session.

## Verdict
After "3 hours", I'd post a 👍 and keep it running tomorrow. These moments would make the review:
- **The hook:** typing straight into FLOW STATE in 15 s. The notepad status line ("828 keystrokes · 7m 13s in FLOW") is a lovely touch.
- **The first retire:** "+18 · +65% DMG & GOLD FOREVER". Delve 2 hits F38 in 16 minutes.
- **The look:** the orange Magma brick and the purple Void.
- **The week-2 hook:** the gold-bordered ★ omen card, a reason to come back daily.

The Glimpse finally lands: the party stops in front of the statue and the card opens on floor 41.

The let-downs a reviewer would mention:
- **The final boss is a reskin.** The Heart of the Keep is the same small ghost as floor 70 with a new name, buried under "34.8B!" numbers.
- **The capstone achievement can be swallowed.** "Heart of the Keep" landed in the 10-minute toast cap and never toasted.
- **Legacy hides its shop.** The Renown shop sits below the stats, the Codex and the 39-achievement grid.
- **One new Glimpse edge case.** A wipe on the Glimpse floor leaves the `glimpse` flag set and blocks Retire while the HUD says "STUCK? ♛ RETIRE: +30 RENOWN".

**Full game 8/10. Demo 8/10** (up from 7).

## Findings (ranked, max 8)

### F1 [severity: major] The Heart of the Keep (F100 finale) is the floor-70 Hollow sprite with a new name, and the arrival trophy banner steals its title
- Evidence:
  - **Same sprite:** `KK.world.boss.key === 'hollow'` at F100 (`world.js:90` only renames `def.name` and sets `heart`).
  - **Too small to see:** at 2.4x magnification it's the same small grey ghost as F70, half-hidden behind "34.8B!" / "50.8B!" crit numbers and the party's hit flashes.
  - **Duplicate title:** on arrival at F100 the depth-trophy banner reads **"HEART OF THE KEEP / FLOOR 100: x1.05 FOREVER"**. 13 s later the boss banner reads **"THE HEART OF THE KEEP / FLOOR 100 BOSS"**: two big gold banners with the same name.
  - **Undercut finish:** VICTORY reads "The Heart of the Keep falls", but the trophy already "paid out" before the fight.
- Why it matters: the end-of-content boss is where reviews are written. Likely review line: "the final boss is just the floor 70 boss again, and I couldn't even see it behind the numbers."
- Proposed fix:
  1. **Make the Heart look different** (cheap version):
     - Draw `boss.heart` at 2x scale with a pulsing red core (reuse the `glow()` used for the sealed statue, `#ff3355`, radius 40).
     - Add a dark-red tint (a `stoneTint`-style recolour).
     - Clamp damage floaters on a heart target to one rolling total (backlog "late-game number soup").
  2. **Rename the trophy banner on F100.** Make it "FLOOR 100 TROPHY / x1.05 FOREVER", or defer the F100 trophy banner until the Heart's `kill`.

### F2 [severity: major] Capstone achievements can be swallowed by the 10-minute toast cap ("Heart of the Keep" never toasted)
- Evidence:
  - **The unlock worked:** `S.ach.f100` was set on the kill (event log: `achievement f100` and `kill hollow` on the same tick). That part of R8 F7 is a PASS.
  - **No toast:** only the relic toast showed. `KK.ui.lastAchToast` was 583 s old (under the 600 s cap in `ui.js:576`), so the unlock went into `UI.achPending` (4 pending).
  - **Real play hits this too:** two achievements within 10 min happens without warp, e.g. Hollowed boss kills, Centenarian, Abyss Walker near F100–125.
- Why it matters: the one achievement a player grinds 3 hours for arrives silently. Likely review line: "beat the final boss and got nothing."
- Proposed fix: give defs a `big: true` flag (f100, hollow, gatekeeper, retire1, f150, codex28, seals30) that bypasses the cap and plays with the VICTORY sting, or queues right after it. Keep the cap for the rest.

### F3 [severity: major] Wipe on the Glimpse floor leaves `S.glimpse = true`: Retire is blocked while the HUD says "STUCK? ♛ RETIRE: +30 RENOWN"
- Evidence:
  - **Staging:** demo run 1, a lone knight entity (`S.heroes` set directly, so it was an under-synced party) on the Glimpse floor.
  - **The retreat:** "RETREAT!" at +5.5 s, then F41 → 40 → 39 → 38 → 37 → 36 → 35 over 30 s, with 7 wipes.
  - **State at F35:** `glimpse: true, demoDone: false, glimpseDone: true, canRetire() === false, renownGain() === 30`.
  - **What the HUD showed:** "STUCK? ♛ RETIRE: +30 RENOWN" plus "DEMO · … · 1 CLEAR". No DEMO COMPLETE card.
  - **Cause:** `W.recover()` (`world.js:745-751`) lowers the floor but never ends the Glimpse. `A.canRetire` (`state.js:309`) refuses while `S.glimpse`.
  - **When it clears:** only when the party re-clears F40 (via the `nextFloor` glimpse branch), or on reload (the sanitiser in `state.js:381`).
  - **Normal play:** a properly recruited party at a normal level (run 2, Lv 71/61/49/34, full HP) did not wipe. So this is an edge case: a barely won F40, a weak or idle party, or Glass Delve-style HP.
- Why it matters: it's the same class of bug as R8 F1, sitting on the demo's most important beat, and the game tells you to press a button that doesn't work.
- Proposed fix:
  - In `W.recover()`: `if (KK.S.glimpse) { KK.S.glimpse = false; W.sealedX = 0; if (!KK.S.demoDone) { KK.S.demoDone = true; KK.emit('demoComplete'); } KK.S.floor = KK.DEMO_CAP - 4; }`.
  - Hide the "Stuck? Retire" hint whenever `!A.canRetire()`.
  - Add a smoke step: Glimpse, then force a wipe.

### F4 [severity: minor] The Legacy shop ("HALL OF LEGENDS") is below the fold, and below the whole achievement grid when it's open
- Evidence:
  - **Panel size:** `#panel .panel-body` is 330 px tall at 1280x720.
  - **Shop position:** "HALL OF LEGENDS" sits at `offsetTop` 439 with the achievements collapsed, and **1058** with them open (the grid is 39 cards).
  - **After the first retire:** the visible part of Legacy says "+0 / REACH FLOOR 37 TO EARN RENOWN" and a stats table. Nothing on screen says "spend your 22 Renown below".
  - **Name clash:** "Hall of Legends" is also the name of an achievement ("Max every capped Legacy upgrade").
- Why it matters: the first-retire payoff is the strongest moment in hour 1. A new player who doesn't scroll sees "+0" and thinks retiring wiped them.
- Proposed fix:
  - Order Legacy as: retire box → Renown shop → Codex → stats → achievements (collapsed).
  - Or add a "♛ 22 RENOWN TO SPEND ↓" chip in the retire box that scrolls to the shop.
  - Rename the achievement to "Living Legend".

### F5 [severity: minor] Achievement progress counters: readable and motivating, with three number issues
- Evidence: the summary line reads well, e.g. "🏆 ACHIEVEMENTS 6/39 · NEXT: Centenarian 41/100" and later "NEXT: Heart of the Keep 81/100". Bars are clear gold. Three issues:
  1. **Counters that go backwards.** Centenarian tracks the *current* top hero level: "NEXT: Centenarian 41/100" at F28, and after the retire it disappeared, so NEXT jumped back to "Forgemaster 2/10". The NEXT line flips with every retire.
  2. **Codex and its achievement disagree.** The Codex box said "next rank in 5 Hollowed kills" (3 kills, counting two Hollow kills) while "Hollow Scholar 0/28" showed an empty bar.
  3. **Number format and order:**
     - "Spark Plug 35/1.00K" and "Warming Up 983/10.0K" ("1.00K" looks like a float).
     - "Deep Work 7m 44s/1h 0m" ("1h 0m").
     - "Bottom of the Keep 101/150" is listed before "Abyss Walker 101/125".
  - **Hard to read:** unearned names and descriptions are at 45% opacity (`.ach:not(.got) > b, span`), barely legible next to the bright bar.
- Proposed fix:
  - Centenarian: track `achP.lvBest = max(lvBest, level)` so the counter never goes backwards.
  - Hollow Scholar: show `codexKills/224` (or rank + "3/8 kills").
  - Goals: use `fmt` with no decimals for goals (`1,000`, `10K`), and "1h" for whole hours.
  - Swap f125 above f150.
  - Raise unearned text to 70% opacity.
  - Pin the NEXT achievement at the top of the grid.

### F6 [severity: minor] Glimpse polish: the statue label is clipped at the top edge, and the DEMO pill sits over the money shot
- Evidence:
  - **Clipped label:** at 2x magnification the "EMBER COLOSSUS - SEALED" label (`render.js:173`, drawn at `gy - 6` above a 1.5x sprite) is cut off at the strip's top edge. The tops of the letters are missing.
  - **Pill over the scene:** the DEMO pill ("DEMO · ENDS AT FLOOR 40 · BEST 20m 6s · 1 CLEAR · ♥ WISHLIST") is drawn across the party and the statue for the whole Glimpse floor. It's still visible behind the card.
  - **Rat during the card:** a golden rat ran across while the card was up and the strip was paused.
- Proposed fix:
  - Draw the label at `Math.max(gy - 6, 7)` or beside the statue.
  - Hide `#hud-demo` while `S.glimpse`, not only during banners and alerts.
  - Don't spawn rats while `KK.paused` or a modal is open.

### F7 [severity: minor] The retire confirm shows a frozen Renown number, and the panel keeps its scroll across tabs
- Evidence:
  - **Stale confirm:** the RETIRE? modal said "+21 RENOWN" while the panel behind it already showed "+22" (the party keeps fighting during the confirm). The retire paid 22.
  - **Shared scroll:** after scrolling Legacy to the shop, the Workshop tab opened scrolled 420 px down with its header cut off. `.panel-body` `scrollTop` is shared between tabs.
- Proposed fix:
  - Update the modal's `+N RENOWN` every 1 s (or pause gains while the confirm is up).
  - Reset `scrollTop = 0` on tab change, or remember it per tab.

### F8 [severity: minor] Late-game strip readability: number soup and the omen pill in the fight lane
- Evidence:
  - **Merged numbers:** at F70–100 the party's incoming damage merges into strings like "34.0KI.0K4.0KI.0K", and crits ("28.9M!", "50.8B!") are bigger than the bosses.
  - **Pill in the fight lane:** the omen pill ("★ EMBER TIDE · ★ SEALED", "◆ GLASS DELVE") sits at the strip's centre right where the boss stands. The Hollow orb and the pill overlapped at F70.
  - **Two floor labels:** the HUD shows "FLOOR 4 / THE CRYPT" and a second floating "FLOOR 4" label stacked on the strip.
- Proposed fix:
  - Roll per-target totals above 1K/s (backlog R4).
  - Move omen and demo pills into `.hud-right` under the fervor meter (backlog R5).
  - Skip the floating floor label when the HUD floor label changed this second.

## Verified fixes from last round (pass/fail, one line each)
- **Glimpse staging: PASS.**
  - The statue is visible from +0 s: 1.5x, outlined, glowing core and blinking eyes.
  - The party halts 22 px short of it with the door at +21 px from +16.4 s.
  - The card opens at +17.2 s **on F41** with the statue in frame, and the strip is paused (`KK.paused = true`).
  - Card text: "The sealed Ember Colossus you just saw waits on floor 50, with its Magma Shell."
  - New issues: label clipping and the pill overlay (F6), and the wipe edge case (F3).
- **Peek card copy: PASS.** "WHAT WAITS BELOW": no stats row, and the footer reads "Reach floor 40 to glimpse the Magma Depths. Your party gets there on its own; typing gets you there faster." No Colossus sprite on the card (optional R8 suggestion not done).
- **Pill wishlist chip + tooltip: PARTIAL.**
  - The text ends "· ♥ WISHLIST" and `title="Wishlist Keystroke Keep on Steam"` is set.
  - The **whole 241x11 px pill** is still the click target (`cursor: pointer`, no separate chip element), and it still sits over the party lane.
- **Daily re-delve label: PASS.** "★ DAILY RE-DELVE: OMEN OF THE DAY" fits on one line next to "+0".
- **Daily re-delve confirm text: PASS.** "Free once a day: this delve pays no Renown, but today's ★ omen pays +20 Renown at floor 96." Nit: "this delve" is ambiguous; say "your current delve".
- **Seal banner: PASS.** `FX.banner('★ SEAL OF THE DAY', '+15 RENOWN')`, deferred until no boss or banner is up. It fired 0.17 s into the banner queue after my staged second seal. It played small because of the 20-min repeat rule, which only my staging triggers; daily seals will be big.
- **"★ SEALED" pill: PASS.** "◆ EMBER TIDE · ★ SEALED" after the Seal at F51. Nit: the tooltip drops the Seal line after sealing.
- **Starred omen card border: PASS.** Ember Tide had a gold border plus a gold "★ OMEN OF THE DAY: FLOOR 51 = +15 RENOWN" box. It stands out clearly.
- **Lantern NEW chip/toast: PASS (chip seen, toast inferred).**
  - The Workshop card reads "Void Lantern LV 0 *NEW* Void slams deal 10% less…" (an italic word, not a pill chip).
  - `S.tutorial.lantern = 1` was set at F70. I didn't see the 6 s toast at 20x.
- **Heart achievement on the kill: PASS.** No unlock on arrival at F100; it unlocked on the Heart's kill. But its toast was swallowed (F2).
- **Esc closes only the top layer: PASS.**
  - RETIRE? confirm: Esc closed the modal and the panel stayed open.
  - RE-DELVE? confirm: the same.
  - A second Esc closed the panel.
- **Achievement progress counters (new): PASS with issues (F5).**
  - Readable, and the "NEXT" line is genuinely motivating ("Heart of the Keep 81/100" pulled me to F100).
  - Wrong or odd numbers: Centenarian goes backwards, Hollow Scholar 0/28 vs the Codex's 3 kills, and "1.00K" / "1h 0m".
- **First boss pacing (idle-ish):** the Rat King died at 7m 23s game time. My helper was broken for minutes 4–7; a clicking player is closer to 5 min. The first retire nudge came around 50–67 min (idle-ish profile, F28 → F36).

## Steam review I'd post (~3 h on record)

> 👍 **Recommended** — *3.1 hrs on record*
>
> Keystroke Keep is the first "desktop idle" game that actually rewards me for working. Every key I type in my real apps charges a tiny pixel party at the bottom of the screen. Ten seconds of typing and the strip lights up into FLOW STATE. The notepad even tells you how long you spent "in flow", which is weirdly motivating. Retiring the party is the best moment: the first one took about an hour, the second run blew through 38 floors in 16 minutes, and the Magma Depths and Void floors look great. The daily Omen + Seal gives me a reason to open it tomorrow.
>
> Gripes: the final boss is just the floor-70 ghost again under a wall of "34.8B!" numbers, and its achievement never even popped. The Legacy shop is hidden under a giant achievement grid; I almost missed my first Renown. Late-game numbers turn into soup.
>
> Low CPU, calm by default, never steals focus. For a few dollars, worth it.

## Ideas (optional, max 3)
1. **A real finale beat for the Heart:** the strip dims, the Heart's core pulses in time with your typing (each key = a heartbeat flash), and the kill shatters it into the Codex pips. Make the last boss *about typing*.
2. **"NEXT" achievement on the strip:** a tiny 1-line gold ticker in the retire box ("NEXT: Abyss Walker 101/125"), so the new counters work without opening Legacy. Show it once per delve, not as a toast.
3. **A Codex kill pip:** on each Hollowed kill, flash "CODEX 3/8" under the VICTORY banner, so the slow week-2 track feels like progress on every kill, not every 8th.
