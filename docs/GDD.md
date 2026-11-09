# Keystroke Keep — Game Design Doc (v0.1)

> **Working title.** A tiny dungeon crawler that lives in a strip at the bottom of your screen.
> **Your work is their adventure:** every key you type and every click you make powers a party of tiny heroes delving an endless dungeon.

| | |
|---|---|
| Genre | Desktop idle / incremental, roguelite-lite |
| Format | Full-width strip docked above the taskbar (always on top, ~150–220 px tall) |
| Platform | Windows first (Steam), macOS/Linux later |
| Price | $4.99 (launch discount 10–15%, deep sales to $2.99) |
| Session shape | Glance-and-go: runs all day, check in every 10–30 minutes for 30–90 seconds |
| Milestone | **Steam Next Fest demo locked by Jan 10, 2027** |
| Tech | HTML5 Canvas + vanilla JS → wrapped in Electron (or Tauri) for Steam |

---

## 1. Pillars

1. **Your activity is the fuel.** Typing and clicking anywhere on your PC charges your heroes. Being productive *feels* like playing. This is the hook; protect it above everything else.
2. **Never in the way.** Calm by default, readable at a glance, never steals focus, never demands input. You can mute it, shrink it, or ignore it for hours.
3. **Number go up, loudly when it counts.** Quiet moment to moment, but boss kills, FLOW STATE, rare relics and level-ups *explode*: shake, fanfare, loot fountains.
4. **Always a reason to glance.** Something new every few minutes: a relic choice, a recruit, a golden rat, a boss.

## 2. Core loop

```
 you type / click ──► Sparks (currency) + Fervor (buff meter)
                         │                    │
                         ▼                    ▼
              heroes auto-cast ULTIMATES   party fights harder & faster,
                                           dungeon gets brighter
                         │
 party auto-walks ──► fights waves ──► gold & chests ──► level heroes / Forge
        ▲                                   │
        │             every 10 floors: BOSS ──► choose 1 of 3 RELICS (run-only)
        │                                   │
        └── hit a wall ──► RETIRE the party ──► Renown ──► permanent Legacy upgrades
```

* **Idle layer (gold):** heroes earn gold whether you're active or not. Offline progress pays out when you return.
* **Activity layer (sparks + fervor):** only real input produces Sparks and Fervor. A non-typer still progresses; an active worker progresses 2–3x faster and gets the fireworks.
* **Glance layer (decisions):** spend gold, pick relics, recruit heroes, retire.

## 3. The activity system (the hook)

| Input | Sparks | Fervor |
|---|---|---|
| Keystroke (non-repeat) | +1 | +2.2 |
| Mouse click | +1 | +1.5 |

**Fervor** (0–100) decays at 3.5/s after a 1.5 s grace period. Continuous typing reaches FLOW in about 15–20 s. Tiers:

| Tier | Fervor | Power | Feel |
|---|---|---|---|
| Idle | 0–24 | x1.0 | dim dungeon, calm music |
| Focused | 25–59 | x1.25 | torches brighten |
| In the Zone | 60–89 | x1.6 | hi-hats join the music |
| **FLOW STATE** | 90–100 | x2.2 | golden auras, afterimages, kick drum, dungeon lit up |

Power multiplies damage; attack speed and walk speed get half the bonus.

**Sparks** fill a jar (cap 150, upgradeable). Each hero's **ultimate** costs Sparks and auto-casts when it's ready. Typing is literally what fires the Meteor. Sparks are also spent in the **Spark Workshop**, and **Spark upgrades never reset**, so your typing investment is permanent.

### Privacy and trust (non-negotiable, and a marketing point)
* We count events. **We never record which keys were pressed**, never store text, never send anything over the network.
* Steam page, first-run screen and settings all say so in plain words. Settings get a toggle to pause input counting.
* Global input hooks run only in the desktop build (uiohook-napi). The browser prototype counts input inside the page only.

### Anti-abuse
* Key auto-repeat is ignored. A token bucket caps counted input at about 15 events/s, so taping a key down or running an autoclicker is no better than fast real typing.
* It's single-player, so mild cheating is fine. The cap just stops it from trivializing the balance.

## 4. Heroes (prototype roster)

Party order front → back: Knight, Archer, Cleric, Mage.

| Hero | Role | Ultimate (Spark cost) | Unlock |
|---|---|---|---|
| **Sir Clank** (Knight) | Melee tank, front line | **Earthshatter** (25): leaps and slams, 400% to all foes in front, stuns | Start |
| **Wren** (Archer) | Ranged DPS | **Arrow Storm** (30): 8 arrows rain from the sky, 150% each | Floor 3 |
| **Mortimer** (Mage) | Slow AoE nuker | **Meteor** (50): 800% AoE with a screen shake | Floor 12 |
| **Sister Pell** (Cleric) | Healer | **Sanctuary** (40): full-heals and revives the party | Floor 22 |

