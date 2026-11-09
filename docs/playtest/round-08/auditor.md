# Round 08 — T2 auditor (content & pacing, dead-content hunter)

## Verdict
The week-2 layer shipped as specced and measures **at or above the R7 prototype**:
- Typists get 48–49 beats after hour 8, with a longest gap of 128–225 min. The prototype predicted 43–48 beats and a 179–250 min gap.
- 0 boss re-kills in 5,321 kills.
- Typing now tears about half of all webs for typists.

Glimpse of the Depths works for typists. They get a sealed Magma floor at 28–41 min, lasting 12–52 s, with a stone Colossus on screen for 11–47 s. 0 KOs on it.

Three problems with the Glimpse:
1. **Retiring while on the sealed floor corrupts the next delve.** The `S.glimpse` flag survives the retire. The result is 16–73 wipes on floor 1–6 against floor-38 monsters, then a teleport to floor 37.
2. **Idle and burst players never see the visual in a Fest-length session.** It lands at 70–109 min; they only get the 40-min text card.
3. **The banner gate makes boss moves vanish in fast fights.** In the demo, Royal Summons now appears in 4–36% of Rat King fights. That undoes the Head Start cap's purpose.

I'd keep it running tomorrow. **8/10** (R7: 7.5). It's 8.5 once F1–F3 are in.

### Method
- **Code:** all numbers come from the **current** `js/` (HEAD 592ac10). Nothing in `js/` was edited.
- **New harness:** `docs/playtest/round-08/r8load.js` is `tools/headless.js` **plus `js/fx.js`**, with `performance.now`/`setTimeout` on sim time and `FX.update` before each `W.update`, like `main.js`. Calm mode is on (the desktop default).
  - That way banners, the banner-gated signature moves, the glimpse alert (setTimeout 2.6 s) and the move-alert caps behave like the real game. Earlier rounds' sims had no `KK.fx`, so **sig moves were never gated in any earlier sim number**.
- **`r8probe.js`:** the R6/R7 harness (`round-06/r6lib.js` with the R7 summary) on top of r8load.
  - `KK.today` is patched to **sim days of 8 h of play** (`--day`).
  - The player takes the starred omen, and takes the free daily re-delve after 30 min walled.
  - The Lantern can't be bought below floor 70, matching the UI.
  - Telemetry: sig moves under a banner, per-fight "saw the boss's own move", the first 3 fights per boss, who tears webs (ultimate / keys / expiry), void-slam gaps per boss, voidT during War Charge, re-kills of a slain floor, Glimpse timing and staging (statue/door/party x, on-screen seconds at strip widths 683/960/1280, alert, banners), the 40-min peek moment, and the Fire Below unlock.
- **`r8edge.js`:** Glimpse edge cases (retire, wipe, quit and reload on the sealed floor; the retire state).
- **Batches:** `batch.sh` and `batch2.sh`. Outputs are in `out/`.
- **Runs** (`--retire nudge --omen random`):
  - Demo, 3 h: 4 profiles × 6 seeds.
  - 8 h: 4 profiles × 4 seeds.
  - 40 h: typist, light and idle × 4 seeds.
  - Plus `tools/playtest.js --demo`: the idle gate (seeds 1–5, 60 min) and idle 150 min (seeds 1–5).

## Findings (ranked, max 8)

### F1 [severity: major] Retiring on the sealed floor keeps `S.glimpse` and wrecks the next delve
- **Evidence:** `node r8edge.js`, seeds 1–3: retire while `S.glimpse` (canRetire true, +30).
  - The new delve starts on floor 6 with `glimpse true`, so `spawnWave` keeps spawning floor-38 monsters at 0.3 HP on floor 6.
  - 16, 26 and 25 wipes follow until the party out-levels them.
  - Then the glimpse exit branch (`world.js:683–687`) sets `demoDone` and **teleports the fresh party to floor 37**, where it wipes 5–10 more times.
  - It also happened unscripted: in `out/demo_burst_s2.txt` the harness's stuck-retire fired as the glimpse began. The "sealed floor" then lasted 1,176 s, with 73 wipes and 129 KOs. The demo card came 20 min late, at floor 6.
