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

## CSS3D panel click-hit-testing bug — fixed 2026-07-26

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

**Residual, non-blocking edge case found during verification**: at steep oblique
viewing angles (looking at a far-arc console well off-axis), the invisible hit-plane
raycast can still miss a point that visually sits inside the panel's rendered content —
a milder recurrence of the same flattening-quirk family, now on the raycast/geometry
side rather than the browser hit-test side. Not a regression (a miss just falls through
to the same relock-on-empty-space fallback, not incorrect behavior), and doesn't
reproduce at normal/near-frontal angles. Not investigated further — revisit only if it
proves disruptive in practice.

**Testing-technique note**: this harness's pointer lock always fails silently
(`WrongDocumentError` under the hood), so `controls.lock()` can be called without the
on-screen mode banner changing — screenshot-only verification of "did a click cause a
relock" is not discriminating. `game-tester` verified by patching
`canvas.requestPointerLock` to count real invocations and adding a capture-phase
`document` click listener to observe which element (if any) received a synthetic
`.click()`. Worth reusing for any future click/relock verification in this harness.

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

## Proposed next steps

**1. Finish the verification the click-hit-testing bug was blocking** — now that it's
fixed (see above), not new work, just confirming what's already built actually behaves:
   - A real `EXECUTE` click on a captured control-surface package, to confirm the
     companion tile populates with real content (human-only, per the
     server-communication rule).
   - The full Phase 9 dynamic-capture flow end-to-end (focus a console, trigger a real
     action from one of its screens, confirm capture/replace/dispose all behave as
     designed).

**2. Open candidates for whatever comes after that — none scoped or agreed yet, pick
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
above). Verified end-to-end by `game-tester` with real coordinate clicks. A minor
residual edge case at steep viewing angles was found and is noted above, not blocking.
Console-screen click interaction is now considered testable/usable going forward.
