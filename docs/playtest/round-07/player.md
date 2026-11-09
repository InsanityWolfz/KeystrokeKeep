# Round 07 — T4 `player` (first-time player, UX & feel)

I played in the browser pane at http://127.0.0.1:5173. Assets were `?v=r7`.

**Viewports:**
- **800x690:** the strip at 1:1, scale 2 = size S. I used this for all pixel checks.
- **1280x720:** sizes M and L, and the layout check.
- **Frozen frames:** I froze moments with `KK.paused = true` plus a no-op `KK.fx.update`. For close-ups I copied the game canvas, scaled up, into a corner overlay.

**Demo session (`?demo`, fresh save), as a Next Fest visitor:**
- **First ~4 min at 1x:** real typing bursts in the notepad. A page typer at ~6.5 keys/s put the characters into the textarea and sent `keydown` events. I made a few manual purchases (level up, Ember Crucible) and picked a relic by hand.
- **Then "mostly idle":** 5x warp, with a 60–220-key burst about every 2 minutes. A "glance" helper bought hero levels, Forge and recruits every 20 s.
- **Later, dev tools:** 20x warp, dropping to 1x on every boss.
- **Path:** first retire (+30) → Legacy → second delve → Demo complete card → Keep delving → +6 retire → +5 Floors x3 → 0-Renown re-delve.

**Full game (`/`), briefly:** fresh save, then state set by script (3 retires, heroes Lv 72–100, Gilded Delve omen). I played F48–F60 for the Ember Colossus (F50) and the Magma Lord (F60).

**Cleanup:** fresh-start reset, warp 1x, viewport preset desktop, navigated to `/`. localStorage is empty, F1, and the welcome modal is showing.

## Verdict
The first 3 minutes are the best they've been:
- You type a few sentences and FLOW STATE lands at **46 s**.
- The "Your typing just powered an ultimate!" toast lands right on time.
- The Rat King falls at **2m 34s**.
- Relics wait politely behind a badge instead of popping a modal.

The R6 polish holds up: crisp digits, the bone pile, the enrage fuse, the achievements list staying open, and no false "Stuck?". But three problems tank the demo:
1. **The 0-Renown RE-DELVE confirm has no buttons and can't be closed.** The whole UI is dead until you reload. This is the demo's advertised endless loop, and once the demo Renown cap is hit, every re-delve is 0-Renown.
2. **Idle retreats are now so quiet they're baffling.** There were 8 wipes in the first 41 minutes. On normal floors nothing on screen explains why the floor counter goes down. A wipe right after the Bone King turned into a Bone King farm: 3 kills and 3 relics in 2.5 minutes.
3. **Every signature move opens on top of the boss's name banner.** And "an ultimate tears the web" never happened, not once in 10 web shots.

**Demo 7/10** (it would be 8 with F1 fixed). **Full game 8/10.** Would I wishlist? Yes. The F1–F10 hook sells it, and the Magma Depths moves read well. But a streamer who hits the dead RE-DELVE dialog would say "softlocked" on air.

## Findings (ranked, max 8)

### F1 [severity: blocker] RE-DELVE confirm renders without buttons: softlock (no Esc, no backdrop close)
- Evidence:
  - **Repro:** demo done → retire for +6 → Head Start/+5 Floors to F21 → Legacy "RE-DELVE (NEW RUN, NEW RELICS)".
  - **The modal shows only:** "♛ RE-DELVE? A fresh run with new relics. Beat your best: 12m 41s." There is no NOT YET and no RE-DELVE button.
  - **Console:** `Uncaught TypeError: Cannot set properties of null (setting 'onclick') at ui.js:452 (UI.confirmRetire)`.
  - **Cause:** at `ui.js:444-450`, the `redelve ? \`<h2>RE-DELVE?</h2><p>…</p>\` : \`<h2>RETIRE…</h2> … <div class="row">…buttons…</div>\`` ternary puts the button row only in the retire branch. Then `m.querySelector('[data-x=no]').onclick` throws.
  - **No way out:**
    - Esc does nothing.
    - Clicking the backdrop does nothing (`.modal-back` stays `display:grid`).
    - Panel, HUD and strip clicks are all blocked.
    - Only a reload clears it.
  - **When it hits:** any re-delve with `renownGain() <= 0`. That means every re-delve once `renownLifetime >= DEMO_RENOWN_CAP`, and every early re-delve before the run re-clears F40.