- **How a real player gets there:**
  - The window is the 12–52 s glimpse floor.
  - It's exactly when a first-time player has +30 Renown and the Legacy ♛ badge is lit (retires == 0).
  - The idle path: "Stuck? ♛ Retire: +30" at the f40 Warlord → Legacy → RETIRE → confirm. `confirmRetire` doesn't pause (only the omen modal does), so the boss can fall, the glimpse starts, and then the player clicks RETIRE.
- **Why it matters:** "beat the demo, retired, then my party died 70 times on floor 6" is a refund and bad-review moment, and it lands at the demo's climax.
- **Proposed fix:**
  - **state.js `A.retire`**, first lines:
    ```js
    if (S.glimpse) { S.glimpse = false; KK.world.sealedX = 0; if (KK.DEMO_CAP && !S.demoDone) { S.demoDone = true; KK.emit('demoComplete'); } }
    ```
    The card still shows, and the retire proceeds normally.
  - **Belt and braces:** `A.canRetire = () => !KK.S.glimpse && (…)`, so the button greys out for those seconds.

### F2 [severity: major] Glimpse vs my R7 spec: typists get it; idle, burst and light get only text in hour 1. Plus staging and card issues
- **Who sees what, when** (r8probe, 6 seeds each; official `playtest.js --demo` idle seeds 1–5 in brackets):

  | Profile | Glimpse floor (f41) | 40-min "What waits below" card | DEMO COMPLETE card |
  |---|---|---|---|
  | Typist | 28.0–40.8 min | only seed 4 (40.0 min, then the glimpse at 40.8, then the 2nd card at 41.2) | +0.2–0.8 min after the glimpse |
  | Light | 50.6–74.5 min | 40.0 min, all seeds | +0.3 min |
  | Burst | 70.5–83.3 min | 40.0 min | +0.3 min |
  | Idle | 75.7–109.0 min (73–102) | 40.0 min | +0.3 min |

- **On the floor** (24 runs):
  - It lasts 12–52 s (median ≈ 22 s).
  - Banners: "VICTORY! > THE MAGMA DEPTHS / FLOOR 41". The alert "THE MAGMA DEPTHS: A SEALED BOSS WAITS IN THE FULL GAME" appears at +2.6–2.7 s, while still on the floor, in 24/24 runs.
  - Imp, magma slime and golem are now seen in the demo.
  - 0 KOs and 0 wipes.
  - Afterwards: maxFloorRun 40, maxFloorEver 40, laps 1, bestCapTime set, no Renown or trophy change. The caution rule is skipped on 40 (boss floor) and 41 (`runCapCleared`), and there's no camp or regroup interplay. **PASS**.
- **What doesn't match the spec:**
  1. **The visual tease never reaches idle, burst or light players in the first hour.** 0/18 runs saw the floor before 50 min. The R7 spec was "first f40 clear **or** 40 min", meaning the sealed floor itself. The 40-min fallback is the text card only.
  2. **The statue isn't at the door.** `W.sealedX = partyX + 230` at floor start, but the door appears at +534 to +851. The party walks *through* the statue 4–17 s in, fights waves 2–3 on top of it, then walks 300–620 px on to an ordinary door.
  3. **Two cards in 72 s.** Typist seed 4: the peek at 40:00, the glimpse at 40:48, the DEMO COMPLETE card at 41:12. `slowUpdate` doesn't check `glimpseDone` or being close to floor 40.
  4. **The peek card reuses the end-card footer.** It says "every re-delve rerolls your relics, a fresh clear of floor 40 pays +6 Renown", which isn't true yet for a player on floor ~22.
  5. **Closing either card with Esc or a backdrop click leaves `UI.demoOpen = true`.** `UI.modal`'s close never runs `done`. The demo's first-retire nudge (ui.js:618-623, "Retiring now earns +30…") then never fires that session. That's the one teaching toast a floor-40 demo player needs.
  6. **Quit and reload on f41:** `W.sealedX` isn't saved, so there's no statue and no alert. Only the card fires (`r8edge` reload case).
  7. **"Fire Below" (`magma`, floor >= 41) unlocks during the glimpse in 24/24 runs.** It's silent in the demo (no toast), and the full game inherits it on import without the player ever entering Magma.
     - Related tooling note: `tools/playtest.js` now reports "biomes reached: Magma Depths" for the demo.
