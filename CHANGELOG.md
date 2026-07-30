# Simple Cubik Changelog

All notable changes to this project.

## v2.8 — Modular API + Bundler (Jul 30 2026)

- Created `tools/bundle.js` — concatenates all modules into one distributable file
- Created `dist/simple-cubik.js` — single-file bundle (62 KB)
- Added `SimpleCubik` public API class:
  - `new SimpleCubik('#el', opts)` — create cube in any container
  - `.doMove(moves)`, `.mix(n)`, `.reset()` — control
  - `.getState()`, `.setState(arr)`, `.getColor(face, row, col)` — read/write colors
  - `.on('move'|'solve', fn)` — event listeners
  - `.destroy()` — clean up
- Added domain lock (synthex.my, cubikbuddy.com, localhost)
- Created example page at `dist/index.html`
- All existing v2.7 fixes preserved

## v2.7 — App.js Cache Fix (Jul 30 2026)

- Fixed app.js cache buster (v=3112 → v=500) — 2D S/E mapping was serving stale code
- Without this, browser loaded old MID_ROW_SLICE where F face → 'E' instead of 'S'

## v2.6 — Debug Cleanup (Jul 30 2026)

- Removed S/M/E test buttons from UI
- Debug overlay now off by default (toggled via 🐛 button)
- Removed `el.style.display = "block"` from swipe handler

## v2.5 — Code Cleanup (Jul 30 2026)

- **cube.js function rename** — fixed backwards function names:
  - `turnECW()` → `turnSCW()` (was named E but actually moved S stickers)
  - `turnSCW()` → `turnECW()` (was named S but actually moved E stickers)
  - Same for CCW variants
  - `doMove('S')` now calls `turnSCW()`, `doMove('E')` calls `turnECW()`
- **edgeAdjacency** — fixed all mid- slice labels in turn-animator.js (dead code but confusing)
- **app.js MID_ROW_SLICE** — updated comments to match v2.4 labels
- **cube.js comment** — removed the confusing "function name quirk" comment

## v2.4 — Label Swap Fix (Jul 30 2026)

**Root cause of S/E misalignment found and fixed.**

The original AXIS_MAP had S and E layers swapped:
- `'S': layerComp 'z'` → rotated vertical layer (z=0 cubies)
- `'E': layerComp 'y'` → rotated horizontal row (y=0 cubies)

But S ring stickers (F3,F4,F5,R3,R4,R5,B3,B4,B5,L3,L4,L5) are on **y=0** cubies.
E ring stickers (L1,L4,L7,D3,D4,D5,R7,R4,R1,U5,U4,U3) are on **z=0** cubies.

**Fix:** Swapped the KEY NAMES `S`↔`E` in AXIS_MAP and FACE_SIGN:
- `'E': layerComp 'z', axis (0,0,1)` ← was old S entry
- `'S': layerComp 'y', axis (0,-1,0)` ← was old E entry
- FACE_SIGN: `'E': 1, 'S': 1` (E direction flipped from -1 to 1)

Key insight: S rotation around -Y axis preserves y coords → no layer drift.
E rotation around Z axis preserves z coords → no layer drift.

## v2.3 — Remove S/E Swap (Jul 30 2026)

- Removed the S/E swap hack from ring-system.js
- Added on-screen debug overlay (swipe shows ring/turn/direction)
- Added 6 test buttons (S+/S-/M+/M-/E+/E-)

**Previous band-aid removed:**
```javascript
// This was in ring-system.js — now deleted
var turnName = ringName === 'S' ? 'E' : ringName === 'E' ? 'S' : ringName;
```

## v2.2 — S/M/E Animation (Jul 29-30 2026)

- Added quaternion animation for S/M/E slice moves
- Moved S/M/E from `SLICE_AXIS` (rebuild-only) into `AXIS_MAP` (animation path)
- Had compensating S/E swap in ring-system.js (removed in v2.3)

## v2.1 — Rotation Engine (Jul 29 2026)

- Clark-style quaternion rotation engine (no rebuild after turns)
- Sticker identity tracking via `updateStickerUserData()`
- World-space direction fix for sticker IDs
- isExternal filtering for raycaster
- S/M/E in SLICE_AXIS (rebuild-only, no animation)

## v2.0 — Initial Rotation Engine (Jul 28 2026)

- Quaternion rotation for face turns (U/D/F/B/L/R)
- Two-mesh sticker approach (dark border + colored face)
- Orbit controller, gesture handler
- S/M/E still used old state-array rebuild approach