- Why it matters: "every re-delve rerolls your relics… your best time is your score" is the demo card's pitch. A frozen UI on a Next Fest demo becomes the review line "softlocked after beating it".
- Proposed fix:
  - Close the ternary after the `<p>`, so the `<p>Resets…</p>` block and `<div class="row">` (NOT YET / RE-DELVE) render in both branches.
  - Give `UI.modal` an Esc and backdrop-click close for all non-critical modals.
  - Add a smoke-test step that calls `UI.confirmRetire()` with `S.demoDone = true, runCapCleared = false, maxFloorRun = 21` and asserts 2 buttons.

### F2 [severity: major] Retreats are now too quiet: after a normal-floor wipe, nothing explains why the floor goes down
- Evidence (idle demo, mostly idle after minute 4, glance purchases every 20 s):
  - **8 wipes in the first 41 min:** at 10:11 (F17), 10:55 (F16), 14:15 (F17), 24:36 (F21), 28:12 (F23), 31:49 (F24), 36:22 (F24) and 40:58 (F27).
  - **Banner vs quiet:** only wipes more than 5 minutes after the last banner get the RETREAT banner (roughly half). The rest are a 1.2 s "RETREAT" alert.
  - **After the alert:** the party camps on F15/F16 for up to 8 min with **no HUD text at all.**
    - At `ui.js:83-88`, `#hud-farm` only shows when `bossBlock` is set or the stall rule fires. The normal-floor camp sets `campFloor/campUntil/campLevels`, which aren't read there.
    - I watched "FLOOR 15" for several minutes with no tag. As a player I thought progress was broken.
  - **Cleric price:** the Cleric at 4,000 gold is what finally broke the F24 wall, at ~45 min.
- Why it matters: the quiet treatment fixed the noise (good). But now "why is it on floor 15? It was on 17" has no answer. Idle players will read it as a bug, or decide the game is punishing them.
- Proposed fix:
  - While `S.campFloor && S.campUntil > playTime`, show `#hud-farm`. Use the calm grey style, not the warning one: "Regrouping below floor 17 · +3 levels to go" (`campLevels − current sum`) or "· 4m".
  - Add one line to the how-to sticky / first RETREAT banner sub: "THE PARTY REGROUPS A FLOOR BELOW UNTIL IT'S STRONGER".

### F3 [severity: major] Camping on a boss floor becomes a boss + relic farm (Bone King x3 in 2.5 min)
- Evidence (same demo run):
  - **Timeline:**
    - Bone King killed at 24:08, then a wipe on F21 at 24:36.
    - `campFloor = 21`, so the party fell back to F20, which is the boss floor.
    - Bone King spawned again at 24:46 and was killed at 25:49.
    - It spawned again at 25:59, reassembled, and was killed at 26:15.
  - **Rewards:** each kill rolled a relic offer, for **3 relic offers in 2.5 min** (Lucky Coin twice: "luckycoin, boots, luckycoin").
  - **Noise:** each loop replayed "FLOOR 20 / A POWERFUL FOE AWAITS…", the boss banner, Reassemble and the relic toast.
  - **Cause:** `world.js:656-658` decrements to `wall − 1` without checking whether that floor is a boss floor.
- Why it matters: it's a relic exploit for idle players, and it hammers the player with the same big moment. The Bone King stops being special.
- Proposed fix:
  - If `F.isBossFloor(wall − 1)`, camp at `wall − 2`.
  - Or never respawn a boss already killed this delve while camping: track `S.bossCleared[floor]` and roll relics only for the first kill per delve.