Level formula: `dmg = base · (1 + 0.45·(L−1)) · 2^⌊L/10⌋`. Cost grows at x1.12 per level. Every 10th level doubles damage, with a big level-up fanfare.

**Post-prototype roster ideas** (one new hero per update keeps people coming back): Rogue (executes low-HP foes, steals gold), Bard (buffs Fervor gain), Necromancer (raises dead enemies), Pet Dragon (Steam supporter-pack cosmetic hero).

## 5. Dungeon & biomes

* Each floor has 3 waves, then a staircase down. Every 10th floor is a **boss floor**.
* Losing (party wipe) knocks you back one floor. The game then farms that floor and retries the boss automatically, so there's never a hard stop.

| Floors | Biome | Monsters | Bosses |
|---|---|---|---|
| 1–20 | The Crypt | Rat, Bat, Skeleton | Rat King (10), Bone King (20) |
| 21–40 | Mossy Caverns | Slime, Spider, Goblin | Brood Mother (30), Goblin Warlord (40) |
| 41–60 | Magma Depths | Imp (ranged), Golem, Magma Slime | Ember Golem (50), Magma Lord (60) |
| 61+ | The Hollow Void | Watcher (ranged), Wraith, Void Knight | The Hollow (every 10) |

Enemy HP grows x1.165 per floor and gold x1.145 per floor. The gap is the wall that drives prestige.

**Events:**
* **Treasure chests:** 8% per wave, worth about 10 kills of gold.
* **Golden Rat:** every 3–6 min a golden rat dashes across the strip. Click it for a burst of gold and Sparks. This is the main "reason to glance".
* *(post-proto)* Wandering merchant, mimics, cursed shrines with a risk/reward choice.

## 6. Relics (run-scoped roguelite layer)

Bosses offer **1 of 3 relics**, weighted Common 60 / Rare 30 / Epic 10. Relics are lost on retirement. Most are keyboard-themed, which keeps the brand on-theme:

* *Common:* Whetstone (+20% dmg), Lucky Coin (+30% gold), Spacebar Shield (+35% HP), Backspace Boots (+25% walk speed), Bottomless Coffee (+15% attack speed), Giant's Belt (knight tank)
* *Rare:* **Clacky Keycap** (keystrokes mint coins), **Caps Lock Crown** (Fervor drains slower), **Enter Amulet** (ultimates cheaper), Vampire Fang, Midnight Oil (offline x2), Treasure Map, Critic's Lens
* *Epic:* **Echo Rune** (ultimates double-cast), **Glass Cannon**, **Flow Pendant** (FLOW gets +100%), **Hotkey Ring** (every 150th keystroke casts a free ultimate)

Target for 1.0: 40+ relics, including build-defining synergies (e.g. "Keyboard Warrior": the more you type, the more crits).

## 7. Progression & prestige

| Layer | Currency | Resets on retire? | Spent on |
|---|---|---|---|
| Run | Gold | Yes | Hero levels, recruits, Forge (damage/HP/gold/speed/crit) |
| Run | Relics | Yes | — |
| Activity | Sparks | **No** | Ultimates, Spark Workshop (jar size, overcharge, kindling, static coins) |
| Meta | Renown | No | Legacy Hall (permanent) |

* **Retire** unlocks at floor 20. `Renown = ⌊((maxFloor − 10) / 5)^1.6⌋` (floor 20 → 3, floor 30 → 9, floor 50 → 27).
* Every Renown point you've ever earned grants a passive +3% damage and gold ("Fame").
* **Legacy Hall:** Heroic Lineage, Royal Treasury, Veteran Recruits, Head Start (+5 floors per level), **Quartermaster** (auto-levels heroes, the classic idle quality-of-life unlock), Zealous Spirit, Recruiter, Warm Campfire (offline), Relic Collector (4 choices).

**Pacing targets** (validated with a headless balance sim, `tools/sim.js`):
* First run: Archer by about 2 min, floor 10 boss by about 10 min, retire-able (floor 20) by about 30–40 min.
* Each later run reaches the previous wall about twice as fast.