- **Why it matters:** the idle audience ("it plays itself") is the one most likely to leave a Fest demo running. For them the best wishlist asset, a new biome palette plus a sealed boss on the strip, comes at 75–109 min.
- **Proposed fix:**
  - **(a) A "Vision of the Depths" at 40 min**, reusing the glimpse floor:
    - ui.js:79 peek → `S.glimpsePending = 'peek'` instead of emitting the card.
    - world.js `nextFloor`: when `S.glimpsePending` and the current floor isn't a boss floor, do the following:
      - Store `S.glimpseReturn = S.floor` and open the glimpse.
      - Spawn the glimpse waves at `Math.min(S.floor, KK.DEMO_CAP - 2)`, hp ×0.3, so a floor-22 idle party can clear them.
      - Return to `S.glimpseReturn`, not 36.
      - Then emit `demoComplete {peek:true}`. Don't set `demoDone`, `runCapCleared` or `bestCapTime` for the peek variant.
    - Alert: "A VISION OF THE MAGMA DEPTHS: SEALED IN THE DEMO".
  - **(b) Staging:**
    - Draw the statue only after `floorClear` on the glimpse floor: `W.sealedX = W.door.x + 30`, a little dust burst, and hold the party 3 s at the door (`W.glimpseHold`).
    - Fire the alert there, not via setTimeout at floor start.
    - Set `W.sealedX` in `spawnWave` when `S.glimpse && W.wave === 0` too, so a reload restores it.
  - **(c) Peek guard:** `&& !S.glimpseDone && S.maxFloorRun < KK.DEMO_CAP - 4`, and fire anyway at 60 min.
  - **(d) Peek footer:** "The demo ends at floor 40. Your save carries over: the full game picks up right where you stop."
  - **(e) `UI.modal(html, onBind, onClose)`:** call `onClose` from every close path. The demo card passes `() => UI.demoOpen = false`.
  - **(f) achievements.js `magma`:** `test: (c) => c.ev.floor >= 41 && !c.S.glimpse`.

### F3 [severity: major] The banner gate (R7) removes boss moves from fast fights; the demo's Royal Summons now shows on lap 1 only
- **Evidence:** fx.js is loaded, so this is the first sim where `world.js:479` actually gates.
  - **The gate itself works:** 0 timed openers fired under a banner across all runs. Only the ungated chargeWarn and reassemble did, 0–3 per 8 h.
  - The opener now comes at **3.1–3.6 s after spawn**: the 2.6 s boss banner plus sigT.
  - Share of fights where the boss's own move happens at all, 8 h:

    | Profile | Brood Mother | War Charge | Ember Colossus | Magma Lord |
    |---|---|---|---|---|
    | Typist | 33–57% | 38–43% | **18–45%** | 27–50% |
    | Light | 33–50% | 40–60% | 40–55% | 50–67% |
    | Idle | 30–40% | 45–67% | 67–100% | 100% |

    Hollowed versions: 67–100%.
  - **Demo, 3 h** (Rat King fights / with Royal Summons):

    | Profile | Rat King fights | With Royal Summons |
    |---|---|---|
    | Typist | 21–23 | 1 (**4–9%**, the first fight only) |
    | Light | 15–18 | 6–18% |
    | Burst | 10–14 | 8–23% |
    | Idle | 10–11 | 20–36% |

  - First encounters are fine: the first fight vs every boss showed its move in all 16 8-h runs (`R8 FIRST3`). The loss is on laps, where kills take 2–3.6 s.
  - **Root cause for the Rat King:** the 60% and 30% HP summons require `summonStage` 1/2. Those stages are only reachable after the timed opener (stage 0), and `sigMove` returns early under any banner. A 2–3 s kill crosses both HP thresholds during the banner and summons nothing.
  - The commit 592ac10 premise ("Head Start capped at 1 so the Rat King stays in every lap") delivers the Rat King but not his move.
