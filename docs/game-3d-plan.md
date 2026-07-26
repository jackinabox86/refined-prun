# 3D Game Mode — Plan

Living phase tracker for `src/game-3d/`. For the technical architecture (dependency
rules, why the import is dynamic, the `features/XIT/` exception, the `tileStatePlugin`
ambient-context wiring) see `docs/architecture.md`'s "3D Game Mode (Spike)" section —
this doc tracks *what phase we're in and what's left*, not how the seam works.

This doc has two tracks, kept deliberately separate:

- **Spike (Phases 1-5, below)** — done/paused. Proved the core mechanics work at all:
  walkable room, buffers Teleported into CSS3D panels, a hologram, a ship hangar. Summarized,
  not narrated — see the git log / old commits if you need the blow-by-blow history.
- **Expansion (Expansion Phase 1+)** — active. Turns the spike into an actual "starship
  bridge / operations center" with multiple purpose-built consoles, an interaction
  system, and eventual visual polish. Don't mix phase numbers between the two tracks —
  "Phase 3" and "Expansion Phase 3" are unrelated.

Branch: `3d-game-mode-spike` (based on `origin/comm-channel-work`), pushed to origin,
no PR opened yet.

## Vision

A fullscreen 3D space-station bridge/operations center, built into refined-prun, that a
player can walk around. A handful of purpose-built consoles (Base Planning, Fleet Ops,
Inventory, etc.) sit arranged around a central hologram showing a region of the star
map — like a bridge crew facing a plot table. Each console shows 2-4 of refined-prun's
buffers as interactive screens, plus a control-surface screen for running action
packages. It's an alternate, opt-in way to inhabit the game's data — not a replacement
for the normal 2D UI, which keeps working exactly as it does today for everyone who
doesn't turn 3D mode on.

## Decisions already made — don't relitigate without new evidence

- Lives inside this repo, under `src/game-3d/` — not a separate extension. Runs in the
  same JS realm as the entity stores (`src/infrastructure/prun-api/data/*`) and the
  same Vue app as the buffers, so no cross-extension messaging bridge is needed.
- Dependency direction is one-way: `game-3d/` may import from `infrastructure/`,
  `core/`, `store/`, `utils/` (same as `features/`). Nothing outside `game-3d/` imports
  from it except the single dynamic `import()` toggle entry point.
- `three` is loaded lazily behind that toggle — never a static import from the base
  app — so users who never enable 3D mode never download it.
- Buffers get mounted into the 3D scene via Vue `<Teleport>`, not by scraping DOM
  nodes — we own the whole component tree.
- Rendering combo: `WebGLRenderer` for room/hologram/hangar/console geometry,
  `CSS3DRenderer` for buffer screens (keeps them real, interactive DOM).
- The toggle entry point is `toggleGame3D()` in `src/game-3d-launcher.ts` — the single
  seam wrapped in try/catch. Both the hotkey (Ctrl+Alt+3) and the top-bar "3D" button
  call this same function. Any new way to enter 3D mode must funnel through it too.
- Accepted permanent exception: `game-3d` imports directly from `features/XIT/` to
  reach buffer components (e.g. `INV.vue`). Those buffers are already eagerly bundled
  for every user regardless of 3D mode, so it costs nothing in bundle size, and no lint
  rule enforces the layering boundary anyway.

---

## Spike Phases 1-5 — Summary (done/paused)

Phases were gated in order for this track. All shipped code compiles/lints clean;
"live-verified" means confirmed via `game-tester` in the local Playwright/WSL2 harness
unless noted otherwise.

- **Phase 1 — Shell spike.** Fullscreen WebGL room + CSS3D panel, WASD +
  `PointerLockControls` walk mode, click-to-lock/Escape-to-unlock interact mode,
  `INV.vue` Teleported into a wall panel with live data. **Key finding, still load-bearing:**
  Teleported buffers can depend on ambient Vue context (provide/inject), not just DOM
  position — `INV.vue` needed `tileStatePlugin`/`useTileState()` installed manually.
  Check this for every new buffer type before assuming a Teleport "just works."
- **Phase 2 — Buffer panels.** Fixed real 2D floating windows (opened via
  `showBuffer()` from inside a Teleported buffer, e.g. clicking a native-screen link)
  painting invisible behind the 3D overlay — root cause was a z-index race, fixed by
  `buffer-window-guard.ts`'s `MutationObserver`. Added a second panel, `XIT CALC`
  (a cross-origin iframe), to test iframe-in-CSS3D. **Not fully closed:** the CALC
  iframe's content still doesn't paint (matches a known, longstanding Chromium/three.js
  bug class — cross-origin iframe content failing to composite under a CSS3D
  `matrix3d` transform; no canonical upstream fix). A scoped mitigation (forced
  reflow-on-load nudge) was added in `buffer-panel.tsx` but its effect is unconfirmed.
  **This is intentionally low priority** — only two minor features in the whole
  extension use iframes at all, not worth more investigation time without a specific
  reason to revisit.
- **Phase 3 — Region hologram.** `hologram.ts`'s `buildHologram()` — one-shot,
  non-reactive snapshot of the player's home star sector, stars colored by type,
  connection lines drawn. Floats at room center `(0, 1.4, 0)`. Live-verified.
- **Phase 4 — Ship hangar.** `hangar.ts`'s `buildHangar()` — placeholder ship meshes
  (no real 3D ship models exist in PrUn data), sized off real cargo-hold capacity since
  `Ship` has no type/class field. Live-verified, including a follow-up fix
  (`HANGAR_DISPLAY_HEIGHT`) after ships were found sitting almost on the floor,
  invisible without an extreme camera pitch.
- **Phase 5 — Polish.** Room aesthetics (distinct ceiling material, procedural
  panel-line texture, cooler lighting), a delayed loading indicator for the dynamic
  import, and WASD acceleration/deceleration smoothing — all shipped. **Movement
  smoothing could not be live-verified** in this harness (see reusable facts below).
  A first combined-scene FPS check (room + hologram + hangar + 2 panels together)
  measured 4-5 FPS, but this was root-caused to the test browser having no real GPU,
  not a real performance problem — see below.

### Reusable facts for future work (both tracks)

- **Pointer lock is broken under this CDP/Playwright harness.**
  `src/game-3d/test-controls.ts` exposes `window.__rpGame3DTest.{rotate,move}` (driven
  by `pw-act.mjs`'s `game3d-test-rotate`/`game3d-test-move`) as a bypass for camera
  turning/movement in tests. It calls `PointerLockControls` methods directly, so it
  proves geometry/rendering/position but **cannot** exercise any app-level logic gated
  on `controls.isLocked` (e.g. `movement.ts`'s WASD smoothing, and — relevant for the
  Expansion track — anything that only activates in "walk mode"). That class of change
  needs a human with a real mouse.
- **This test browser has no real GPU** — WebGL runs on `SwiftShader` (a software
  rasterizer), confirmed via `pw-act.mjs webgl-renderer-info`. Any FPS number from this
  harness (`pw-act.mjs fps-check [seconds]`) needs that check alongside it before being
  treated as a real perf signal — software rendering is expected to be 10-50x slower
  than real GPU hardware. This is specific to this local Playwright/WSL2 setup, not
  something that extends to real users' normal desktop browsers (which get standard
  hardware-accelerated WebGL).
- **Ambient Vue context varies per buffer.** Some buffers (e.g. `INV.vue`) need plugins
  like `tileStatePlugin` installed on an ancestor to avoid throwing on mount. Check each
  new buffer candidate individually — don't assume a clean Teleport.
- **A blank/unpainted CSS3D iframe panel doesn't mean it failed to load** — check the
  DOM for the buffer's own loading-state indicator (e.g. `CALC.vue`'s `LoadingSpinner`)
  to distinguish "never loaded" from "loaded but not painted" before debugging the
  wrong layer.
- **Cutting a real opening in a box-room wall:** hide that face's material
  (`visible: false`) rather than removing/rebuilding the box geometry itself, then
  reconstruct the surrounding wall as separate freestanding frame meshes using
  `DoubleSide` — `BackSide` (used by the shared wall material, since the camera sits
  inside the box looking out) would cull those standalone frame boxes' room-facing side.
  First used for Expansion Phase 6's viewscreen window; reusable for any future wall
  opening.
