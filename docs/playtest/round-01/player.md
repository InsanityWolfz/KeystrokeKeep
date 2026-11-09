# Round 01 — T4 `player` (first-time player, UX & feel)

Played in the browser pane at http://127.0.0.1:5173 (innerWidth 1024x768, DPR 1, strip M unless noted). Fresh save, then about 4 real minutes typing in the notepad by hand in bursts. After that I used the dev tools (autotype, 5x/20x, +Gold, +Sparks, +5 Floors, Rat!) to reach the first relic offer (F10 boss), FLOW, the F20 boss (The Bone King), Mossy Caverns, a retire (+3 Renown), and Magma Depths and Hollow Void (F41/F61). I tried strip sizes S, M and L. When I finished I left the browser on a clean save (welcome modal showing, warp 1x, autotype off).

## Verdict
The first 2 minutes are great. The welcome is clear, every keystroke sends sparks up from the strip, and you buy your first level-up within about a minute. You get the archer at floor 3, and boss VICTORY and recruit banners feel good. The problem is the always-on part. FLOW STATE costs about 8 seconds of typing and replays a full-strip gold flash and banner every time you come back from a short pause. Ultimates flash white and shake the strip every few seconds. The relic offer pops up over your work and takes the first click. I'd keep it running tomorrow only with sound off, and I'd go looking for a "calm" option that doesn't exist. Not a refund, but a 3-star "too distracting to leave on" review is likely. **6.5/10.**

## Findings (ranked, max 8)

### F1 [severity: major] FLOW STATE is reached in ~8 s and its full celebration replays on every re-entry
- Evidence: Fresh save, typing by hand: FLOW was reached after **56 keystrokes, ~6 s**, with the "FLOW STATE! / x2.2 POWER" banner, a gold flash, a ring and 40 particles. I paused 8 s, typed one more sentence, and got the whole celebration again. In code: +2.2 fervor per key (`js/state.js:104`), FLOW at 90 (`js/data.js:138`), so 41 keys. Decay only starts after 1.5 s idle at 3.5/s (`js/state.js:123-125`), so any pause of about 4.4 s drops you out. Every re-entry fires the banner, a 0.45-alpha flash, a ring, a light, particles and the `flow` sound (`js/fx.js:245-250`, `js/audio.js:176`). With autotype (about 5 keys/s) the bar sat in FLOW permanently, and 1.34K keystrokes gave "3m 11s in FLOW".
- Why it matters: FLOW is the game's headline moment, but here it is both trivial (normal typing keeps you in it, so it isn't a peak) and noisy. Someone who types in sentences with thinking pauses will see the big gold banner dozens of times an hour. Expected review: "the strip keeps flashing FLOW STATE at me every time I stop to think."
- Proposed fix: Make FLOW earned and sticky.
  - Gain 2.2 → ~0.8 per key, so FLOW takes ~110 keys (~25–40 s of steady typing).
  - Add hysteresis: enter at 90, leave only below 70, and don't decay for 4 s instead of 1.5 s.
  - Play the full banner, flash and sound at most once per ~10 minutes (or once per session). Other re-entries get a small "FLOW" text and the HUD bar glow only.

### F2 [severity: major] Too much flash, shake and floating text for something that sits in your peripheral vision (no calm option)
- Evidence:
  - `FX.flash` fires on every Knight ult (white 0.2 plus shake 4, `fx.js:200-205`), every Meteor (orange 0.55, shake 6 and hitstop, `fx.js:207-215`), Sanctuary (0.35), FLOW (0.45), Retreat (0.6), boss intro and level milestones. 42 ultimates fired in ~5 sim-minutes.
  - Several screenshots show text piled on top of itself in the 60 px play band:
    - "IN THE ZONE" + "EARTHSHA…" + "RETREAT! / THE PARTY FALLS BACK A FLOOR"
    - "ARROW STORM!" + "EARTHSHAT…" + "MOSSY CAVERNS" + "FLOOR 21" + "178"
  - Damage numbers ("251!", "178") drift up into the HUD and sit on the FLOOR 20 label.
  - Floating texts get clipped at the strip's left edge ("ARTHSHA", "XO4!").
  - Gold pickups ("+4.7", "+4.1", "+15") add to the noise.
  - Audio: every counted keystroke plays a `spark` SFX (`audio.js:165`), and SFX and music both default to ON.
  - Settings has only sound, music, volume, size and counting. There is no reduce-motion or flash option.