- **Why it matters:** the moves exist to make each boss read differently on a strip you glance at. On demo laps 2–22, every early boss is again "a big sprite that dies".
- **Proposed fix:**
  1. **world.js:479:** only hold *timed* openers under a banner. Let HP-triggered moves through:
     ```js
     if (banner && e.key !== 'ratking') { e.sigT = Math.max(e.sigT, 0.5); return; }
     ```
     For the Rat King, make the stages independent:
     ```js
     due = (stage === 0 && (e.sigT <= 0 || e.hp / e.maxHp < 0.6)) || (stage <= 1 && e.hp / e.maxHp < 0.6) || (stage <= 2 && e.hp / e.maxHp < 0.3)
     ```
     with `summonStage = max(stage + 1, …)`. The summons alert can still wait via FX.moveAlert.
  2. **Boss-name banner `life: 1.8`** (fx.js:254, from 2.6; R7 F3 option 3). Openers land at about 2.3–2.8 s, inside most 3–4 s lap kills.
  3. **Optional:** the opener fires the moment the banner ends (`e.sigT = 0` rather than `max(sigT, 0.5)`).

### F4 [severity: minor] The boss-bar move name (R7) is clipped off the right edge on every Hollowed boss
- **Evidence** (render.js:293–300):
  - The label is centred at `bx + bw/2 = Wd - 65` and the font is 4 px per character, so anything over 32 characters runs past `Wd`.
  - Examples:

    | Label | Characters | Clipped | Shows as |
    |---|---|---|---|
    | THE HOLLOWED GOBLIN WARLORD - CHARGING | 38 | 11 px | "…CHARG" |
    | THE HOLLOWED EMBER COLOSSUS - SHELLED | 37 | 9 px | |
    | THE HOLLOWED BONE KING - REASSEMBLING | 37 | 9 px | |
    | THE HOLLOWED BROOD MOTHER - VOID SLAM | 37 | 9 px | |
    | EMBER COLOSSUS (WOUNDED) - SHELLED | 34 | 3 px | |
    | THE HOLLOWED GOBLIN WARLORD (WOUNDED) - CHARGING | 48 | 31 px | |

  - Wounded carry-overs are common late (enrage keeps wounds).
- **Why it matters:** the move name is the persistent, size-S-readable cue R7 added, and it's cut exactly on the late fights where it matters most.
- **Proposed fix:**
  ```js
  const lbl = …; const cxl = Math.min(bx + bw / 2, Wd - 3 - KK.font.width(lbl) / 2); KK.font.draw(b, lbl, cxl, by + 6, …)
  ```
  - Or drop "THE " in the bar and write "WND" for "(WOUNDED)".
  - Or move the move tag onto the `by + 12` line when ENRAGE isn't showing.