- **Real native 2D game DOM can be reparented into a CSS3D panel, not just Vue-Teleported
  content.** A single `appendChild`/`replaceChildren` move (not a clone) preserves DOM
  identity, so Vue's own reconciliation on the moved subtree (status text, log lines,
  button `disabled` state) keeps patching correctly wherever the node ends up — and the
  game's own (non-Vue) window/tile manager tolerated the move too, with zero console
  errors across open/interact/close. Two conditions made this work, both worth keeping:
  park the source window off-screen (`position: fixed; left/top: -9999px`) rather than
  hiding it some other way, and close it later via its own real close button
  (`closePrunWindow()`) rather than assuming it can just be discarded — its body may be
  empty after the move, but the header/close control is untouched. First proven for
  Expansion Phase 7's control-surface (a real `XIT ACT` window); reusable for any future
  feature needing genuine native-window behavior a synthetic Teleport can't provide.
- **Reparented real-DOM content can rely on percentage-height ancestor chains that
  collapse to 0 under a CSS3D panel's `auto`-height container.** Unlike Teleported Vue
  screens (which size themselves intrinsically off their own content), real native
  window DOM was built assuming a window of a known pixel size — give any panel hosting
  reparented real DOM an explicit `heightPx` in `createPanelShell`, don't assume it can
  be omitted the way normal screens omit it. Found via Expansion Phase 7 (a panel
  collapsing to an unreadable ~36px sliver until this was set).
- **Spawn always faces -Z (three.js's default camera forward), not whichever wall a new
  feature gets added to.** The console arc/hologram sit toward -Z, so anything meant to
  be seen without turning around belongs on -Z too — the old wall-mounted `hangar.ts`
  and Phase 6's viewscreen (initially, until corrected the same day) both learned this
  the hard way by launching on +Z, behind spawn. Don't assume "spawn faces it" for
  anything placed on a wall without checking which side -Z actually is.
- **A `MutationObserver` callback on `document.body` fires only after the synchronous
  DOM-mutation batch that triggered it completes** — so a newly-added element's own
  synchronous mount-time side effects (e.g. `TileAllocator`'s tile split into
  `Node.node`/`Node.child`, which the source establishes happens at mount, not on a later
  click) are already done by the time the observer callback runs. That means a
  **synchronous** existence check (`_$`, not the indefinitely-waiting `$` — see
  `docs/dom-helpers.md`) inside the callback is enough to tell "did this really split"
  from "this is some other kind of window that will never split," with no polling or
  timeout needed. First used by Expansion Phase 9's `control-surface-router.ts` to detect
  `ExecuteActionPackage` windows opening dynamically; reusable for any future
  MutationObserver-based detection of another component's synchronous mount behavior.
- Files: `room.ts` (room geometry, `ROOM_HALF`/`ROOM_HEIGHT`/`EYE_HEIGHT` constants),
  `movement.ts` (WASD), `Renderer.ts` (`DualRenderer`, WebGL+CSS3D combo, overlay
  z-index), `buffer-panel.tsx` (`createPanelShell` — reusable CSS3D screen
  boilerplate — plus the INV/CALC panel constructors), `buffer-window-guard.ts`
  (2D-window z-index fix), `hologram.ts`, `hangar.ts`, `overlay.ts` (mode hint + EXIT
  button), `test-controls.ts` (test bypass), `Game3D.ts` (orchestrates
  everything + render loop), `index.ts` (`launchGame3D()`, idempotent toggle),
  `game-3d-launcher.ts` (`toggleGame3D()`, the single dynamic-import seam).

---

## Expansion: Bridge / Operations Center

Starts 2026-07-25. Goal: turn the spike's "a room with some panels in it" into an
actual bridge — multiple purpose-built consoles arranged around the central hologram,
a real interaction system for walking up to and using one, and (eventually) the visual
polish to make it feel like a starship bridge rather than a tech demo.

### Decisions already made for this track — don't relitigate without new evidence

- **Layout: arc facing center.** Consoles curve around facing inward toward the room
  center (where the hologram floats) — crew stations facing a plot table, not panels
  bolted to flat walls. This supersedes the spike's flat-wall-mounted INV/CALC
  placement; both get repositioned into the arc as part of Expansion Phase 1. The
  hangar is not interactive and can stay on its own wall as a non-interactive showcase,
  separate from the operational arc.
- **Focus model: press E to focus in place.** Walk up, face a console, press E:
  pointer unlocks, that console's screens become clickable, camera stays put. Press E
  again (or walk away) to return to walk mode. A per-console-scoped version of the
  spike's existing global click-to-lock/unlock pattern, not a new interaction paradigm.
- **Console data model is declarative, not bespoke-per-console.** One
  `ConsoleDefinition` shape (id, purpose label, position, rotation, `themeColor`,
  `screens: [{ command, widthPx, heightPx }]`, 2-4 entries) consumed by one generic
  `createConsole(definition)` builder. The spike's `createBufferPanel()`/
  `createCalcPanel()` were one-off functions — fine for 2 panels, not for a full
  console roster.
- **The console's control-surface screen (action-runner log + Act + Skip buttons) is
  reserved in the data model from Expansion Phase 1, but not wired to a real component
  until Expansion Phase 4.** It's a separate field from the main `screens` array, not
  another entry in it. Deliberately split into two risks tackled one at a time: "does
  walk-up-and-interact work at all" (Expansion Phase 2, using buffers already proven
  simple) vs. "does the real `XIT ACT` component behave correctly when Teleported"
  (its own investigation, same category of risk the CALC iframe saga turned out to be).
- **`themeColor` (or equivalent) is reserved in `ConsoleDefinition` from day one**, even
  before Expansion Phase 5 renders anything with it — cheap now, costs a data-model
  change later if skipped.
- **Interaction hitboxes are separate objects from visual housing meshes.** The
  `Raycaster` in Expansion Phase 2 checks against a simple invisible hitbox per
  console, not whatever geometry the housing ends up being — so Expansion Phase 5 can
  redesign the physical console model freely without touching interaction code.

### Expansion Phase 1 — Console data model & refactor

Define `ConsoleDefinition` and the generic `createConsole()` builder (reusing
`createPanelShell` from `buffer-panel.tsx` for the actual CSS3D screens). Refactor the
existing INV and CALC panels into this shape as the first two consoles, and reposition
them into the arc-facing-center layout (a `room.ts`/`Game3D.ts` layout change, not just
a code reshape). Housing mesh stays a plain placeholder frame at this stage — no visual
investment yet. **Done, live-verified 2026-07-25.** `console.ts` (`ConsoleDefinition`,
`createConsole()` — resolves each screen via the `xit` registry (`xit.get(command)`)
rather than hardcoded per-command imports, so Expansion Phase 3's full roster is pure
data, no new panel-constructor code per console) + `console-roster.ts` (arc math,
`buildConsoles()`). INV and CALC are now freestanding (off the walls) on a 140° arc,
radius 3.0, centered on the room's front-center, at ±70°. The CALC-specific
iframe-repaint workaround (Phase 2 of the spike) was generalized into
`attachIframeRepaintWorkaround()` in `buffer-panel.tsx`, applied to every console screen
unconditionally — cheap since it's a no-op when no iframe is present, and needed since
any future XIT command screen could render one. `themeColor` and `controlSurface` exist
in `ConsoleDefinition` per the day-one decision above, unconsumed until Phase 5/4
respectively.

### Expansion Phase 2 — Interaction system

`Raycaster` from camera-forward each frame, checked against each console's hitbox,
driving a state machine (nothing → "facing console: <purpose>, press E" → focused).
Wire the E key to toggle focus (pointer unlock/lock, overlay prompt), scoped to
whichever console the player is facing — reusing the spike's existing lock/unlock
overlay-hint pattern (`overlay.ts`) rather than replacing it. Prove this with just the
2 consoles from Expansion Phase 1 before scaling up. **Code done 2026-07-25, NOT yet
human-verified.** New `interaction.ts` (`createInteraction()`, factory-function style
matching `movement.ts`) owns the whole state machine and now owns the
`controls`/`'lock'`/`'unlock'` event wiring too (moved out of `Game3D.ts`). Each
console's hitbox (`console.ts`) is a separate invisible mesh from its housing, per the
day-one decision. `overlay.ts` gained a `'focused'` mode and `setFacing()` for the
walk-mode "Facing X · Press E" sub-hint. **Verification gap found, not yet closed:**
`game-tester` confirmed the code loads and the FLT/INV consoles still show live data
with zero regressions, but discovered that `interaction.ts`'s `update()` (the
raycast/facing-detection step) is gated on `controls.isLocked`, and pointer lock never
actually flips true under the CDP/Playwright harness even via the `test-controls.ts`
rotate bypass — so *even the facing-text detection*, not just the E-focus toggle, could
not be automatically verified this session, contrary to the assumption when this phase
was scoped that facing-detection wouldn't depend on real lock. **Needs a human with a
real mouse** to confirm: (1) the "Facing `<purpose>` · Press E to interact" hint
actually appears on approach, (2) E enters/exits focused mode correctly, (3) Escape's
old generic-interact fallback still works when nothing is focused. Do this before
starting Expansion Phase 3.

