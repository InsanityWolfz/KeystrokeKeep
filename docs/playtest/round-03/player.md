# Round 03 — T4 `player` (first-time player, UX & feel) — DEMO build

I played the demo build in the browser pane at http://127.0.0.1:5173/?demo (innerWidth 1024x768, DPR 1, strip AUTO = 128 px) from a fresh save, like a Next Fest visitor who just downloaded it.

**What I did:**
- **About 10 minutes by hand (game time 0:00–8:30):** I typed real sentences into the notepad in bursts (meeting notes, an email, a bug report…) at about 7 keys/s. I used a page-level keydown typer, because the pane's `type` action still counts 0 keystrokes. I bought everything by clicking: recruited Wren and Mortimer, bought Forge and Workshop upgrades, caught 2 golden rats, and queued two relic offers before choosing.
- **Dev tools to F40:** I used Simulate typing, warp 5x and 20x, and +Gold (about 7 presses in total). I bought upgrades with a small DOM helper that clicks the panel's own buttons. I then watched the F40 Goblin Warlord at 1x and got the **Demo complete** card. I took the F40 relic (Hotkey Ring).
- **Retire and second run:** I retired for +30 Renown and bought Head Start x3, Quartermaster, Lineage, Veterans and Treasury. I ran a second delve at 60x to see what happens after the cap.
- **Cleanup:** fresh-start reset, autotype off, warp 1x, viewport reset to desktop, and navigated back to http://127.0.0.1:5173/ (welcome modal showing, `DEMO_CAP` 0, localStorage empty).

**Caveats:**
- Screenshots trail the page by 1–2 actions, so I checked state with DOM and `KK.S` reads.
- To inspect the 128 px strip I copied the canvas into a 2x pixelated overlay.
- At warp, Fervor sits at IDLE because simulated typing runs in real time (dev artifact). That makes the mid-game wall below look harder than it would for a real typist at 1x.

## Verdict
The first 10 minutes are the best they've been. Here is how fast things happened:
- **FLOW STATE at 84 keystrokes (about 15 s).** That's fast; the R1/R2 calls for a 25–40 s ramp still stand.
- **"Your typing just powered an ultimate!"** right away.
- **First boss (F10 Rat King) at 2:25.**
- **Mossy Caverns and Mortimer by about 6 min.**
- **A guaranteed epic at F30.**

The demo **sells the fantasy**: buttons read honestly now, the relic queue works, and the boss bar is readable.

The demo **ending is a wall, though**. After the F40 card the party silently loops floors 37–39 forever. After one retire, Renown can never be earned again ("REACH FLOOR 41 TO EARN RENOWN"), even though the card invites me to "retire for Renown and try new relic builds". The card itself is a plain text box with a grey 12 px wishlist line and no button. Every pixel-font "floor" also reads **"Aoor"**.

I'd wishlist on the strength of the first 20 minutes. I'd uninstall the demo after the second run. **7/10** (R2 was 7.5; the core improved, but the demo ending costs more than that).

## Findings (ranked, max 8)

### F1 [severity: major] After "Demo complete" the demo is a dead end: no more bosses, relics or Renown, ever
- Evidence:
  - `world.js:501-504`: after `S.demoDone`, reaching floor 39 wraps to 37 (`S.floor >= DEMO_CAP - 1` sets `DEMO_CAP - 4`). The F40 boss can never be fought again, in this run or any later one.
  - Sampled every second on run 2: `37,37,38,38,38,39,39,37,37,37,38,38,38,39,39`. `bossKills` stayed at 6 and `maxFloorRun` at 39.
  - Renown is record-based: `renownGain = renownFor(maxFloorRun) - renownFor(renownFloor)`. The record is 40, so run 2's gain is **0 forever**. `retireTarget()` is 41, and the Legacy box shows a dead "REACH FLOOR 41 TO EARN RENOWN" button (screenshot after the retire).
  - The last relic of every later run is the F30 one.
  - Yet the demo card says: "The strip keeps running: farm gold, retire for Renown and try new relic builds."
  - There is also a silent wrap from F40 to F37 right after the kill (HUD "FLOOR 37"), with no banner, 2.5 s before the card appears.