### F5 [severity: minor] Achievement progress counters: implement-ready spec for the current achievements.js (39 entries)
- **Data:** add optional fields to `LIST` entries: `goal` (or `get goal()`), `cur: (S, P) => n`, `fmt` (formatter), and `from` (hide the counter until `cur >= from`).

  | id | goal | cur | notes |
  |---|---|---|---|
  | chests100 | 100 | `S.stats.chests` | |
  | rats25 | 25 | `S.stats.rats` | |
  | keys10k / keys100k | 1e4 / 1e5 | `S.stats.keys` | |
  | flow1h / flow10h | 3600 / 36000 | `S.stats.flowTime` | `fmt: U.fmtTime` |
  | ults1k | 1000 | `S.stats.ults` | |
  | retire10 | 10 | `P.bigRetires \|\| 0` | |
  | omen10 | `get goal(){return D.OMENS.length}` | `(P.omens \|\| []).length` | |
  | hollowed6 | 6 | `(P.hollowed \|\| []).length` | |
  | codex28 | `get goal(){return D.CODEX_MAX}` | `KK.mods().codexRanks` | |
  | legacy_all | `get goal(){return D.LEGACY.filter(d=>d.max<999).length}` (8) | `D.LEGACY.filter(d=>d.max<999 && (S.legacy[d.id]\|\|0)>=d.max).length` | |
  | crucible10 | 10 | `S.workshop.crucible \|\| 0` | |
  | lv100 | 100 | `Math.max(...HEROES.map(h=>S.heroes[h]\|\|0))` | `from: 30`; current delve |
  | f100 / f125 / f150 | 100 / 125 / 150 | `S.maxFloorEver` | `from: 61 / 100 / 100` |
  | seals7 / seals30 | 7 / 30 | `S.seals \|\| 0` | |
  | blitz | 8 | `P.blitzBest \|\| 0` | in `test`, after the push: `c.P.blitzBest = Math.max(c.P.blitzBest\|\|0, c.P.bossTimes.length);` (label: "best 10-min window") |
  | deep90 | 90 | `P.deepBest \|\| 0` | `from: 40`; new test: `if (c.S.omen==='deep') c.P.deepBest=Math.max(c.P.deepBest\|\|0,c.ev.floor); return c.S.omen==='deep' && c.ev.floor>=90;` |

  - No counter for the 21 binary ones: first_boss, flow, full_party, retire1, gatekeeper, rat, epic, caverns, comeback, echo, ult_boss, revive, speed60, magma, void, hollow, omen1, idle50 and the like.
  - In the demo, the 5 demo achievements are all binary, so there are no counters.
  - Optional: show the stat-based counters (keys, flow, ults, chests, rats) on the greyed FULL GAME rows with "(carries over)".
- **API** (achievements.js):
  ```js
  A.progress = (def) => {
    if (!def.goal) return null; const S = KK.S, P = S.achP || {}; let cur;
    try { cur = def.cur(S, P); } catch (e) { return null; }
    if (def.from && cur < def.from) return null;
    if (cur >= def.goal) { check(def); return null; }       // old saves past a threshold unlock on sight
    return { cur, goal: def.goal, pct: Math.floor(100 * cur / def.goal), txt: (def.fmt || KK.U.fmt)(Math.floor(cur)) + '/' + (def.fmt || KK.U.fmt)(def.goal) };
  };
  A.next = () => { let best = null; for (const d of LIST) { if (KK.S.ach[d.id] || (KK.DEMO_CAP && !d.demo)) continue; const p = A.progress(d); if (p && p.pct > 0 && (!best || p.pct > best.pct)) best = Object.assign({ def: d }, p); } return best; };
  ```
  - `check` is the existing function; `A.progress` must be defined after it.
- **UI** (ui.js `achHTML`, :325):
  - Row:
    ```js
    `<div class="ach ${got[a.id] ? 'got' : ''}"><b>${a.name}</b><span>${a.desc}</span>${p ? `<div class="achprog" data-ach="${a.id}"><i style="width:${p.pct}%"></i></div><small>${p.txt}</small>` : ''}</div>`
    ```
    where `p = !got[a.id] && KK.ach.progress(a)`.
  - Summary:
    ```js
    `🏆 ACHIEVEMENTS ${n}/${list.length}${nx ? ` · NEXT: ${nx.def.name} ${nx.txt}` : ''}`
    ```
    with `nx = KK.ach.next()`. Example: "· NEXT: Treasure Hunter 87/100".
  - **Live refresh:** in `refreshPanel` (legacy tab), at most 1 Hz and only when `UI.achOpen`, update each `[data-ach]` bar width and its `small` text. No full rebuild per keystroke.
  - **CSS:**
    ```css
    .ach { opacity: 1 } .ach:not(.got) > b, .ach:not(.got) > span { opacity: .45 }
    .achprog { height: 3px; background: #0008; margin-top: 4px } .achprog i { display: block; height: 100%; background: #ffd76a }
    .ach small { font: 10px var(--font-px); color: #ffd76a; margin-top: 2px }
    ```
    The current `.ach { opacity: .45 }` would dim the bar too.
  - No progress toasts.
  - Steam later: `SetStat` with `IndicateAchievementProgress` at 25/50/75% from the same `cur`.