### Expansion Phase 3 — Full console roster

Add the remaining consoles with real purposes and real XIT commands per screen (e.g.
Base Planning, Fleet Ops, plus whatever else earns a station). Each new buffer type
needs the Phase-1-established ambient-context check before assuming it Teleports
cleanly. Re-run a combined-scene sanity/perf pass once the full roster is live,
remembering the SwiftShader/no-real-GPU caveat above — don't chase FPS numbers from this
harness without a renderer check alongside them. **Done, live-verified 2026-07-25.**
Roster is now 4 consoles on the arc: `inv` (Inventory, unchanged), `baseplanning`
(Base Planning — BS + PROD, two screens), `companyops` (Company Ops — CONTS + FIN, two
screens), `flt` (Fleet Ops, unchanged). BS/PROD/CONTS/FIN all passed the ambient-context
check (grepped their entire component folders, not just the top-level `.vue` file, for
`useTile()`/`useXitCommand()`/raw `inject()` — none found; `useXitParameters()` is safe
without a provider since it falls back to `[]`). `DISPATCH` was considered and rejected
as a candidate — its `.vue` calls `useTile()` (`inject(tileKey)!`), which we don't
provide, so it would throw on mount; revisit only if `createConsole()` is extended to
also provide `tileKey` with a synthetic tile.

**Real bug found and fixed, not just a data problem:** the initial 4-console layout had
severe overlap across every screen — traced to `SCREEN_SCALE`, which was `0.01`
(pixel→world) in both `buffer-panel.tsx` and `console.ts` as two independent literals
that happened to match. That value was a leftover from the original spike, where it was
correct — panels were mounted flat on 5-unit-radius walls, meant to read as wall-sized
screens. Expansion Phase 1 changed the geometry model to freestanding human-scale
consoles at radius 3.0 without revisiting this constant, so a 700px panel was rendering
7 world-units wide in a 10-unit room — almost certainly already overlapping in Phase
1/2's 2-console layout too, just not caught because only 2 widely-separated,
differently-rotated consoles didn't make it visually obvious. Fixed by exporting one
`SCREEN_SCALE` constant from `buffer-panel.tsx` (now `0.0016`, tuned so a 700px panel
reads as ~1.1 world-units — a console monitor, not a movie screen) and having
`console.ts` import it instead of holding its own copy. Re-verified with
pixel-measured (not `getBoundingClientRect` — see `docs/browser-testing-3d.md` for why)
bounding boxes: no overlap between any of the 6 screens, the hologram, or each
multi-screen console's own two screens; text still legible after the ~6x size
reduction.

### Expansion Phase 4 — Functional control surface

Wire the reserved control-surface screen to the real action-runner component(s) under
`src/features/XIT/ACT/` (log display, Act button, Skip button) on whichever consoles
need it. Confirm the ambient-context check and the "explicit click gates server
communication" rule (`docs/contributing.md`) both hold for the Teleported version, same
as any other buffer. **Blocked — investigated 2026-07-25, needs a design decision before
implementation starts.** `ExecuteActionPackage.vue` (the real Act/Skip/log component) is
not a display-only buffer like every other console screen so far — its `ActionRunner`
constructs a `TileAllocator` (`runner/tile-allocator.ts`) that, on construction,
inspects `tile.container.classList` for real window/node DOM ancestry
(`C.Window.body`, `C.Node.child`) and calls `showBuffer()`/`setBufferSize()`/simulated
clicks to open and drive **real native 2D PrUn buffer windows** as part of executing
action steps. It needs a genuine `PrunTile` wired into the live 2D tile-management DOM,
not the synthetic tile-ID string `createConsole()`'s `tileStatePlugin` bridge currently
fakes. Teleporting it as-is throws immediately (`tile.container` undefined) or worse.
Two real paths forward, neither attempted yet: (a) back the control-surface screen with
an actual live 2D `XIT ACT` buffer (opened hidden via `showBuffer()`) and reflect that
real instance into the 3D panel instead of an independent Teleport, or (b) refactor
`TileAllocator` to support a non-DOM-backed mode — touches code real users depend on for
live trading/production actions, higher regression risk. User chose to skip to Phase 5
rather than pursue this now; revisit as its own dedicated investigation.

### Expansion Phase 5 — Visual polish (bridge vibe)

Real console housings (angled podium/desk instead of a flat rectangle), per-console
accent lighting/color driven by the already-reserved `themeColor`, floor markings or
whatever else sells the "operations center" feel. Deliberately last, so it lands on a
proven interaction skeleton instead of getting reworked when the interaction model
changes underneath it. **Done, live-verified 2026-07-25.** `console.ts`'s flat
placeholder `housing` plate replaced with four meshes per console (all children of the
same group, inheriting its arc position/rotation): `pedestal` (floor-to-under-screens
support column), `desk` (a thin ~14°-tilted shelf just under the screens, reading as a
console podium surface), `floorMarker` (a tinted floor disc), and `accentLight` (a
low-intensity, short-range `THREE.PointLight` tinted with the console's `themeColor`).
`hitbox` (interaction raycasting) was untouched, confirming the Phase 1 decision to keep
it independent of the visual housing paid off — no interaction-code changes needed for
this visual redesign. Verified via `game-tester`: no clipping/z-fighting, all 4 consoles
read as podiums rather than flat plates, accent lights correctly tinted per console and
not overpowering, screens still live.

### Expansion Phase 6 — Hangar viewscreen (docking-arms diorama)

**Done, live-verified 2026-07-25.** Replaced the wall-mounted `hangar.ts` display
(placeholder ships sitting on a flat surface, compact/toy scale) with a window looking
out into a distant space diorama: a station with spindly docking arms that the player's
fleet is attached to, seen through an opening in the room's wall — not a flat screen
rendering data. `buildHangar()` itself was left in place (still exported, just no longer
called from `Game3D.ts`) since its ship-mesh construction was extracted into a shared
`buildShipMesh(length, hullMaterial, bridgeMaterial)` helper that the new diorama reuses
at a much larger scale — the user resolved the "coexist or replace" open question in
favor of replace, so ships now only appear in the new diorama.

Implementation, delegated to Grok per `AGENTS.md`'s DELEGATION section (diff matched the
brief closely, one TS fix needed for a const comparison):

- `room.ts`: a wall's box face is `visible: false` — a true geometry hole, not a texture
  trick — and rebuilt as 4 freestanding framing boxes (top/bottom/left/right; new
  exported constants `WINDOW_WIDTH` (4), `WINDOW_HEIGHT` (2.2), `WINDOW_CENTER_Y` (1.8))
  using `DoubleSide` material (BackSide, used by the rest of the box-interior walls,
  would have culled the inward-facing side of these separate boxes). **Originally built
  on the +Z face, moved to -Z** in a same-day follow-up (see below) — the opening is on
  whichever wall the console arc sits near, not the one behind spawn.
- `viewscreen.ts` (new): `buildViewscreen()` assembles a starfield (`THREE.Points`, ~1200
  stars on a sphere shell radius 120-180), a sun (additive-blended `Sprite` with a
  radial-gradient canvas texture, same offscreen-canvas idiom as `room.ts`'s
  `createPanelTexture`), and a station (stacked-cylinder hub + 5 arms radiating at even
  72° spacing, ships attached via `buildShipMesh()` at length 4-8, one per arm up to
  however many ships the company has — a mood diorama, not a literal 1:1 fleet
  inventory like the old hangar was). Builds the station even with zero ship data.
- `Game3D.ts`: swapped `buildHangar()`'s wall placement for `buildViewscreen()`
  (originally at `(0, 1.2, ROOM_HALF + 45)`, moved to `(0, 1.2, -(ROOM_HALF + 45))` — see
  below), and widened the camera far clip plane from 100 to 300 so the diorama/starfield
  aren't clipped.

