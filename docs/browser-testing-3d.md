# Browser Testing — 3D Game Mode

Extends `docs/browser-testing.md` for `src/game-3d/` (the walkable bridge/
operations-center spike/expansion) specifically. Read that doc first — the harness
setup, the build/launch/drive loop, and the `pw-act.mjs` action list all apply here
unchanged. This doc only covers what's different for 3D, kept separate so an ordinary
2D-feature verification never has to load it.

See `docs/game-3d-plan.md` for what's actually being built/tested right now (phase
status, known-open issues) — this doc is pure testing mechanics, not feature status.

## Visual-iteration sandbox (no login, no extension, no real data)

For a pure materials/lighting/geometry/camera-framing change, the full `run3d` loop
(rebuild → reload-extension → log back into a real, logged-in game tab) is slow and adds
nothing — none of that machinery touches how a wall texture or a bloom setting looks.
`src/game-3d/sandbox/` is a second, much cheaper way in: a standalone Vite dev server
that boots a real `Game3D` scene with fixture data instead of the live `prun-api`
stores, so there's no extension build, no browser profile, no PU login, and no
WebSocket in the loop.

```
pnpm run dev:3d-sandbox                              # Vite dev server on :5183, HMR
node scripts/pw-sandbox-screenshot.mjs overview out.png    # room overview
node scripts/pw-sandbox-screenshot.mjs console out.png     # console close-up (baseplanning)
node scripts/pw-sandbox-screenshot.mjs hologram out.png    # hologram detail
```

Open `http://localhost:5183/?cam=<preset>` directly in a browser for interactive
poking, or use the on-page preset buttons (top-left) to switch cameras without typing a
URL. `pw-sandbox-screenshot.mjs` is deliberately not `pw-act.mjs`: there's no login
session to preserve, so it launches and closes its own throwaway headless browser per
call instead of attaching over CDP to a persistent profile. That on-page preset bar
(`#sandbox-preset-bar` in `sandbox/main.ts`) is dev-only scaffolding, not part of any
reviewed piece — `pw-sandbox-screenshot.mjs` removes it via `page.evaluate` before
every screenshot; if you add new dev-only on-page UI to the sandbox, exclude it the
same way or it will bleed into a critic round (see "Gotchas" below).

The sandbox boots a real `Game3D` instance, so `overlay.ts`'s HUD (mode banner, corner
brackets, EXIT button, etc.) is present in every screenshot by default, no extra wiring
needed to review it. It always starts in "interact" mode, though — the screenshot tool
launches a fresh throwaway page per call with no click-to-lock or test-controls
interaction, so walk/focused mode HUD states and the mode-transition animation are not
currently reachable through it. Extending it to call
`window.__rpGame3DTest`/force a mode change would be needed to screenshot those.

**When to use which:**

| | Sandbox (`dev:3d-sandbox`) | `run3d` (real game) |
| --- | --- | --- |
| Materials, lighting, bloom, geometry, camera framing | ✅ fast, HMR | works, but rebuild+reload for every tweak |
| Console panel layout/positioning against the room | ✅ | ✅ |
| Click-hit-testing, control-surface capture, real XIT panel correctness | ❌ out of scope (see below) | ✅ required |
| Anything depending on real ship/site/contract data shapes or values | ❌ | ✅ required |
| Periodic integration checkpoint before/after a batch of sandbox-only changes | — | ✅ |

Treat the sandbox as the fast inner loop for pure-visual work and `run3d` as the
periodic integration checkpoint that confirms the same change still holds up against
real XIT panels and real data — not a replacement for it.

**What's real vs. fixture:**

- The scene, room, consoles, hologram geometry, and rendering pipeline are the exact
  same `Game3D` code the extension uses (`src/game-3d/sandbox/main.ts` passes an
  optional `cameraPose` into `Game3D`'s constructor for the presets; everything else is
  unmodified).
