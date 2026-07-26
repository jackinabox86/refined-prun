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
