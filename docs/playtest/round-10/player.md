# Round 10 — T4 `player` (first-time player, UX & feel)

I played in the browser pane at http://127.0.0.1:5173/?v=r10c, viewport 1280x720 (strip canvas 1280x128, view 640 world px). For pixel checks I copied the game canvas into a 2.7x–6x overlay at the top of the page (removed afterwards), and once drew `KK.SPR.frames[key][0].c` for all new creatures at 4x on a Heartroot-coloured sheet.

**Two builds this round.** My session was interrupted by a usage-limit pause. When I came back, the lead had already landed R10 parts 1–3 (45278ee, c0ff1e2, cc956d7). So:
- **Before the reload (commit 51310be):** the first 10 minutes, the first Rootmother/Keeper fights and the old Root Ward card.
- **After a reload (same save, new code):** the Rootmother and Keeper again, the Echoed Depths, banners, achievements and the console.

Every finding below was re-checked on the new code unless it says otherwise.

**What I did:**
- **Fresh save, first ~10 min:**
  - A page typer sent `keydown` events at ~7 keys/s (a fast typist). Real `computer.key` presses also count; `computer.type` does **not** count, because it inserts text without key events.
  - I bought with Party clicks plus a small "glance" helper.
  - I picked one relic by hand (Giant's Belt).
  - About 1x for 3 min, then 5x.
- **Late content:**
  - Set `S.heroes` to Lv 470–1000, then `S.floor`, `S.maxFloorRun` and `S.slain = {}` so bosses respawn (cleared boss floors skip the boss via `S.slain`, `world.js:90`).
  - Fought the Rootmother (f120) 4 times and the Keeper (f140) 3 times, once with typing paused for 2.5 s.
  - Walked f149 → f171 through Echoed Crypt / Caverns / Magma, with `daysPlayed` 1 and then 5.
  - Event log, a 200 ms timeline of alerts/texts/roots/locks, and an `FX.banner` wrapper for the banner count.
- **Cleanup:** fresh-start reset, warp 1x, viewport back to desktop. Floor 1, empty localStorage, welcome modal showing.

## Verdict
The Heartroot is the best-looking biome in the game: maroon brick, hanging root vines with pink sparks, a crowned flower-stalk Rootmother and a 44 px Keeper. **Lockdown (new build) is a genuinely good typing beat:** "LOCKDOWN! TYPE TO BREAK THE SEAL", 10 keys, "SEAL BROKEN!" and the sealed ultimate fires at once. Overgrowth is the opposite:
- The roots are invisible at strip size.
- A typist tears them in 0.4 s, before the alert has even faded.
- After the first one, there is no prompt at all.

The Echoed Depths past f150 look exactly like floors 1–60 with purple monsters. A reviewer will say "after 150 it just loops". The first 10 minutes are as good as R9: FLOW in ~20 s, first boss at 2:20 with heavy typing. I'd keep it running: **full 8/10, demo 8/10** (demo not re-played this round; nothing in it changed).

## Findings (ranked, max 8)

### F1 [severity: major] Overgrowth doesn't read and doesn't feel like anything: roots are invisible, the alert shows once per 10 min, and typing tears them in 0.4 s
- Evidence (new build, Rootmother f120, 4 fights):
  - **Roots are tiny and low-contrast.** They are six 1 px dots plus one 12x1 line in `#7a4a24` per hero (`render.js:481`). At 6x magnification I could just make out a thin brown line across each hero. At strip size, on the maroon Heartroot wall and inside the gold FLOW outline, it is invisible.
  - **No per-hero text.** Overgrowth sets `h.webbed` directly (`world.js:543`) and does not emit `webbed`, so the new "ROOTED: TYPE!" text never appears for it. Only Root Lasher roots get it.
  - **The alert shows once per 10 minutes.** `FX.moveAlert` gates on 600 000 ms per type (`fx.js:105`). The 2nd and later Overgrowths in a fight, and the next Rootmother within 10 min, show nothing at all.
  - **Typing tears the roots before you can react.** Timeline at 7 keys/s:
    - t+0.0: roots k/a/c/m = 1.5 s left.
    - t+0.1: 0.8 s left.
    - t+0.4: 0.1 s left.
    - t+0.6: four stacked "ROOTS TORN!" texts.
  - **The prompt outlives the problem.** The alert "OVERGROWTH! TYPE TO TEAR THE ROOTS" (1.4 s) stays on screen 1 s after the roots are gone.
  - **Idle players lose little.** With typing off, the roots simply expire after 2 s.
- Why it matters: this is the Heartroot's signature typing mechanic, and to a first-time player it is a 1.4 s caption with no visible cause and no felt effect. Likely review line: "the bosses' special moves are just text that flashes."
- Proposed fix:
  1. **Draw roots that read.** A 2 px tall `#6cd05a`/`#7a4a24` vine wrapping each rooted hero's feet and shins (y+10..y+14), plus 2–3 thorny strands rising to the knees, and a light green outline.
  2. **Make tearing a short typing beat.** Overgrowth needs N keys (about 6) for the whole line. Show N pips above the party that crack one per key, so "TYPE!" becomes a 1-second mini-goal. End the alert when the roots are torn.
  3. **Emit one party-level "ROOTED: TYPE!"** on Overgrowth, and one "ROOTS TORN!" over the party instead of four stacked copies.
  4. **Let move alerts repeat as a small one-liner** (no box) after the first big one per fight, instead of being silent for 10 minutes.

### F2 [severity: major] "Big banner only the first time in a save" resets on every launch: `bannerFirsts` is saved but dropped on load
- Evidence:
  - **The save has it:** `localStorage['keystroke-keep-save-v1'].bannerFirsts` = `{"boss:The Rootmother":1,"boss:The Keeper":1,"boss:The Hollowed Rat King":1}`.
  - **But `KK.newState()` has no `bannerFirsts`** (`'bannerFirsts' in KK.newState()` is false).
  - **`KK.load` copies only keys that exist in the fresh state** (`state.js:385-391`).
  - **Result in the browser:** after my reload, `S.bannerFirsts` held only the keys earned after the reload. Everything seen earlier (the Rat King, the Crypt, the Heartroot...) would be big again.
- Why it matters:
  - R9's banner calming (market F: 28–46 big banners/h → 1–14) only holds within one app session.
  - For a desktop strip that is started every morning, the first boss, biome and JOINS banner of every session are big again.
  - Captures restarted from a save get big banners too.
- Proposed fix: add `bannerFirsts: {}` to `KK.newState()`. Add a smoke check: save, reload, and `Object.keys(S.bannerFirsts).length` must be unchanged.

### F3 [severity: major] The Echoed Depths look exactly like the old biomes: floor 152 is the floor-1 Crypt
- Evidence:
  - **f152 "Echoed Crypt":** the same grey brick, torches and banners as floor 1. Only the monsters get a 50% `#6a2cff` overlay (`hollowTint`, `render.js:524`).
  - **f169 "Echoed Caverns":** the green caverns of f21–40. Slimes and goblins are lilac, and the room is unchanged.
  - **Day 1 is all one biome:** with the new day gate (`biomeOf`: `open = daysPlayed`), every 10-floor band is "Echoed Crypt". A day-1 player at f151–200 sees the floor-1 room for 50 floors, with an "ECHOED CRYPT / FLOOR 161" banner every 10 floors.
  - **The HUD label is the only cue.** "Echoed Crypt" is small text under the floor number.
- Why it matters: after the best-looking biome (the Heartroot), the game drops back to its first screen. Likely review line: "after floor 150 the game just loops back to the start with recoloured enemies."
- Proposed fix: give echoed bands an "echo" pass on the palette and art:
  - Darken walls and floor 25% and mix the fog toward `#2a0f40`.
  - Add the Void's emissive star layer (`render.js` emis for `void`) at 50%, plus a slow purple vignette.
  - Tint the torches purple and draw the HUD biome label in `#c472ff`.
  - Day 1: name the bands "Echoed Crypt I/II/III", or use the Heartroot as a second option, so it isn't one name 5 times.

### F4 [severity: minor] Floor 150, "Bottom of the Keep", is the end of the new biome and is fought against a Hollowed Rat King, with 4 big banners in 8 s
- Evidence:
  - **The boss:** at f150 `bossFor` falls to the Hollowed rotation (`state.js:82`). I got "THE HOLLOWED RAT KING / FLOOR 150 BOSS", a purple-tinted floor-10 rat.
  - **The banner burst** (my `FX.banner` log, t = game seconds):
    - 2090 "DEPTH TROPHY / FLOOR 150: x1.05 FOREVER"
    - 2094 "THE HOLLOWED RAT KING"
    - 2096 "VICTORY!"
    - 2098 "ECHOED CRYPT / FLOOR 151"
  - **The same 4-banner burst repeats every 10 floors** from f160 on (trophy + boss + VICTORY + Echoed band).
- Why it matters: the Heartroot ends on the weakest boss in the game. The trophy steals the first beat, as it did at f100 in R9.
- Proposed fix:
  - Make f150 a Heartroot finale: the Rootmother and the Keeper together, or a Heart Warden-guarded Rootmother. Move the Hollowed slot to 130/110 only.
  - Fold the depth trophy into the boss's VICTORY sub-line on boss floors ("VICTORY! · FLOOR 150 TROPHY x1.05").

### F5 [severity: minor] New creature readability at strip size: the Lasher looks like wall décor, the Keeper looks like a Void monster, and the Warden's guard is rarely seen
- Evidence:
  - **Sprite sheet at 4x:**
    - Root Lasher (12x16): a thin red flower on a green stem. At 1x on the root-veined maroon wall it reads as a decoration until it shoots.
    - Spore Bloat (14x12) and Sporeling (8x6): clearly a pink blob and a mini blob. Good, and the split reads.
    - Heart Warden (14x16): a brown golem. The stone tint while guarded is visible.
    - The Rootmother (24x40): a crowned flower stalk. Distinct and on-theme.
    - The Keeper (26x44): a purple robe, a gold crown and a gold staff.
  - **The Keeper's purple is the Void/Hollow family:** the Hollow is also purple and crowned, and Echoed monsters are tinted the same `#6a2cff`. In a Heartroot palette it reads as "a Void boss wandered in".
  - **The Warden's guard is almost never seen by typists.** In the old build, 21/21 guard breaks were by an ultimate within 1–2 s of contact, never worn. The new "GUARD WORN" path exists, but typists will rarely see the guard last.
- Proposed fix:
  - Lasher: a bulb or eye at the top plus a 1 px dark outline, so it separates from the wall vines.
  - Keeper: recolour to heartwood/bone (`#5e3a24` robe, `#ff4f7a` heart-core lantern instead of the gold staff), keeping the crown.
  - Warden: show a small "GUARD" shield pip over it while guarded (like the lock), so the x0.5 is readable even if brief.

### F6 [severity: minor] Lockdown: a good beat, but the second and later ones are nearly invisible, and "SEALED" collides with the alert
- Evidence (new build, f140):
  - **First Lockdown:** "LOCKDOWN! TYPE TO BREAK THE SEAL", then 10 keys (`lockKeys` 0 → 9 in 1.2 s), then "SEAL BROKEN!" and ARROW STORM fired the same frame. This feels great.
  - **Text collision:** the "SEALED" text (`h.y - 26`) is drawn in the same band as the alert. At 6x the word is cut by the alert box.
  - **Later Lockdowns are almost unmarked.** With the 10-minute alert gate, a 2nd or 3rd Lockdown shows only "SEALED" for 1.2 s and a 5x3 px yellow lock (`render.js:480`), which I could only find at 6x. Lockdown hit the mage 3 times in a row in one fight.
- Proposed fix:
  - A 7x7 lock with a soft yellow glow, and 10 tiny key pips under it that fill as you type.
  - Draw "SEALED" under the hero's name bar, not at alert height.
  - Use the same "small repeat alert" rule as F1.

### F7 [severity: minor] Late-game text pile: status words, damage numbers and crits share one column (R9 F8, carried)
- Evidence:
  - **Merged numbers:** f120 "22.3417.7T3T" and "1531" + "24T" + "110T" merge.
  - **Crits bigger than bosses:** "2.11QA!" was drawn larger than the 44 px Keeper.
  - **Stacked status words:** at f140, "ROOTED: TYPE!", "SEALED", "423T" and "1.86T" stacked over the front hero and the Lasher in one column.
  - **Hidden behind the HUD:** "GUARD BROKEN" was partly hidden under the floor plate.
- Why it matters: the new mechanics depend on words (ROOTED, SEALED, GUARD), and those words now fight the damage numbers.
- Proposed fix:
  - Route status words to a fixed status line just above the party's HP bars, one word per hero at a time.
  - Roll damage into per-target totals above 1K/s (backlog R4).
  - Cap crit text at 1.5x normal size past f100.

### F8 [severity: minor] Relic and naming polish around the new content
- Evidence:
  - **Old Root Ward (pre-fix):** an epic offered next to Enter Amulet ("Ultimates cost 40% fewer Sparks"), with a desc that used "Overgrowth" before the player had met it. It was a trap pick.
  - **New Root Ward (rare, f90+):** "Webs and roots last 60% shorter, +2 Sparks per tear". Fine, but I didn't see it in a fight after the reload.
  - **Reused icon:** the card uses the `shield` icon, the same blue shield as Rivet Armor in the Forge.
  - **"Echo" names collide:** "Echoes of the Deep" (6 Hollowed bosses), "Echoes All the Way Down" (f175), the Echo Rune relic and "Echoed" monsters. Two achievements side by side both start "Echoes".
  - **Chests pile up:** at f140 the HUD Relics badge read 12 with "9 RELIC CHESTS ARE WAITING". Each needs open → card → pick: 27 clicks to clear.
- Proposed fix:
  - A root-and-shield icon for Root Ward.
  - Rename "Echoes of the Deep" to "Hollow Hunter".
  - In the relic modal, add "TAKE + NEXT" (pick and open the next chest in one click) when more than 1 chest is waiting.

## Verified fixes from last round (pass/fail, one line each)
- **First 10 minutes vs R9: PASS, no regression.**
  - At ~7 keys/s: FLOW STATE in ~20 s, Wren at 2:01, first boss (Rat King, f10) at 2:11 → kill 2:20, relic modal two-step fine, Mortimer at 7:06.
  - The f19 "TRAINING ON FLOOR 19: GATHERING STRENGTH" hold showed at 5–8 min while I saved gold.
  - The notepad status line ("6.25K keystrokes · 21m 26s in FLOW") still delights.
- **Welcome card line (tray / Ctrl+Shift+Alt+K / never online): PASS.**
- **HUD plate behind the floor line and brighter biome label: PASS** ("FLOOR 101 / THE HEARTROOT" in pink is legible).
- **Legacy order: PASS.** "HALL OF LEGENDS" renders before the achievements in the panel.
- **First-only big banners: PARTIAL.** It works within a session (the 2nd Rootmother banner was small), but it resets on every load (F2).
- **Heartroot entry banner: PASS.** Big white "THE HEARTROOT", pink "FLOOR 101", on the first entry.
- **New achievements: PASS.** Root and Branch, Weed Killer, Keys to the Keep and Abyss Walker unlock on time. "Echoes All the Way Down" shows a gold bar "171/175", and the summary reads "ACHIEVEMENTS 16/43 · NEXT: Echoes All the Way Down 170/175".
- **Heart of the Keep (f100): not judged.** My overpowered staging killed it in ~2 s, and R9 verified it at 1x.
- **Capstone toasts:** "Keys to the Keep" is `big: true`. I didn't catch its toast in the warp.
- **Console: PASS.** No errors from r10 code. The only errors are old ones: CSP fetch blocks from a previous session's probe, `shop2 is not defined`, and an R7 `ui.js?v=r7` TypeError.
- **Width note:** at an 800 px wide viewport, "FLOOR 1 / THE CRYPT" overlaps the "IDLE x1.0" fervor bar. It's fine at 1280; real strips are wider.

## Ideas (optional, max 3)
1. **Roots that you type off, letter by letter.** On Overgrowth, put the next 6 letters the player types as glyphs on the vines (it never records keys, just shows "a key happened" as a vine snapping). Each key snaps one vine with a crunch, and the last one bursts the whole line free. That makes the Heartroot about typing the way the Heart idea in R9 asked for.
2. **Echoed floors as a "memory" of the old biome.** Draw the old biome at 60% with the Heartroot's root veins still crawling over it, so the Echoed Depths look like the Heartroot growing into your old floors. It tells a story and fixes F3.
3. **A Keeper "key" drop:** after the Keeper's kill, a golden key floats to the Relics icon and opens one waiting chest automatically. That's thematic ("Keys to the Keep") and cuts chest-queue clicks.
