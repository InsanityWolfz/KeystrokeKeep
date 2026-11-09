# Round 10 — T1 economist (Incentive & Economy Designer)

## Verdict
**Full game: 8/10.** I would keep it running tomorrow, and I would not refund at $4.99.

**The Heartroot is a step, not a wall.** Record depth at 8, 20 and 40 h is within ±5 floors of the build before it for every profile. No profile gets stuck at f101–110, f120 or f140. For idle and burst players, the Heartroot plus the Echoed Depths push the last new boss or biome from day 5 to day 11–19.

**For the typist, nothing changes in week 2.** A typist meets the Keeper at 6.7 h, so everything is still seen by day 6–7. From day 10–15, 11–13 of 35 days are still dead.

**Four economy problems, all cheap to fix:**
- **The Heartroot halved the Hollowed variety at depth** (F1). This is a side effect of the rotation formula.
- **The Seal auto-claims at ×1** in yesterday's delve on about 60% of days, so the star choice never comes up. When it does come up, the star is still a no-brainer (F3).
- **Root Ward is a trap epic.** Taking it costs floors (F4).
- **The Keeper's Lockdown does almost nothing** (F5).

**Method:**
- About 290 seeded runs of the real, unedited sim on HEAD **51310be**.
- The baseline is the pre-Heartroot build: `git show 51310be^:js/*` copied to `docs/playtest/round-10/old/js` and loaded by `econ10lib.js`. No git stash and no worktree.
- **`week10.js`** is the R9 calendar model with fixes: day 1 is 8 h, then 4 h/day with 16 h offline before each. It now uses real zero-padded dates and calls `KK.dayTick()`, so `daysPlayed` and the Hollowed pool grow as in `main.js`. R9's `'d'+n` dates would break at day 10 under the new `t < sealDay` guard. It also logs depth, band, boss-floor and mechanic telemetry.
- **Root Ward** is ranked as a mid epic by default (after Lens), with `--rw first|never` variants.
- **Other scripts:** `sealfarm10.js` and `qmlong10.js` (R9 scripts on real dates), and `agg10.js`.
- **Batches:** `run10.sh`. Aggregates are in `out/*_agg.txt`.
- **Run counts:**
  - Month: 4 seeds × 3 profiles × new/old at glance 60, plus burst and idle at glance 300.
  - 9 days (40 h): 6 seeds × 3 profiles × 8 configs.

## Findings (ranked, max 8)