### F4 [severity: major] Every signature move fires during the boss's intro banner, and milestone banners collide with alerts
- Evidence: frozen frames at fire time, S at 1:1 and M at 1280:
  - **Rat King:** Royal Summons at +0.6 s. "SQUEAK! THE RAT KING SUMMONS" is printed over "THE RAT KING / BOSS", and the two "RAT KING"s interleave.
  - **Brood Mother:** WEB SHOT! at +0.8 s, over "BROOD MOTHER".
  - **Ember Colossus:** "MAGMA SHELL: AN ULTIMATE CRACKS IT" at spawn. It has expired before the banner is gone.
  - **Magma Lord:** LAVA RAIN! at +1.0 s.
  - **Goblin Warlord:** WAR CHARGE! at ~4 s. Because banners queue (FLOOR 40 → GOBLIN WARLORD), the alert plate covers "GOBLIN" ("…BLIN WARLORD"). At L it hides the whole first word.
  - **Milestone banner:** on the F40 fight, a hero milestone banner "SISTER PELL LV 20 / x1.5 DAMAGE!" played over the WAR CHARGE! plate.
- Why it matters: the first time a player sees each move is exactly when it's least readable. These six moves are the demo's set pieces.
- Proposed fix:
  - In the boss update, hold `sigT`/`summonStage` until `KK.fx.banners.length === 0` plus 0.5 s. The Magma Shell spawn-shell can stay, but delay its alert the same way.
  - While `W.boss` is alive, queue hero level-milestone banners (`fx.js:288`) and play them after the kill.

### F5 [severity: major] "An ultimate tears the web" never happens and isn't shown; typing → ult → counterplay isn't taught
- Evidence:
  - **Web Shot:** **10 web shots over 2 Brood Mother fights, 0 `webTorn`.** The second fight had autotype plus my typing.
    - A web is torn only when *the webbed hero itself* casts (`world.js:213`). The back-most hero is usually the mage, the rotation skips the Cleric, and the web lasts 2.5 s against a 7 s cycle.
    - The alert is just "WEB SHOT!" (`fx.js:325`). The idea that an ult helps appears nowhere on screen.
    - The web on the hero is 6 white pixels and a 12 px line (`render.js:457`), and the "WEBBED" floater fades in 1.2 s while the web lasts 2.5 s.
    - At 800 px the "W" of WEBBED sits under the `.hud-left` spark box.
  - **Magma Shell:** the alert does say "AN ULTIMATE CRACKS IT", and "SHELL CRACKED!" plus the burst reads great.
    - But an idle player has 0–15 Sparks, so the opening shell always expires uncracked.
    - The Cleric's ult (Sanctuary) doesn't crack it, because it deals no damage, so "any ultimate" isn't true.
    - It only cracked when I banked Sparks right as the shell went up (knight ult at shell 4.0 → crack).
  - **Do players realise typing helps?** With the fresh-save "Your typing just powered an ultimate!" toast, yes for ults in general. For these two moves, no. Nothing links the move to the keyboard.
- Proposed fix:
  - Make any *damaging* ult tear **all** webs, mirroring the shell.
  - Alerts:
    - "WEB SHOT! TYPE ⚡: AN ULTIMATE TEARS IT"
    - "MAGMA SHELL! TYPE ⚡: AN ULTIMATE CRACKS IT"
  - While a web or shell is up, pulse the spark box (`#hud-spark`) or the ult bar of whoever is next in `W.ultTurn`.
  - Draw a 3-row grey cocoon over the webbed hero for the full 2.5 s.

