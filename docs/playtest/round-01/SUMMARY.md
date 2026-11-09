# Round 01: Summary

Testers: economist (6/10), auditor (6/10), market (6/10), player (6.5/10). Full reports are in this folder.

## Headline problems found
- **Prestige exploit:** you could retire again instantly for free Renown. Shallow farming beat patient play by up to 8x.
- **Dead Spark Workshop:** ultimates drained 100–112% of the Sparks that typing made.
- **Content ran out at about 2h15:** after The Hollow (floor 70) nothing new appeared.
- **Meteor and Sanctuary were starved:** Earthshatter always cast first.
- **Offline beat online:** closing the game earned more, up to 4.9x.
- **Bad desktop citizen:**
  - Rendered every frame at the monitor's refresh rate (160 fps, with the Windows compositor going from about 6–14% to 27% on the tester's machine).
  - Audio never suspended.
  - Always-on-top above fullscreen apps.
  - Took keyboard focus when clicked.
  - Loaded Google Fonts, which broke the privacy promise.
- **Interruptions while working:** relic offers popped over the work area, and one stray click picked a relic for good. The welcome-back modal also covered your work.
- **FLOW was cheap and loud:** it took about 6 seconds to reach, and the fanfare replayed on every re-entry.

## Changes made

### Economy
- **Renown is record-based:** `gain = R(maxFloor) - R(best floor already paid)`, with exponent 1.6 → 1.9. Kills the re-retire exploit and the farming strategy.
- **Embers:** every 4 Sparks spent on ultimates bank 1 permanent Ember, and the Workshop is priced in Embers. The jar can no longer cap itself.
- **Idle Battery** moved to Legacy (+8%/rank). It acts as a floor (`powerMult = max(tier, 1+idle)`), so starting to type can never weaken the party.
- **Offline earnings:** base 40%, Campfire +10/rank, Midnight Oil +20, hard cap 80% of online. Uses real income, with the floor-based rate only as a fallback when income is 0.
- **Legacy repriced:** about 61 Renown for the first level of everything, up from 23.
- **Legacy effects apply immediately:** Head Start bought at the start of a delve moves you down right away, and Veterans raises current hero levels.
- **Quartermaster** only spends up to 10% of gold per level, saves for recruits, and has a toggle in Settings.
- **Hero costs:**
  - Archer levels 30 → 25.
  - Mage levels 500 → 200.
  - Cleric recruit 12,000 → 4,000; levels 4,000 → 400.
  - Enemy HP growth 1.26 → 1.27.
- **Relics and Forge:**
  - Enter Amulet −40% Spark cost.
  - Echo Rune 60%.
  - Epic weight 10 → 15.
  - Midnight Oil reworked: +20 offline points, and chests ×1.5.
  - Keen Edge: +3% crit chance and +25% crit damage per level.

### Combat and content
- **Ultimates take turns (round-robin):** the hero whose turn it is saves Sparks; a hero with nothing to do passes. Sanctuary triggers below 55% HP.
- **Boss slam** now counts the boss's own swings; before, it counted hits the boss took.
- **Floor 70+ cycles all bosses as "Hollowed X":** the Void no longer repeats one boss forever.
- **Golden rat** is slower (speed 46 → 28) and sits higher, so it's easier to click.

### Feel
- **FLOW:**
  - +1.2 Fervor per key (was 2.2) and +0.9 per click (was 1.5).
  - Decay grace 3 s (was 1.5).
  - Sticky tiers: you drop out 12 points below the threshold.
  - The full banner, flash and sound play at most once per 10 minutes.
- **Calm mode** (Settings): no shake, hitstop or slow-mo, and flashes are capped.
- **Softer routine effects:**
  - Ultimate flashes are quieter (Meteor flash 0.55 → 0.22).
  - At most 14 floating texts, and they stay below the HUD.
  - No "+gold" text on normal kills.
- **Foreground pillars** go transparent when they would cover a hero or an enemy.

### Desktop shell and trust
- **Frame rate:** 30 fps by default (15/30/60 setting), 20 on battery, 12 when idle with nothing happening. Rendering stops when hidden, locked or asleep.
- **Audio suspends** when muted, hidden or locked. Music is off by default, volume 0.3, and keystroke blips are off by default with their own toggle.
- **Window behavior:**
  - `focusable:false` and `showInactive()`: clicking the strip never steals focus.
  - `skipTaskbar`.
  - 'floating' always-on-top level (not 'screen-saver').
  - Tray toggle for always-on-top.
  - Display picker on multi-monitor setups.
  - Ctrl+Alt+K hides or shows the strip.
- **Sound and pause controls:** a mute button on the HUD and a Sound toggle in the tray. Pause counting is one saved setting, mirrored in the tray. The HUD shows "PAUSED".
- **No network:**
  - Fonts are bundled locally (OFL licenses included).
  - The CSP is locked (`connect-src 'none'`).
  - The Electron main process blocks all http(s)/ws requests.
- **Strip size** defaults to AUTO (about 13% of screen height).

### UI
- **Relic offers** never auto-open: a toast and a badge appear instead. Picking is two steps (select, then TAKE) with a 600 ms misclick guard.
- **Welcome back** auto-collects with a toast instead of a modal.
- **Badges** for Workshop (Embers), Legacy (affordable Renown) and Relics.
- **Retire button** shows "REACH FLOOR N TO EARN RENOWN" when nothing would be gained. Renown is pinned in the Legacy header.
- **Panel** has a fixed height so tabs don't jump. On screens under 1280 px the biome name sits under the floor.
- **Small fixes:** gold costs are rounded up, and the `buildPanel` crash guard is in.

### Tooling
- `playtest.js` typing is now seeded, so runs are reproducible. Workshop affordability uses Embers, and the report shows ultimates by hero.
- `tools/serve.py` is a no-cache dev server, and asset URLs are versioned (`?v=r1`).

## Before → after (`playtest.js --min 180 --seed 1`)

| | Before (R0) | After (R1) |
|---|---|---|
| Typist: floor at 20 min | 31 | 32 |
| Typist: first retire | 0h58m @ floor 48, +25 | 1h52m @ floor 69, +108 |
| Typist: ultimates (knight/archer/mage/cleric) | mostly knight | 266 / 383 / 250 / 11 |
| Typist: Workshop levels bought | 0 | jar 8 + others |
| Idle: first retire | ~0h40m @ floor 30 | 0h42m @ floor 30, +13 |
| Idle: 3 h end floor | ~60 | 68 |

## Verification
- Sim: typist, idle and burst profiles all reproduce without errors.
- Browser smoke test:
  - Welcome screen with the new defaults.
  - Relic offer does not auto-open; select → TAKE works; badges show.
  - Settings panel renders the new rows.
  - No game console errors. The only errors came from the tester's own fetch probes being blocked by the new no-network policy, which is intended.
- Electron snapshot:
  - Fonts load from the local files.
  - The offline toast shows instead of the modal.
  - Docks at 2560 px; no main-process errors.

## Watch next round
- **First retire for typists drifted to about 1h50** under the 8-minute-stall policy. Players may retire earlier on their own, but check whether the prestige hook now comes too late.
- **The typist vs idle Renown gap widened** (108 vs 13 at the first retire): the record-based formula amplifies depth. Is that fair?
- **51–108 Renown at the first retire still buys most first levels.** Check whether Legacy is still a no-brainer.