- **Why it matters:** the slow ones (Wordsmith 100k keys at about 14 h of typing, Monk Mode, Dynasty, Augur, Devout, Hollow Scholar at 38–40 h) are invisible goals today. A counter is a reason to glance at Legacy in week 2.

### F6 [severity: minor] The Void Lantern appears silently. The Workshop badge ignores `minFloor`. Two spec lines are missing.
- **Evidence:**
  - `minFloor: 70` hides the card until floor 70 (ui.js:266). **PASS.**
  - But the card shows up with no toast and no NEW tag:
    - Typists reach f70 at 1.1–1.3 h and can afford L1 at 5.9–7.1 h.
    - Light players reach f70 at 1.7–1.9 h and can afford L1 at 10.5–12.6 h.
    - Idle players never afford it (16–246 Embers at f70).
  - `badges()` `wsAff` (ui.js:145) counts the hidden Lantern. I measured 0 false badges (`blocked-but-affordable 0` in all 52 runs), so it's latent.
  - Missing from the R7 F1 spec:
    - the re-delve modal's "Today's omen: … reach floor N for +10 Renown" line (ui.js `confirmRetire`);
    - removing the retire box's duplicate "Hollow Codex N/28" (ui.js:293), now that the Codex box exists.
- **Proposed fix:**
  - On the first `floor >= 70` event: toast "The Void Lantern can now be built in the Workshop (void slams -8% per level)" and set a NEW tag on the card until it's bought.
  - `wsAff`: add `&& (!d.minFloor || S.maxFloorEver >= d.minFloor)`.
  - Add the omen line to `confirmRetire` when `!KK.DEMO_CAP && A.dailyOpen()`.

### F7 [severity: minor] Wired but dead or invisible (old leftovers plus new ones)
- **Still dead:**
  - `UI.offlineModal` (ui.js:540) is never called.
  - `const tooBig = false` and the `data-lock` path (ui.js:250, 254, 190).
  - `S.runInputs = (S.runInputs || 0)` (state.js:151) is a no-op; the counting happens in achievements.js:91.
  - `KK.on('echo', () => {})` (fx.js:219): the epic Echo Rune's second cast has no cue of its own.
  - `HEROES.cleric.ult.cd: 25` is never read; world.js:195 hard-codes `c.ultCd = 25`.
  - `CODEX_RANKS` is exported but only referenced in a comment.
  - **Fix:**
    - Delete the first three.
    - Echo: `KK.on('echo', ({ h }) => FX.text(h.x, h.y - 26, 'ECHO!', '#c472ff', 1, { life: 1 }))`.
    - Cleric: `c.ultCd = D.HEROES.cleric.ult.cd`.
    - Drop `CODEX_RANKS`.
- **New:**
  - The Web Shot alert still reads "WEB SHOT! TYPE: AN ULTIMATE TEARS IT" (fx.js:335). Keystrokes now tear webs directly (typists: 45–56% of webs torn by keys). Suggested text: "WEB SHOT! TYPE TO TEAR IT".
  - `W.sealedX` isn't persisted (F2).
  - `UI.demoOpen` gets stuck (F2).
  - The demo save's Head Start L2 from the R7 build now does nothing in the demo (max 1) with no refund. It only affects pre-Fest testers, and the full game uses all 8 levels again.
  - Tooling: `tools/playtest.js` counts the glimpse as "Magma Depths reached" and its monsters as seen. When reading demo coverage, discount floor 41.
- **No orphan events:** emit and listen cross-check — only `swing` and `fizzle` are emitted without a listener (harmless).

## Verified fixes from last round (pass/fail, one line each)
- **Week-2 layer (40 h, after hour 8, day = 8 h of play): PASS, at or above the R7 prototype.**

  | Profile | Beats | Longest gap | Empty 2 h windows | Max floor | R7 prototype (beats / gap / empty / floor) |
  |---|---|---|---|---|---|
  | Typist | 48–49 | 128–225 min | 2–3 | 180–183 | 43–48 / 179–250 / 2–4 / 180–184 |
  | Light | 44–47 | 157–187 min | 1–3 | 164 | 43–48 / 149–227 / 2–4 / 160–168 |
  | Idle | 30–39 | 216–251 min | 3–5 | 127–134 | 31–37 / 214–282 / 4–5 / 129–130 |

