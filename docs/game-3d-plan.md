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
- **Console layout: arc facing center.** Consoles curve around facing inward toward the
  room center (where the hologram floats) — crew stations facing a plot table, not
  panels bolted to flat walls.
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
sector at room center `(0, 1.4, 0)`, stars colored by type, connection lines drawn.

**Viewscreen** (`viewscreen.ts`, `room.ts`): a real geometric window cut into the -Z
wall (`visible: false` on that box face + 4 freestanding `DoubleSide` framing boxes
around the gap — the box itself isn't split), looking out onto a distant (40-50+ world
units away) starfield/sun/station diorama built from genuine WebGL geometry (not a
render-to-texture screen). The station's docking arms hold the player's ships, built via
`hangar.ts`'s shared `buildShipMesh()` helper at a much larger scale than the old
wall-mounted hangar display it replaced. `hangar.ts` itself is no longer called from
`Game3D.ts` but stays for that shared helper. Cosmetic, non-blocking: only ~2 of 5 arms
read as distinct ships from straight through the window (even 72° spacing points most
arms toward/away from the camera) — not fixed.

**Consoles** (`console.ts`, `console-roster.ts`): 4 consoles on a 140° arc (radius 3.0,
centered on -Z): `inv` (INV), `baseplanning` (BS + PROD), `companyops` (CONTS + FIN),
`flt` (FLT). Each `ConsoleDefinition` (id, purpose, position, rotationY, themeColor,
`screens: [{command, widthPx, heightPx?}]`) is built by the generic `createConsole()`,
which resolves each screen via the `xit` command registry (`xit.get(command)`) — adding
a console is pure roster data, never new constructor code. Visual housing per console:
`pedestal`, `desk` (podium surface), `floorMarker`, `accentLight` (tinted by
`themeColor`) — all independent of the invisible raycasting `hitbox`. Every console also
gets one identical, unconditional **dormant control-surface slot** (900×420,
`CONTROL_SURFACE_WIDTH_PX`/`HEIGHT_PX` in `control-surface.ts`) showing "No action
running" until dynamically activated (see below) — no console has a command hardcoded
into it.

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
`tile-allocator.ts`). If so, it parks the window off-screen and reparents the split node
into that console's slot, replacing the placeholder; a previous capture on the same
console is closed first. Exiting 3D mode closes every still-active capture. **This flow
is currently untestable — see Known Issues below.**

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

**Known, deliberately low-priority cosmetic issue:** `XIT CALC`'s cross-origin iframe
still doesn't reliably paint inside a CSS3D panel (a known Chromium/three.js bug class,
no canonical upstream fix). A scoped mitigation exists in `buffer-panel.tsx` but its
effect is unconfirmed. Not worth more investigation time — only two minor features in
the whole extension use iframes at all.

---

## KNOWN BLOCKING BUG (found 2026-07-26, not fixed) — CSS3D panel clicks mostly don't reach panel content

**Top priority for whoever picks this track up next.** While unlocked (`interact` or
`focused` mode), clicking *anywhere* on a console's screen content instantly re-locks
into walk mode instead of the click reaching the button/link underneath — this blocks
essentially all real mouse interaction with buffer content in 3D mode.

**Confirmed root cause** via a read-only `game-tester` diagnostic (`elementFromPoint()` +
computed-style queries, no real clicks made): the `pointer-events: auto` override on each
panel's root div (`createPanelShell`) is wired correctly — computed style confirms it
takes effect over its ancestor `css3dLayer`'s `pointer-events: none` (`Renderer.ts`). The
bug is one level down: `document.elementFromPoint()` at real screen pixels over most
panels' visible area returns the `CANVAS` element, not the panel — Chromium's hit-test
geometry doesn't agree with what it visually painted. **Geometry-dependent, not
universal**: the one panel closest to camera (least visually skewed) hit-tested
correctly across a dense coordinate grid; every more central/distant panel (larger
`matrix3d` skew) hit-tested as pure canvas across its entire visible area. Since
`Game3D.ts`'s `onCanvasClick` re-locks on any click landing on the canvas, a broken
hit-test there reproduces the symptom exactly.

Same underlying flattening quirk already on record below for `getBoundingClientRect()`
(nested `preserve-3d` + `matrix3d`+`perspective()` geometry not matching Chromium's
simplified layout-geometry computation) — but this is a stronger, previously-unconfirmed
consequence: it corrupts real click *delivery*, not just a JS coordinate *query*. **This
also retroactively means every earlier "PREVIEW click works" verification (Phase 7/8 in
git history) never actually tested real click interaction** — those used `element.click()`
(a direct JS call bypassing browser hit-testing), per the existing testing-technique
gotcha about coordinate clicks and the fullscreen canvas below. They proved the Vue click
handler *works when invoked*, not that a real mouse click *reaches it*.

**Not fixed.** Two candidate approaches, neither attempted:

- **Cheap experiment, not guaranteed:** reduce transform extremity (tighter camera FOV,
  smaller arc radius/angles) to see whether less skew narrows or eliminates the affected
  region. Unknown whether there's a skew threshold below which Chromium's hit-test stays
  accurate, or whether this is broken at any non-trivial angle.
- **Real fix, more work:** bypass native hit-testing entirely — reuse the raycaster
  already built for console-facing detection (`interaction.ts`) to compute, in 3D space,
  exactly which panel/pixel a click's ray intersects, then dispatch a synthetic click at
  the correct DOM element ourselves rather than relying on the browser's click delivery
  through the CSS3D transform chain.

**Practical fallout:** confirming a real package's companion tile populates via `EXECUTE`
(needs a human click, per `docs/contributing.md`'s server-communication rule) and the
whole dynamic-capture flow (walk up, focus, click a real action button, watch it get
captured into the console's slot) are both **untestable until this is fixed** — not
merely pending a verification pass.

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
- Files: `room.ts`, `movement.ts`, `Renderer.ts`, `buffer-panel.tsx`, `buffer-window-guard.ts`,
  `hologram.ts`, `hangar.ts` (ship-mesh helper only, no longer wall-mounted),
  `viewscreen.ts`, `console.ts`, `console-roster.ts`, `interaction.ts`,
  `control-surface.ts`, `control-surface-router.ts`, `overlay.ts`, `test-controls.ts`,
  `Game3D.ts` (orchestrates everything + render loop), `index.ts` (`launchGame3D()`,
  idempotent toggle), `game-3d-launcher.ts` (`toggleGame3D()`, the single dynamic-import
  seam).

## Session log

Keep this short — one or two lines per session, current state lives above. For detail on
*how* any given piece was built, read git log on this branch.

**2026-07-26** — Compressed this doc from a full phase-by-phase narration + ~250-line
session log down to current architecture + decisions + known issues, at the user's
request. No functional change. Last functional work: Expansion Phase 9 (generic dynamic
control surface, replacing the fixed-per-console model) landed and was structurally
verified; a real, serious click-hit-testing bug was found via live human testing right
after and is now the top blocking item (see above) — nothing else is safely testable by
click until it's addressed.
