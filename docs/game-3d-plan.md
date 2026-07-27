# 3D Game Mode — Plan

Living state tracker for `src/game-3d/`. For the technical architecture (dependency
rules, why the import is dynamic, the `features/XIT/` exception, the `tileStatePlugin`
ambient-context wiring) see `docs/architecture.md`'s "3D Game Mode (Spike)" section —
this doc tracks *what exists today and what's left*, not how the seam works.

This doc is deliberately kept short — it's a working-state summary, not a narrated
history. For session-by-session detail on how any given piece got built, see git log on
branch `3d-game-mode-spike` (pushed to origin, no PR opened yet).

## Vision

A fullscreen 3D space-station bridge/operations center, built into refined-prun, that a
player can walk around. A handful of purpose-built consoles (Base Planning, Fleet Ops,
Inventory, etc.) sit arranged around a central hologram showing a region of the star
map — like a bridge crew facing a plot table. Each console shows 2-4 of refined-prun's
buffers as interactive screens, plus a control-surface slot for running action packages.
It's an alternate, opt-in way to inhabit the game's data — not a replacement for the
normal 2D UI, which keeps working exactly as it does today for everyone who doesn't turn
3D mode on.

## Decisions already made — don't relitigate without new evidence

- Lives inside this repo, under `src/game-3d/` — not a separate extension. Runs in the
  same JS realm as the entity stores (`src/infrastructure/prun-api/data/*`) and the same
  Vue app as the buffers, so no cross-extension messaging bridge is needed.
- Dependency direction is one-way: `game-3d/` may import from `infrastructure/`, `core/`,
  `store/`, `utils/` (same as `features/`). Nothing outside `game-3d/` imports from it
  except the single dynamic `import()` toggle entry point.
- `three` is loaded lazily behind that toggle — never a static import from the base
  app — so users who never enable 3D mode never download it.
- Buffers get mounted into the 3D scene via Vue `<Teleport>`, not by scraping DOM
  nodes — we own the whole component tree (except the control surface, which
  deliberately reparents real native window DOM — see Architecture below).
- Rendering combo: `WebGLRenderer` for room/hologram/viewscreen/console geometry,
  `CSS3DRenderer` for buffer screens (keeps them real, interactive DOM).
- The toggle entry point is `toggleGame3D()` in `src/game-3d-launcher.ts` — the single
  seam wrapped in try/catch. Both the hotkey (Ctrl+Alt+3) and the top-bar "3D" button
  call this same function. Any new way to enter 3D mode must funnel through it too.
  Deliberately NOT a persisted `userData` setting — 3D mode is an occasional excursion,
  not something to auto-resume on every page load.
- Accepted permanent exception: `game-3d` imports directly from `features/XIT/` to reach
  buffer components (e.g. `INV.vue`). Those buffers are already eagerly bundled for every
  user regardless of 3D mode, so it costs nothing in bundle size, and no lint rule
  enforces the layering boundary anyway.
- **Console layout: one per wall, facing center.** Resolved 2026-07-26 (second round):
  replaced the single 140° arc with one console per room wall (`inv` -X, `flt` +X,
  `companyops` +Z, `baseplanning` -Z offset off the viewscreen window), each still
  rotated to face the room center where the hologram floats — crew stations facing a
  plot table, just spread around the room instead of clustered on one arc. Room bumped
  `ROOM_HALF` 5→8 (10×10→16×16) at the same time to give the spread-out consoles and the
  walk path enough clearance.
- **Focus model: press E to focus in place.** Walk up, face a console, press E: pointer
  unlocks, that console's screens become clickable, camera stays put. Press E again (or
  walk away) to return to walk mode.
- **Console data model is declarative, not bespoke-per-console.** One `ConsoleDefinition`
  shape consumed by one generic `createConsole(definition)` builder — never write a new
  one-off panel constructor per console; add a roster entry instead.
- **Control surfaces are generic and dynamic, not hardcoded per console** (as of the
  current design — see Architecture below). Long-term intent is player-configurable
  console screens, so nothing should hardcode a specific command into a console.
- **Interaction hitboxes are separate objects from visual housing meshes** — the
  raycaster checks a simple invisible hitbox per console, independent of whatever
  geometry the housing uses, so visual redesigns never touch interaction code.
- **Hangar/viewscreen ship data is the player's own company only** — not a deferred
  choice, a hard API constraint: `SHIP_SHIPS` only ever contains your own company's
  ships, matching the real 2D `FLT` screen exactly.