- Console screens mount the real XIT Vue components (`INV.vue`, `BS.vue`, etc.) via the
  real `xit.get(command)` registry — `src/game-3d/sandbox/xit-bootstrap.ts` eagerly
  imports `src/features/XIT/**` only (deliberately not `basic/`/`advanced/`, which
  assume a live 2D page DOM; none of the console roster's commands live there).
- `src/game-3d/sandbox/fixtures.ts` dispatches API messages into the real `prun-api`
  entity stores (`SHIP_SHIPS`, `SITE_SITES`, `COMPANY_DATA`, etc.) — the same
  `dispatch()` real socket traffic uses. This isn't optional cosmetic polish: the real
  app never mounts any UI until `initializeApi()` awaits every store's `fetched` flag,
  so without it several panels crash outright (not just render empty) the instant they
  read an `undefined` store — e.g. `CONTS.vue` calling `.filter()` on it. Most stores get
  a deliberately empty array — "loading/empty" panels are fine, data accuracy isn't the
  goal — except one small system (one site, three stars) that feeds BS/PROD a real row
  and gives `buildHologram()` a region to draw; some computeds also needed a few
  non-empty fields to stop throwing outright (see the comments in `fixtures.ts`, e.g.
  `COMPANY_DATA.headquarters`/`representation` for FIN's balance sheet).
- Nothing here can affect the real extension build: `vite.config.sandbox.mts` is a
  fully separate Vite config (different entry, different `root`, not `build.lib`), and
  `pnpm run build`/`build:fast` never reference it.

## The one thing that changes everything: pointer lock is broken here

`requestPointerLock()` fails under a CDP-driven harness with `WrongDocumentError`, even
after bringing the page to front. Root cause: attaching over CDP and driving synthetic
mouse/keyboard input doesn't give the browser window real OS-level foreground focus
under WSLg — `document.hasFocus()` is a Blink-level concept and reports `true` anyway,
but Pointer Lock's stricter check needs real OS focus.

Since `game-3d`'s WASD movement and camera turning both gate on
`PointerLockControls.isLocked`, **no camera movement works through a real
click-to-lock flow under this harness** — content on any wall other than the one facing
spawn (side/rear panels, a hangar, any console) can't be reached by clicking to lock and
using WASD. Every 3D verification must use the test-only bypass below instead.

## Test-only bypass

`src/game-3d/test-controls.ts` exposes `window.__rpGame3DTest.{rotate,move}` while a
`Game3D` instance is alive (attached in `start()`, detached in `dispose()`), bypassing
pointer lock entirely by calling `PointerLockControls` methods directly (those work
regardless of `isLocked`; only `game-3d`'s own `movement.ts` gate needs pointer lock,
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
                                             # arguments. Run before trusting any FPS
                                             # number out of this harness — see below.
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

**`game3d-test-move` doesn't run through `movement.ts`'s `clampToRoom`** — real WASD
movement stays clamped inside the room, but this bypass calls `PointerLockControls`
directly, so pushing it too far in one call clips the camera straight through
wall/floor geometry into a dark, textured-up-close near-clip view. Not a product bug;
move in small increments (~2-3 world units at a time) and back off if the frame goes
uniformly dark.

**Both bypass actions are relative-only — there's no absolute teleport.** Reaching a
specific console from spawn (e.g. `baseplanning` on the arc) takes repeated small
`rotate`/`move` calls with visual checking in between, which cost real iterations during
Expansion Phase 7 verification. If a future session finds itself testing one console
repeatedly, adding an absolute-position/rotation test action (set camera position/yaw
directly, bypassing incremental movement entirely) would be worth the small effort.

## Entering/exiting 3D mode in tests

- Open via the top-bar "3D" button.
- Exit via the overlay's "EXIT 3D" button.
- **Don't rely on the Ctrl+Alt+3 hotkey for either, in automated tests** — see the first
  gotcha below.

## Gotchas learned the hard way

- **A blind AAA-visual critic reviewing a sandbox screenshot cannot tell your scene's
  own content from unrelated things sharing the frame — always audit what else is
  physically in shot before trusting a verdict.** Bit three times across two redesign
  passes: (1) an `overview` camera preset sat almost exactly inside the hologram's
  effect volume, so several rounds of "room shell" critic verdicts were actually
  complaining about the hologram's own glow/motes, misattributed as room-lighting bugs;
  (2) the sandbox's own dev-only camera-preset button bar (plain HTML `<button>`s,
  top-left) bled into a HUD-overlay critic round, which flagged it as "feels like debug
  UI" — real feedback, but about the wrong piece entirely; (3) worst case yet — no
  camera preset ever looked down -Z at the viewscreen window at all, so an entire
  piece's first critic round judged a wall bay it had nothing to do with, and the
  verdict was wrong from top to bottom. Before adding a *new* preset to review a piece,
  don't just trust that its `lookAt` framing shows the intended subject — verify it (a
  screenshot, or read the math) before spending a critic round on it. When briefing a
  critic on any piece, explicitly check whether the current camera framing includes any
  *other* piece's geometry or any dev-only scaffolding UI, and either avoid framing it
  in, exclude it (see `#sandbox-preset-bar` above), or tell the critic explicitly what's
  in-frame-but-out-of-scope so it doesn't get credited or blamed for something it isn't.

- **When an unexplained visual artifact appears and its cause is uncertain, test
  whether it moves with a dramatic camera-pitch change before writing a bugfix brief
  for it.** A stray tan shape bleeding in from the top of a `viewscreen`-preset
  screenshot was chased for a while as a suspected rendering/occlusion bug in
  `viewscreen.ts` (plausible-sounding theories: an oversized backdrop sphere, a
  depth-buffer precision issue at extreme distance) before being disproven: pitching the
  camera dramatically downward made the shape shrink almost to nothing, while a tiny
  pitch change earlier had barely moved it (a false negative — too small a test to be
  conclusive). The steep-pitch test proved it was ordinary 3D geometry belonging to a
  *different* piece (the room's own atrium ceiling, in frame because the new preset's
  default pitch happened to graze it), not a `viewscreen.ts` bug at all. Screen-space/
  DOM artifacts don't move with camera pitch; ordinary 3D geometry does — a large,
  deliberate pitch swing (not a token 0.5-unit nudge) is a cheap, conclusive way to tell
  them apart before spending a builder round chasing the wrong file.

- **Camera far clip plane is 300 world units** (`Game3D.ts`'s
  `new THREE.PerspectiveCamera(75, 1, 0.1, 300)`). Anything placed farther than that
  from the camera is silently culled — no error, no warning, it just never renders.
  This bit the viewscreen diorama twice: the planet and (still unfixed) the sun sprite
  were both placed beyond 300 world units from spawn and were therefore invisible in
  the actual game, not just "hard to see" — confirmed by testing that no amount of
  camera-angle change makes a beyond-far-plane object appear. When placing any distant
  dressing object (`viewscreen.ts` or similar), compute its total world distance from
  spawn/room-center — remember the viewscreen group itself is already offset to world
  `z=-55` (`Game3D.ts`), so a local Z of `-250` is actually `-305` world, already past
  the limit — and leave real margin under 300, not right up against it.

- **For a piece that must read at both close range and room-scale distance (e.g. a
  hologram centerpiece), fine geometric detail that looks great close-up can be
  genuinely invisible at distance — that's a scale problem, not a brightness problem,
  and cranking bloom/emissive intensity won't fix it.** What actually worked after two
  rounds of incremental hierarchy/detail additions failed to fix a "reads as a small
  smudge from across the room" critic complaint: one bold pass that replaced thin
  `THREE.Line` geometry with solid `TubeGeometry`, substantially grew the overall
  footprint, and added a large-area core/shell and a vertical light-column silhouette —
  large-area, thick, high-contrast shapes that survive being shrunk to a small portion
  of the frame. Prefer this over another round of small added detail if a "distance
  read" complaint survives one iteration.

- **A tab that already had 3D mode loaded can keep running a stale module after a
  rebuild, even though `dist/` on disk is current.** Confirmed for real: a geometry/
  placement fix (moving the viewscreen wall) showed the OLD behavior on first check
  after `build:fast`, despite `dist/` grepping clean for the fix — a plain
  `reload-extension` (which also refreshes the game tab, per the base doc) made it show
  correctly. If a fix that changes static geometry/placement doesn't appear to have
  taken effect, `reload-extension` before concluding the fix is broken — this applies
  even when nothing about the extension's own load sequence changed, just re-entering
  3D mode is not enough to pick up a new build in an already-open tab.

- **Global hotkeys (Ctrl+Alt+3) sent via a synthetic keypress can silently fail to fire**
  if focus is on an open buffer's command input — the input appears to capture the
  keydown before it reaches the `document`-level listener. Use the on-screen button
  equivalent (top-bar "3D" button / overlay "EXIT 3D" button) instead.

- **A fullscreen `<canvas>` (the WebGL/CSS3D overlay) intercepts real
  mouse-coordinate clicks across its ENTIRE viewport, even fully transparent/unpainted
  regions.** `document.elementFromPoint()` at a spot that visually shows something else
  "behind" the canvas (a 2D floating window, say) still returns the canvas, not that
  element — coordinate-based clicks aimed there hit the canvas instead. Dispatch
  events/`.click()` directly on the target element rather than clicking by viewport
  coordinates when testing anything layered with or behind the fullscreen canvas.

- **A screenshot showing "nothing there" in a sparse 3D scene is not proof the content
  failed to render** — it's equally consistent with a viewing-angle or scale artifact.
  This happened for real: a run concluded `hangar.ts`'s ship placeholders were
  missing/broken after checking several angles, but a direct follow-up (steep downward
  pitch, close to the wall) found them rendering correctly — they were just sitting
  very low and easy to miss (since fixed with `HANGAR_DISPLAY_HEIGHT` — see
  `docs/game-3d-plan.md`). Before concluding a 3D element isn't rendering, try a
  steep-angle/close-distance pass first, or check its actual world position/scale
  against the camera's rather than trusting one "reasonable angle" screenshot.

  **Related, for iframes specifically:** a blank/unpainted iframe inside a CSS3D panel
  doesn't mean it failed to load — check the DOM directly to distinguish "never loaded"
  from "loaded but not painted." E.g. `CALC.vue` renders a `LoadingSpinner` as a sibling
  of the iframe (`v-if="loading"`, not `v-else`) that only disappears once the iframe's
  `@load` fires; if that sibling is gone from the DOM but the panel still looks blank,
  the load succeeded and the real issue is downstream (rendering/paint, not
  network/CSP). This is a known, low-priority, deliberately-not-chased-further issue
  for the CALC panel specifically (see `docs/game-3d-plan.md`'s Spike summary) — only
  two minor features in the whole extension use iframes at all, don't over-invest here
  without a specific reason to revisit.

- **`getBoundingClientRect()` on a CSS3D panel div returns coordinates that don't match
  where it actually paints.** Confirmed by outlining a panel and comparing the reported
  rect against a pixel-measured bounding box from a screenshot — they disagreed on both
  size and position (e.g. one panel: rect said `(50,86)-(195,313)`, actual paint was
  `(70,206)-(200,432)`). Root cause is presumed to be a `transform-style: preserve-3d`
  flattening quirk in how Chromium computes layout-geometry APIs for `CSS3DRenderer`'s
  nested `matrix3d`+`perspective()` transforms — the compositor paints correctly, the
  geometry query just doesn't match it. **To check whether two panels overlap, measure
  actual painted pixels from a screenshot (e.g. decode the PNG and find each panel's
  distinct border/background color), not `getBoundingClientRect`.** Also: toggling
  `display: none` on a panel to isolate it in a screenshot doesn't work either —
  `CSS3DRenderer`'s render loop re-syncs the element's visibility every frame and
  silently reverts the mutation.

- **Console housing accent colors (blue/green/purple/orange, one per console) are hard
  to reliably tell apart from a screenshot under the scene's dark ambient lighting.** A
  verification pass misidentified `companyops` (purple) as `inv` (blue) by desk color
  alone before catching it by checking on-screen content instead (FIN's bar chart vs.
  INV's item grid). When identifying which console a screenshot shows, check the
  screen's actual content, not the housing/accent-light color.

- **`pw-sandbox-screenshot.mjs`'s browser defaults to `SwiftShader`, a software
  rasterizer, not because the machine lacks a GPU but because the sandboxed/excluded
  Bash path that normally runs it can't see one.** An earlier version of this note
  claimed "this harness's browser has no real GPU" as a blanket fact — **wrong,
  corrected after re-testing**: the underlying machine can have a real GPU
  (`nvidia-smi -L` confirmed one), but WSL2's GPU passthrough device (`/dev/dxg`) sits
  behind a mount namespace that sandboxed and `excludedCommands` calls alike can't see,
  so software rendering was the only thing that reliably worked when the script was
  written. The script now auto-detects `/dev/dxg` and uses real GPU when it's visible
  (only true for a caller-side unsandboxed launch, e.g. Claude Code's
  `dangerouslyDisableSandbox: true`), falling back to SwiftShader automatically on
  failure — GPU mode measured ~2.7x faster against a heavy scene but has also been
  observed to hang navigation outright (unresolved, presumed WSL2 GPU-device
  contention), hence the automatic fallback rather than making it the unconditional
  default. Software-rendering a WebGL+CSS3D scene is still expected to be 10-50x slower
  than real GPU hardware when SwiftShader is what actually ran, so any FPS number
  measured here (`fps-check`) is still not a trustworthy signal of real-world
  performance on its own — this is specific to this local Playwright/WSL2 setup, not
  something that extends to real users' normal desktop browsers (they get standard
  hardware-accelerated WebGL) regardless of which path this script took. Always run
  `webgl-renderer-info` alongside any `fps-check` and report both together (including
  which rendering path was active); a low FPS number without a renderer check is not
  enough to diagnose a real perf regression, and don't start optimizing product code off
  an `fps-check` number alone.

- **A `dev:3d-sandbox` instance reused across dozens of rapid-fire
  `pw-sandbox-screenshot.mjs` calls in one long session degrades** — heavier-scene
  presets (`hologram`, `pit`) started timing out on `page.goto` first while lighter ones
  (`console`, `overview`) kept working, confirmed to clear immediately on a fresh
  restart and then recur (on different presets) once enough requests piled up again.
  Not root-caused further (likely Vite/Node resource accumulation across many
  transform requests, or many launch/teardown cycles of headless Chromium against the
  same dev server). Restart `dev:3d-sandbox` between heavy screenshot rounds rather than
  reusing one instance for a whole long session — check whether one's already running
  first (`curl` the port) rather than assuming, but don't hesitate to cycle it once
  presets start timing out that worked minutes earlier.

  **Before concluding a specific preset/content is genuinely broken (not just this
  degradation), retest 2-3x on a freshly restarted, idle server.** One preset was
  logged as "reliably hangs" after a builder round added new geometry — three identical
  calls, `page.goto` timeout every time, both GPU and SwiftShader — and the conclusion
  looked solid (a specific preset, deterministic failure). It was wrong: the three
  failures immediately followed a hard Vite-cache clear plus a botched restart that
  raced a port conflict, then three rapid identical calls into that unstable window. A
  clean restart afterward rendered the same preset correctly 3/3 tries with no code
  change at all. A `curl` of the raw URL (bypassing the browser) returning instantly is
  a fast way to confirm the dev server itself isn't the bottleneck before suspecting the
  scene content.

- **The on-screen mode banner ("Interact mode" / walk / focused) is not a reliable
  signal for whether a click actually caused a relock in this harness.** It's driven
  entirely by `PointerLockControls`'s `lock`/`unlock` events, which only fire on a
  *successful* browser pointer lock — and pointer lock always fails here (see above),
  so `controls.lock()` can be called and silently do nothing while the banner stays
  unchanged either way. Screenshot-only verification of "did this click cause a relock"
  is not discriminating. Instead, patch `canvas.requestPointerLock` (via an injected
  script) to count real invocations, and add a capture-phase `document` click listener
  to observe which element (if any) received a synthetic `.click()`. This combination
  gave a reliable, non-visual signal when verifying the CSS3D click-hit-testing fix (see
  `docs/game-3d-plan.md`) and should be reused for any future click/relock verification.

## Files

Same shared scripts as the base manual (`pw-helper.mjs`, `local-browser-test.mjs`,
`pw-close.mjs`, `pw-kill.mjs`, `pw-act.mjs`) — this doc doesn't introduce new test
infrastructure, just documents the game-3d-specific `pw-act.mjs` actions and gotchas
above. Also relevant:

- `src/game-3d/test-controls.ts` — the `window.__rpGame3DTest` pointer-lock bypass.
- `docs/game-3d-plan.md` — phase tracker; read before any 3D verification task to know
  what's actually being tested and what's already known-broken/deferred.