### F6 [severity: minor] DOM pills sit on top of canvas alerts and the boss; the narrow-window HUD overlap persists
- Evidence:
  - **Size L at 1280:** `#hud-demo` "◆ GILDED DELVE" covers the middle of the alert: "MAGMA SHELL: AN ULTIMA[◆ GILDED DELVE]CKS IT". `#hud-farm` ("⚠ BOSS TOO STRONG…") sits just above it.
  - **Size S at 1280:** the omen pill sits right over the Ember Colossus sprite at F50. The shelled Colossus is dark grey on dark brick and was already hard to see.
  - **Demo:** "TREASURE! +29" and crits ("88.4K!") overprint "DEMO · ENDS AT FLOOR 40 · BEST 12M 41S · 1 CLEAR" all session.
  - **Narrow windows (below ~1050 px):** `.hud-right`'s fervor box still covers `#hud-floor`:
    - 981 px: "FLOOR 2DLE".
    - 800 px: "FLOOR 5" fully hidden behind "FLOW STATE".
- Proposed fix:
  - Hide `#hud-demo`/`#hud-farm` while `KK.fx.alerts.length > 0` (same rule as banners, `ui.js:89/94`). Or move the pill into `.hud-right` under the fervor meter (backlog R5).
  - At `innerWidth < 1050`, drop `#hud-biome` and shift `.hud-center` to `left: 40%`.

### F7 [severity: minor] The enrage fuse clips the boss name after 60 s; the enrage alert's "(96%)" reads backwards
- Evidence:
  - **Name clipping:** `render.js:289-293` draws the name at `by+6`, then the fuse's black strip `fillRect(bx-1, by+3, bw+2, 2)` over its top row. From 60 s on, every long fight shows "THE BUNE KING" and "GUBLIN WARLURD" (magnified frames at 62 s, 122 s and 166 s).
  - **Fuse states (pass):** the fuse itself, "ENRAGE 58S" (orange) and "ENRAGE 14S" (red) with the 8 Hz white flash all read clearly.
  - **Alert wording:** "ENRAGED! RETREAT. IT KEEPS ITS WOUNDS (96%)" reads as "96% wounded" when it means the boss stays at 96% HP. At 800 px, "ENRAG" sits under the spark box.
- Proposed fix:
  - Draw the fuse 3 px *above* the HP bar (`by-3`), or move the name to `by+8` while `ek > 0.33`.
  - Alert: "ENRAGED! FALL BACK - BOSS STAYS AT 96% HP".

### F8 [severity: minor] Pixel font has no "·" (re-delve banner shows "?"); the Legacy retire box goes stale while open
- Evidence:
  - **Missing glyph:** the +6 retire banner reads **"+6 RENOWN ? BEAT 12M 41S"**.
    - `ui.js:458` builds `' · BEAT '`, and `font.js:33` falls back to `G['?']` for unknown glyphs.
    - It's the only canvas string with a non-ASCII character (I grepped every banner/alert/text/font.draw).
  - **Stale retire box:** with Legacy open, `#retire-gain` updates, but the retire button doesn't. `ui.js:287` has no `data-cost`, and `refreshPanel` doesn't rebuild it.
    - After +5 Floors x3 the box still said "Deepest floor this delve: 6" with a disabled "CLEAR FLOOR 40 AGAIN FOR +6 RENOWN".
    - Only close/reopen showed "21" and "RE-DELVE".
    - The same happens on crossing F20/F41 with the panel open.
- Proposed fix:
  - Add `'·': ['...','...','.#.','...','...']` to `font.js` (and assert all `FX.banner` strings are in-glyph in the smoke test).
  - In `refreshPanel` for `legacy`, rebuild the retire box (or set `UI.dirty`) when `A.canRetire()` or `S.maxFloorRun` changes.