- Why it matters: Next Fest players who like it keep it open, and the demo becomes a screensaver with nothing to earn. Expected review line: "Demo ends at floor 40 and then nothing you do matters. Retire is broken." It also makes the whole prestige loop look shallow, which is exactly what the full game must disprove.
- Proposed fix:
  - Let the cap boss repeat: in demo mode, wrap only *after* the F40 boss dies (40 → 37), not at 39. Every run then ends on a boss and a relic.
  - Make demo Renown repeatable. Either:
    - (a) while `DEMO_CAP` is set, pay `renownFor(maxFloorRun) * 0.5` per retire instead of record-based, or
    - (b) pay +5 Renown per F40 boss kill.
  - Either way, the Legacy shop (8 of its 11 items affordable at 30–60 Renown) gets a second and third visit.
  - On the wrap, show a banner: "THE DEPTHS ARE SEALED / FULL GAME" (`fx.banner`, 2 s).

### F2 [severity: major] The UI font renders "fl" and "fi" as an "A"-like ligature: "Deepest Aoor", "Reach Aoor 10", "Sparks Are their ultimates", "Ares the next hero's ultimate"
- Evidence:
  - `--font-ui: 'Pixelify Sans'` (`style.css:24`) with default `font-variant-ligatures: normal`.
  - The DOM text is correct ("Deepest floor this delve: 24"), but it draws as "Aoor".
  - A side-by-side test at 40 px: "floor · fl fi ffl" renders as "Aoor · A A AA". With `font-variant-ligatures:none` it renders correctly.
  - Affected text:
    - Legacy: "Deepest floor this delve", "Deepest floor ever", "(floor 40)".
    - Party: "Reach floor 10/18 to meet them".
    - Party subtitle: "Your Sparks fire their ultimates" reads "Sparks **Are**".
    - Hotkey Ring relic card: "fires" reads "**Ares**".
    - Head Start: "floors deeper (now floor 1)".
- Why it matters: It shows in the first 30 seconds (Party tab) and in every screenshot or GIF of the panels. It reads as broken localization or an amateur build. "Floor" is the game's core number.
- Proposed fix: In `css/style.css`, add `font-variant-ligatures: none; font-feature-settings: "liga" 0, "clig" 0;` on `:root`/`body`, or on every rule using `var(--font-ui)`. This is a one-line fix.

### F3 [severity: major] The "Demo complete" card undersells the full game and lands in a pile-up
- Evidence:
  - `ui.js:454-461`: an `h2` and two paragraphs of text. The only call to action is a 12 px muted line, "Wishlist Keystroke Keep on Steam to get pinged at launch.", plus a single "KEEP DELVING" button.
  - There are no run stats, no art of what's next, and no wishlist button.
  - Within about 5 s at the climax I got:
    - the retire nudge toast (mid-boss, at F40: "Retiring now earns +30 Renown (+114%…)"),
    - then a silent teleport to F37,
    - the relic toast ("The boss dropped a relic!…"),
    - and then the card.
  - The card mentions "The Magma Depths, The Hollow Void and their bosses" by name only.
  - Nothing before the cap tells you the demo ends at F40. There is no "DEMO" text anywhere in the HUD or panels (only `ui.js:455` mentions it).
- Why it matters: This card is the conversion moment of the whole Next Fest effort. Right now it feels like a wall, not a cliffhanger, and the wishlist ask is the least visible text on it.
- Proposed fix:
  - Rebuild the card:
    - **Header:** "THE CAVERNS ARE CLEARED".
    - **Stats row:** time played, keystrokes, time in FLOW, bosses, relics. You have these in `S.stats`; they're also shareable.
    - **Teaser:** two silhouetted boss sprites (Magma Lord, The Hollow) plus "+2 biomes · Hollowed bosses · 4 more relics…".
    - **Primary button:** **"♥ WISHLIST ON STEAM"**. In Electron, use `shell.openExternal('steam://openurl/https://store.steampowered.com/app/<id>')`.
    - **Secondary button:** "Keep delving".
  - Suppress the retire nudge and the relic toast until the card is closed.
  - Add a small "DEMO · F40" pill under `#hud-biome`, or a line in the Legacy header, from the start so players know the goal.

### F4 [severity: minor] Head Start lies in the demo and eats Renown
- Evidence:
  - `data.js:126`: the effect is capped at 2 levels in demo (`Math.min(l, 2)`), but `max` is still 8 and `desc` uses the uncapped `l`.
  - I bought 3 levels (3+5+7 = 15 of my 30 Renown). The card says "(now floor 16)", but the delve starts at **floor 11** (`KK.mods().startFloor` = 11, HUD "FLOOR 11").
  - The jump banner also said "THE CRYPT / FLOOR 6" while the HUD said FLOOR 11.