**Live-verified via `game-tester`:** no console errors across an extended session;
opening reads unambiguously as "wall with a window," not a solid or fully-missing wall;
starfield/sun/station are all distinct and visible through it; rest of the room (other
walls, floor, ceiling, hologram, consoles) unaffected — confirmed via a full 360° sweep.
`SwiftShader` software rendering confirmed again (same caveat as every prior FPS number
in this doc). One cosmetic, non-blocking finding survives from that first pass: **only
~2 of the 5 station arms read as distinct ships from straight on** — the even 72°
spacing means most arms point toward/away from the camera rather than laterally, so
they're mostly hidden behind the hub from the default straight-through-the-window
viewing angle. Not fixed; revisit by biasing arm angles toward more lateral spread if a
future session wants more ships readable at a glance.

**Same-day follow-up fixes (session (9) below), from human playtesting with a real
mouse** — all three delegated to Grok, all confirmed by `game-tester`:

- **Window wall was wrong.** The initial build put the opening on +Z, which turned out
  to be *behind* spawn when facing the console arc (spawn faces -Z by default, toward
  the consoles — see the "Reusable facts" list above) — the opposite of "beyond the
  consoles." Moved to -Z: `room.ts`'s material-array indices swapped (index 4 → solid,
  index 5 → open) and `frameZ` negated; `Game3D.ts`'s `viewscreen.position` Z term
  negated to match. Confirmed: spawn's default forward view now shows the console arc
  *and* the diorama beyond it together, with no turn required; the +Z wall (now behind
  spawn) is solid with no leftover opening.
- **Console desk (`console.ts`) tilted the wrong way** — read as a ramp rising toward
  the player instead of a podium surface sloping down toward them. Fixed by flipping
  `desk.rotation.x` from `-0.25` to `0.25`. Confirmed via geometry math (the tilt is too
  subtle a rotation on a thin 0.06-unit box to read reliably from screenshots at this
  scale/distance) rather than pixel inspection alone.
- **Console screens could grow taller than the desk.** Data-heavy screens (INV, FLT,
  etc.) size to their real content, which can extend past the desk since screens are
  vertically centered at local Y=0. Added a hard cap: new `SCREEN_MAX_HEIGHT_WORLD =
  0.7` constant (`console.ts`) converted to pixels and passed to `createPanelShell`
  (`buffer-panel.tsx`, gained an optional `maxHeightPx` param → CSS `max-height` +
  `overflow-y: auto`), applied uniformly to every screen. Confirmed via computed-style
  inspection: all 6 screens show `max-height: 437px`; INV/BS/PROD/FIN (whose content
  exceeds that) are correctly clamped with a scrollbar, CONTS/FLT (short enough content)
  are unaffected — no artificial clamping when it isn't needed.

**Harness trap hit during this verification, not a product bug:** the game tab was
running a stale module from before the follow-up `build:fast`, even though `dist/` on
disk already had the fix — `reload-extension` was required before the wall-swap showed
correctly. See `docs/browser-testing-3d.md`'s Gotchas section for the general rule this
produced.

Design decided in conversation with the user 2026-07-25, before any code was written:

- **Real 3D geometry placed far outside the room, seen through a wall opening — not a
  rendered/textured screen.** The user was explicit that a flat "screen displaying
  data" is not what they want here; it needs to feel like looking out a window at
  something actually there, sharp and dimensional, not "cheap and dull." Reuse the
  existing single-camera/single-scene render pipeline (`Renderer.ts`) — no
  render-to-texture, no second camera or scene. The diorama is genuine WebGL geometry
  positioned well outside the room (roughly 40-50+ world units past the wall, exact
  number TBD at implementation time) and made visible through an opening cut into the
  wall geometry.
  - **Known unsolved technical step, flagged honestly rather than hand-waved:**
    `room.ts`'s walls are currently one solid `THREE.BoxGeometry` per room (six-material
    box). Cutting a window into a face of that isn't a simple property change — it
    likely needs either splitting that wall into separate segments with a gap between
    them, or a `THREE.Shape`-with-a-hole via `ExtrudeGeometry`/`ShapeGeometry`, or a
    frame mesh that merely looks like an opening. Whoever picks this up should treat
    "how does the wall get an opening" as the first implementation question, not assume
    it's trivial.
- **Ships attached to spindly station docking arms**, not sitting on a flat surface.
  A station hub with several thin radiating arms (procedural primitives — `BoxGeometry`/
  `CylinderGeometry` composition, the same no-external-models idiom already used
  throughout `room.ts`/`hangar.ts`/`console.ts` — don't introduce asset loading), each
  arm terminating in a ship. Reuse/scale up `hangar.ts`'s existing placeholder
  hull+bridge ship-mesh construction rather than designing new ship geometry from
  scratch.
- **Significant scale.** Ships and station should read as large and distant — a
  deliberate departure from the current hangar's compact, close-up, toy-model scale.
  This pairs with the "seen through a window, far outside the room" placement above.
- **"Cold space" mood:** a dark starfield backdrop, and a glowing sun in the distance.
- **Sun glow via a billboarded sprite using a procedural radial-gradient canvas
  texture** (same technique as `room.ts`'s `createPanelTexture` — draw a gradient to an
  offscreen `<canvas>`, wrap it as a `THREE.CanvasTexture`), **not** true bloom
  post-processing. Real bloom needs an `EffectComposer` pass added to `Renderer.ts`'s
  render pipeline — meaningfully more rendering infrastructure than a single glowing
  dot warrants; a bright emissive sprite with a soft falloff texture gets a
  similar-reading glow far more cheaply.
- **Relationship to the existing `hangar.ts` is undecided** — whether this replaces it
  outright or the two coexist wasn't resolved in this conversation. Decide at
  implementation time; not a blocker to writing the rest of this design down.
- Not yet scoped: exact wall-opening location/size, exact diorama distance/scale
  numbers, how many docking arms/ships to show, whether the starfield is a skybox,
  point cloud, or something else. First implementation session should read this section,
  then work through those specifics the same way Phase 1-5 sessions worked through
  their own numeric/layout unknowns (build, verify with `game-tester`, adjust).

### Expansion Phase 7 — Functional control surface

**Done, live-verified 2026-07-26.** Confirmed with the user before implementation (they
approved proceeding as scoped, with one added requirement folded in below). Unlike
Phases 1-6, this phase started as the assistant's own suggestion rather than a
user-driven design — see the original proposal rationale kept below for context.

**Why this over other candidates:** every other plausible "what's next" (more consoles,
hologram interactivity, ambient audio/sound design, further visual polish, a second
walkable area) is incremental garnish on a bridge that already works. Phase 4
("Functional control surface") is the one piece of the original Vision
("a control-surface screen for running action packages") still entirely unimplemented —
consoles are read-only today, they can't act. It was investigated once (2026-07-25),
found genuinely blocked on an architecture question, and explicitly deferred twice
since (skipped for Phase 5, skipped again for Phase 6). This is that investigation's
own two-paths-forward finding, picked up as its own phase rather than left open
indefinitely.

**Approach — resume Phase 4's path (a), not (b).** Path (a) (see Phase 4 above): back
the control-surface screen with a REAL, live 2D `XIT ACT` buffer window — opened via the
same `showBuffer()` call every native screen link already uses — instead of an
independent synthetic Teleport. This keeps the window a genuine DOM/tile-manager
citizen, so `TileAllocator`'s `tile.container.classList` ancestry checks
(`C.Window.body`, `C.Node.child`) pass unmodified; **zero changes to
`runner/tile-allocator.ts`or any other code real users depend on for live
trading/production actions.** Path (b) (refactor `TileAllocator` itself) stays rejected
for the same reason Phase 4 rejected it: touching that code is a real-money-action
regression risk this track shouldn't take on for a cosmetic/UX feature.

**User requirement added during confirmation (2026-07-26), not in the original
proposal:** the control-surface screen must show the ACT buffer's real companion tile
alongside it, not just the control panel in isolation — a player needs to see what
they're about to execute, not just an Act/Skip button in a vacuum. This shaped the
implementation below: the whole split (`Node.node`, both `Node.child` tiles), not just
the first tile, gets reparented as one panel.

**What shipped:**

1. **Devtools spike (no code)**: via `game-tester`, opened `XIT REFUELACT` as a plain
   native window (`pw-act.mjs open-buffer "XIT REFUELACT"`) and inspected the DOM.
   Confirmed `TileAllocator`'s mount-time split fires synchronously, with zero console
   errors: `Window.body` → `Node__horizontal Node__node` → two `Node.child` divs, first
   holding the real ACT tile (`PREVIEW`/`EXECUTE`, no `CONFIGURE` needed for this
   package), second an empty/unconfigured placeholder tile (the companion `ActionRunner`
   later fills via `ctx.requestTile()` mid-run). Mounting alone never touches the
   server — only `PREVIEW`/`EXECUTE`/`ACT`/`SKIP` clicks do — so this observation step
   was itself inert.
2. **DOM re-parenting — the open technical bet paid off.** New
   `src/game-3d/control-surface.ts`'s `createControlSurfacePanel()`: opens the real
   window via `showBuffer()`, parks it off-screen (`position: fixed; left/top: -9999px`
   — never visible as a floating 2D window), awaits the `Node.node` split wrapper via
   the global `$()` helper, then `targetDiv.replaceChildren(node)` — a single DOM move,
   not a clone. Vue's own reconciliation (status text, log lines, ACT/SKIP `disabled`
   state) kept patching correctly post-move, confirming the plan's optimistic bet about
   Vue's DOM-reference-based patching. The pessimistic worry — the game's own
   (non-Vue) window/tile manager choking on content moved out of its window — didn't
   materialize either: `game-tester` found no console errors across enter → navigate →
   `PREVIEW`-click → exit, and exiting 3D mode (which calls `closePrunWindow()` on the
   parked, now-empty window) closed cleanly with no leftover floating window. The
   mirror-only fallback was never needed.