## Verified fixes from last round (pass/fail, one line each)
- **Achievements list open state (R6 F1): PASS.** Opened it, bought Head Start through the real button: still `open`, `UI.achOpen = true`, and `#panel-body.scrollTop` kept at 500.
- **Digits in Silkscreen (R6 F2): PASS.** At 1:1 these are all unambiguous:
  - Legacy: "Renown: 30", "+30", "+114%", "40", "2.20K".
  - Workshop: "60 / 100 / 120", "75 EMBERS".
  - Party: "1.48K", "98", "1.50K".
  - Demo card: "12m 41s", "2.80K".
- **Enrage fuse, countdown and red pulse (R6 F3): PASS.**
  - Fuse at 62 s, "ENRAGE 58S" at 122 s, red "ENRAGE 14S" plus boss flash at 166 s.
  - Own alert, no RETREAT banner, not counted as a wipe (`stats.wipes` unchanged), wounds kept (`bossWounds {40: 0.964}`).
  - Caveat: name clipping (F7).
- **Reassemble bone pile (R6 F4): PASS.**
  - "THE BONE KING REASSEMBLES!" on the black alert plate at +400 ms.
  - The sprite is a low pile rising and the bar refills to 25%. Seen at 1x on my first fight without trying.
- **Wind-up flashes: PASS.** The Warlord tints red on alternate frames during the War Charge wind-up (`windup` 0.56). There is also the enrage flash.
- **Banner dimming (R6 F7): PASS.** Floaters drop to 35% under "A NEW GENERATION RISES" and "GOBLIN WARLORD". The band is still 0.4 black.
- **Re-delve wording (R6 F8): FAIL.**
  - The text is right: "RE-DELVE? A fresh run with new relics. Beat your best: 12m 41s.", and the +6 banner adds "BEAT …".
  - But the dialog has no buttons and softlocks (F1), and "·" renders as "?" (F8).
- **No false Stuck hint (R6 F5): PASS.**
  - After DEMO COMPLETE, I sampled every second for 10 game-min at 20x (floors loop 37–39): `#hud-farm` was hidden in all 25 samples.
  - The real wall hint "STUCK? ♛ RETIRE: +30 RENOWN" appeared correctly after the F40 enrage. Clicking it opened Legacy at the retire box.
- **Omen pill width and tooltip (R6 F6): PASS.**
  - 98 px alone and 98 px with the wall hint showing (`#hud-farm` 283 px).
  - `display: table`, `pointer-events: auto`, and title "Gold x2, but monsters have +40% HP.".
  - New problem: it covers alerts and the boss (F6).
- **The six moves at S/M/L:**

  | Move | Readable? | Notes |
  |---|---|---|
  | Royal Summons | yes | but on top of the intro banner (F4) |
  | Reassemble | yes | |
  | Web Shot | weak | tiny web, tear never seen (F5) |
  | War Charge | yes at S/M | shove visible, every ~10 s; covered by banner/pill at L |
  | Magma Shell / SHELL CRACKED! | yes | dark shelled sprite is low-contrast |
  | Lava Rain | marks yes | orange ground rings under 3 heroes; no falling blob is drawn (no `lava` case in render.js), just a burst on landing |

- **Console:** the only new game error is the F1 TypeError. The shop2 ReferenceError and 3 CSP "inline event handler" lines are in the pane's persisted log from before this session. `grep` finds no `on…=` attributes in `js/` or `index.html`.

## Ideas (optional, max 3)
1. **"Type to counter" glow.** While a shell or web is up, the spark box and the next hero's ult bar glow cyan, and a small "⌨ TYPE!" chip sits over the party. It's the one moment where the core fantasy ("your work is their adventure") can become a reaction: the player types a sentence, and the shell cracks.
2. **Camp as a visible camp.** During a regroup, draw a tiny campfire sprite behind the party and show "Regrouping · +3 lv". Retreats become a cozy beat instead of a mystery, which suits a desktop companion.
3. **Victory hold at F40.** Still open from R5: freeze the strip on the Warlord's death for 0.6 s with gold rain, and keep F40 behind the DEMO COMPLETE card. Right now the card opens over F39/F38 with "87.1K!" crits behind it.
