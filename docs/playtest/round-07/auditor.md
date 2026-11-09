# Round 07 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
R6 mostly landed. The things I checked work:
- Wounded retries keep their Hollowed status every time.
- The bone pile can't be hit, and the Bone King visibly gets back up.
- The enrage works, and all six signature moves fire in 96–100% of fights.

But the four new moves are mostly **invisible for typists outside the Hollowed fights**. A typist kills a normal Ember Colossus, Magma Lord or Brood Mother in 2.0–4.7 s. Their one opener move plays under the 2.6 s boss-name banner, and only 18–38% of those fights show a second move or one after the banner.

The week-2 layer prototypes cleanly against the current code. Beats after 8 h roughly double for typists (23–31 → 43–48) and the longest gap halves (386–505 → 179–250 min).

The demo has one structural problem: **idle and burst players only reach the single wishlist button at 71–104 min.**

I'd keep it running tomorrow. **7.5/10** (R6: 7.5). It's 8 once the week-2 layer and a demo wishlist moment for idle players are in.

### Method
- **Code:** all numbers come from the **current** `js/` (R6 final). Nothing in `js/` was edited.
- **Harness:** R6's `round-06/r6lib.js` (loads the current `js/`). New scripts in `docs/playtest/round-07/`:
  - `r7probe.js`: move telemetry, including:
    - opener vs. boss banner;
    - first hero hit;
    - shell hits and cracks;
    - web tears and carry-over;
    - lava share;
    - wounded and Hollowed status;
    - War Charge timer freezes;
    - alert collisions.
  - `r7proto.js`: in-memory week-2 prototypes that mirror the spec code below: `omen`, `lantern`, `tro`, `ach2`, `week2`, and the web variants `webAll`, `webTurn`, `webKeys`.
  - `r7summary.js`.
  - `agg_moves.js`.
  - `demo_audit.js`: what the player has seen at 10/20/30/45/60/90/120 min.
  - `chk_bossloop.js` and `chk_camp.js`.
  - `hook_loop.js` and `hook_camp.js`: `node -r` preloads that instrument `tools/playtest.js` without touching it.
  - `dbg_webkeys.js`.
  - `batch.sh`, `batch2.sh`, `batch3.sh`.
- **Output:** `out/` (`b8_*`, `b40_*`, `demo_*`) and `out/aud/`.
- **Runs:** `--retire nudge --omen random` throughout.
  - 8 h: 4 profiles × 4 seeds.
  - 40 h: typist, light and idle × 4 seeds, in 6 configurations.
  - Demo, 3 h: 3 profiles × 3 seeds.
  - `tools/playtest.js --demo`: idle seeds 1–8 and typist seed 3.
- **Correction to R6:** R6's `tro` prototype counted every trophy past 150 twice (TROPHY plus TROPHY2), and its f150/f200 beat fired on every revisit. The R7 week-2 beat counts below are clean and a little lower than R6's.

## Findings (ranked, max 8)