3. **One real bug found and fixed along the way**: the first live pass showed the
   reparented split panel collapsing to a ~36px unreadable sliver. Root cause: the
   `controlSurface` roster entry had no `heightPx`, so `createPanelShell`'s `targetDiv`
   got `height: auto` — but the reparented native-window DOM depends on a
   percentage-height ancestor chain (it was built assuming a window of a known pixel
   size), and percentage heights resolve to 0 against an `auto`-height ancestor. Fixed
   by giving `controlSurface` an explicit `heightPx: 420` (`console-roster.ts`), same
   requirement `screens` entries don't have since Teleported Vue content there sizes
   itself intrinsically. **Any future control-surface console needs this same explicit
   `heightPx`** — don't assume it can be omitted like a normal screen.
4. **Wired ONE console only**: `baseplanning`'s roster entry gained
   `controlSurface: { command: 'XIT REFUELACT', widthPx: 900, heightPx: 420 }`.
   `REFUELACT` is a placeholder/testbed package chosen for being generic and
   already spike-verified to open cleanly — it isn't semantically tied to base
   planning. Swapping in a real base-linked action package is unstarted follow-up work,
   not part of what this phase proved. `inv`/`companyops`/`flt` are untouched.
5. **Real-money-action caution held throughout testing**: both `game-tester` passes
   only clicked `PREVIEW` (confirmed local-only per `docs/xit-act-patterns.md` — computes
   steps, no server call) to prove interactivity survives the reparenting; `EXECUTE`,
   `ACT`, `SKIP`, `CANCEL` were never clicked.

**Known non-blocking limitation**: the companion tile (second `Node.child`) renders as
the game's own generic "empty tile" diagonal-hash placeholder until a running package
actually calls `ctx.requestTile()` — expected given `REFUELACT` is a placeholder package
this session never executed, not a rendering bug. A future session wiring a real
base-linked package (or manually walking one step of a run, human-confirmed) would be
needed to see the companion tile show real content.

### Expansion Phase 8 — Real control-surface content

**Done, live-verified 2026-07-26.** User resolved the three open questions below before
implementation: (1) fixed real package, not the player's own staged packages — smaller
scope, matches Phase 7's mechanism; (2) `baseplanning`'s `REFUELACT` mismatch (see Phase 7)
resolved by **relocating** the control surface to `flt` instead of building a new
base/production action type — `REFUELACT` is genuinely a fleet action (its trigger button
lives on `FLT.vue`'s Fuel column in the normal 2D UI), so once moved it's no longer a
placeholder, it's the real, correct fit; (3) stay at one console, don't roll out further
this phase. Net change: `console-roster.ts`'s `controlSurface` field moved from
`baseplanning` (now back to just its BS/PROD screens, no control surface) to `flt`
(now FLT screen + the `XIT REFUELACT` control surface) — same command, same
`heightPx: 420` requirement, zero changes to `console.ts`/`control-surface.ts`/anything
else, since Phase 7 already built the mechanism generically. Pure roster data, implemented
directly rather than delegated to Grok (same precedent as Phase 3). `game-tester`
confirmed: `baseplanning` shows exactly 2 screens with no control panel; `flt` shows FLT +
a working "REFUEL ALL EXCHANGES" control surface (real ACT log, PREVIEW/EXECUTE/SKIP,
companion tile); PREVIEW produced real computed local steps; zero console errors; clean
exit with no leftover floating window. Only `PREVIEW` was clicked (server-communication
rule); `EXECUTE`/`ACT`/`SKIP` still need a human-confirmed click before the companion tile
would ever show real (non-placeholder) content — this remains the one still-open item if
a future session wants to see that end-to-end.

Original proposal (kept for context on how the questions below were framed):

**Why this over other candidates:** Phase 7 proved the *mechanism* (a real ACT window's
DOM can be reparented into a console, both tiles visible, cleanly disposed) but
deliberately used a placeholder package (`XIT REFUELACT` on `baseplanning`, chosen only
because it was already spike-verified and needed no per-row parameters) that isn't
semantically tied to base planning and isn't something the player actually asked to run.
The companion tile also only ever shows the game's generic empty-tile placeholder,
because nothing has ever executed against it. Making the control surface feel like part
of the *actual* bridge experience — not a tech-demo package sitting on a console it
doesn't belong on — is the natural next step now that the plumbing is proven.

**Open questions to resolve before implementation, not yet decided:**

1. **Fixed demo package vs. the player's own real package?** The original Vision text
   ("a control-surface screen for running action packages") reads as the player's own
   packages, not a hardcoded demo — but that's a meaningfully bigger feature: it means
   surfacing whatever the player has staged/saved (per the `DISPATCH`/`GOVBURN`
   `staged.ts` module-level-ref pattern documented in `docs/xit-act-patterns.md`) rather
   than a fixed `pkg` object like `RefuelActWindow.vue`'s. Decide which this phase is
   actually building before writing code — they're different scopes.
2. **What's the right package for `baseplanning` specifically?** Investigate whether a
   base-production-linked one-click package already exists or needs to be built (the
   existing one-click packages — `BURNACT`, `REFUELACT`, `GOVBURNACT` — are all
   ship/fleet actions, not base/production ones). A production-queue action package
   would be the natural fit given `BS`/`PROD` are already on that console.
3. **Roll out to the other three consoles, or stay at one?** `inv`, `companyops`, `flt`
   don't have a control surface yet. Each would need its own natural package pick
   (e.g. `flt` pairs naturally with the existing ship-fleet packages) — worth doing only
   once question 1 is settled, so it isn't rolled out three more times under the wrong
   model.
4. **Verification will eventually need a real EXECUTE**, once real content is wired —
   unlike Phase 7 (which only ever needed `PREVIEW`), confirming a real package's
   companion tile populates correctly requires actually running at least one step. Per
   `docs/contributing.md`'s server-communication rule, that must be a human-confirmed
   click, not something `game-tester` does unsupervised — plan the verification pass
   around that constraint from the start rather than discovering it mid-session.

### Expansion Phase 9 — Generic dynamic control surface (supersedes Phase 7/8's fixed-package model)

**Done, structurally verified 2026-07-26; dynamic capture itself still needs a human.**
User rejected Phase 8's premise (a fixed package hardcoded per console, `MTRAACT`/
`CONTTRADEACT` built new) after clarifying two things: (1) the "quasi-preconfigured
action package" candidates they actually wanted — `RESUPPLYACT` (the command is
literally `BURNACT`, titled "BURN RESUPPLY") and `REPAIRACT` — already exist and are
both per-base actions triggered from `BS.vue`'s `BaseRow.vue` (`RES`/`REP` buttons,
`showBuffer('XIT BURNACT <naturalId>')`/`showBuffer('XIT REPAIRACT <naturalId>')`); no
new action type needed. (2) More importantly, consoles shouldn't be tied to *any*
specific command at all — stated design intent for the long term is **player-configurable
console screens**, so hardcoding a package per console (what Phase 7/8 did) works against
that goal. Instead: every console gets a generic **dormant** control-surface slot: idle by
default, and dynamically activated whenever the player triggers a real action-package
window from one of that console's own screens while that console is focused — not wired
up front. Confirmed this reframing is architecturally sound before writing code (traced
`interaction.ts`'s existing focused-console tracking, `buffer-window-guard.ts`'s
MutationObserver technique, and `tile-allocator.ts`'s `Window.body`/`Node.node`/
`Node.child` split classes as the building blocks).