- Why it matters: In the demo you get exactly one Renown payout (F1), and half of it can go into a level that does nothing.
- Proposed fix: In `headstart`, use `max: KK.DEMO_CAP ? 2 : 8`, and `desc` should use the capped value. Fix the `jumpFloor` banner so it shows the real start floor.

### F5 [severity: minor] Ult charge bar over the next hero isn't understandable
- Evidence:
  - `render.js:445-457` draws a 10x2 world-px bar (20x4 css px at S) in white or cyan directly above the green HP bar. There's no icon, label or tutorial toast. In the 2x canvas overlay it reads as "a second HP bar" or a shield.
  - With 1–2 heroes, Sparks sit at 113–146/150, so the bar is permanently full and blinking at 3 Hz (`Math.floor(t*6)%2`). Meanwhile the knight waits out his 6 s cooldown, so "full" doesn't mean "now".
  - With 4 heroes plus Echo (Sparks 1–25), it finally fills and drains in a readable way.
- Why it matters: It's another blinking element in the corner of your eye, and it doesn't teach "typing → ultimate", which is its whole purpose.
- Proposed fix:
  - Draw it in the Spark colour with a 3 px ⚡ pip on the left, and put it under the feet (or as a thin arc), away from the HP bar.
  - Blink only when charged **and** off cooldown. While cooling down, show the fill dimmed.
  - Add a one-time toast on the first full charge: "The ⚡ bar under a hero fills as you type. When it's full they cast their ultimate."

### F6 [severity: minor] First-run wall at F27–30 with no retire hint, and the hint texts still collide
- Evidence:
  - Without a retire, run 1 stalled at F27–30 from about 13 to 30 min (wipes 1 → 11, `bossBlock` 30). This is exaggerated by warp, since Fervor was IDLE.
  - The hint "⚠ BOSS TOO STRONG: FARMING. LEVEL UP!" drew over the "RETREAT! / THE PARTY FALLS BACK A FLOOR" banner (same spot, screenshot at F27), which is still the R2 F3 collision.
  - `renownGain()` was 13 there. The retire nudge (`ui.js:498`) needs gain ≥ 30 or 25 min of runtime, so it stayed silent. The F20 toast "Retire… (when you get stuck)" had disappeared 10 minutes earlier.
- Proposed fix:
  - When `bossBlock` is set and `renownGain() ≥ 10`, change the farming hint to "Stuck? ♛ Retire: +13 Renown (+40% forever)".
  - Allow one floating text channel at a time: suppress hint texts while `fx.banner` is active.
  - `ui.js:498` multiplies total elapsed real time by the *current* warp. Switching to 60x after 1 min counts as 60 min. Accumulate sim time instead (`KK.simTime`).

### F7 [severity: minor] Retire keeps the old income rate, giving a floor-1 windfall
- Evidence:
  - `A.retire` (`state.js:263-277`) never resets `S.incomeRate`. Right after retiring, the HUD showed "1.81K/s" at floor 1, and gold went from 0 to 4.81K in a few seconds.
  - Keycoins pay `incomeRate*3` (`state.js:128`) and rats pay `incomeRate*75` (`world.js:539`), so the first minute after a retire pays at the old run's rate.
- Proposed fix: In `A.retire`, set `S.incomeRate = 0` (keep `incomeAvg` for offline pay, or reset it too).