- **Seals: PASS.**
  - 5 in 40 h for every profile, one per day. The star was offered 5 and taken 5 times.
  - Seal floor reached 4–36 min into the delve. The first Seal comes at 0.9–1.9 h.
  - 3–4 free daily re-delves.
  - The UI surfaces are in: omen card ★ (ui.js:505), pill and tooltip, retire button, toast and stat row.
- **Void Lantern hidden until f70: PASS.** Typist L1–L5 at 5.9–7.1 h → 27.7–30.7 h. Light L1–L4 at 10.5–12.6 h → 29.8–36.3 h. Idle: never. Discoverability: F6.
- **Trophies to 200: PASS.** Typist f160 at 19.8–23.2 h, f170 at 27.6–30.6 h, f180 at 35.6–37.8 h. Light f160 at 33.5–36.5 h. f190 and f200 are past 40 h (fine for week 3+).
- **3 new achievements: PASS.**
  - Bottom of the Keep (f150): typist 15.3–17.9 h, light 25.2–29.0 h.
  - Faithful (7 Seals) and Devout (30): by design they need 7 and 30 calendar days, so 0 in a 40 h sim.
  - 39 in total; the demo card uses `LIST.length`.
- **Codex box: PASS (code).**
  - Shows rank, multiplier, the next rank in N kills and 28 pips.
  - Locked text below f70. Demo text "(full game)".
  - Rank-28 toast reads "The Codex is complete!". Hollow Scholar arrives at 38.1–39.7 h for typists (2/4 seeds).
- **Slain floors: PASS.** 0 re-kills of a boss floor already beaten this delve, in 5,321 boss kills over 52 runs. Campfloor and campLevels reset on retire.
- **Void timer order: PASS.** The median gap between void slams is 12.0 s for every Hollowed boss, including the Hollowed Warlord (n = 2–49 per run). `voidT` only holds during a stun, as intended.
- **Web tearing: PASS.**
  - Typist: keys tear 45–56% of webs and ultimates 2–11%; median web 0.93–2.03 s (was 2.5).
  - Light: keys tear 12–25%.
  - Burst and idle: 0–9%, so the web expires at 2.53 s.
  - "WEB TORN!" shows. Webs clear on KO, floor change and recovery.
- **Moves wait for the banner: PASS** mechanically (0 gated openers under a banner). It costs moves in fast fights: F3.
- **Alert plate above the banner (render.js:338): PASS.** 0–5 alerts per 8 h drawn while a banner shows.
- **Boss bar move names: PASS (code).** Clipped on Hollowed bosses: F4.
- **Re-delve softlock fix, demo card count of 39, DEMO pill opens the store: PASS (code).**
- **Pacing sanity: PASS.**
  - 8 h max floor: typist 120–125, light 110, burst 100–109, idle 94–100 (R7: 120–125 / 106–110 / 96–100 / 90–97).
  - Idle demo hour-1 gate wipes: 2/1/2/4/0 (unchanged).
- **R7 F8 leftovers: FAIL (still open).** offlineModal, tooBig, runInputs, the echo listener, cleric `ult.cd` and CODEX_RANKS are all still there (F7).

## Ideas (optional, max 3)
1. **Every later floor-40 re-clear flashes the sealed Colossus behind the door for 2 s**, with a rotating line naming one full-game boss and its move ("BELOW THE SEAL: THE MAGMA LORD'S LAVA RAIN"). Twenty demo laps become twenty tiny trailers, using the F2 staging code.
2. **A Seal streak on the omen pill** ("★ GLASS DELVE · F142 · 3-DAY STREAK") and as Steam rich presence. It's the one daily reason to glance at the strip, and friends can see it.
3. **The "NEXT:" achievement in the Legacy summary also as a tooltip on the Legacy button**, so the nearest goal is one hover away without opening the panel.