**What shipped**, delegated to Grok per `AGENTS.md`'s DELEGATION section (brief:
`.local/scratch/phase9-control-surface-router-brief.md`; diff matched it closely, no
rework needed):

- `ConsoleDefinition.controlSurface` removed entirely — no roster entry (including
  `flt`'s prior `XIT REFUELACT`) references a command for its control surface anymore.
  `createConsole()` now unconditionally gives every console one identical
  `CONTROL_SURFACE_WIDTH_PX`/`CONTROL_SURFACE_HEIGHT_PX` (900×420) dormant slot.
- `control-surface.ts` rewritten from "open a specific command and reparent it" to
  `createControlSurfaceSlot()` — just builds a placeholder ("No action running") panel
  and exposes `activate(node)`/`deactivate()`/`dispose()`. It no longer calls
  `showBuffer()` itself.
- `interaction.ts` gained a `getFocusedConsoleId()` getter on its returned object (the
  focus state already existed as a private closure var — Phase 2 built it, this phase
  just needed to read it from outside).
- New `control-surface-router.ts`: a `MutationObserver` on `document.body`, same
  technique as `buffer-window-guard.ts` (mirrored, not merged/modified). On any newly
  added `.Window.window` node: if no console is currently focused, does nothing — the
  window behaves as an ordinary floating 2D window, completely untouched, exactly as
  today. If a console *is* focused, synchronously checks for a `C.Node.node` child via
  `_$` (the synchronous get-or-undefined helper — deliberately not `$`, which waits
  indefinitely and would hang forever on a window that will never split, e.g. a plain
  non-ACT buffer link clicked from inside a console's screen). If present, it's a real
  `ExecuteActionPackage` window: park it off-screen and `activate()` the focused
  console's slot with the split node. A previous capture on the same console is closed
  (`closePrunWindow`) before the new one takes over, so a rapid replace can't orphan a
  window. `dispose()` (called on 3D-mode exit) closes every still-active capture across
  all consoles, generalizing what Phase 7/8's fixed-package cleanup used to do for just
  `flt`.
- **Default behavior decided without a separate question round** (flagged to the user,
  no objection raised): walking away from a focused console leaves any active capture
  running — it is not auto-closed. Only exiting 3D mode, or triggering a *new* capture on
  that same console, tears one down. Matches the codebase's existing caution elsewhere
  about not disrupting a real action mid-run.

**Verified (`game-tester`, structural only — see next paragraph for what's still
open):** all 4 consoles (`inv`, `baseplanning`, `companyops`, `flt`) show exactly one
"No action running" panel each, trailing their normal screens; existing screens
(INV/BS/PROD/CONTS/FIN/FLT) all still show live data with zero regressions from the
shared `console.ts` refactor; no console errors; clean exit with no orphaned windows.

**Known verification gap, same shape as Phase 2's:** the actual dynamic-capture flow —
walk up to a console, press E to focus, click a real action button inside one of that
console's screens (e.g. `BS.vue`'s `RES`/`REP`), watch the resulting `ExecuteActionPackage`
window get captured into that console's slot — could **not** be exercised this session.
`interaction.ts`'s E-key handler is gated on `controls.isLocked`, and pointer lock never
actually flips true in this CDP/Playwright harness; `test-controls.ts`'s bypass only
fakes camera rotate/move, not lock state, so there is no way to drive a console into
"focused" through automation. This needs a human with a real mouse to confirm end-to-end
— same standing limitation as Phase 2's still-unconfirmed facing-hint/Escape fallback.

### KNOWN BLOCKING BUG (found 2026-07-26, not fixed) — CSS3D panel clicks mostly don't reach panel content

**Top priority for whoever picks this track up next.** Discovered by the user during
their first real-mouse attempt to click inside a console screen (previously, only
keyboard-driven state transitions — E-focus, Escape — had been human-tested; see Phase
2's history above). Symptom: while unlocked (`interact` or `focused` mode), clicking
*anywhere* on a console's screen content instantly re-locks into walk mode instead of the
click reaching the button/link underneath — this blocks essentially all mouse
interaction with buffer content in 3D mode, not just this session's Phase 8/9 testing
goals.

**Confirmed root cause via `game-tester` diagnostic** (read-only `elementFromPoint()` +
computed-style queries, no real clicks made): the `pointer-events: auto` override on each
panel's root div (`createPanelShell`, `buffer-panel.tsx`) is wired correctly — computed
style confirms it takes effect over its ancestor `css3dLayer`'s `pointer-events: none`
(`Renderer.ts`). The bug is one level down: `document.elementFromPoint()` at real screen
pixels over most panels' visible area returns the `CANVAS` element, not the panel — i.e.
Chromium's hit-test geometry doesn't agree with what it visually painted. This is
**geometry-dependent, not universal**: the one panel closest to camera (least visually
skewed) hit-tested correctly across a dense coordinate grid; every more central/distant
panel tested (larger `matrix3d` skew) hit-tested as pure canvas across its *entire*
visible area. Since `Game3D.ts`'s `onCanvasClick` re-locks on any click landing on the
canvas, a broken hit-test there reproduces the reported symptom exactly.

This is the same underlying flattening quirk already on record in
`docs/browser-testing-3d.md` for `getBoundingClientRect()` (nested `preserve-3d` +
`matrix3d`+`perspective()` geometry not matching Chromium's simplified layout-geometry
computation) — but this is a **stronger, previously-unconfirmed consequence**: that
quirk doesn't just corrupt a JS coordinate *query*, it corrupts real click *delivery*.
**This also retroactively means every earlier "PREVIEW click works" verification (Phase
7, 8) never actually tested real click interaction** — those used `element.click()`
(a direct JS method call bypassing browser hit-testing entirely), per the existing
testing-technique gotcha about coordinate clicks and the fullscreen canvas. They proved
the Vue click handler *works when invoked*, not that a real mouse click *reaches it*.

**Not fixed — user chose to flag and stop rather than scope a fix this session.** Two
candidate approaches were identified, neither attempted:

- **Cheap experiment, not guaranteed:** reduce transform extremity (tighter camera FOV,
  smaller arc radius/angles) to see whether less skew narrows or eliminates the affected
  region. Unknown whether there's a skew threshold below which Chromium's hit-test stays
  accurate, or whether this is broken at any non-trivial angle.
- **Real fix, more work:** bypass native hit-testing entirely — reuse the raycaster
  already built for console-facing detection (`interaction.ts`) to compute, in 3D space,
  exactly which panel/pixel a click's ray intersects, then dispatch a synthetic click at
  the correct DOM element ourselves rather than relying on the browser's click delivery
  through the CSS3D transform chain.

**Practical fallout for this track right now:** Phase 8's real-`EXECUTE` verification and
Phase 9's whole dynamic-capture flow (both requiring a real click inside a console
screen) are effectively **untestable by the user until this is fixed**, not merely
pending a verification pass — this supersedes those items' "needs a human" framing above.

## Open questions — resolved 2026-07-25

All four were investigated and closed; none needed a code change. Keeping the record
here rather than deleting it — future sessions shouldn't have to re-derive these.

- **Does the hangar show only the player's own ships, or fleet-mates/company ships
  too?** Already correct, and not actually a choice — `shipsStore` (`hangar.ts`) is
  built from the `SHIP_SHIPS` API message, the same source the real 2D `FLT` screen
  uses (`docs/game/screens-fleet.md`: "Table of all ships", no cross-company filter
  exists anywhere in the game or extension). PrUn's API only ever sends your own
  company's ship data to your client — other companies'/corp-mates' ships aren't
  something we could show even if we wanted to. Not a deferred design decision, a hard
  constraint. Added a one-line comment to `hangar.ts` recording this so a future reader
  doesn't have to re-derive it.
- **Any accessibility/non-desktop story?** Formally decided: accepted non-goal.
  Pointer Lock inherently requires a real desktop mouse; 3D mode is strictly opt-in
  (top-bar button + hotkey) and never replaces the 2D UI, which stays fully accessible
  for everyone who doesn't enable it.
- **Where does the on/off toggle live, and is it a userData setting?** Confirmed as
  final: the top-bar "3D" button (`game-3d-launch-button.tsx`, next to FULL) plus the
  Ctrl+Alt+3 hotkey (`main.ts`), both funneling through `toggleGame3D()`. Deliberately
  NOT a persisted `userData` setting — 3D mode is an occasional excursion, not something
  you'd want to auto-resume on every page load.
- **Single room, or could the ops-center expand to multiple/connected areas later?**
  Decided to stay single-room for the foreseeable future. No concrete feature has come
  up that needs a second area (room transitions, navigation between them, etc.) to
  justify that complexity — revisit only if one does.

## Session log

Append a short entry at the end of any session that does real work here — date, what
happened, what was learned, what's next. Read the whole log before starting work, not
just the Vision section. This is separate from running the `/distill` skill (which
captures reusable cross-session learnings into `AGENTS.md`/`docs/architecture.md`/
`.claude/skills/*`) — updating this log is normal work on this plan, not a distill run.
The Spike track's session-by-session history was condensed into the summary above
rather than carried forward verbatim — see git history on this branch for the full
narrative if ever needed.

**2026-07-25** — Restructured this doc into two tracks (Spike summary + Expansion) at
the user's request, now that work is moving from "prove the mechanics" to "build the
actual bridge." Talked through Expansion sequencing and locked in the decisions
recorded above (arc-facing-center layout, press-E-to-focus-in-place, declarative
console data model, control-surface screen reserved now but wired to the real
action-runner later, `themeColor` reserved from day one). No code written yet — next
session starts Expansion Phase 1.

**2026-07-25 (2)** — Implemented and live-verified Expansion Phase 1 (see that section
above for what shipped). Notable design decision made mid-implementation, not
pre-recorded above: `createConsole()` resolves screens generically through the existing
`xit` command registry (`src/features/XIT/xit-registry.ts`) instead of hardcoded
per-command Vue imports like the spike's `createBufferPanel`/`createCalcPanel` did —
found this registry already existed and is exactly what the real 2D XIT host uses, so
Expansion Phase 3 (full roster) becomes pure data (add a roster entry with a command
string) rather than new constructor code per console. Delegated implementation to Grok
per `AGENTS.md`'s DELEGATION section; diff matched the brief closely on first pass, no
rework needed. Next session starts Expansion Phase 2 (interaction system — Raycaster +
E-key focus).

**2026-07-25 (3)** — User feedback: CALC and (implicitly) the `WEB` shortcut commands
are poor console test subjects (a niche calculator and static web-links respectively,
not representative of a real bridge console). Swapped `console-roster.ts`'s second
console from CALC to `FLT`/`FLEET` ("Fleet Ops") — confirmed `FLT.vue` only needs
`tileStatePlugin` (same ambient context as INV), so it Teleports cleanly with no other
changes needed; this also gets a head start on Expansion Phase 3's real "Fleet Ops"
console. Then implemented Expansion Phase 2 (interaction system) per the section above
— see that entry for the verification gap found (facing-detection needs a human with a
real mouse; not yet confirmed working end-to-end, only confirmed not to have regressed
anything or thrown errors). Both changes delegated to Grok, diffs matched their briefs
closely.

**2026-07-25 (4)** — User said to keep going rather than wait for manual verification of
Phase 2, so proceeded straight into Expansion Phase 3 (full console roster — see that
section above for what shipped and the real `SCREEN_SCALE` bug found/fixed along the
way). This was pure roster data (no `console.ts`/`interaction.ts` changes needed —
Phase 1's genericization paid off exactly as hoped), so implemented directly rather than
delegating to Grok. Also added a `getBoundingClientRect()`-is-unreliable-for-CSS3D-panels
gotcha to `docs/browser-testing-3d.md`, found while re-verifying the scale fix. **Phase
2's interaction behavior (facing-hint text, E-focus toggle, Escape fallback) is still
not human-verified** — that gap from the previous entry is unchanged, just no longer
blocking.

**2026-07-25 (5)** — User said to keep going without waiting on manual testing.
Investigated Expansion Phase 4 (functional control surface) and found it's genuinely
blocked on an architectural question, not just more implementation — see that section
above for the detail (the real ACT component needs a live 2D DOM tile, not a synthetic
one). Presented this to the user rather than guessing at a fix, given it's real-money/
real-server-action code with a hard ToS rule attached. User chose to skip to Expansion
Phase 5 (visual polish) instead. Implemented and live-verified Phase 5 (see that section
above) — pedestal/desk/floor-marker/accent-light per console, replacing the flat
placeholder plate. All 5 Expansion phases from the original sequencing are now either
done (1, 2 code-complete pending human-verify, 3, 5) or explicitly blocked-pending-design
(4). **Phase 2's interaction behavior is still not human-verified** — this is now the
main open item before considering the Expansion track "solid." Next session: get a human
to test Phase 2 (facing hint, E-focus toggle, Escape fallback) with a real mouse, or
pursue one of Phase 4's two paths if the user wants to unblock it.

**2026-07-25 (6)** — Asked the user what came after Phase 5 since no Phase 6 exists;
they chose to resolve the plan's four-item "Open questions" list (see that section,
now retitled "resolved") rather than start new scene features. All four closed without
needing new game logic — the hangar's ship-scope question turned out to be a hard API
constraint rather than a deferred design choice (PrUn's `SHIP_SHIPS` message only ever
contains the player's own company's ships, matching the real 2D `FLT` screen exactly),
the other three were policy calls formalized in the doc. Added a one-line comment to
`hangar.ts` recording the ship-scope finding. **Phase 2's interaction behavior is still
the one open item needing a human with a real mouse** before the Expansion track can be
called fully verified.

**2026-07-25 (7)** — Talked through what to do about the hangar with the user. They
want ships to feel like a real, explorable 3D presence rather than data on a panel, but
agreed a full second walkable room (reopening the just-closed single-room decision) is
more than this stage warrants. Landed on a middle path: a window in the room wall
looking out onto a real (not rendered-to-texture) diorama of the player's ships docked
to spindly station arms, placed far outside the room at real WebGL depth so it reads as
sharp/dimensional rather than a flat "cheap and dull" screen — full design captured as
the new Expansion Phase 6 above. No code written this session; purely a design
conversation, written down in detail specifically so the next session (or a future
context-refreshed one) doesn't have to reconstruct it. Start there next.

**2026-07-25 (8)** — Implemented and live-verified Expansion Phase 6 (see that section
above for the full detail). User resolved the one design gap left open in the previous
session's write-up — replace the wall-mounted hangar outright rather than have both
coexist. Delegated implementation to Grok per `AGENTS.md`'s DELEGATION section (wrote a
detailed brief to `.local/scratch/phase6-brief.md` given the geometry work involved);
diff matched the brief closely, one TS const-comparison fix needed on Grok's end. Real
technical question the design doc flagged as unsolved — "how does a wall get an
opening" — resolved as: hide the box face (`visible: false`) entirely rather than
removing geometry, then rebuild most of the wall with 4 freestanding framing boxes
around the gap, using `DoubleSide` material since the shared `BackSide` wall material
would have culled those boxes' inward faces. Verified via `game-tester`: clean opening,
starfield/sun/station diorama all distinct and visible, no regressions to the rest of
the room, no console errors. Two minor non-blocking findings recorded in the Phase 6
section (spawn faces away from the new window by default; only ~2 of 5 station arms
read as distinct ships from straight on) — neither fixed this session, both cosmetic.
**Phase 2's interaction behavior is still the one open item needing a human with a real
mouse** before the Expansion track can be called fully verified — unchanged from prior
sessions, not touched this session. Next session: either that human-verification pass,
or pick a new Expansion Phase 7 topic with the user (no more phases are currently
planned past 6).