- Why it matters: This is a work companion. Repeated white and orange full-strip flashes plus screen shake at the bottom of the screen pull the eye away from work, and they are a photosensitivity concern. A click sound on every key is a "had to mute it in 5 minutes / it beeps during my calls" review.
- Proposed fix:
  - Add Settings → **"Calm mode (reduce flashes & shake)"**. Calm mode caps `FX.flash` alpha at ~0.1, turns off `FX.shake` and `FX.stop`, and halves particle counts. Consider calm as the default for the native build.
  - Even outside calm mode, cap flash alpha at ~0.25.
  - Limit concurrent floating texts to ~4 per side and clamp their y below the HUD row.
  - Drop the per-pickup "+gold" texts (the HUD gold counter pulse is enough).
  - Give banners one priority slot so a new banner replaces the old one instead of stacking.
  - Default the per-keystroke `spark` sound OFF, or put it behind its own toggle.

### F3 [severity: major] The relic offer interrupts your work and a single stray click picks permanently
- Evidence: On a boss kill the offer overlay auto-pops at mid-screen above the strip. It covered the notepad's status bar, the sticky and the whole dev-tools window. It also force-closes any open panel (`ui.js:327`), so you can be mid-purchase in Party. One click on a card picks immediately, with no confirm (`ui.js:331-339`). I meant to click the dev-tools "1x" button, which sits under the right card, and permanently took **Backspace Boots (common)** over **Flow Pendant (epic)**. In Electron the offer is excluded from click-through (`native.js:37`), so a click aimed at the user's own app behind it will pick a relic.
- Why it matters: Losing an epic to a misclick feels terrible. Popups that grab focus are the #1 annoyance for desktop-companion games.
- Proposed fix: Don't auto-open. On boss kill, show a glowing chest on the strip plus a pulsing badge on the ◆ Relics HUD button and one toast ("Relic waiting!"). Open the offer only when the player clicks. If it must auto-open: ignore clicks for the first 700 ms, make picking two steps (select a card, then "TAKE"), and never close an open panel.

### F4 [severity: major] Sparks are invisible as a currency: the Spark Workshop is a race you can't win
- Evidence: All session the HUD sparks hovered between 2 and 40 of 150 (2/150, 8/150, 6/150, 3/150…), because ultimates spend them as soon as they are affordable. With dev +Sparks I had 150, and by the time the Sparks tab rendered (under 1 s) I was at 135. Static Coins (140) was already greyed out. I could only buy Spark Jar by clicking immediately. As a player I never once saw the jar fill up on its own. This confirms backlog item R0 from the player's side.
- Why it matters: A whole tab ("never resets!") is unusable for active typists, the people the game is for. Players will read it as broken or pointless.
- Proposed fix: Add a **"Save Sparks for upgrades" toggle** (or a reserve slider) on the Sparks tab and as a small lock icon on the HUD spark box. While it's on, ults only spend Sparks above the reserve. Also show "Saving for: Spark Jar (80)" progress on the spark box. Alternatively, ultimates could spend a separate meter, with Sparks as pure currency.

### F5 [severity: minor] Panel tab bar and close button jump when switching tabs or strip size
- Evidence: `#panel` is bottom-anchored and sized to its content. Relics is 170 px tall while Party/Forge/Sparks/Legacy/Settings are about 374 px, so the tab row moves between about y=150 and y=285 in the screen frame. Clicking "Settings" in the spot where it had just been landed on nothing, and my close click (X at 761,223) missed after a size change moved it to (761,195).
- Why it matters: Small but constant friction. You have to hunt for tabs every time.
- Proposed fix: Give `#panel` a fixed height (e.g. `height: min(374px, 50vh)`) with `#panel-body` scrolling, so the tab row and X never move.

### F6 [severity: minor] HUD collisions at common laptop widths (1024–1280 CSS px) and at strip size S
- Evidence: At innerWidth 1024, `.hud-center` spans x 427–597 and `.fervor` spans 566–756. They overlap by 31 px, so the biome name ("THE CRYPT", "MOSSY CAVERNS", "MAGMA DEPTHS", "THE HOLLOW VOID") is always hidden under the fervor box. That's a 1280x800 laptop at 125% scaling. The boss HP bar and floating numbers also overlap the floor label. At size **S** the 46 px-tall HUD covers the top ~36% of the 128 px strip.
- Why it matters: You can't see which biome you're in, which is one of the main "new thing!" signals. The HUD reads as messy.
- Proposed fix:
  - Stack the biome name under "FLOOR N" (smaller, centered), or hide it below 1280 px and show it only in the biome-change banner.
  - Below 1280 px, move the fervor box into the left column under the spark box.
  - At size S, use a single-row compact HUD (icons and numbers only, no box padding).

