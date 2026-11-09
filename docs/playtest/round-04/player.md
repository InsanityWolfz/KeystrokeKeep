# Round 04 — T4 `player` (first-time player, UX & feel) — FULL game

I played the full game in the browser pane at http://127.0.0.1:5173/ from a fresh save. The page reported 1024x768 (screenshots scaled to 800x600), DPR 1, and strip AUTO = 128 px. The assets were `?v=r4`, as loaded at the start of the session.

**Note:** `js/data.js`, `js/state.js` and `js/fx.js` changed on disk while I played:
- Second Wind now triggers after 30 s.
- A "SECOND WIND!" text was added.
- Static Coins now has `needsTyping`.

My page kept running the build it loaded, so the Second Wind and Static Coins notes below describe that build.

**What I did (wall-clock / sim time):**
- **Hand phase, 0–10:30 at 1x:**
  - **Typing:** a page-level keydown typer put real sentences into the notepad at about 6–7 keys/s, with a 1.5 s pause every 60 keys.
  - **Clicks by hand:** Start, recruiting Wren, the Party tab, the Relics tab, and picking and taking Critic's Lens.
  - **Shopping:** a small helper that clicks the panels' own buttons, cheapest first. I recruited Mortimer and Sister Pell by saving gold.
- **Run 1 to the first wall:** warp 5x, then 20x, with the same shop helper. The F50 boss blocked me at sim 72 min.
  - I added one relic offer with `KK.actions.rollRelics()` to test the retire warning.
  - First retire: +51 Renown.
- **Run 2 (Head Start x5, Quartermaster, Recruiter, Lineage):** F61 at sim 57 min. Second retire: +40 Renown, then the Omen modal. I picked Storm Front.
- **Run 3 (Veterans x5):**
  - The Void at F61 and The Hollow at F70 at 1x.
  - F76 stalled. I used 4 presses of +Gold and Party MAX.
  - The Hollowed Ember Colossus at F80 at 1x.
  - Second Wind test: a 66 s break.
  - "+5 Floors" to F86, then state edits `KK.S.floor = 99` / `100` with `KK.world.reset()` and `maxFloorRun = 100`.
  - Forced Sanctuary: I set hero HP and called `KK.world.damageHero` on the knight.
  - Echo: `KK.S.relics.push('echo')` plus +Sparks.
- **Third retire:** inflated to +151 by my `maxFloorRun` edit. Omen modal #2, where I picked Deep Omen, then bought out most of Legacy.
- **Cleanup:** fresh-start reset, warp 1x, viewport reset to desktop, and navigated back to http://127.0.0.1:5173/. The welcome modal shows and localStorage is empty.

## Verdict
The first 10 minutes are tight:
- FLOW at about 15 s.
- Wren at 1:05, F10 boss at about 2:30, F20 at 5:10.
- Mossy Caverns at 5:50, Mortimer at 6:30, Sister Pell at 10:24.
- Two relics by 6 min.

Run 2 is the best moment in the game: F50 in 29 sim min against 72 for run 1. That speed-up sells the retire.

After that the game stops introducing ideas:
- **The Omen modal** is a decent choice. But it's a wall of 12 px text with no up/down colour coding. You can't see the active omen anywhere on the strip.
- **The Hollow and the Hollowed bosses** are re-tinted damage sponges. My party never dropped below 65% HP from F70 to F100, and Sanctuary never fired naturally in about 40 sim min of Void.
- **F76–F100 is a slow grind:** about 7 sim min per floor at 20x, numbers piling up, a boss that's white from hit-flash most of the time, and nothing new.
- **Legacy was nearly bought out by my third retire** (only Lineage, Treasury, Veterans and Head Start were left). The third retire was inflated by my edit, but R3's sim gives 279 Renown at 4 h, which is enough to do the same.

I'd keep it running tomorrow for the first two runs. I wouldn't refund, but my review would say "great first 2 hours, then it's the same strip with bigger numbers." **7.5/10** for the full game. R3 gave the demo 7.

## Findings (ranked, max 8)

### F1 [severity: major] Late game has no danger: Sanctuary, the Cleric and "boss" tension vanish after the Magma Depths
- Evidence:
  - From F75 to F100 (run 3, Veterans x5, 4 heroes at Lv 110–180), I counted ults: knight 31, archer 24, mage 24, **cleric 0**.
  - HP samples every second through the Hollowed Ember Colossus (F80, about 60 s): the lowest single hero was 65%. On the same fight the boss went 65% → 9% while heroes sat at 88–100%. The Hollow (F70) took about 50 s with no hero below about 80%.
  - At F99 I set `KK.S.floor = 99` (about 20 floors past the natural wall). Enemies took 21% of the knight's HP per hit and he was topped back to 100% within about 1 s. Heals kept the party full.
  - In my 3 runs the party only wiped at the walls, and those were slow-farm walls, not fights.
  - Sanctuary only fired when I forced a KO with `damageHero(knight, hp+1)`. When it fires it looks great: a gold ring, pillars, "SANCTUARY!" and "REVIVED".