**2026-07-25 (9)** — User human-tested Phase 2 with a real mouse and confirmed the
E-focus toggle works — the first piece of that long-standing verification gap actually
closed (facing-hint text and Escape's generic-interact fallback are still unconfirmed).
Then applied three follow-up fixes to the just-shipped Phase 6, all delegated to Grok
per `AGENTS.md`: (1) flipped the console desk's tilt direction (`rotation.x` sign,
`console.ts`) since it read as sloping up toward the player instead of down; (2) swapped
the viewscreen window from the +Z wall to -Z per user correction — it needs to be beyond
the console arc (which sits near -Z) in the same forward view from spawn, not behind the
player looking at the consoles, which is where it landed in session (8); (3) added a
`SCREEN_MAX_HEIGHT_WORLD` cap + CSS `max-height`/`overflow-y: auto` to console screen
panels (`buffer-panel.tsx`/`console.ts`) so tall buffer content clips at the desk with a
scrollbar instead of visually overlapping it. `game-tester` verification confirmed all
three (see the Phase 6 section's "Same-day follow-up fixes" for the detail) — one
harness trap surfaced along the way (stale module in an already-open tab after
`build:fast`, needing `reload-extension`; now documented in
`docs/browser-testing-3d.md`) and two stale doc comments in `room.ts`/`viewscreen.ts`
still saying "+Z" were fixed to say "-Z". Also asked by the user to recommend a genuine
Phase 7 (not just verification of the above) — wrote up **Expansion Phase 7 —
Functional control surface (proposed)** above: resuming Phase 4's path (a) (a real live
`XIT ACT` buffer window backing the control-surface screen, DOM-reparented into the CSS3D
panel, native window otherwise hidden) since it's the last unimplemented piece of the
original Vision and Phase 4 already scoped it down to two paths with (a) being the lower
production-code-risk one. Explicitly flagged in that section as the assistant's proposal,
not yet agreed to the way Phases 1-6 were — confirm or redirect before starting
implementation.