### F7 [severity: minor] Foreground pillars hide the party; dark enemies blend into some biomes
- Evidence: Foreground pillars (`render.js:233-243`) are near-black, 27 screen px wide, full height, with parallax 1.3. The camera stops during fights, so a pillar can sit on a hero for the whole fight. On the F20 screenshot Sir Clank was completely hidden behind one. Fire Imps (red) on Magma's red-orange bricks and enemies in the Void are low-contrast. I often found the target by its HP bar or damage number, not its sprite.
- Why it matters: The "who's winning at a glance" read fails exactly when it matters (boss fights).
- Proposed fix:
  - Skip foreground pillars within ±40 world px of `W.partyX` and the current target, or draw them at 35% alpha.
  - Add a 1 px dark or light outline to enemy sprites, keyed to the biome palette (light outline in Void and Magma).

### F8 [severity: minor] Retire flow leads you into a useless purchase; Renown isn't visible
- Evidence: After confirming Retire (+3 Renown), Legacy auto-opens with the toast "Spend your Renown in the Hall of Legends!". The upgrades are below the fold and need a scroll. I bought **Head Start** ("Begin each delve 5 floors deeper") and it did nothing, because the new delve had already started at floor 1. Renown is not shown in the HUD, and once you scroll down Legacy doesn't show it either. The retire modal says "+3 RENOWN" but not what that buys.
- Why it matters: The first prestige should feel like a power spike. Instead the first Renown purchase is visibly wasted.
- Proposed fix:
  - Turn the retire confirm into a two-step "Retire → Spend Renown → Begin new delve" screen, and apply the Legacy effects (Head Start, Veteran Recruits) when the new delve starts.
  - Or apply Head Start immediately if it's bought while still on floor 1 of a fresh delve.
  - Pin a "♛ N Renown" counter in the Legacy header (sticky).
  - Put the Hall of Legends above the stats box.

## Other observations (lower priority)
- **Testers' reset is broken:** `localStorage.clear(); location.reload()` does **not** give a fresh start. The `beforeunload` handler re-saves the live state (`main.js:42`), so the welcome modal never shows, and that's what happened on my first attempt. Use `KK.resetting = true; localStorage.clear(); location.reload()` or Settings → Reset save. Please update the LOOP.md tester instructions.
- **Golden rat:** It runs right to left against the camera, along the very bottom edge of the strip (`y = GROUND+6`), and crosses in ~5–8 s. It's very hard to click while working, and I missed twice. The reward (+66 gold, about 10x my bank at that point) and the burst are excellent juice. Suggestions: walk it at y = GROUND−4, use 0.6x speed, and give it a 20 px hitbox.
- **Fractional gold** in costs ("LEVEL UP 8.8", "1.2" gold) looks off for an idle game. Round costs up to integers below 1000.
- **Card text wrapping** on the Sparks/Legacy cards at 1024 px: "OVERCHARGE / LV / 0" and "NEEDS [icon]" (Idle Battery) are truncated. Put the LV badge on its own line or shrink the name.
- **Console:** no errors from real play. Two `TypeError … [UI.tab] is not a function at buildPanel (ui.js:140)` errors came from my synthetic clicks on the Settings size buttons while the panel was closed. Add `if (!UI.tab) return;` at the top of `buildPanel` to be safe.
- **What worked well:**
  - The welcome modal copy.
  - Cyan spark particles on each key.
  - The "!" badges on the HUD and tabs, and the hover tooltips on the HUD buttons.
  - x1/x10/MAX buying.
  - The recruit banner ("MORTIMER JOINS! / THE MAGE").
  - The level-10 milestone banner.
  - The boss intro and "VICTORY! THE BONE KING FALLS".
  - "RETREAT! THE PARTY FALLS BACK A FLOOR", which clearly explains a wipe.
  - The clear Retire confirm (lists what resets and what stays).
  - Size L looks great.

## Verified fixes from last round
- n/a (round 01).

## Ideas (optional, max 3)
1. **"Deep work" FLOW:** Make FLOW quieter, not louder. When you're really in flow, the strip dims its effects and the music thins out, and the party glows gold. When you stop, you get a satisfying "FLOW: 12 min, +3.4K gold" summary popup.
2. **Relic chest on the strip:** The boss drops a chest that sits in the corridor and the party guards it. You open it whenever you like, and the choice happens in the Relics panel. That's anticipation instead of an interruption (fixes F3).
3. **"Peek" golden rat:** The rat pokes its head out of a crack for ~10 s with a little shimmer, then vanishes. That's easier to catch during work and still a delight, and could also be the hook for offline catch-up bonuses.