- Why it matters: The cleric is a dead hero for the last two biomes, and "bosses" are HP bars, not events. Review risk: "the late game is just waiting for numbers to go up."
- Proposed fix: Make late bosses threaten instead of only soaking:
  1. **Hollowed bosses** get a telegraphed signature slam every 8 s: a red ground flash 1 s before impact, dealing 45% of party max HP to all.
  2. **Scripted Sanctuary at 50% boss HP**, as in the R3 backlog: "Sister Pell answers the Void!" That gives each boss a 2-beat arc.
  3. **Enemy attack scaling:** scale `eAtk` with floor past 60 (+1.5% per floor) so heal and Armor upgrades matter again. Gate it so a wipe costs only 1 floor, as now.

### F2 [severity: major] Head Start without Veterans throws the new party backwards: the first Renown purchase most players make feels broken
- Evidence:
  - After retire 1 (+51 Renown), the Legacy grid offers Head Start at 3/5/7/9/11 Renown. Buying 5 levels put me on F26 (Mossy) with a **level-1 knight**.
  - `W.recover` drops one floor per wipe (`world.js:543`). Within about 10 sim min the party was on **F9** with `bossBlock=10`, and 29 wipes were on the stat sheet: a stream of "RETREAT!" banners.
  - The whole Head Start purchase (35 Renown) was refunded as wipes.
  - Run 3, with Veterans x5 bought first, started F26 at Lv 53 and was fine.
  - The Head Start card never mentions this ("Begin each delve 5 floors deeper").
- Why it matters: The first Legacy visit is the big prestige payoff, and Head Start is the most exciting-sounding card. It makes the second run start with a 10-minute losing streak.
- Proposed fix (pick one):
  - (a) Never retreat below `m.startFloor`: in `W.recover`, `S.floor = Math.max(KK.mods().startFloor, S.floor - 1)`.
  - (b) Better: Head Start also grants starting levels, for example `startLvl += 8 * l` (F26 ≈ Lv 40), so the jump is survivable without Veterans.
  - Either way, add "(heroes start at Lv X)" to the card's `desc`.

### F3 [severity: major] Omen choice is clear in text but not exciting or legible: no up/down colour, no "who it's for", and invisible once picked
- Evidence:
  - **Modal:** `UI.chooseOmen` (`ui.js:442-463`), 3 cards of 132x141 px with 12 px Pixelify text.
  - **Wording:** each card's upside and downside sit in one sentence ("Ultimates cost 30% less and hit 50% harder, but Fervor drains twice as fast."). Nothing colours the good part green and the bad part red. At 1:1 I had to read every word, and in the scaled screenshot "x1.25" and "x0.85" read as "x1.88" / "x0.8S".
  - **Timing:** the modal appears **while the new delve is already running**. Behind it, "A NEW GENERATION RISES / +40 RENOWN" plays and the party starts fighting (F26 → F25 retreat during my read).
  - **Clicks:** there's no hover or selection state. One click commits, and there's no confirm.
  - **After the pick:** a toast ("Omen: Storm Front…"), and then the omen exists only as a line in the Legacy panel ("Omen this delve: Storm Front"). There's no HUD pill or icon, and the strip itself never changes.
  - **Repeats:** both offers I saw contained Deep Omen ({march, deep, storm} then {hoard, muster, deep}).
- Why it matters: Omens are the R3 answer to "more of the same", but they read like a settings dialog. A player can't remember what they picked an hour later, and the strip looks identical either way. The run doesn't feel different.
- Proposed fix:
  - **Card layout:** split each `desc` into `up` / `down` fields, rendered as a green "▲ Gold x2" line and a red "▼ Monsters +40% HP" line.
  - **Tags:** add a tag like the Workshop one: "FOR TYPISTS" (Storm Front), "FOR IDLERS" (Quiet Halls), "RISKY" (Deep, Glass).
  - **Pause:** pause the sim (`KK.warp = 0`) while the modal is open.
  - **Visibility:**
    - Show a small omen icon pill under `#hud-biome`, the same slot as the demo pill, with a tooltip.
    - Tint the strip per omen: gold motes for Gilded, red vignette for Deep, faster torch flicker for Storm.
  - **Variety:** don't re-offer an omen from the previous offer.

