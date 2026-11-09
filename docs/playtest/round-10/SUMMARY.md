# Round 10: Summary

| Tester | R8 | R9 | R10 |
|---|---|---|---|
| Economist | 8 / demo 7.5 | 8 / 8 | **8** |
| Auditor | 8 | 8 | **8.5** |
| Market | 8.5 | 8.5 | **9** |
| Player | demo 7 / full 8 | 8 / 8 | **8 / 8** |

**Built before testing: Biome 5, "The Heartroot" (51310be).**
- Floors 101–150, with three new monsters:
  - Root Lasher: every third shot roots the front hero.
  - Spore Bloat: splits into two Sporelings.
  - Heart Warden: a guard that halves damage.
- Two new bosses:
  - The Rootmother: Overgrowth.
  - The Keeper: Lockdown.
- The Echoed Depths from floor 151: old biomes return with hollow-tinted monsters.
- Also: Root Ward relic, 4 achievements (43 total), and new pixel art.

All four testers were interrupted by a usage limit and resumed after the reset.

## Headline findings
- **The Heartroot works.**
  - Hours 8–40 spent in one biome: 96–97% Void before; now the Heartroot takes 28–35% for typists and 80–84% for idle players.
  - The last new visual used to arrive at 1–2.7 h; now it arrives at 29–39 h.
  - New content starts right at Steam's 2-hour refund line: typists reach the Heartroot at about 2 h.
  - It is a step, not a wall. Record floors at 8 / 20 / 40 h are within a few floors of the old build.
- **Save bug (player F2), the most important fix of the round.** Load only copied fields that `newState()` listed. Every field added later was silently dropped on each reload:
  - Codex kills, days played, Seal timing (`sealPT`, `omenStarDay`)
  - slain floors, boss wounds
  - first-ever banners, `bestMile`, `lastOmenOffer`
- **The Hollowed rotation broke** (economist F1, auditor F2). The Heartroot bosses took the even bands, so floors 110 and deeper only ever showed three of the six Hollowed bosses.
- **Lockdown did nothing measurable.** The ult rotation simply passed the sealed hero.
- **Seals:**
  - About 60% of Seals were claimed under yesterday's omen, so the ×2 was lost silently.
  - The starred omen was still a no-brainer.
- **Root Ward was a trap epic,** dead below floor 90.
- **Readability (player):**
  - Overgrowth roots were invisible at strip size.
  - The Echoed Depths looked like the original rooms.
  - The Keeper read as a Void monster.
- **Capture gate (market):**
  - Pacing passes: 59–61 real fps in 379 of 381 seconds.
  - S3 and G1 repeat frame for frame.
  - G2 drifted until audio was turned off: sound effects drew from the game's seeded random stream.
- **Noise:** every cap passes except hour-1 toasts for typists, at 13 against a cap of 10.

## Fixed this round
- **Part 1, economist** (45278ee):
  - Hollowed rotation steps by retires.
  - The Echoed Depths open one old biome per day played.
  - Today's Seal needs a delve begun today; the star pays ×1.5.
  - Root Ward becomes a rare relic from floor 90: roots 60% shorter, +2 Sparks per root torn.
  - Lockdown makes the rotation wait on the sealed hero; 10 keystrokes break the seal.
- **Part 2, auditor** (c0ff1e2):
  - Rotation indexed by Hollowed slot, so a single run meets all six bosses.
  - Sporelings join on the next frame. Before, 20–27% died in the frame they spawned.
  - Warden guard wears only while it fights (7 s) and shows "GUARD WORN"; an ultimate that breaks it deals half.
  - "ROOTED: TYPE!" and "ROOTS TORN!" text.
  - Stale copy fixed: demo card, Codex 40 text, "next rank in N".
- **Part 3, market** (cc956d7):
  - Sound effects get their own random stream.
  - Capture paces frames on a fixed schedule.
  - The duplicate "joins the party!" toast is gone: hour-1 toasts go from 13 to about 10.
- **Part 4, player** (cb50bfa):
  - Load keeps every saved field.
  - Thick root vines and a "ROOTED! TYPE!" line on every Overgrowth.
  - Echoed violet wash, void stars and a violet label.
  - The Keeper in bark and blood colours; a brighter Lasher.
  - Root Ward gets its own icon; echo175 renamed "Down the Echo Well".

## Verified
- **Sims (10 h typist / 20 h idle, retire nudge):** maxEver 145 / 123, against 149 / 129 before the Heartroot.
- **Demo idle first hour:** floor 34, 1 retire.
- **Rotation, day 6:** all six Hollowed bosses appear in one run, and the order shifts per retire.
- **Bloat split:** queued, then joins the next frame.
- **Browser, save round-trip:** `codexKills`, `daysPlayed`, `bannerFirsts`, `slain` and `sealPT` all survive a reload.
- **Browser, visuals:**
  - Overgrowth roots all four heroes, and the vines show.
  - Floor 162 shows "Echoed Caverns" in violet over a violet wash.
  - No new console errors.
- **Not yet confirmed:** the audio stream and fixed-schedule capture need the market tester's safe launcher. R11 gate: G2 and G5 at 3/3 with audio on.

## Carried to the backlog
- **[major] Idle players spend 81% of hours 8–40 in the Heartroot.** Fix: zero-art "Deep Heartroot" sub-bands for f121–130 and f141–150 (auditor F4).
- **[minor] The banner burst at f150 and every echo band:** trophy + boss + VICTORY + biome within 8 s.
- **[minor] After f200:** Hollowed Rootmother and Keeper, plus 2 achievements.
- **[minor] Text pile:** status words share a column with damage numbers; huge crit numbers.
- **[minor] A "take + next" button for queued relic chests.**
- **[minor] Echo-band achievements; Seal play-gap of 2 h** (economist).
- **[tool] Headless sim never calls `KK.dayTick`,** so `daysPlayed` stays 1 in `playtest.js`.
- **[capture] A G6 Rootmother shot script** (draft in round-10/market.md).
- **[user]** Unchanged:
  - Steamworks (App ID, `KK.STORE_URL`).
  - Trailer and Coming Soon page by about Dec 1–3 for Desktop Companion Fest.
  - Code signing.
  - Stale `dist/`: rebuild before recording.
