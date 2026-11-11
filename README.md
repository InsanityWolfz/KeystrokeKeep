# Keystroke Keep (prototype v0.1)

*Your work is their adventure.* A tiny pixel dungeon crawler that lives in a strip at the bottom of your screen. Every key you type and every click you make powers your heroes.

## Play it

**Real desktop strip (recommended):** double-click **`Play Keystroke Keep.bat`** (or **`Add Desktop Shortcut.bat`** once, to put a shortcut on your desktop), or run:

```
npm start
```

* It docks as an always-on-top strip above your taskbar and counts your typing and clicks **system-wide**. It only counts them; it never records which keys.
* Click empty space above the strip and the click goes straight through to your other apps.
* **Tray icon (crown):**
  * Pause input counting
  * Hide or show the strip
  * Open dev tools
  * Quit (also under ⚙ Settings → Quit Game)

**Browser version (has dev tools and a fake desktop):**

```
npm run serve
```

Then open http://127.0.0.1:5173.
* There's a fake notepad to type into.
* The dev window has simulated typing, time warp (up to 60x), +gold, +sparks, +5 floors and a golden-rat spawn.

## Build for Steam

```
npm run dist        # full game  -> dist/full/win-unpacked/Keystroke Keep.exe
npm run dist:demo   # demo build -> dist/demo/win-unpacked (demo flag baked in, cap floor 40)
npm run icon        # re-render build/icon.png from the pixel-art crown
```

* Unsigned for now (code signing is on the Next Fest checklist).
* Saves: `%APPDATA%/Keystroke Keep/saves` (demo: `Keystroke Keep Demo`), atomic writes + 3 backups; the full game imports a demo save on first launch.
* Steam depot: upload the `win-unpacked` folder; launch `Keystroke Keep.exe`.

## How it plays

* **Gold (idle):** heroes auto-fight and earn gold whether or not you're active. Spend it in ⚔ Party and ⚒ Forge.
* **Sparks (activity):** 1 per keystroke or click. They auto-fire hero ultimates (Earthshatter, Arrow Storm, Meteor, Sanctuary). They're also spent in the ✦ Spark Workshop, whose upgrades **never reset**.
* **Fervor:** keep typing to climb Idle → Focused → In the Zone → **FLOW STATE** (x2.2 power, a lit-up dungeon, golden auras, drums kick in).
* **Bosses** every 10 floors drop a **relic choice** (17 relics, mostly keyboard-themed).
* **Golden rat** every few minutes: click it for a gold and Spark burst.
* **Retire** at floor 20+ for Renown. Spend it in the Legacy tab on permanent upgrades (Quartermaster auto-levels your heroes).

## Project layout

| Path | What |
|---|---|
| `docs/GDD.md` | Game design doc, Steam plan, roadmap to the Jan 10 Next Fest demo |
| `js/world.js` | Combat/dungeon simulation (DOM-free) |
| `js/state.js` | Save data, formulas, economy, balance knobs (`KK.BAL`) |
| `js/data.js` | Heroes, monsters, biomes, relics, upgrades |
| `js/sprites.js` | All pixel art, authored as text grids and baked at boot |
| `js/render.js` | Low-res buffer renderer: parallax, lighting, effects |
| `js/fx.js` | Juice: particles, damage numbers, shake, banners, coins |
| `js/audio.js` | Procedural WebAudio SFX + adaptive music (no audio files) |
| `js/ui.js` | HUD, panels, relic offers, modals, toasts |
| `electron/` | Desktop shell: docking, click-through, tray, global input hook |
| `tools/sim.js` | Headless balance sim: `node tools/sim.js 120 typist 60` (profiles: `typist`, `idle`, `heavy`) |
| `tools/sprites.html` | Sprite sheet viewer (serve, then open `/tools/sprites.html?s=4`) |

**Balance tuning:**

```
BAL='{"eHpG":1.27}' node tools/sim.js 90 typist
```

## Known gaps / next steps

* Fonts load from Google Fonts. Bundle them locally before shipping (the desktop build falls back to monospace offline).
* Multi-monitor: the strip docks to the primary display only.
* No packaging yet (electron-builder), no Steamworks (steamworks.js), no code signing.
* Saves live in localStorage. Move them to a file and Steam Cloud for the desktop build.
* Bosses reuse scaled-up monster sprites. Commission real boss art (and capsule art!) before Next Fest.