### F1 [severity: major] Week-2 layer: implement-ready spec for the current files (prototyped; final numbers)
- **Evidence:** 40 h, 4 seeds (`out/b40_*`, `out/aud/nl40_*`, `out/aud/w40_*`). Beats are anything new after 8 h: a major, a new omen, a trophy, an achievement, a Codex rank, a Seal or a Lantern level.

  | 40 h, after 8 h | typist beats / longest gap / empty 2 h windows (of 17) / max floor | light | idle |
  |---|---|---|---|
  | HEAD | 23–31 / **386–505 min** / 4–6 / 170–176 | 26–34 / 183–276 / 2–4 / 155–160 | 22–27 / 257–402 / 4–7 / 120–126 |
  | + Omen of the Day + trophies 160–200 + 3 achievements | 34–43 / 251–363 / 3–6 / 174–180 | 37–45 / 151–319 / 1–5 / 160–169 | 31–37 / 214–282 / 4–5 / 129–130 |
  | + Void Lantern (full spec) | **43–48 / 179–250 / 2–4 / 180–184** | 43–48 / 149–227 / 2–4 / 160–168 | 31–37 / 214–282 / 4–5 / 129–130 (Lantern never bought) |

  - **Seals:**
    - 5 per 40 h (one per 8 h "day"), and the starred omen was taken all 5–6 times it was offered.
    - The Seal floor (record − 15, minimum 40) is reached **4–36 min** into the delve.
    - The first Seal comes at 0.9–1.6 h (the delve after retire #2), so the mechanic is taught early.
    - 2–4 free daily re-delves per 5 days.
  - **Codex** with the layer: typists reach rank 27–28 by 40 h (HEAD 19–21), so Hollow Scholar becomes a 40 h goal.
  - **Lantern** (4000 Embers, ×1.8, −8%):
    - typist L1 at 7.7–8.7 h and L5 at 31.7–34.7 h; light L1 at 13.0–16.0 h.
    - **Idle never buys it.** Forcing an idle player to save for it gets L1 at 8.6–12.1 h but costs 3–10 floors (`ws40_*`). For light players, saving costs 20–30 floors. Saving for the Lantern is a trap, so don't nudge players toward it.
    - A cheaper and stronger Lantern (1500, ×2, −10%, `wn40_*`) lands L1 at 3.2–3.5 h. That's hour 3, not week 2, and it's worse for the gap (208–384 min).
    - **Keep 4000 / ×1.8 / −8%** as a week-2 Ember sink for typists, and hide the card until floor 70.
- **Why it matters:** a typist's week 2 is still a 6–8 h silence between beats. *"After day 3 nothing new happens, it just numbers up."*
- **Proposed fix (exact code, current line numbers):**
  - **data.js**
    - :153 `TROPHIES = [75, 80, …, 140, 150, 160, 170, 180, 190, 200]`. Typist f160 at 20.5–24.9 h, f170 at 27.6–32.5 h, f180 at 36–38 h. Light f160 at 34–36 h.
    - :118, append to WORKSHOP:
      ```js
      { id: 'lantern', name: 'Void Lantern', icon: 'candle', base: 4000, growth: 1.8, max: 5, minFloor: 70, desc: (l) => `Void slams deal 8% less damage per level (now -${8 * l}%)`, apply: (m, l) => { m.voidDmg *= 1 - 0.08 * l; } }
      ```
  - **state.js**
    - :83 mods: add `voidDmg: 1`.
    - :16 newState: add `seals: 0, sealDay: '', freeDelveDay: '', omenStar: null,`.
    - After :31:
      ```js
      KK.today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
      ```
    - After :296:
      ```js
      A.starOmen = () => { let h = 0; for (const c of KK.today()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return D.OMENS[h % D.OMENS.length].id; };
      A.dailyOpen = () => !KK.DEMO_CAP && KK.S.retires >= 2 && KK.S.sealDay !== KK.today();
      A.sealFloor = () => Math.max(40, (KK.S.renownFloor || 0) - 15);
      A.claimSeal = () => { const S = KK.S; S.sealDay = KK.today(); S.seals = (S.seals || 0) + 1; S.renown += 10; S.renownLifetime += 10; KK.dirty(); KK.emit('seal', { n: S.seals }); };
      ```
    - :299:
      ```js
      A.canRedelve = () => !!(KK.DEMO_CAP && KK.S.demoDone && KK.S.maxFloorRun >= 20) || (A.dailyOpen() && KK.S.freeDelveDay !== KK.today() && A.renownGain() <= 0);
      ```
    - :315, after `S.lastOmenOffer = …`:
      ```js
      S.omenStar = null;
      if (S.omenOffer && A.dailyOpen()) { const st = A.starOmen(); if (!S.omenOffer.includes(st)) S.omenOffer[0] = st; S.omenStar = st; }
      if (gain <= 0 && !KK.DEMO_CAP) S.freeDelveDay = KK.today();
      ```
      - `gain` is already in scope at :305.
      - If the day rolls over mid-delve, the star stays valid (generous on purpose).
  - **world.js**
    - :546 `W.damageHero(h, h.maxHp * 0.55 * KK.mods().voidDmg, e)`.
    - :660, after the `maxFloorRun` line:
      ```js
      if (S.omen && S.omen === S.omenStar && KK.actions.dailyOpen() && S.floor >= KK.actions.sealFloor()) KK.actions.claimSeal();
      ```
  - **ui.js**
    - :257 `D.WORKSHOP.filter((d) => !d.minFloor || S.maxFloorEver >= d.minFloor).map(…)`.
    - Omen `card()` (:470–476): if `id === S.omenStar`, add `<i class="new">★ OMEN OF THE DAY: FLOOR ${A.sealFloor()} = +10 RENOWN</i>`.
    - Pill (:93): prefix `'★ '` and append ` · ★ FLOOR ${A.sealFloor()}` while `S.omen === S.omenStar && A.dailyOpen()`. Tooltip: `om.desc + ' Omen of the Day: reach floor N for +10 Renown.'`.
    - Retire button (:287): when `gain <= 0 && A.canRetire() && !KK.DEMO_CAP`, read `'★ FREE DAILY RE-DELVE (OMEN OF THE DAY)'`.
    - Re-delve modal (:443): `Today's omen: <b>${name}</b>. Reach floor ${A.sealFloor()} under it for +10 Renown.`
    - Toast next to :535:
      ```js
      KK.on('seal', ({ n }) => UI.toast(`★ Seal of the Day #${n}: +10 Renown. A new Omen of the Day tomorrow.`, 'crown', 'epic', 6));
      ```
    - Stat box (:295): `statRow('Seals', S.seals || 0)`, plus `Chests` and `Wipes` (backlog).
    - Demo card (:523): replace the literal "36" with `${KK.ach.LIST.length}`.
  - **achievements.js**, after :40:
    - `seals7` "Faithful" (7 Seals) and `seals30` "Devout" (30), both `on: 'seal'`, test `c.S.seals >= N`.
    - `f150` "Bottom of the Keep" (reach f150: typist 15.3–17.1 h, light 26–28 h).
    - That makes 39 achievements.
  - **Not in the demo:** `dailyOpen` is false when `DEMO_CAP` is set.

### F2 [severity: major] Demo: idle and burst players get their only wishlist moment at 71–104 min. The best addition is a "Glimpse of the Depths" at floor 40 or 40 min
- **What a demo player sees** (`out/aud/demoaudit_*`, `out/demo_*`, `tools/playtest.js --demo`):

  | | Typist (3 seeds, consistent) | Idle (3+5 seeds) |
  |---|---|---|
  | 10 min | f23. The Crypt and the Caverns, 2–3 heroes. Rat King and Bone King killed. Royal Summons and Reassemble seen. FLOW. 2 of 5 demo achievements. | f16, Crypt only. 2 heroes, the Rat King. 1 achievement. |
  | 30 min | **f40 and the demo card at 31–33 min.** All 4 heroes (Pell at 14 min), all 6 demo monsters, 4 of 6 signature moves (no Shell or Lava in the demo), all 5 Workshop rows. First retire at 33 min, then 7 Legacy rows bought at once. | **f19–20, walled at the Bone King** (4–7 retreats). 0–1 retire for +3 Renown. Still 1–2 achievements. |
  | 60 min | 4 laps, best 6.4 min. 14 of 17 relics offered, 8 of 10 Legacy rows. | f23–27. The Caverns, Pell at about 57 min. Bone King first killed at 19–55 min. |
  | 120 min | 13 laps, best 4.4 min. All 17 relics. Renown ≈100, capped at 120 around 2 h; after that only the best time is left. | **Demo card at 71–104 min** (playtest.js seeds 1/2/4/5: 1h16, 1h11, 1h15, 1h41). 2 laps. |

- **Never seen in the demo:**
  - Omens, the Codex, trophies, the Magma and Void biomes.
  - 6 of 12 monsters and 3 of 7 boss types, the Hollowed bosses and the Heart.
  - Magma Shell and Lava Rain.
  - 31 of 36 achievements, which are hidden from the demo list entirely.
- **Teases that work:**
  - The demo card's list of what waits.
  - The demo pill ("ENDS AT FLOOR 40 · BEST · CLEARS").
  - Best time as the score.
  - "Your save carries over".
- **Teases that don't work:**
  1. The `♥ WISHLIST` button exists only on the one-time demo card. Idle players, the whole "it plays itself" audience, mostly won't see it within a Fest-length session.
  2. The card undersells the full game ("3 more bosses"). There are really 3 new bosses, 6 Hollowed returns, the Heart of the Keep, 2 more signature moves and 60+ more floors.
  3. The demo pill isn't clickable: `.demo-pill` only gets `pointer-events: auto` with `.omen`, and the demo never sets `.omen`.
  4. The demo achievement list shows 5 and hides the other 31.
  5. Head Start L2 (start at floor 11) skips the Rat King for the rest of the demo, so Royal Summons is seen on the first lap only (3 Rat King fights in 3 h of a typist demo, against 73 Bone King fights).
- **Why it matters:** the demo exists to turn Fest sessions into wishlists. For idle players there's no ask at all in the first hour, and the depth the full game offers is never shown.
- **Proposed fix (single best addition): "Glimpse of the Depths"**, triggered on the first floor-40 clear **or** at 40 min of play, whichever comes first.
  - It shows one sealed floor of Magma Depths:
    - `world.js nextFloor` demo block (:645–654): on the first clear, set `S.floor = 41; S.glimpse = true`. Don't count it in `maxFloorRun` or Renown.
    - `spawnWave`: when `S.glimpse`, spawn 1 wave of imp, magslime and golem at `hpMult: 0.3`, then an **inactive, untargetable Ember Colossus** with `shell` set at the door. Show the alert "MAGMA SHELL · SEALED IN THE DEMO" and the banner "MAGMA DEPTHS · FULL GAME".
    - At the door, set `S.floor = 36`, `S.glimpse = false`, and emit `demoComplete`.
  - The 40-min fallback is a toast plus the same card, reworded as "Your party is still delving. Here's what waits below…", with the wishlist button.
  - Every asset already exists. It shows the most striking art change (the biome palette) and a new move in the strip itself, and it fires for idle players too.
  - **Cheap extras:**
    - Make the DEMO pill clickable (`.demo-pill { pointer-events: auto; cursor: pointer }` in the demo, calling `UI.openStore()`).
    - List the 31 locked achievements greyed with a "FULL GAME" tag.
    - Card text: "3 new bosses, 6 Hollowed returns, the Heart of the Keep, 60+ more floors".
    - Optional: cap demo Head Start at 1 so all 4 demo bosses appear on every lap.

### F3 [severity: major] Typists mostly see the new moves under the boss-name banner
- **Evidence** (8 h, 4 seeds; `node agg_moves.js b8_typist`, and demo runs):
  - Typist non-Hollowed kills take **2.0–4.7 s**. The first hero hit lands at 1.6–2.1 s.
  - The opener fires at 0–1.0 s, which is always inside the 2.6 s `FX.banner(boss name)` (fx.js:244).
  - Share of fights with a second move or one after the banner:

    | Mode | Brood Mother | Ember Colossus | Magma Lord | War Charge |
    |---|---|---|---|---|
    | Typist, 8 h | 38% | **18%** | 26% | seen in only 34% |
    | Light | 34% | 29% | 39% | 43% |
    | Demo typist (Brood Mother) | **16%** | | | |

  - The alert plate (render.js:328, `ay = 24`) is drawn over the banner band (render.js:600, `cy = 30`, about 19–45 px), so the move name and the boss name overlap.
  - Over 40 h a typist sees 79 Magma Shell, 112 Lava Rain, 52 Royal Summons and 41 Web Shot alerts inside the banner window (`out/b40_typist_s1`).
  - Collisions with the void warning are rare (0–5 per 8 h, 22 per 40 h). The 2.4 s dodge works.
- **Why it matters:** two of the four new moves exist mainly to show the typing hook ("an ultimate cracks it"). Players who type see them least.
- **Proposed fix:**
  1. render.js:328: `const ay = FX.banners.length ? 8 : 24;`. The plate then sits above the banner band and both stay readable. One line.
  2. Name the active move in the boss bar (render.js:290), e.g. `' · SHELLED'` while `e.shell > 0`, `' · SUMMONING'` for 1 s after a summons, `' · CHARGING'` while `e.chPhase`. It's persistent and readable at size S.
  3. Optional: give the boss banner `life: 1.8` (from 2.6).
  - Don't delay the openers: at a 2.8 s start, most typist fights would end first.

### F4 [severity: minor] A normal-floor wipe right after a boss floor makes the party kill the same boss again and again (free relics)
- **Evidence** (`hook_camp.js` on `tools/playtest.js --demo --profile idle --seed 4`):
  ```
  [25.2m] BOSS KILL f20 The Bone King · [26.0m] WIPE f21 campFloor 21 · [27.2m] BOSS KILL f20 … [28.2m] … [29.1m] BOSS KILL f20
  ```
  - That's 4 Bone King kills in 4 min, each a relic offer and +10 Embers.
  - `hook_loop.js`, idle demo, seeds 1–8: 2 of 8 seeds loop (3 and 2 re-kills). It didn't happen in the typist/idle/burst 8 h seeds I checked.
  - **Cause:**
    - `W.recover` (world.js:681) drops to floor X0, the boss floor, after a wipe on X1.
    - `nextFloor`'s camp rule (:657–658) keeps bouncing the party at `wall − 1` = X0, so the boss respawns every lap.
  - Late game, the same path would farm Hollowed kills for the Codex.
- **Why it matters:** relic offers are meant to be "every 10 floors". The loop inflates them, gives Blitz progress for nothing, and looks like a bug ("we killed the Bone King four times?").
- **Proposed fix:** a boss beaten this delve stays dead.
  - killEnemy :140: `(S.slain = S.slain || {})[S.floor] = 1`.
  - spawnWave :77: `if (F.isBossFloor(f) && W.wave === W.waves - 1 && !(S.slain && S.slain[f]))`. Otherwise spawn a normal wave.
  - state.js retire :308: add `S.slain = {}`.
  - Also clear the stale camp there: `S.campFloor = 0; S.campLevels = 0;`.
    - `chk_camp.js`, light 40 h: 1 of 20 regroups pointed at a leftover `campFloor` 6–7 floors above the boss wall, so the party re-fought the boss during a regroup.

### F5 [severity: minor] War Charge still freezes the Hollowed Warlord's void and attack timers (R6 F5: partial)
- **Evidence:**
  - `fightT`, `windup`, `flashCool`, `pile`, `shell` and the sig timer now tick above the stun and charge branches (world.js:502–507). Damage numbers are hidden 1.0 s per charge, as designed. **PASS.**
  - But the void block (:541–551) and `e.atkT -= dt` (:532) still sit below the charge `continue`s (:514–524).
  - `voidT` and `atkT` are frozen for **98%** of every charge: 29–83 s per 8 h, 249–574 s per 40 h. That's about 1 s per charge, or about 8% fewer void slams for the Hollowed Warlord.
- **Proposed fix:** move the whole `if (e.boss && (e.hollowed || e.key === 'hollow') && e.active) {…}` block to just after :509 (`if (frozen || !front) …continue;`). Still below the stun line, so stuns keep pausing the slam.

### F6 [severity: minor] Web Shot: "an ultimate tears the web" shows up in 0–13% of webs. Typing should tear it, and webs leak into the next floor
- **Evidence:**
  - Torn by an ultimate, 8 h:

    | Profile | Torn |
    |---|---|
    | typist | 9–13% |
    | light | 0–6% |
    | burst | 0–2% |
    | idle | 0–2% |

  - 40 h: typist 12%, idle 0%.
  - Variants:
    - Any paid ultimate tears every web (`webAll`): 6–19%.
    - The web targets the next ultimate's hero (`webTurn`): 1–19%.
  - The cap is ultimate frequency: about 1 every 12 s against a 2.5 s web.
  - `dbg_webkeys.js`: a typist lands **5.7 keystrokes per web**.
  - `webbed` is never cleared on knockout, `nextFloor` (:667) or `recover` (:684). Webs carry into a new floor or retreat 3–9 times per 8 h, and a revived or new-floor hero idles for up to 2.5 s.
- **Proposed fix:**
  - world.js, near :257:
    ```js
    KK.on('activity', () => { for (const h of W.heroes) if (h.webbed > 0) { h.webbed -= 0.5; if (h.webbed <= 0) { h.webbed = 0; KK.emit('webTorn', { h }); } } });
    ```
    A typing player breaks a web in about 1 s and sees "WEB TORN!". That's the typing hook on the strip, while idle players keep the 2.5 s.
  - Add `h.webbed = 0` in `damageHero` on knockout, in `nextFloor` :667 and in `recover` :684.
  - Lava Rain is fine as a readable threat: 5–10% of the damage taken in Magma Lord fights, 0–5 knockouts per 8 h.

### F7 [severity: minor] Achievement progress and Codex progress: design
- **Achievement counters:**
  - **Where:** add an optional `goal` and `cur: (S, P) => n` to `LIST` entries (achievements.js:12–55).

    | Achievement | Counter |
    |---|---|
    | chests100 | `S.stats.chests` / 100 |
    | rats25 | `stats.rats` / 25 |
    | keys10k, keys100k | `stats.keys` |
    | flow1h, flow10h | `stats.flowTime`, shown as h:mm |
    | ults1k | `stats.ults` |
    | retire10 | `P.bigRetires` / 10 |
    | omen10 | `(P.omens \|\| []).length` / 10 |
    | hollowed6 | `(P.hollowed \|\| []).length` / 6 |
    | codex28 | `KK.mods().codexRanks` / 28 |
    | legacy_all | maxed capped rows / 8 |
    | crucible10 | `workshop.crucible` / 10 |
    | lv100 | the highest hero level / 100 |
    | f100, f125, f150 | `maxFloorEver` |
    | blitz | `P.blitzBest` / 8 (store the best 10-min window in the test) |
    | seals7, seals30 | `S.seals` |

  - No counter for the binary ones (first_boss, echo, idle50, speed60 and similar).
  - **UI** (ui.js:306):
    - Locked rows with `cur` get `<i class="prog"><i style="width:${pct}%"></i></i><small>${cur}/${goal}</small>`.
    - The summary line adds the nearest one: `🏆 ACHIEVEMENTS 18/36 · NEXT: Treasure Hunter 87/100` (the highest `cur/goal` among locked rows).
  - No progress toasts; they nag. Later, the Steam layer mirrors `cur` with `SetStat` and `IndicateAchievementProgress` at 25/50/75%.
- **Codex in Legacy:**
  - **Where:** a box between the stat box and `achHTML()` (ui.js:298), replacing the parenthetical "Hollow Codex N/28" in :284.
  - **Content:** `HOLLOW CODEX  rank ${r}/28 · x${1.03^r} dmg & gold · next rank in ${8 - kills % 8} Hollowed kills`, plus a 28-pip bar.
  - Before the first Hollowed kill: "Defeat Hollowed bosses past floor 70 to fill the Codex". In the demo: "(full game)", which doubles as a teaser.
  - At rank 28: "COMPLETE: x2.29".
  - Also fix the Codex toast at rank 28 (ui.js:535): it still says "Next rank in 8 Hollowed kills".

### F8 [severity: minor] Wired but dead or invisible (still open)
- `UI.offlineModal` (ui.js:509) is never called.
- `tooBig` (ui.js:241) is always false.
- `S.runInputs = (S.runInputs || 0)` (state.js:149) is a no-op.
- `KK.on('echo', () => {})` (fx.js:210) is empty.
- `HEROES.cleric.ult.cd: 25` is never read; `sanctuaryReact` hard-codes 25 at world.js:175.
- `CODEX_RANKS` is exported but only used in a comment. Old saves fold through `S.codex`.
- The Spark display "/150" (ui.js:62) is never reached: 4 Sparks wasted of 15,402 inputs in the demo typist run.
- Ultimates fired at a lone bone pile: 0–10 per 40 h, negligible.
- The stat box still lacks Chests, Wipes and Seals.

## Verified fixes from last round (pass/fail, one line each)
- **Wounded retries keep Hollowed status: PASS.** 36/36, 43/43 and 31/31 late wounded spawns stayed Hollowed (40 h idle, 3 seeds); 8 h runs 100%.
- **Enrage and regroup: PASS.** The enrage fires in all modes (8 h: 4–10 per run). Wounds carry over. Regroups: 1–4 per 8 h, 20–41 per 40 h.
- **Reassemble: PASS.** The pile blocks 2–136 hits per run. Rise to second death is the 1.5 s pile plus a median standing time of 0.37–1.5 s for normal kills (8 h) and 2–10 s for Hollowed (40 h). 0–1 kills land within float noise of the pile ending; none truly die as a pile.
- **Royal Summons: PASS.** Seen in 100% of fights, 3 waves per fight.
- **Web Shot: PASS** (seen 98–100%). Readability: see F3/F6.
- **Magma Shell: PASS** (seen 100%; opener hit in 70–100% of fights). Cracked: typist 22–37%, light 14–24%, idle 0–3%.
- **Lava Rain: PASS** (seen 98–100%; 5–10% of Magma Lord fight damage).
- **War Charge no longer pausing timers: PARTIAL.** `fightT`, `windup` and the sig timer are fixed; `voidT` and `atkT` are still frozen 98% of each charge (F5).
- **Codex toast: PASS** ("rank N/28"). The rank-28 wording is still wrong (F7).
- **Omen pill tooltip: PASS (code).** `.demo-pill.omen { pointer-events: auto }` (style.css:442), and `native.js` passThrough doesn't ignore it. Not checked in the browser.
- **demoSealed toast: PASS.** It switches to "Demo Renown is maxed" (ui.js:536).
- **Pacing sanity (8 h, 4 seeds):**
  - Max floor: typist 120–125, light 106–110, burst 96–100, idle 90–97.
  - 40 h max floor: typist 170–176, light 155–160, idle 120–126.
  - Demo typist best floor-40 time: 3.8–4.0 min.

## Ideas (optional, max 3)
1. **The Omen of the Day ★ as Steam rich presence** ("★ Glass Delve · floor 142/153"). It's the one daily reason to glance at the strip, and it's visible to friends.
2. **"Type to break free"** across the board: keystrokes tear webs (F6). A future Bone King variant could drop faster while you type ("rattle the bones").
3. **Demo "next lap" teaser:** each sealed toast names a random full-game boss and its move ("Below the seal: the Magma Lord's LAVA RAIN"), so 13 laps read as 13 small trailers.