### F4 [severity: major] After about 3 hours there's nothing new to chase: F100 is just a number, and Legacy maxes out
- Evidence:
  - **F100:** "FLOOR 100 / THE HOLLOW VOID" with the normal floor banner. There's no trophy, milestone or line of text.
  - **F80 Hollowed boss:** "VICTORY! / The Hollowed Ember Colossus falls", the same banner as the F10 Rat King. Its relic offer was 3 commons (Enter Key, Whetstone, Bottomless Coffee).
  - **Relic stacking:** I owned Coffee x3 across runs. Late relic offers are filler.
  - **Legacy:** after my third retire, these were MAX: Quartermaster, Recruiter, Zealous Spirit, Warm Campfire, Idle Battery, Relic Collector. Left: Lineage, Treasury (infinite +25%), Veterans 5/10 and Head Start 5/8. My Renown was inflated by the `maxFloorRun = 100` edit, but R3's sim gives 279 Renown at 4 h, which covers the whole finite list.
  - **Stats:** the Legacy stats show "Deepest floor ever" but no goal.
- Why it matters: This is the "content runs out in 3 hours" review sentence (T3's #1 Steam risk). The game has omens now, but no *target*.
- Proposed fix (smallest first):
  1. **Depth trophies** at 75/100/110/125 (backlog R1): a gold banner "DEPTH RECORD: 100", a permanent +5% damage each, and a trophy row in the Legacy stats. Also a "Next trophy: F110" line under the stats.
  2. **A real F100 finale boss**, "The Keeper of the Keep": a unique sprite and a 3-phase fight. The first kill unlocks Legacy tier 2.
  3. **Legacy tier 2:** 4–6 new nodes (an omen reroll, a 4th omen card, keep 1 relic through a retire, Hollowed relic pool), shown greyed with "Defeat the Keeper" from the start, so there's something to look forward to.

### F5 [severity: minor] Late-game number soup: damage numbers and crits overprint the HUD and each other, and the boss is white from hit-flash most of the time
- Evidence:
  - At F70–F100 (2x canvas overlay), the numbers stack into unreadable strings such as "3240 2.57M / 4?7 3 1M / 24.8M", "54 10.2M 8.41 1M" and "REVIVED29..23.5M".
  - Crits like "123M!" and "261M!" draw over the HUD floor label (`#hud-center` "FLOOR 70/100").
  - At late-game attack speed, the Hollowed Colossus and the F100 mobs show as a white silhouette in most frames, so the purple Hollowed tint is only visible between hits.
  - Floating "SIR CLANK LV 130 / x1.5 DAMAGE!" banners plus "LV 62"-style texts fire about every 20–40 s with Quartermaster. Each one plays the milestone arpeggio (`audio.js:183`).
- Why it matters: The strip should be readable at a glance. At this point the glance says "noise". The milestone arp every half minute is irritating on a call.
- Proposed fix:
  - **Damage numbers:**
    - Above 1K damage per second on screen, merge numbers per target into one rolling total that updates for 0.6 s ("DPS ticker").
    - Show crits only when they're more than 5x a normal hit.
    - Clamp numbers to y ≥ 20 world px, below the HUD centre.
  - **Hit flash:** limit to 1 frame every 0.25 s per enemy (`h.flash` cooldown).
  - **Milestones:** past Lv 100, banner only at every 50 levels, and play the milestone sound only when the panel is open or calm mode is off.

### F6 [severity: minor] Wall hint "Stuck? ♛ Retire" works but is hard to read and isn't clickable
- Evidence:
  - It appeared at F49 after the F50 boss wiped the party ("Stuck? ♛ Retire: +51 Renown", `bossBlock = 50`). It's hidden while a banner plays and while standing on the boss floor (`ui.js:83`).
  - It's a 10 px `#ffb4a0` label with only a 1 px shadow (`.farm-tag`, `style.css:155`).
  - On the Magma Depths' orange-red bricks it nearly disappears. Gold pops ("+1.6K") cross it every second at the party's x.
  - It's a `div` with no handler, so you can't click it to open Legacy.
- Proposed fix:
  - Give `.farm-tag` a pill: `background:#120d1acc; border:1px solid #000; padding:1px 5px`.
  - When it shows the retire text, make it a button that runs `UI.open('legacy')`.
  - Move gold pop texts 10 px higher, or clip them away from `#hud-center`.

### F7 [severity: minor] Second Wind (loaded build) works but is invisible, and the effect is tiny
- Evidence:
  - With Second Wind Lv 5 (`m.secondWind = 20`), after a 66 s break the first keys gave +3 Sparks each (`seq 3/sw19, 3/sw18…`), so it works mechanically.
  - On screen nothing happened: no text, no toast, no glow on the Spark bar.
  - The total is +40 Sparks per break, about one ultimate.
  - On disk (mid-round) `fx.js:321` now adds "SECOND WIND!" and the break is 30 s. That's good; verify it next round.
- Proposed fix:
  - Keep the new text, and also tint the Spark bar `#ffb070` while `S.secondWind > 0`, with a "+2" spark particle per key.
  - Consider +3 per key, or 6×level keys, so a Lv 5 break is worth about 2 ultimates.

### F8 [severity: minor] Small things
- **(a) Legacy panel after a retire:**
  - The "Spend your Renown in the Hall of Legends!" toast opens Legacy, but at 1024x768 the Hall of Legends grid starts at y≈440 (pane coordinates). Only the top row of cards peeks above the strip, so you have to scroll.
  - Fix: after a retire, set `#panel-body.scrollTop` to the Hall header, or put the Hall first and the retire box and stats below it.
- **(b) Retire confirm:** it warns about the chest ("You have 1 unopened relic chest(s). They will be lost."). Add an **OPEN CHEST** button next to it, and fix the "(s)" to proper pluralisation.
- **(c) Repeated commons:** offers repeat across runs (Backspace Boots at F10 and F20 of run 1; Bottomless Coffee picked 3 times). Exclude the previous offer's ids.
- **(d) Biome-change banners:**
  - Three floor labels still stack on a biome change: HUD "FLOOR 61 / THE HOLLOW VOID", the banner "THE HOLLOW VOID" and a small "FLOOR 61" under it (R3 F8d, still open).
  - At F61 a void-eye enemy sprite drew over the middle of the banner text ("THE HOLLOW▮VOID").
- **(e) Party cards:** when the cost has 5+ characters, the LEVEL UP buttons wrap to "LEVEL / UP" (Party cards at 245K). Shrink to "LVL UP" or widen the button.
- **(f) Hollow sprite:** The Hollow (the F70 finale of the Void) is roughly hero-sized and reads like a regular eye monster with a glow. Scale it up 1.5x for the boss frame.
- **(g) Static Coins** had no NEEDS TYPING tag in the loaded build, although it's typing-only. Already fixed on disk (`needsTyping: true`).

## Verified fixes from last round (pass/fail, one line each)
- **Ligature fix ("floor" everywhere):** PASS. The computed `font-variant-ligatures` is `none` on body and `.desc`. A 44 px test of "floor fire · Reach floor 10" renders correctly, and the Party cards read "Reach Floor 10", "Sparks fire".
- **Charge bar under feet:** PASS.
  - It sits under the hero's feet with a yellow pip and cyan fill, and no longer looks like a second HP bar.
  - The first-ult toast ("The bar under a hero fills with your Sparks: full = next ultimate") explains it.
  - It's still easy to miss at 128 px, but it's no longer misleading.
- **First-run wall hint "Stuck? ♛ Retire":** PASS (function) / PARTIAL (legibility). It showed "+51 Renown" at F49 when blocked by F50 (F6).
- **incomeRate reset on retire:** PASS. `incomeRate` was 0.0 right after the retire, and gold climbed 0 → 13 in 5 s. The HUD showed the stale "518/s" for under 1 s, until the next `slowUpdate`.
- **Workshop header:** PASS. It reads "WORKSHOP". The Second Wind card shows the cyan "NEEDS TYPING" tag.
- **Relic toast cleared on overlay:** PASS. Opening the Relics overlay while relic toasts were up left no toast over the TAKE button.
- **Echo text "x2":** PASS. With Echo Rune I saw "METEOR x2!" as a single label instead of an overprint. Some quick casts still show a plain "EARTHSHATTER!", which is fine.
- **Relic chests warning in retire confirm:** PASS. "You have 1 unopened relic chest(s). They will be lost." in red (see F8b).
- **Console:** no game errors. Only the 32 harness CSP "Fetch API cannot load /js/*.js" lines.

## Ideas (optional, max 3)
1. **Omen as a visible "weather" on the strip.** Each omen changes the strip's look for the whole delve: Gilded → coin glints in the torches, Storm Front → rain streaks and lightning flicker on ults, Deep Omen → red vignette and darker bricks. You'd remember what you picked, and a screenshot would show which run it was. This turns omens from a menu into content.
2. **"Keeper's Door" at F100.** A big sealed door with 4 runes. Each rune lights when you beat F100 under a different omen category (risky, greedy, typist, idler). All 4 lights open the finale boss and Legacy tier 2. That gives omens a long-term purpose and the late game a visible goal on the strip itself.
3. **Retire recap card.** On retire, show a one-line postcard: "Run 3 · Storm Front · F87 in 58 min · 600 ults · best boss: Hollowed Colossus 62 s". Then compare it with the previous run ("+28 floors faster"). The prestige speed-up is the best feeling in the game, so show it as numbers.