### F1 [severity: major] The Heartroot took the even bands, so past f80 only 3 of the 6 Hollowed ever appear (Rat King, Broodmother and Ember Colossus only on f80)
- **Evidence:** `F.bossFor` with `daysPlayed=6`, retires 0–11 (scratch one-liner in this round's run notes):

  | Floor | Bosses that can appear |
  |---|---|
  | f80 | ratking, broodmother, embergolem |
  | f90, 110, 130, 150, 170, 190 | boneking, warlord, magmalord only |
  | f120, 160, 200 | rootmother |
  | f140, 180 | keeper |

  - **The cause:** the index is `floor((f-80)/10) + 2*retires`. Odd bands plus an even offset always land on odd indices when the pool size is even (2, 4 or 6).
  - Before the Heartroot, the even bands (120, 140, 160…) carried the other three.
  - **On day 1 (pool of 2),** every odd band (f90, 110, 130, 150, 170…) is the Hollowed Bone King on every delve. The typist month shows "110: boneking 99% (326 fights)".
- **Why it matters:**
  - Deep play is 90%+ of play time after hour 8. Half the signature moves (summons, web, lava rain) vanish from it.
  - This undoes part of the R9 "one new Hollowed per day" fix: the new Hollowed only shows on f80, once per delve.
  - Review line: "past 100 it's the same three bosses forever".
- **Proposed fix** (`state.js` `bossFor`): use `+ (KK.S.retires || 0)` instead of `+ 2 * (KK.S.retires || 0)`.
  - With pool 6, odd bands then reach every index across two delves.
  - On day 1, the odd bands alternate Rat King and Bone King per retire.
  - Depth is unaffected: the bosses within a pool have similar stats.

### F2 [severity: major] Week-2 shape: the Heartroot and Echoed Depths fill days 2–16 for idle and burst players, but not for typists (all new content by day 6–7, 11–13 dead days from day 10–15)
- **Evidence:** 35-day month, 4 seeds, glance 60 (`out/month_new_agg.txt` vs `month_old_agg.txt`). Echoed bands count as new biomes.

  | | Typist new / old | Burst new / old | Idle new / old | Idle g300 new / old |
  |---|---|---|---|---|
  | Last day with a new boss or biome | **6–7** / 5 | **11–12** / 5 | **16** / 5 | **17–19** / 5 |
  | New boss + biome per day, days 2–5 | 2.5, 1.8, 2.0, 1.5 / 1.0 each | 1.8, 2.0, 1.5, 1.5 / 1.0 | 1.5, 1.5, 1.8, 1.3 / 1.0 | 1.3, 1.8, 0.3, 2.0 / 1.0 |
  | Dead days of 35 (no milestone but the Seal) | 11–13 from day 10–15 / 10–13 from day 9–14 | 6–9 from day 17–20 / 7–9 from day 19–21 | 4–6 from day 20–25 / 4–6 from day 19–23 | 5–8 from day 9–23 / 5–9 from day 19–23 |
  | Hours to Rootmother / Keeper / f175 | 3.1 / 6.7 / 18.4 | 8.3 / 15.2 / 36.5 | 11.9 / 19.6 / 44.8 | — |
  | Achievements at day 35 | 42/43 (old 38/39) | 40–42/43 | 38/43 (old 34/39) | 37/43 |

  - **Typist novelty is front-loaded:** the Heartroot is reached at 1.8 h (inside the refund window, which is good), but the Keeper is still a day-1 kill.
  - **Typist milestones on days 8–14:** new build 2.0, 4.8, 2.3, 3.5, 1.3, 1.3, 0.5; old build 3.0, 2.5, 3.8, 3.8, 0.5, 0.8, 0.3. No difference.
- **Why it matters:** typists are the store-page audience ("your work is their adventure") and the likeliest reviewers. Their curve is unchanged after day 7.
- **Proposed fix:** gate the Echoed Depths by calendar as well as by floor, the way R9 did for Hollowed.
  1. An Echoed band shows its "Echoed X" biome, tint and new name only once `daysPlayed >= band + 2`. Echoed Crypt opens on day 2, Caverns day 3, Magma day 4, Void day 5, Heartroot day 6. Before that, the band uses the plain Heartroot.
  2. Add one echo-only achievement per band ("Echo of the Crypt" … ×5, at f160/170/180/190/200 under its echo). That gives a typist about 1 milestone per day through day 9.
  3. **Optional:** trophies past 300 every 10 floors to 400. The typist is at f285 on day 35 and runs out of trophies around day 40.

### F3 [severity: major] The Seal auto-claims at ×1 in yesterday's delve on about 60% of days, so the star choice never happens; when it does, the star is still a no-brainer
- **Evidence:** 40 h (9 days), 6 seeds. Days 2–9 for a player who always takes the star:
  - Only **19/48 (typist), 20/48 (burst) and 18/48 (idle)** Seals were starred.
  - The rest fired as soon as the carried-over delve passed `sealFloor` after the return. These delves had run 20–230 min, under yesterday's omen.
  - **The cause:** `world.js:760` claims whenever `S.omen && dailyOpen()`, and `omenStar` is only set at a retire.

  | 40 h | Always star | Skip the star (`nostar`) | Random omen |
  |---|---|---|---|
  | Typist Renown / depth | 1480 / f211 | 1259 (**−15%**) / f201 | 1369 / f207 |
  | Burst | 1138 / f180 | 970 (−15%) / f172.5 | 1014 / f177.5 |
  | Idle | 1006 / f170 | 837 (−17%) / f160 | 931 / f166 |
  | Seal Renown in 9 days | 334 / 310 / 293 | 231 / 210 / 200 | — |

  - In the month runs, Seals are 45% of a typist's lifetime Renown (1657 of 3719).
- **Why it matters:** the R9 fix was meant to make the omen pick a priced trade-off.
  - In practice the doubled Seal is usually lost to an auto-claim before the player sees the offer.
  - When the offer is seen, skipping the star costs 10 floors and 15% Renown, which no other omen repays.
  - Either way it is not a choice. Worse, it is a silent loss of half a Seal that the player can't see.
- **Proposed fix:**
  1. A Seal can only be claimed in a delve **begun on today's date**: set `S.delveDay = KK.today()` in retire/redelve, and require `S.delveDay === today` in the claim.
     - The morning return then shows "★ Today's Seal: re-delve free" (the free re-delve already exists), and every day presents the choice.
  2. Star multiplier ×2 → **×1.5**, and the non-star Seal 1.0 → **1.25** of `sealValue()`. The star then pays about +6–9 Renown over another omen, about the size of the Deep Omen's +4–7 per retire, so build-fit omens become viable.

### F4 [severity: minor] Root Ward is a trap epic: taking it costs 3–6 floors at 40 h, and it can be the guaranteed first epic at f30 (1 in 5 saves)
- **Evidence:** 40 h, 6 seeds. Root Ward ranked first vs never (`--rw first|never`):

  | 40 h | Rank first | Never | Shipped-like (mid) |
  |---|---|---|---|
  | Typist depth / Renown | f206 / 1402 | **f211.5 / 1465** | f211 / 1480 |
  | Burst | f179.5 / 1094 | f180 / 1140 | f180 / 1138 |
  | Idle | f166 / 973 | **f169.5 / 1025** | f170 / 1006 |

  - **It blocks very little:** 28–32 blocks per hour held. Idle parties get rooted about 205 times per hour (8200 roots plus 370 Overgrowths in 40 h).
  - **The reset is per wave:** `W.wardUsed` resets every wave. Each block saves at most 1.5 s on one hero, or 2 s of Overgrowth once per boss fight.
  - **Epic odds:** it takes 1/5 of the epic weight and 1/5 of the one-time guaranteed epic at f30 (`state.js:285`). There are no roots before f101.
  - No other relic went dead this round.
- **Why it matters:** an epic should be a "wow" pick, and this one is strictly worse than Echo or Glass in every profile. A player who reads "ignores roots" and takes it in the Heartroot loses depth.
- **Proposed fix:**
  - Make it **rare**, with "Roots and webs last 60% shorter; each one torn by typing gives +2 Sparks".
  - Keep it out of the pool below f90 (`r.minFloor = 90`) and out of the f30 guaranteed epic.
  - If it stays epic: "Heroes can't be rooted or webbed while above 50% HP".

### F5 [severity: minor] The Keeper's Lockdown is toothless: the rotation just passes the sealed hero, and the Keeper at f140 is the easiest deep boss
- **Evidence:** month win rates on f140, new (Keeper) vs old (Hollowed):

  | Profile | Keeper | Old Hollowed |
  |---|---|---|
  | Typist | 92% | 90% |
  | Idle | **86%** | **72%** |

  - The Rootmother at f160 sits at 65–71%, about level with the bosses around her.
  - **The cause:** `world.js:548-550` sets `ultCd = 6` on the turn holder, and the hero loop's `if (h.ultCd > 0) W.passUlt()` skips to the next hero at once. That is 326–555 Lockdowns per month that cost about one ult slot each.
  - "Keys to the Keep" is a **big** achievement earned at 6.7 h (typist) or 19.6 h (idle) with no real fight.
- **Proposed fix:**
  - While `h.locked > 0`, the rotation **holds** on that hero (no pass), so no ult fires for up to 6 s.
  - **Ten keystrokes break the seal early** (`h.locked -= 0.6` per key), which fits the biome's "typing tears roots".
  - Expected cost: about 1 ult per 10 s for idle (they barely ult anyway: 89 Warden guard-breaks by ult vs 1187 worn off). Typists lose nothing.

### F6 [severity: info] The Heartroot is a step for every profile: idle is slowest at f110–140 (Heart Warden guard), with no profile stuck; Codex 40 lands on day 12 (typist), 16 (burst), 19–20 (idle)
- **Evidence:** median record floor (month and 9-day runs):

  | Max floor at | 8 h new/old | 20 h new/old | 40 h new/old |
  |---|---|---|---|
  | Typist g60 | 149 / 150 | 178.5 / 179 | 211 / 208.5 |
  | Burst g60 | 120 / 120 | 152 / 151.5 | 180 / 181.5 |
  | Idle g60 | 111.5 / 116 | 141.5 / 145.5 (28 h: 150 / 158) | 170 / 169.5 |
  | Idle g300 | 106.5 / 106.5 | 136.5 / 137.5 | 160 / 160 |

  - **Hours to f120 / f140** (g60):

    | Profile | New | Old |
    |---|---|---|
    | Typist | 2.9 / 5.8 | 2.6 / 5.0 |
    | Burst | 7.4 / 13.9 | 7.3 / 13.8 |
    | Idle | **10.0 / 18.0** | **8.2 / 16.5** |
    | Idle g300 | 12.0 / 24.1 | 10.8 / 21.9 |

  - **Floors per hour on f110–120:** typist 12.2 vs 18.0, idle 3.3 vs 4.9. Idle catches up from f150.
  - **Renown per hour from f130 to f220** is unchanged: about 30 typist, 20–30 burst, 18–23 idle.
  - **Boss floors are not walls:**

    | Floor (boss) | Win rate |
    |---|---|
    | f120 Rootmother | 91–99% |
    | f140 Keeper | 86–92% |

    Band wipes on f101–120 are 0–7 per month, the same as old.
  - **Heart Warden:** idle parties break the guard with an ult 89 times vs letting it wear off 1187 times. Typists break it 2383 vs 273. The intended typing reward works, and costs idle about 2 h at f110–140.
  - **Codex 40 (h / day):**

    | | Typist | Burst | Idle | Burst g300 | Idle g300 |
    |---|---|---|---|---|---|
    | New | **48 / 12** | 67.5 / 16 | 79 / 19 | 74 / 18 | 82.5 / 20 |
    | Old | 45 | 67 | 73 | 71 | 75 |

    Codex 28: typist 25 h (day 6), idle 48 h. The Rootmother and Keeper replace Hollowed kills one for one, so the pace is about the same (slightly slower where the f140+ win rates differ).
- **Proposed fix:** none needed. If idle at f110–140 should feel less sluggish, set `guardT` 8 → 6 s (about −25% of the guard's uptime for parties that can't ult).

### F7 [severity: minor] Seal clock farming is capped at 1 per hour: 7 Seals in 8 h, 2.3–3.0× the Renown of honest play, and Devout now needs 30+ h
- **Evidence:** `sealfarm10.js`, 6 seeds, 8 h after an honest day 1 (`out/sealfarm.jsonl`):

  | 8 h after day 1 | Renown | Seals |
  |---|---|---|
  | Honest typist / idle | 210 / 125 | 1 / 1 |
  | Farmer (clock +1 day at each Seal) | 492 / 376 | 7 / 7 (claimed at 30, 96, 172…, every 60–80 min) |
  | Farmer, Devout | — | 0/6 |

  - A delve begun under yesterday's star does claim on the new day, but at ×1. That is by design under "any omen".
- **Why it matters:** the R9 fix works (it was 31–37 Seals and 4–5× before). The idle ratio stays at 3× because every farmed Seal is starred.
- **Proposed fix:** raise the play gap 3600 → **7200 s**. Honest 4 h sessions claim at least about 3 h of play apart, so honest players lose nothing. The farmer drops to about 4 Seals (about 1.7×). F3's "delve begun today" rule also forces a re-delve per farmed Seal.

## Verified fixes from last round (pass/fail, one line each)
- **Clock-proof Seals: PASS.** 7 per 8 h vs 31–37 (F7). Zero-padded dates work, and day 10+ is not refused.
- **Seal under any omen, star ×2: PASS mechanically, FAIL as a choice.** 60% of Seals auto-claim at ×1, and skipping the star costs 15% Renown (F3).
- **Hollowed rotation grows with days played: PASS.** All 6 seen by day 4–5 (`hollowed6` at 20 h). The deep-floor variety bug is F1.
- **Codex to 40: PASS.** Day 12, 16 and 19 by profile (F6); Codex 28 on days 6–12.
- **Trophies to 300: PASS.** Typist at f283–289, burst f276–279 and idle f264–267 at day 35. They run out at about day 40 for typists.
- **Quartermaster buys the whole Forge: PASS.** At 8 h and glance 300, idle Quartermaster reached f106.2 vs f105.7 manual, typist f144.7 vs f145.8. Renown is −1 to −3% (R9: −15%). Swift and Keen are at 10/10 in both.
- **Dynamo/Lantern tagged for idle parties:** not measurable in the sim (UI only). The retire hint at the f40 door and the offline toast are UI too; I didn't re-run them.

## Ideas (optional, max 3)
1. **Echo trophies:** the first clear of each Echoed band under its own echo pays a small permanent bonus (+2% gold for that biome's monsters). The echoes then become collectibles with an economic hook, not a palette swap.
2. **Heartroot Spark faucet:** each root torn by typing gives +1 Spark. The Heartroot then becomes the biome where typing visibly refuels ults, which suits the store fantasy, and idle players lose nothing.
3. **Seal streak pips** (R9 idea 1, still open): +1 Renown per consecutive Seal day up to +7. It is the cheapest fix for the typist's dead days from day 10 (F2).
