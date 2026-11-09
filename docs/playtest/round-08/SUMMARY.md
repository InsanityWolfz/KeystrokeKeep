# Round 08: Summary

| Tester | R6 | R7 | R8 |
|---|---|---|---|
| Economist | 7.5 / 7.5 | 8 / 7.5 | **8 / demo 7.5 (8 after F1)** |
| Auditor | 7.5 | 7.5 | **8 (8.5 after F1–F3)** |
| Market | 8.5 | 8 | **8.5** |
| Player | 7.5 / 8 | 7 / 8 | **demo 7 (8 after fixes) / full 8** |

Built before testing: **Glimpse of the Depths** (592ac10), the auditor's R7 F2.
- On the first floor-40 clear, the party walks one sealed Magma Depths floor with a stone "SEALED" Ember Colossus.
- A 40-minute "What waits below" card covers idle players.
- The DEMO pill links to the store.
- Demo Head Start is capped at 1.

## Headline findings
- **[blocker] Retiring during the sealed floor corrupted the next delve.** Floor-38 monsters spawned on floor 6, the party wiped endlessly, and it survived a reload.
- **The Glimpse was unreadable:**
  - The party walked through a hero-sized grey statue, and the alert covered it.
  - The card opened after the strip had already snapped back to floor 37.
  - The peek card copy was wrong.
  - The pill was an accidental store link.
- **The caution rule counted clicks as typing,** so realistic idle players still failed the hour-1 gate (4.8–10.6 retreats).
- **Quartermaster** was too frugal to keep a hands-off player progressing (f24 vs f35 in hour 1).
- **Seal of the Day** was a login bonus and could be farmed with the clock.
- **Void Lantern** was near-dead.
- **The middle Fervor tiers** stopped mattering after hour 2.
- **The banner gate made boss moves disappear in fast fights:** Royal Summons showed in only 4–9% of typist fights.
- **Noise census (desktop defaults):** SFX are fixed. Sound starts in 2–13% of seconds, down from 94–98%. Still over the caps:
  - Big banners: up to 190/h in the demo loop.
  - Loud booms: 96–129/h for typists.
  - Hour-1 toasts: 20–24.
- **Capture mode:** the `js` and `flow` cues were broken, and there was no way to wait for an event.
- **Desktop incident:** an early market capture run showed the strip on the user's primary display for 16 s during a fullscreen game and injected two hotkey presses. Later runs used the side monitor; the real save is unchanged. LOOP.md now forbids tests from touching the primary display, injecting input or touching real saves.

## Changes made

### Glimpse of the Depths
- **Retire safety:** retire is blocked during the Glimpse, and a forced retire cleans up. A stale flag is sanitised on load.
- **Staging:**
  - Two short waves.
  - The statue is visible from the start and drawn at 1.5x with an outline, glowing eyes and the label "EMBER COLOSSUS - SEALED".
  - The party pauses at the door short of it.
  - The strip freezes while the demo card opens on floor 41; the card says it "waits on floor 50".
- **Peek card** has its own copy and no stats.
- **Demo pill** shows a "♥ WISHLIST" chip with a tooltip.
- **Esc** closes only the top layer.
- **Fire Below** doesn't unlock on the Glimpse.

### Economy
- **Caution rule** is keyed to keystrokes only. The 35% step-back and the 85% pre-boss check apply to everyone; typing only skips the 60% replay.
- **Quartermaster** spends up to 50% of gold on levels, and keeps Blades, Armor and Purse topped up while each costs ≤25% of gold.
- **Seal of the Day:**
  - The target is record − 5, worth 10 + record/10 Renown.
  - It's tied to the day it was offered (`omenStarDay`).
  - A banner shows once the screen is clear, and the pill shows "★ SEALED".
  - The starred omen card gets a gold border, and the re-delve confirm explains the Seal.
- **Void Lantern:** 1000 x1.6, −10% per level, with a NEW chip and an unlock toast.
- **Fervor tiers** each add +5% over the idle power floor.
- **Demo "Stuck? Retire" hint** needs +25 Renown before the first floor-40 clear.

### Bosses
- **Rat King** HP-stage summons pass the banner gate.
- **Boss banner** lasts 1.8 s and reads "FLOOR N BOSS"; the floor banner is skipped on boss floors.
- **Boss-bar label** is clamped on screen.
- **Heart of the Keep** achievement now unlocks on the kill.
- **Cleric cooldown** comes from data.

### Calm caps
- **Banners:** a big banner repeated within 20 min plays small. VICTORY is big only for the first kill of each boss.
- **Move alerts** are gated once per fight AND at most once per 10 min per move, including Reassemble. Alert text blinks at 2 Hz. In calm mode the FLOW glow is steady.
- **Sounds:**
  - With combat sounds off, the ult booms use a quiet variant.
  - Boss stingers play at most every 3 min, the zone chime every 5 min, and the milestone arpeggio every 3 min.
- **Toasts:** achievement toasts at most every 10 min, with the rest counted. The demo "new best" toast plays only on laps 1–2 or for a ≥60 s improvement.

### Capture mode
- **Cue fixes:**
  - The `js` cue runs through the shell, because CSP forbids eval.
  - The `flow` cue emits its tier change.
  - New `await` (event) and `wave` (jump to boss) cues.
  - `juice` also sets combat sounds.
  - No welcome-back toast in capture mode.
- **Shot scripts:** the market tester's 5 scripts are adopted into `tools/capture/shots/`, with `stage.js` and `sim-save.js`:
  - g1: FLOW → Meteor
  - g2: Magma Shell
  - s3: relic pick
  - s4: omen choice
  - g5: demo Glimpse

### Cleanup
Removed `UI.offlineModal`, `tooBig`, the `runInputs` no-op, the empty echo listener and `CODEX_RANKS`.

## Verification
- **Sim:**
  - Glimpse flow (seed 2): glimpse at f40, then f41, then demoComplete. maxFloorRun and maxFloorEver stay 40.
  - A forced retire during the Glimpse is clean (+30, glimpse cleared). `canRetire` is false during it.
  - Idle demo hour-1 retreats: 2/1/2/4/0. Typist demo: 1.
  - 8 h: typist max f140 with 7 wipes; idle max f106.
- **Browser (demo, warp 20, autotype):**
  - Events fire in order: glimpse@f40, glimpseDoor@f41, demoComplete@f41.
  - The card opens on floor 41 with the Magma Depths and the sealed Colossus visible, including the "waits on floor 50" line. The strip is paused.
- **Capture:** `g1_flow_meteor` ran in the shell and printed the MARKs for G1 IN, the FLOW STATE banner and the Meteor landing. The sprite check passed.

## For the user (from the market tester, in plain words)
1. **Steamworks:** finish sign-up at https://partner.steamgames.com/ (agreement, bank, tax interview, identity). Then pay the $100 app fee (https://partner.steamgames.com/doc/gettingstarted/appfee). Send the App ID and store URL so the DEMO pill and Wishlist button work.
2. **Code signing:** order a certificate (Azure Artifact Signing or OV).
3. **Dates:**

   | When | What |
   |---|---|
   | ~Nov 23 | Coming Soon page submitted |
   | ~Dec 1 | Page live with the Desktop Companion tag |
   | Jan 10 | Next Fest registration closes |
   | Jan 14–18 | Desktop Companion Fest |
   | Jan 18 | Demo and page submitted for review |
   | Feb 1 | Everything submitted |
   | Feb 22 – Mar 1 | Next Fest |