- **No accessibility/non-desktop story** — accepted non-goal. Pointer Lock inherently
  requires a real desktop mouse; 3D mode is strictly opt-in and never replaces the 2D UI.
- **Single room only** — no concrete feature has come up that needs a second walkable
  area; revisit only if one does.

---

## Architecture / current state

**Room & movement** (`room.ts`, `movement.ts`): a walkable box room
(`ROOM_HALF`/`ROOM_HEIGHT`/`EYE_HEIGHT` constants). WASD with acceleration/deceleration
smoothing (confirmed working by human playtest) drives `PointerLockControls`. Two
non-walk states: `interact` (unlocked, nothing focused — Escape's generic fallback) and
`focused` (unlocked, scoped to one console — see Interaction below). Spawn always faces
-Z; anything meant to be seen without turning around belongs on -Z (the console arc and
viewscreen both sit there).

**Hologram** (`hologram.ts`): one-shot, non-reactive snapshot of the player's home star
sector, stars colored by type, connection lines drawn. Positioned at `HOLOGRAM_POSITION`
— the room corner diagonally opposite the -Z viewscreen wall (`(ROOM_HALF-2.4, 1.4,
ROOM_HALF-2.4)`), clear of the `flt`/`companyops` consoles on the adjacent walls. Moved
here 2026-07-26 (second round) from room-center, per playtest feedback that it read as
"in the middle of everything."

**Viewscreen** (`viewscreen.ts`, `room.ts`): a real geometric window cut into the -Z
wall (`visible: false` on that box face + 4 freestanding `DoubleSide` framing boxes
around the gap — the box itself isn't split), sized to 80% of that wall's own width/height
(`WINDOW_WIDTH`/`WINDOW_HEIGHT` = `ROOM_HALF*2`/`ROOM_HEIGHT` × `WINDOW_WALL_FRACTION`,
centered — bumped from a small fixed 4×2.2 opening 2026-07-26, second round, per playtest
feedback), looking out onto a distant (40-50+ world units away) starfield/sun/station
diorama built from genuine WebGL geometry (not a render-to-texture screen). The station's
docking arms hold the player's ships, built via
`hangar.ts`'s shared `buildShipMesh()` helper at a much larger scale than the old
wall-mounted hangar display it replaced. `hangar.ts` itself is no longer called from
`Game3D.ts` but stays for that shared helper. Cosmetic, non-blocking: only ~2 of 5 arms
read as distinct ships from straight through the window (even 72° spacing points most
arms toward/away from the camera) — not fixed.

**Known cosmetic bug, found 2026-07-26 during the visual pass's `game-tester`
verification:** the sun sprite (`buildSun()`) is placed on the wrong side of the room.
Its local position `(60, 20, 140)` sits inside the viewscreen group positioned at
`(0, 1.2, -(ROOM_HALF+45)) = (0, 1.2, -50)`, giving a world position of roughly
`(60, 21.2, +90)` — behind the room's solid, unopened `+Z` wall, opposite the actual
window (`-Z`). Confirmed empirically: rotating to the exact computed line-of-sight angle
from spawn shows only a plain wall, nothing else. Likely just a sign error on the
sprite's local Z offset. Not fixed yet — low priority, purely cosmetic, `viewscreen.ts`
untouched otherwise.

**Consoles** (`console.ts`, `console-roster.ts`): one console per room wall, each facing
the center (`wallPose()`, inset `WALL_INSET` from its wall): `inv` (INV) on -X,
`baseplanning` (BS + PROD) on -Z (offset to x=-3 to clear the viewscreen window), `flt`
(FLT) on +X, `companyops` (CONTS + FIN) on +Z. Each `ConsoleDefinition` (id, purpose, position, rotationY, themeColor,
`screens: [{command, widthPx, heightPx?}]`) is built by the generic `createConsole()`,
which resolves each screen via the `xit` command registry (`xit.get(command)`) — adding
a console is pure roster data, never new constructor code. Console height (`CONSOLE_Y`,
shared between `console.ts` and `console-roster.ts` — duplicated on purpose to avoid a
circular import) dropped from `ROOM_HEIGHT*0.55` to `ROOM_HEIGHT*0.55*0.7` — 30% shorter,
2026-07-26 second round, per playtest feedback. Visual housing per console: `pedestal`,
`desk` (angled podium surface, `DESK_TILT = 0.25` rad), `floorMarker`, `accentLight`
(tinted by `themeColor`) — all independent of the invisible raycasting `hitbox`.

**Desk-mounted control-surface panels** (2026-07-26, second round): previously each
console's dormant control-surface placeholder ("No action running") lived in the same
top row as its buffer screens, sized to fit the whole split window's combined width. Now
the top row holds only the console's own buffer screens (`definition.screens`), and two
separate `ControlSurfaceSlot`s (`primary` + `companion`, `createControlSurfacePanels()`
in `control-surface.ts`) sit below, tilted to `DESK_TILT` (0.25 rad, matching the desk
mesh). Reasoning for the split: an `ExecuteActionPackage` window's `Node.node` always
contains exactly two `Node.child` tiles (the action config + its companion buffer, per
`getCompanionTile()` in `tile-allocator.ts`) — previously both were squeezed as one DOM
subtree into a single placeholder; now each gets its own dedicated slot.

Positioning is **top-edge-anchored, not desk-center-anchored**: `console.ts`'s
`CONTROL_ROW_TOP` (local Y = -0.45) sits just below the lowest a screen's bottom edge can
ever reach (-0.35, derived from `SCREEN_MAX_HEIGHT_WORLD`), and the row's center Y is
computed backward from that top edge and the panel's own height — so the panel can never
creep upward into the screen row above regardless of a screen's actual rendered height,
and resizing `CONTROL_SURFACE_HEIGHT_PX` later can't silently reintroduce that. Per-panel
size is 460×460 (`CONTROL_SURFACE_WIDTH_PX`/`HEIGHT_PX`) — narrower than the old combined
900px (each panel now hosts one `Node.child` tile instead of both), chosen specifically to
fit inside the vertical gap between `CONTROL_ROW_TOP` and the floor at the current
(30%-shorter) `CONSOLE_Y`; a first attempt at 560px tall, and a desk-surface-relative
center instead of a top-edge anchor, both had to be corrected after `game-tester` found a
real overlap with `companyops`'s screens — re-derive by hand before changing either
constant. Each panel's border now uses the console's own `themeColor` (previously a fixed
blue for all four) plus a slightly thicker 3px border, after `game-tester` also found the
original fixed-blue/dark-background styling blending into the similarly dark pedestal
mesh directly behind it for `baseplanning`. Both fixes re-verified by `game-tester`.

**Still not human-verified**: reparenting the two `Node.child` siblings to two separate
DOM locations (rather than moving their shared `Node.node` parent as one unit, as the
original single-panel design did) is an unverified assumption riding on the existing
"real native DOM tolerates reparenting" fact below; it's possible the native
tile/split-resize logic assumes both children stay under one parent. Needs a live human
test of an actual action run once the still-open control-surface capture bug (below) is
separately fixed enough to reach that point.

**Interaction** (`interaction.ts`): a `Raycaster` from camera-forward each frame, checked
against each console's hitbox, drives a state machine (nothing → "Facing `<purpose>` ·
Press E" hint → focused). E toggles focus (pointer unlock/lock, overlay hint); walking
away or pressing E again returns to walk mode. Confirmed working end-to-end by human
playtest (facing hint, E-toggle, Escape fallback). Exposes `getFocusedConsoleId()` for
the control-surface router to read.

**Dynamic control surface** (`control-surface.ts`, `control-surface-router.ts`): no
console is wired to a specific command. `control-surface-router.ts` runs a
`MutationObserver` on `document.body` (same technique as `buffer-window-guard.ts`); when
a real window opens while a console is focused, it synchronously checks (via `_$`, not
the indefinitely-waiting `$`) whether that window already split into the
`ExecuteActionPackage` two-tile shape (`Node.node`/two `Node.child`, per
`tile-allocator.ts`). If so (and only if exactly two `Node.child` tiles are found via
`_$$`), it parks the window off-screen and reparents each child individually into that
console's `primary`/`companion` desk panel (see above), replacing both placeholders; a
previous capture on the same console is closed first. Exiting 3D mode closes every
still-active capture. **This flow is currently untestable — see Known Issues below.**

**Renderer/overlay** (`Renderer.ts`, `overlay.ts`, `buffer-window-guard.ts`,
`buffer-panel.tsx`): `DualRenderer` stacks `WebGLRenderer` + `CSS3DRenderer` in one
fullscreen overlay driven by one shared camera. `createPanelShell()` is the shared CSS3D
screen boilerplate (handles `SCREEN_SCALE` pixel→world conversion, max-height clamping
with a scrollbar, and the iframe-repaint workaround). `buffer-window-guard.ts` fixes a
z-index race so ordinary 2D floating windows (opened via a link inside a Teleported
buffer) paint correctly above/below the 3D overlay. `overlay.ts` renders the mode hint
and EXIT button.

**Test-only bypass** (`test-controls.ts`): exposes `window.__rpGame3DTest.{rotate,move}`
for `pw-act.mjs`'s `game3d-test-rotate`/`game3d-test-move` — calls `PointerLockControls`
methods directly, proving geometry/rendering/position but unable to exercise anything
gated on `controls.isLocked` (see Known Issues).

**Visual pass (2026-07-26, procedural-only, no downloaded assets)**: `Renderer.ts`'s
`DualRenderer` now runs an `EffectComposer` (`RenderPass` + `UnrealBloomPass`, built
lazily on first `render()` call since `scene`/`camera` don't exist yet at
`DualRenderer`'s own construction) instead of a bare `webgl.render()` call, making
emissive materials (console pedestal/desk/floor markers, hologram star spheres, the
viewscreen sun sprite) glow without haloing the non-emissive walls. `Game3D.ts`'s
constructor builds a PMREM environment map once (`RoomEnvironment` + `PMREMGenerator`)
and assigns it to `scene.environment`, giving existing `metalness`-bearing materials
subtle reflections with no material changes needed. `room.ts`'s `createPanelBumpMaps()`
generates matching normal/roughness maps for the procedural wall/frame/floor panel-line
texture (height-field canvas → finite-difference normal map), read as embossed seam
relief under lighting. New `greebles.ts` scatters ~60 rivet/vent/pipe instances
(`THREE.InstancedMesh`) along the room's wall base — purely decorative, never added to
`panelHitTargets` or any hitbox list. All four verified visually by `game-tester`;
bloom alone costs a real, measurable 2-4x further slowdown on this harness's
software-rendered `SwiftShader` baseline (~2 fps → ~0.5-1 fps) — not blocking on real
GPU hardware, but worth knowing before trusting any FPS number from this harness on a
bloom-enabled build.

**Known, deliberately low-priority cosmetic issue:** `XIT CALC`'s cross-origin iframe
still doesn't reliably paint inside a CSS3D panel (a known Chromium/three.js bug class,
no canonical upstream fix). A scoped mitigation exists in `buffer-panel.tsx` but its
effect is unconfirmed. Not worth more investigation time — only two minor features in
the whole extension use iframes at all.

---

## CSS3D panel click-hit-testing bug — fixed for moderate skew, open at extreme arc angles (2026-07-26)

Previously: while unlocked (`interact` or `focused` mode), clicking anywhere on a
console's screen content instantly re-locked into walk mode instead of reaching the
button/link underneath. Root cause: `document.elementFromPoint()` at real screen pixels
over most panels returns the `CANVAS` element, not the panel — a Chromium hit-test/paint
mismatch under the CSS3D `matrix3d`/`preserve-3d` transform chain (same underlying
flattening quirk as the `getBoundingClientRect()` note below, but corrupting real click
*delivery* rather than just a JS coordinate *query*). `Game3D.ts`'s `onCanvasClick`
re-locked on any click landing on canvas, reproducing the symptom exactly. This also
retroactively meant every earlier "PREVIEW click works" verification (Phase 7/8) never
tested real click interaction — those used `element.click()`, bypassing browser
hit-testing entirely.

**Fix**: bypass native screen-space hit-testing. `panel-hit-test.ts` raycasts in 3D
space (camera through the click's screen coordinates) against an invisible hit-plane
mesh matching each CSS3D panel's exact position/size, giving a hit-test that isn't
subject to the flattening bug. The exact DOM element is then resolved via a temporary
reparent-to-`document.body` + `position: fixed; transform: none` + `elementFromPoint`
trick (escapes the corrupting transform chain for the query, synchronous so nothing
paints in between; safe against three.js's own `CSS3DRenderer.render()`, which
self-heals both parentage and the cached transform string every frame regardless). A
real `.click()` is dispatched on the resolved element instead of re-locking; only
clicks that hit no panel at all still fall through to the walk-mode relock.

Verified end-to-end by `game-tester` with real `page.mouse.click()` coordinate clicks
(not `element.click()`): a click on a base-list row's expand toggle inside a
base-planning console panel reached the real Vue handler and visibly expanded the row,
while `requestPointerLock` (instrumented via patch) stayed uncalled; a click on empty
canvas with no panel behind it still triggered the relock fallback correctly.

**Residual gap, root-caused 2026-07-26 (later session): the fix does not cover
steeply-angled panels.** A later verification pass initially flagged what looked like a
full regression (0 hits across broad sampling) — turned out to be partly a measurement
artifact (many sampled points were simply outside any panel's actual on-screen footprint,
or landed on points where native hit-testing already succeeds, e.g. the control-surface
placeholder's "No action running" text, which was never broken) — but a real, reproducible
gap survived once confirmed against an actual screenshot: at `inv`/`flt` (the two
consoles at the ends of the 140° arc, ~±70° from center), viewed from spawn or any
similarly oblique angle, a click squarely inside the panel's *visibly rendered* content
(confirmed via screenshot pixel inspection, not guesswork) returns `hitCount: 0` from the
raycaster itself — not just from native `elementFromPoint`. Root cause: at this much
skew, Chromium's CSS `matrix3d`/`perspective()` rendering of the CSS3D panel div
diverges from the *true* 3D transform of the invisible hit-plane mesh sharing the same
`object.position` — the same flattening-quirk family as the known `getBoundingClientRect()`
issue below, but this time affecting the panel's actual visual paint, not just a
coordinate query. Since the raycast fix assumes visual paint matches true 3D geometry
(true at moderate skew, confirmed twice: the original row-expand verification and a
direct follow-up test both against more face-on consoles), it inherits this mismatch at
extreme skew rather than fixing it — bypassing native `elementFromPoint` doesn't help
when the *visual position itself*, not just the hit-test query, has diverged from the
geometry. Not a regression from any later session's changes (confirmed unaffected by
the bloom/reflections/greebles visual pass) and not something a better hit-plane
position/size can fix on its own — the panel's own visible paint is the thing that's
wrong at this angle. Two console screens (`inv`, `flt`) are affected when viewed at
their natural arc angle; `baseplanning`/`companyops` (nearer the arc's center, more
face-on from spawn) are not. **Next step if picked up**: the plan doc's original "cheap
experiment, not guaranteed" idea (narrower arc span/smaller radius, reducing the worst
skew angles) is the most promising untried lever, since the root cause is specifically
skew severity, not a fixable code defect in the hit-plane math.

**Testing-technique note**: this harness's pointer lock always fails silently
(`WrongDocumentError` under the hood), so `controls.lock()` can be called without the
on-screen mode banner changing — screenshot-only verification of "did a click cause a
relock" is not discriminating. `game-tester` verified by patching
`canvas.requestPointerLock` to count real invocations and adding a capture-phase
`document` click listener to observe which element (if any) received a synthetic
`.click()`. Worth reusing for any future click/relock verification in this harness.

---

## KNOWN BUG — control-surface capture missed a real action package (found 2026-07-26, human playtest, not investigated)

Reported directly by the user (not yet reproduced/diagnosed by an agent): starting an
action runner (RepairAct) at the `baseplanning` console did **not** get captured into
that console's control-surface slot. A normal 2D floating buffer window appeared
instead (i.e. it stayed a regular window, exactly like `control-surface-router.ts`'s
"not focused / not an ACT split / leave it alone" fallback paths), and the console's
control-surface slot itself showed no change (still whatever it was before — dormant
"No action running" or a prior capture).

**Not yet diagnosed.** `control-surface-router.ts`'s `tryCapture()` only proceeds if
`getFocusedConsoleId()` returns that console's id at the moment the window's DOM node
mutates in — two candidate causes worth checking first, neither confirmed:

- The console may not actually have been in `focused` state (per `interaction.ts`) at
  the exact moment the window opened — e.g. if the click that launched the action
  happened while merely `interact`-mode-unlocked rather than truly `focused` on
  `baseplanning` specifically.
- The synchronous `_$(win, C.Node.node)` split-detection check may not find a match for
  this specific action package's DOM shape/timing — the comment above it assumes
  `TileAllocator`'s split always completes before the `MutationObserver` callback fires,
  which may not hold for every action-package variant.

Needs a live human repro with devtools open (check `getFocusedConsoleId()`'s value and
whether `tryCapture` even runs) before attempting a fix — don't guess-fix this blind.

---

## Reusable facts for future work

- **Pointer lock is broken under the CDP/Playwright test harness.** `test-controls.ts`'s
  bypass calls `PointerLockControls` methods directly, so it proves geometry/rendering/
  position but cannot exercise anything gated on `controls.isLocked`. That class of
  change needs a human with a real mouse.
- **The test harness has no real GPU** — WebGL runs on `SwiftShader` (software
  rasterizer), confirmed via `pw-act.mjs webgl-renderer-info`. Any FPS number from this
  harness needs that check alongside it — software rendering is 10-50x slower than real
  GPU hardware. Specific to this local Playwright/WSL2 setup, not real users' browsers.
- **Ambient Vue context varies per buffer.** Some buffers (e.g. `INV.vue`, `FLT.vue`)
  need plugins like `tileStatePlugin` installed on an ancestor to avoid throwing on
  mount; others (`DISPATCH`) call `useTile()`/raw `inject()` and would throw as-is. Grep
  a candidate buffer's whole component folder (not just the top-level `.vue`) for
  `useTile()`/`useXitCommand()`/`inject()` before assuming a Teleport "just works."
- **A blank/unpainted CSS3D iframe panel doesn't mean it failed to load** — check the
  DOM for the buffer's own loading-state indicator to distinguish "never loaded" from
  "loaded but not painted" before debugging the wrong layer.
- **Cutting a real opening in a box-room wall:** hide that face's material
  (`visible: false`) rather than removing/rebuilding the box geometry, then reconstruct
  the surrounding wall as separate freestanding frame meshes using `DoubleSide` —
  `BackSide` (used by the shared wall material, camera sits inside looking out) would
  cull those standalone frame boxes' room-facing side.
- **Real native 2D game DOM can be reparented into a CSS3D panel, not just
  Vue-Teleported content.** A single `appendChild`/`replaceChildren` move (not a clone)
  preserves DOM identity, so Vue's own reconciliation on the moved subtree keeps
  patching correctly wherever the node ends up, and the game's own (non-Vue) window/tile
  manager tolerates the move too. Two conditions matter: park the source window
  off-screen (`position: fixed; left/top: -9999px`) rather than hiding it another way,
  and close it later via its own real close button (`closePrunWindow()`) rather than
  assuming it can be discarded — its body may be empty after the move, but the
  header/close control is untouched.
- **Reparented real-DOM content can rely on percentage-height ancestor chains that
  collapse to 0 under a CSS3D panel's `auto`-height container.** Unlike Teleported Vue
  screens (which size themselves intrinsically), real native window DOM assumes a known
  pixel size — give any panel hosting reparented real DOM an explicit `heightPx` in
  `createPanelShell`, don't assume it can be omitted.
- **Spawn always faces -Z** (three.js's default camera forward) — anything meant to be
  seen without turning around belongs on -Z, not whichever wall a feature gets added to.
- **A `MutationObserver` callback on `document.body` fires only after the synchronous
  DOM-mutation batch that triggered it completes** — so a newly-added element's own
  synchronous mount-time side effects (e.g. `TileAllocator`'s tile split, which happens
  at mount, not on a later click) are already done by the time the callback runs. A
  **synchronous** existence check (`_$`, not the indefinitely-waiting `$` — see
  `docs/dom-helpers.md`) is enough to tell "did this really split" from "this is some
  other kind of window that will never split," with no polling needed.
- **`getBoundingClientRect()` on a CSS3D panel div doesn't match where it actually
  paints**, and this same flattening quirk also corrupts real click hit-testing for
  sufficiently-skewed panels — see the Known Blocking Bug above. To check whether panels
  overlap visually, measure painted pixels from a screenshot, not `getBoundingClientRect`.
- **A CSS3D panel and its raycasting hit-plane can be tilted together to angle-match a
  sloped mesh** (console.ts's desk panels, 2026-07-26 third round): set matching
  `rotation.x` on both the `CSS3DObject` and the hit-plane mesh — `panel-hit-test.ts`'s
  intersect logic needs no changes, three.js raycasting already respects arbitrary mesh
  transforms. Untested against the known extreme-skew click-hit-testing bug above — a
  tilt adds a rotation axis no earlier verification exercised, so don't assume it's immune
  to that flattening quirk.
- **Anchor a variable-height panel row by its own top (or bottom) edge, not by a fixed
  center point, whenever it sits next to another element whose size can vary** (the desk
  panels above, first attempt centered them on the desk's own position and a `game-tester`
  pass caught real overlap with a console's screens once content rendered taller than
  assumed). Compute the row's center from `edgeConstant - (height/2)*cos(tilt)` so
  retuning the height later can't silently reintroduce the overlap — a fixed-center
  placement has to be re-derived by hand every time either sibling's size changes.
- **A placeholder panel's fixed background/border can blend into a nearby mesh of a
  similar dark color** (the desk panels' original fixed blue border against the console
  pedestal's dark navy, `baseplanning`/`companyops`, 2026-07-26 third round) — check
  contrast against whatever's actually behind a panel from likely viewing angles, not just
  against the room's general wall/floor tone the rest of a console's screens are silhouetted
  against.
- Files: `room.ts`, `movement.ts`, `Renderer.ts`, `buffer-panel.tsx`, `buffer-window-guard.ts`,
  `hologram.ts`, `hangar.ts` (ship-mesh helper only, no longer wall-mounted),
  `viewscreen.ts`, `console.ts`, `console-roster.ts`, `interaction.ts`,
  `control-surface.ts`, `control-surface-router.ts`, `overlay.ts`, `test-controls.ts`,
  `Game3D.ts` (orchestrates everything + render loop), `index.ts` (`launchGame3D()`,
  idempotent toggle), `game-3d-launcher.ts` (`toggleGame3D()`, the single dynamic-import
  seam).

## Proposed next steps

**1. Human playtest feedback (2026-07-26) — three done, one still open:**

   - ~~Reconsider the console arc layout~~ — **done (2026-07-26, second round).** Replaced
     the arc with one console per wall (see Decisions/Architecture above). Room
     `ROOM_HALF` bumped 5→8 in the same change for clearance.
   - ~~Decide on bloom's default state~~ — **done.** `Renderer.ts` now has a
     `BLOOM_ENABLED = false` const gating the `EffectComposer`/`UnrealBloomPass`; flip it
     to re-enable for visual-polish-focused work.
   - ~~Move the hologram to a room corner~~ — **done (2026-07-26, third round).** See
     Architecture above (`HOLOGRAM_POSITION`).
   - **Fix the control-surface capture bug** — still open. RepairAct at `baseplanning`
     wasn't captured (see the KNOWN BUG section above). Needs a live human repro with
     devtools before attempting a fix; don't guess-fix blind. The desk-panel split below
     changes *where* a capture lands but not the `tryCapture()` gating logic this bug
     lives in — still needs its own diagnosis.

**1b. Second round of layout requests (2026-07-26, third round) — done, `game-tester`-
verified in their dormant/placeholder state:**

   - **Viewscreen window enlarged to 80% of its wall** (`room.ts`'s `WINDOW_WIDTH`/
     `WINDOW_HEIGHT`, see Architecture above). Verified.
   - **Consoles 30% shorter** (`CONSOLE_Y` factor, see Architecture above). Verified.
   - **Control-surface capture split into two desk-mounted panels** instead of one
     top-row placeholder (see "Desk-mounted control-surface panels" above). First
     implementation had two real bugs (`companyops` screen/panel overlap,
     `baseplanning` panel illegible against the pedestal) — both caught by `game-tester`
     and fixed (top-edge-anchored positioning, per-console `themeColor` borders), then
     re-verified. **Still open**: an actual action run through these panels is
     untestable until the KNOWN BUG above (control-surface capture not always firing) is
     separately diagnosed and fixed — today's verification only covers the dormant "No
     action running" placeholders, not real `Node.child` content reparented into them.

**2. Re-evaluate the click-hit-testing gap now that the arc is gone** — the original gap
(see the dedicated section above) was rooted in extreme *viewing angle* to the arc's two
end consoles (`inv`/`flt`, ~±70° skew). That specific geometry no longer exists post
layout-change — each console now sits flat against its own wall, typically viewed closer
to face-on from across the room — but this is **not yet re-tested**; don't assume it's
fixed until a fresh click-hit-test pass confirms it, since a different skew angle could
still reproduce the same underlying Chromium CSS3D/`matrix3d` flattening quirk.

**3. Finish the verification the click-hit-testing bug was blocking** — for
`baseplanning`/`companyops` this is unblocked already; for `inv`/`flt` it depends on #2:
   - A real `EXECUTE` click on a captured control-surface package, to confirm the
     companion tile populates with real content (human-only, per the
     server-communication rule).
   - The full Phase 9 dynamic-capture flow end-to-end (focus a console, trigger a real
     action from one of its screens, confirm capture/replace/dispose all behave as
     designed).

**4. Open candidates for whatever comes after that — none scoped or agreed yet, pick
with the user before starting any of them:**

   - **Player-configurable console screens.** The stated long-term intent behind Phase
     9's "don't hardcode a command into a console" design — let the player choose which
     XIT command occupies a console's screen/control-surface slot, rather than a fixed
     roster. Meaningfully bigger than anything built so far (needs a UI for picking, and
     probably `userData` persistence); the natural big next feature if the vision is
     still to build toward it.
   - **Hologram interactivity** — click a star/planet on the hologram for info, or use
     it to navigate, rather than a static snapshot.
   - **Expand the console roster** beyond the current 4, or let a console show more than
     one screen combination.
   - **Ambient audio/sound design** for the bridge.
   - **Docking-arm spread fix** (cosmetic, non-blocking) — bias the viewscreen station's
     arm angles for more lateral spread so more than ~2 of 5 read as distinct ships from
     straight through the window.
   - **CALC iframe repaint fix** — explicitly low priority; revisit only if a specific
     reason comes up, not proactively.
   - **A second walkable area** — explicitly decided against for now (see Decisions
     above); only revisit if a concrete feature need arises that a single room can't fit.

## Session log

Keep this short — one or two lines per session, current state lives above. For detail on
*how* any given piece was built, read git log on this branch.

**2026-07-26** — Compressed this doc from a full phase-by-phase narration + ~250-line
session log down to current architecture + decisions + known issues, at the user's
request. No functional change. Last functional work: Expansion Phase 9 (generic dynamic
control surface, replacing the fixed-per-console model) landed and was structurally
verified; a real, serious click-hit-testing bug was found via live human testing right
after and was the top blocking item.

**2026-07-26 (later same day)** — Fixed the click-hit-testing bug: raycast-based
hit-plane + temporary-reparent DOM resolution replaces broken native hit-testing (see
above). Verified end-to-end by `game-tester` with real coordinate clicks for the two
arc-center consoles.

**2026-07-26 (later still)** — Added a procedural-only visual pass (bloom, PMREM
reflections, normal/roughness maps, instanced greebles — see above), verified by
`game-tester`. That verification also flagged what first looked like a full regression
of the click-hit-testing fix; a focused follow-up investigation (including manual
raycast math cross-checked against real screenshots) found the true picture: the fix
is solid for moderately-angled consoles (confirmed twice) but has a real, unfixed gap
at the arc's extreme ends (`inv`/`flt`, ~±70°) where Chromium's CSS3D rendering itself
diverges from the true 3D transform — see the corrected section above. Also found (and
left unfixed, low priority): the viewscreen sun sprite is placed behind the wrong wall.

**2026-07-26 (session end)** — User playtested live and paused the session deliberately
to think through several findings before continuing: the console arc layout reads as
confusing and should probably be consoles-spread-around-the-room instead (which may
also resolve the extreme-skew hit-testing gap for free — see Proposed next steps); the
hologram should move from room-center to a corner; a real action package (RepairAct) at
`baseplanning` failed to get captured into its control-surface slot (new bug, not yet
diagnosed); and bloom's ~2-4x perf cost on this harness is worth disabling by default for
faster iteration, re-enabling only for visual-polish work. No code changed this round —
purely doc updates capturing the feedback for a focused follow-up session.

**2026-07-26 (follow-up)** — Acted on two of the four paused items: disabled bloom by
default (`Renderer.ts`'s `BLOOM_ENABLED` const) and replaced the console arc with one
console per wall, all facing the room center (`console-roster.ts`'s `wallPose()`); bumped
`ROOM_HALF` 5→8 for clearance. Hologram-to-corner and the control-surface capture bug
remain open (see Proposed next steps). The old extreme-skew click-hit-testing gap's root
geometry (the arc) no longer exists, but this hasn't been re-tested — don't assume fixed.

**2026-07-26 (third round)** — User confirmed the focus hint and room movement-clamp
bounds both work correctly (human-only checks the automated harness can't exercise).
Acted on the remaining live feedback: moved the hologram to the room corner opposite the
viewscreen (`HOLOGRAM_POSITION`); enlarged the viewscreen window to 80% of its wall
(`WINDOW_WIDTH`/`WINDOW_HEIGHT` in `room.ts`); shrank console height 30% (`CONSOLE_Y`);
and split each console's single dormant control-surface placeholder into two panels
(`primary`/`companion`) mounted tilted on the desk below the buffer screens instead of
squeezed into the top row. All four changes verified by `game-tester`; the desk-panel
split initially had two real bugs (`companyops` panels overlapping its live CONTS/FIN
screens, `baseplanning` panels illegible against the pedestal) — both found and fixed in
the same round (top-edge-anchored row positioning, per-console `themeColor` borders), then
re-verified passing on all four consoles. Does not fix the still-open control-surface
capture bug — only changes where a successful capture would land once that's fixed.
