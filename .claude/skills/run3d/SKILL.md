---
name: run3d
description: Extends the `run` skill for testing refined-prun's 3D Game Mode (`src/game-3d/` — the walkable bridge/operations-center spike/expansion). Covers the pointer-lock-broken-under-CDP limitation, the test-only camera bypass, and 3D-specific gotchas (perf/FPS caveats, iframe-in-CSS3D quirks, canvas click-interception). Triggers on "test 3d mode", "verify game-3d", "test the bridge/consoles", "check the hologram/hangar". Requires the `run` skill's harness already set up (build, launch, generic pw-act actions) — read that skill first if you haven't; this one only covers what's different for 3D. Do NOT load this for ordinary 2D feature testing — that's `run`'s job alone.
---

# Run3D: Testing refined-prun's 3D Game Mode

Extends `.claude/skills/run/SKILL.md` — read that first for the base harness (build,
launch, generic `pw-act` actions, sandbox rules, cleanup). This skill only covers what's
different when testing `src/game-3d/` specifically, kept in its own file so a normal
2D-feature testing session never has to load 3D-only content.

See `docs/game-3d-plan.md` for what's actually being built/tested right now (phase
status, known-open issues) — this skill is pure testing mechanics, not feature status.

## The one thing that changes everything: pointer lock is broken here

`requestPointerLock()` fails under this CDP-driven harness with `WrongDocumentError`,
even after `page.bringToFront()`. Confirmed root cause: `connectOverCDP` + synthetic
`page.mouse.click()`/`page.keyboard.press()` doesn't give the Chromium window real
OS-level foreground focus under WSLg — `document.hasFocus()` is a Blink-level concept
and reports `true` anyway, but Pointer Lock's stricter check needs real OS focus.

Since `game-3d`'s WASD movement and camera turning both gate on
`PointerLockControls.isLocked`, **no camera movement works through a real
click-to-lock flow in this harness** — content on any wall other than the one facing
spawn (side/rear panels, a hangar, any future console) can't be reached by clicking to
lock and using WASD. Every 3D verification must use the test-only bypass below instead.

## Test-only bypass

`src/game-3d/test-controls.ts` exposes `window.__rpGame3DTest.{rotate,move}` while a
`Game3D` instance is alive (attached in `start()`, detached in `dispose()`), bypassing
pointer lock entirely by calling `PointerLockControls` methods directly (those work
regardless of `isLocked`; only `game-3d`'s own `movement.ts` gate needed pointer lock,
not three.js itself):

```
node scripts/pw-act.mjs game3d-test-rotate <yawDeg> <pitchDeg>
                                             # rotates the camera directly. Requires 3D
                                             # mode already open — errors clearly if
                                             # window.__rpGame3DTest isn't found instead
                                             # of silently no-oping.
node scripts/pw-act.mjs game3d-test-move <forward> <right>
                                             # moves the camera, same bypass.
node scripts/pw-act.mjs webgl-renderer-info  # reports GPU vendor/renderer string, no
                                             # arguments. Run this before trusting any
                                             # FPS number out of this harness — see
                                             # gotcha #4 below.
node scripts/pw-act.mjs fps-check [seconds]  # measures actual frame rate via
                                             # requestAnimationFrame counting over N
                                             # seconds (default 2).
```

**What this bypass can and can't prove:** it proves geometry/position/rendering — it
does NOT exercise any `game-3d` code layered on top that gates on `controls.isLocked`
(e.g. `movement.ts`'s WASD acceleration/deceleration smoothing, or any future
Expansion-track interaction logic gated the same way). Report that class of change as
compiles-clean-but-unverified, needing a human with a real mouse, rather than trying to
force it through the bypass.

## Entering/exiting 3D mode in tests

- Open via the top-bar "3D" button.
- Exit via the overlay's "EXIT 3D" button.
- **Don't rely on the Ctrl+Alt+3 hotkey for either, in automated tests** — see gotcha
  #1 below.

## Gotchas learned the hard way

1. **Global hotkeys (Ctrl+Alt+3) sent via `press` can silently fail to fire** if focus
   is on an open buffer's command input — the input appears to capture the keydown
   before it reaches the `document`-level listener. Use the on-screen button
   equivalent (top-bar "3D" button / overlay "EXIT 3D" button) instead.

2. **A fullscreen `<canvas>` (the WebGL/CSS3D overlay) intercepts real
   mouse-coordinate clicks across its ENTIRE viewport, even fully transparent/unpainted
   regions.** `document.elementFromPoint()` at a spot that visually shows something
   else "behind" the canvas (a 2D floating window, say) still returns the canvas, not
   that element — coordinate-based clicks aimed there hit the canvas instead. Dispatch
   events/`.click()` directly on the target element rather than clicking by viewport
   coordinates when testing anything layered with or behind the fullscreen canvas.

3. **A screenshot showing "nothing there" in a sparse 3D scene is not proof the content
   failed to render** — it's equally consistent with a viewing-angle or scale
   artifact. This happened for real: a run concluded `hangar.ts`'s ship placeholders
   were missing/broken after checking several angles, but a direct follow-up (steep
   downward pitch, close to the wall) found them rendering correctly — they were just
   sitting very low and easy to miss (since fixed with `HANGAR_DISPLAY_HEIGHT` — see
   `docs/game-3d-plan.md`). Before concluding a 3D element isn't rendering, try a
   steep-angle/close-distance pass first, or check its actual world position/scale
   against the camera's rather than trusting one "reasonable angle" screenshot.

   **Related, for iframes specifically:** a blank/unpainted iframe inside a CSS3D
   panel doesn't mean it failed to load — check the DOM directly to distinguish "never
   loaded" from "loaded but not painted." E.g. `CALC.vue` renders a `LoadingSpinner` as
   a sibling of the iframe (`v-if="loading"`, not `v-else`) that only disappears once
   the iframe's `@load` fires; if that sibling is gone from the DOM but the panel still
   looks blank, the load succeeded and the real issue is downstream (rendering/paint,
   not network/CSP). This is a known, low-priority, deliberately-not-chased-further
   issue for the CALC panel specifically (see `docs/game-3d-plan.md`'s Spike
   summary) — only two minor features in the whole extension use iframes at all, don't
   over-invest here without a specific reason to revisit.

4. **This harness's browser has no real GPU — WebGL runs on `SwiftShader`, a software
   rasterizer.** Confirmed via `webgl-renderer-info`:
   `ANGLE (Google, Vulkan (SwiftShader Device...), SwiftShader driver)`.
   Software-rendering a WebGL+CSS3D scene is expected to be 10-50x slower than real GPU
   hardware, so any FPS number measured here (`fps-check`) is not a trustworthy signal
   of real-world performance on its own — this is specific to this local
   Playwright/WSL2 setup, not something that extends to real users' normal desktop
   browsers (they get standard hardware-accelerated WebGL). Always run
   `webgl-renderer-info` alongside any `fps-check` and report both together; a low FPS
   number without a renderer check is not enough to diagnose a real perf regression,
   and don't start optimizing product code off an `fps-check` number alone.

## Files

Same shared scripts as `run` (`pw-helper.mjs`, `local-browser-test.mjs`, `pw-close.mjs`,
`pw-kill.mjs`, `pw-act.mjs`) — this skill doesn't introduce new test infrastructure
files, just documents the game-3d-specific `pw-act.mjs` actions and gotchas above. Also
relevant:

- `src/game-3d/test-controls.ts` — the `window.__rpGame3DTest` pointer-lock bypass.
- `docs/game-3d-plan.md` — phase tracker; read before any 3D verification task to know
  what's actually being tested and what's already known-broken/deferred.