## 8. Strip UX

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│ 🪙 12.4K   ⚡ 87/150     FLOOR 14 · The Crypt ●●○    [FERVOR ▓▓▓▓░ IN THE ZONE] ⚔ ⚒ ✦ ◆ ♛ ⚙ │
│  torches · bricks ·  [Mage][Cleric][Archer][Knight] →    👹 👹    · · · door ·         │
└───────────────────────────────────────────────────────────────────────────────────────┘
```
* Buttons open a single panel that **slides up above the strip** (in Electron, the window grows upward, then shrinks back).
* Relic choices appear as a non-blocking card row. The game keeps running and a pulsing ◆ shows the pick is waiting.
* Strip sizes S, M and L (pixel scale 2/3/4). Volume defaults low because people play this at work.

## 9. Juice spec ("chill, explodes on big wins")

**Always on (subtle):** walk bob, small white damage numbers, enemy hit-flash and knockback, coins arcing to the gold counter, torch flicker, floating dust, sparks rising from the floor as you type.

**Big moments (loud):**
* **Crit:** yellow 2x number, 40 ms hit-stop
* **Ultimate:** shake, light flash, unique VFX per hero
* **Boss intro:** banner, rumble, music drops out
* **Boss kill:** slow-mo, white flash, shake, loot fountain, relic fanfare
* **Enter FLOW:** golden screen pulse, rising arpeggio, auras
* **Level 10/20/30 milestone:** light pillar
* **Enemy death:** shatters into its own pixels

## 10. Audio

All synthesized at runtime with WebAudio in the prototype. A composer pass comes before Next Fest.
* Music: chill A-minor dungeon arpeggio (Am–F–C–G, 80 bpm) whose layers react to Fervor (hats at Zone, kick and octave arp at FLOW).
* SFX are short, soft and rate-limited, so 10 kills a second never gets grating.

## 11. Tech plan

* **Prototype (now):** vanilla JS, classic scripts (no build step; opens straight from `index.html`), 1:1 pixel buffer upscaled with nearest-neighbor.
  * The simulation (`world.js`) is DOM-free, so `tools/sim.js` can run hours of play headless for balancing.
* **Desktop build:** Electron.
  * Frameless, transparent, always-on-top window docked to the bottom of the work area.
  * `uiohook-napi` for global input *counts*.
  * Steamworks via `steamworks.js` (achievements, cloud saves, rich presence like "Delving floor 42 · FLOW STATE").
* **Saves:** localStorage now, then a JSON file synced with Steam Cloud. Offline progress is capped at 12 h.

## 12. Steam plan & roadmap to Jan 10

**This week (do it now; it's the long pole):**
* Pay the Steam Direct fee and create the store page. Page review takes days, and wishlists only accumulate while the page is live.
* **Check the Steamworks Next Fest registration and demo-submission deadlines today** and plan backward from them.

| Week of | Goal |
|---|---|
| Nov 9 | ✅ Prototype (this build). Play it for 3 days at work. Is it sticky? |
| Nov 16 | Electron wrapper: global input, docking, tray icon, always-on-top. Save to file. |
| Nov 23 | Commission capsule art + 1 key art ($200–600). Placeholder Steam page live. |
| Nov 30 | Content: 40 relics, 6 heroes, 4 biomes complete, 8 bosses with unique attacks. |
| Dec 7 | Steamworks: achievements, cloud saves, rich presence. Settings, onboarding. |
| Dec 14 | Trailer: 30 s "it runs while you work" vertical + horizontal cuts. Start posting short clips. |
| Dec 21 | Demo build (cap at floor 30 + 1 retire). Friends & family playtest. |
| Dec 28 | Balance & polish from playtest. Real audio pass. |
| **Jan 10** | **Demo locked & submitted.** Press kit, streamer outreach list. |

**Store page essentials:**
* Tags: Idle, Incremental, Roguelite, Pixel Graphics, Dungeon Crawler, Relaxing, Desktop.
* The first GIF is the strip running *above a real code editor/doc* with sparks flying as someone types.
* Tagline: *"Your work is their adventure."*

**Wishlist goal before launch:** 7–10k.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Desktop-idler niche is crowded | Activity hook + roguelite relics is a fresh angle; lean on it in every asset |
| "Keylogger" fear | Radical transparency, open-source the input module, a pause toggle, and an FAQ on the store page |
| Steam review of global hooks / antivirus false positives | Code-sign the build, use well-known uiohook, test on a clean VM |
| Players who don't type much | Base idle progress is fully viable; clicks count too; golden rat |
| Scope creep before Jan 10 | Demo = 2 biomes, 4 heroes, 25 relics. Everything else is post-fest |

## 14. Open questions for the next design pass
* Should FLOW STATE have a visible "streak" timer (minutes in flow today) as a light productivity stat? Possibly a big shareability hook ("I was in FLOW for 3h today").
* Co-op "connected strips" with friends: post-launch update or never?
* A daily/weekly "dungeon modifier" for returning players?