**2026-07-26** — User confirmed proceeding with Expansion Phase 7 as scoped, adding one
requirement not in the original proposal: the control-surface panel must show the ACT
buffer's real companion tile next to it, not just the control panel alone (a player
needs to see what they're executing). Investigated the real `showBuffer()`/
`TileAllocator` mechanics first (read `tile-allocator.ts`, `buffers.ts`,
`ExecuteActionPackage.vue`, `xit-act-patterns.md` — found and accounted for an
undocumented-in-the-plan constraint: `TileAllocator` splits its host window **at
mount**, not on any click, so the real ACT window must stay a genuine standalone window
for that split to happen against real DOM). Ran an inert devtools spike via
`game-tester` (open `XIT REFUELACT`, inspect the resulting split DOM, no clicks) before
writing any code, confirming the mount-time split behaves exactly as the source
predicts. Wrote a detailed implementation brief
(`.local/scratch/phase7-control-surface-brief.md`) and delegated to Grok per
`AGENTS.md`'s DELEGATION section; diff matched the brief closely (new
`src/game-3d/control-surface.ts`, extended `ConsoleDefinition.controlSurface` to a full
`ConsoleScreenDefinition`, folded the control surface into `console.ts`'s existing
screen-layout loop). `pnpm run compile` clean on the first pass. First `game-tester`
verification found the reparenting mechanism itself sound (correct DOM split, no
console errors, clean disposal on exit, click handlers survived the move) but caught a
real bug: the panel rendered as an unreadable ~36px sliver. Root-caused and fixed
directly (a one-line roster change, not re-delegated) — see the Phase 7 section above
for the `heightPx`/percentage-height-collapse detail. Re-verified clean on the second
pass: both tiles render side by side at the correct size, `PREVIEW` click works
post-reparenting, exit cleanup leaves no orphaned window, zero console errors across
either pass. This closes out the last unimplemented piece of the original Vision
("a control-surface screen for running action packages") — every Expansion phase
through 7 is now done. Only `baseplanning` is wired; `REFUELACT` is an explicitly
placeholder/testbed package, not a real base-planning action — swapping in a real
base-linked package and/or wiring the other three consoles is unstarted follow-up, not
scoped as its own phase yet. Phase 2's interaction facing-hint text and Escape's
generic-interact fallback remain the one still-open item from earlier sessions,
untouched this session.

Ran `/distill` after Phase 7 landed, capturing two cross-session-reusable technique facts
into "Reusable facts for future work" above (real native DOM can be reparented into a
CSS3D panel and survives Vue's own patching; such reparented content needs an explicit
`heightPx` since it can depend on percentage-height ancestors that collapse under an
`auto`-height panel) and a gotcha into `docs/browser-testing-3d.md` (the
`game3d-test-rotate`/`game3d-test-move` bypasses are relative-only, no absolute
teleport — costly for repeatedly testing one console; a follow-up task to add one was
filed but not implemented). Also wrote up **Expansion Phase 8 — Real control-surface
content (proposed)** above at the user's request: replacing Phase 7's placeholder
`REFUELACT` package with something real, and deciding whether the control surface should
show a fixed demo package or the player's own staged/saved package (a materially
different scope) before rolling it out to the other three consoles. Explicitly flagged
as a proposal, not yet agreed the way Phases 1-7 were — confirm or redirect before
starting implementation.

**2026-07-26 (2)** — Ran Phase 8. Before writing any code, checked whether a
base/production-linked one-click package actually exists (it doesn't — grepped
`ACT/actions/*`: only `refuel`, `cont-trade`, `cont-ship`, `mtra`, `cx-buy`,
`govburn-data`, none base/production-related; confirmed `BURNACT`/`REFUELACT`/
`REPAIRACT` all trigger from `FLT.vue`, i.e. they're fleet actions, not base ones) and
put that finding in front of the user as one of three open questions before touching
code. User chose: fixed real package (not player-staged), resolve the mismatch by moving
the control surface to `flt` rather than inventing a new base/production action type, and
stay at one console. See the Phase 8 section above for what shipped and how
`game-tester` verified it — a small, low-risk roster-only change (Phase 7's mechanism was
already generic enough to need zero other code changes). Every phase from the original
sequencing (1-8) is now done; the only standing open item across the whole Expansion
track is Phase 2's facing-hint-text/Escape-fallback human-verification gap (E-focus
toggle itself was confirmed by the user in session (9) on 2026-07-25) and Phase 8's own
EXECUTE-needs-a-human note above. No new Expansion Phase is currently proposed — next
session should either close one of those two verification gaps or ask the user what
comes next.

**2026-07-26 (3)** — User asked for "another phase." Proposed rolling Phase 8's
fixed-package model out to `companyops`/`inv` (new `CONTTRADEACT`/`MTRAACT` one-click
windows) and flagged `baseplanning` as still having no fitting action type. User rejected
this: they didn't want new action-type/window pairs built at all, and pointed out
`RESUPPLYACT` (the actual command is `BURNACT`) and `REPAIRACT` already exist as
quasi-preconfigured packages — **correcting the previous session-log entry above**,
which said `BURNACT`/`REFUELACT`/`REPAIRACT` "all trigger from `FLT.vue`": that's only
true for `REFUELACT`. `BURNACT`/`REPAIRACT` are per-base, triggered from `BS.vue`'s
`BaseRow.vue` (`RES`/`REP` buttons) and `REP.vue`. More importantly, the user reframed
the whole model: consoles shouldn't be hardcoded to a specific command at all, since the
long-term intent is player-configurable console screens — a control surface should just
sit dormant until the player triggers a real action from a button inside that console's
own screens. Investigated feasibility against the actual code (`interaction.ts`'s
already-tracked-but-unexposed `focusedConsoleId`, `buffer-window-guard.ts`'s
`MutationObserver` pattern, `tile-allocator.ts`'s split classes) before proposing it back
as **Expansion Phase 9** — user confirmed the focus-based correlation approach was
correct. See that section above for the full design and what shipped. Delegated to Grok
per `AGENTS.md`; diff matched the brief closely. `game-tester` confirmed the structural
part (dormant slot on all 4 consoles, zero regressions to existing screens, clean exit);
the dynamic-capture flow itself remains unverified pending a human with a real mouse, on
top of Phase 2's still-open gap. Distill requested for after this lands.

**2026-07-26 (4)** — Asked the user for a full list of everything still needing manual
verification (compiled from every "needs a human"/"unconfirmed" note across the doc).
User confirmed WASD smoothing, E-focus, and Escape's fallback all work fine, and doesn't
care about the CALC iframe issue at this stage — but reported a new, serious problem
while trying to test Phase 8/9's click-based flows: clicking anywhere on a console
screen while unlocked instantly re-locks into walk mode instead of the click reaching
the button underneath, blocking real mouse interaction with any buffer content.
Investigated via a read-only `game-tester` diagnostic before proposing any fix — see the
new **KNOWN BLOCKING BUG** section above for the full write-up. Confirmed root cause:
Chromium's hit-test geometry for CSS3D-transformed panels doesn't match what it visually
paints, for panels beyond a certain skew — `elementFromPoint()` resolves to the
underlying canvas instead of the panel across most of the console arc. This is the same
flattening quirk already on record for `getBoundingClientRect()`, now confirmed to also
break real click delivery, and it retroactively means every prior "PREVIEW click works"
finding (Phase 7, 8) only ever proved the Vue handler runs when invoked directly, not
that a real click reaches it. Presented two candidate fixes (cheap FOV/geometry
experiment vs. a real fix bypassing native hit-testing via the existing raycaster) plus
a "just log it" option; user chose to stop here rather than scope a fix this session.
**This is now the top-priority item for the Expansion track** — it blocks real
verification of both Phase 8's EXECUTE step and Phase 9's entire dynamic-capture flow,
not just this session's testing goals. Next session should pick one of the two candidate
approaches (or investigate further) before any more click-dependent feature work lands.
