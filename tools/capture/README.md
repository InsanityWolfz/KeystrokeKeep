# Capture mode (store screenshots, GIFs, trailer)

The desktop build with fixed 60 fps, seeded randomness, full juice, no tutorial or achievement toasts, and hotkeys. It uses its own profile and save (`<userData>-capture`), so it never touches a real save. The input hook stays on, so real typing drives the typing shots.

```
npm run capture:save -- --floor 19 --levels 40,35,30,20 --relics 3 --out tools/capture/f19_party.json
set KK_CAPTURE=1 && set KK_CAPTURE_SAVE=tools/capture/f19_party.json && set KK_CAPTURE_SCRIPT=tools/capture/flow-meteor.json && npx electron .
```

## Environment flags

| Flag | Default | Meaning |
|---|---|---|
| `KK_CAPTURE=1` | off | Turns capture mode on. |
| `KK_CAPTURE_SAVE` | none | Staged save, copied into the capture profile at boot. |
| `KK_CAPTURE_SCRIPT` | none | Cue script; see below. |
| `KK_CAPTURE_SEED` | 1 | Seeds `Math.random`, so takes repeat. |
| `KK_CAPTURE_SIZE` | L | Strip size: S, M or L. |
| `KK_CAPTURE_FPS` | 60 | Fixed frame rate. |
| `KK_CAPTURE_JUICE` | full | `full` (trailer) or `companion` (the calm desktop mix). |
| `KK_CAPTURE_AUDIO` | sfx | `sfx`, `music`, `both` or `off`. |
| `KK_CAPTURE_TOASTS=1` | off | Allow normal toasts. |
| `KK_CAPTURE_BG` | transparent | Opaque background colour, e.g. `#00ff00` for chroma key. |
| `KK_LOWGPU=1` | off | Force low-GPU mode. Capture mode defaults it to off. |

Fullscreen auto-hide is off in capture mode, so OBS and editors don't hide the strip.

## Hotkeys

All are Ctrl+Shift+Alt plus a digit.

| Digit | Action |
|---|---|
| 1 | Simulated typing on/off |
| 2 | Warp: cycles 1x, 5x, 20x |
| 3 | Fill Sparks |
| 4 | +5 floors |
| 5 | Jump to the floor before the next boss |
| 6 | Golden rat |
| 7 | FLOW STATE |
| 8 | Freeze or unfreeze |
| 9 | Cycle panels: none, Party, Relics, Legacy |
| 0 | Replay the cue script |

## Cue script

```json
{ "seed": 7, "cues": [ { "t": 0, "do": "warp", "v": 20 }, { "t": 2, "do": "mark", "v": "CUT" } ] }
```

Available cues:

| Cue | Value |
|---|---|
| `warp` | Warp multiplier |
| `floor` | Floor to jump to |
| `sparks` | Number, or `full` |
| `autotype` | `true` or `false` |
| `flow` | none |
| `rat` | none |
| `relicOffer` | none |
| `openPanel` | `party`, `relics`, `legacy`, `settings`, or empty to close |
| `pickRelic` | Index |
| `retire` | none |
| `omen` | Omen id |
| `size` | S, M or L |
| `juice` | `full` or `companion` |
| `pause` | none |
| `toast` | Text |
| `js` | Renderer JS, for unusual setups |
| `mark` | Label; prints a timestamped `[capture] MARK` line for the editor |

The shot list (S1–S8, G1–G5, trailer beats) is in `docs/playtest/round-07/market.md`.