### F8 [severity: minor] Small things (each under 5 minutes)
- **(a)** The Workshop panel header still says **"SPARK WORKSHOP"**, while the tab and HUD tooltip say "Workshop". Rename it "WORKSHOP".
- **(b)** The relic toast "THE BOSS DROPPED A RELIC! CHOOSE IT IN ◆ RELICS…" sits at y≈440 (pane coordinates), on top of the relic overlay's "TAKE … / DECIDE LATER" row (y≈450). Clicking ◆ while the toast is up hides the take button. Clear relic toasts when `#relic-offer` opens.
- **(c)** With Echo Rune plus several ults, the canvas labels overprint each other: "ECHECHO!" and "ARREARTHSHATTER!" on the boss strip at F39. Show "ARROW STORM ×2" once instead of two offset labels.
- **(d)** On a biome change, three floor labels stack in the centre: HUD "FLOOR 21 / MOSSY CAVERNS", the banner "MOSSY CAVERNS", and a small "FLOOR 21" under it. Drop the small subline when a biome banner shows.
- **(e)** The dev "+5 Floors" button (`ui.js:568`) ignores `DEMO_CAP`, so it can push you to F42 in the demo. Clamp it to `DEMO_CAP`.
- **(f)** Queued relic offers can repeat the same three commons (F10 and F20 both rolled Coffee, Giant's Belt and Lucky Coin). Avoid re-offering the exact set of the previous offer.
- **(g)** Single-hero phase (0–1:45): Sparks hit the 150 cap with one hero (one ult every 6 s), so most early typing is wasted. That's fine for 2 minutes, but it's where the bar blinks constantly (F5).

## Verified fixes from last round
- **Disabled Spark/Renown button styling:** PASS. Unaffordable Workshop and Legacy buttons are dark with muted text, affordable ones are bright. The big retire button shows a dark "REACH FLOOR 20 TO EARN RENOWN" until it's available.
- **Relic queue:** PASS.
  - I left F10 pending, and F20 queued behind it (`relicQueue` length 1, HUD badge "2").
  - The overlay said "(1 MORE WAITING)", and the second chest opened as soon as I took the first.
  - Nothing was lost. (Note: a retire still clears unchosen offers, `state.js:269`, without saying so in the confirm.)
- **Boss bar and crit readability:** PASS for the bar and crits; PARTIAL for hint text.
  - The boss name and red bar now sit at the right, under the HUD buttons ("THE RAT KING", "GOBLIN WARLORD"), clear of `#hud-center`.
  - Crits ("31.1K!", "192K!") are legible and no longer cover the party.
  - The "BOSS TOO STRONG" hint and the "RETREAT!" banner still overlap (F6).
- **Badge calm-down:** PASS. All badges have `animation: none`, and only the relic badge carries a `glow` class. Still, 4–5 badges are lit most of the time (Party, Forge and Workshop "!", plus relic and Legacy), so the relic one only stands out by colour.
- **Golden rat catchability:** PASS.
  - It moves in screen space at 22 world/s, so it takes about 23 s to cross the strip at y≈545/600.
  - I caught 2 of 4 tries even with about 3 s of tool lag. I missed the 2 tries I made without leading the click. A human would catch it easily.
  - Reward: +510 gold and +25 Embers at F13.
- **Workshop/Embers naming and HUD Embers:** PASS. The tab reads "WORKSHOP" with a candle icon, the HUD shows the Ember count next to Sparks, the retire confirm says "Keeps: Renown, Legacy, Workshop upgrades, Embers.", and Legacy shows "(no record yet)". One leftover: the "SPARK WORKSHOP" header (F8a).
- **Card wrapping:** PASS. No more "LV / 0" splits; long names get LV on their own row. It's slightly inconsistent ("KINDLING LV 0" inline, "OVERCHARGE / LV 1" stacked). Buttons are pinned to the bottom. The x1 buttons are 30 px tall and Recruit/x10 are 46 px, so they line up at the bottom but their tops differ.
- **Hollowed naming:** PASS by code (`world.js:80` gives "The Hollowed Rat King"). It can't be reached in the demo.
- **Ult charge bar over the next hero:** FAIL on understandability (F5). It draws and fills correctly.
- **Retire nudge toast:** PASS, but the timing is off. It fired at F40 ("Retiring now earns +30 Renown (+114% dmg & gold forever)…"), mid-boss and right before the demo card (F3). It never fires for a player stuck at F30 with +13 (F6).
- **Console:** no game errors. The only messages are the same 32 pre-existing CSP "Fetch API cannot load /js/*.js" lines from the harness.

## Ideas (optional, max 3)
1. **Demo "trophy shelf" at the end:** the Demo complete card shows the run as a pixel postcard: party sprites, relics owned, "4,420 keys · 16m in FLOW · F40 in 50 min". Add a "Copy as image" button (canvas → clipboard). That's free word-of-mouth from Next Fest players posting their postcard.
2. **Sealed door at F40 in the demo:** instead of silently looping 37–39, the party walks up to a glowing magma door with a lock and a "FULL GAME" plaque, turns around and farms. It's a visible, diegetic cliffhanger every time you glance at the strip, and it's better than a modal.
3. **First-run goal line:** a small "Next: Mortimer at F10 · Relic at F10 boss" line under the floor during the first 15 minutes, to keep the novelty cadence visible while you work.
