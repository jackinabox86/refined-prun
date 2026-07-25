# 3D Game Mode — Plan

Living phase tracker for `src/game-3d/`. For the technical architecture (dependency
rules, why the import is dynamic, the `features/XIT/` exception, the `tileStatePlugin`
ambient-context wiring) see `docs/architecture.md`'s "3D Game Mode (Spike)" section —
this doc tracks *what phase we're in and what's left*, not how the seam works.

Branch: `3d-game-mode-spike` (based on `origin/comm-channel-work`), pushed to origin,
no PR opened yet.

## Vision

A fullscreen 3D space-station room, built into refined-prun, that a player can walk
around. Refined-prun's buffers appear as interactive screens/panels on the walls. A
hologram shows a region of the star map. A hangar view shows the player's ships. It's
an alternate, opt-in way to inhabit the game's data — not a replacement for the normal
2D UI, which keeps working exactly as it does today for everyone who doesn't turn 3D
mode on.

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
- Rendering combo: `WebGLRenderer` for room/hologram/hangar geometry, `CSS3DRenderer`
  for the buffer panels (keeps them real, interactive DOM).
- The toggle entry point is `toggleGame3D()` in `src/game-3d-launcher.ts` — the single
  seam wrapped in try/catch. Both the hotkey (Ctrl+Alt+3) and the top-bar "3D" button
  call this same function. Any new way to enter 3D mode must funnel through it too.
- Accepted permanent exception: `game-3d` imports directly from `features/XIT/` to
  reach buffer components (e.g. `INV.vue`). Those buffers are already eagerly bundled
  for every user regardless of 3D mode, so it costs nothing in bundle size, and no lint
  rule enforces the layering boundary anyway.

Phases are gated in order. Each assumes the previous one's definition of done was
actually met — don't skip ahead, and if a phase's core assumption turns out false,
stop and report it rather than routing around it with a hack that fixes the demo but
not the assumption.

## Phase 1 — Shell spike — DONE

Goal: prove a real refined-prun buffer can be Teleported into a CSS3D scene and stay
interactive.

Shipped: fullscreen WebGL room + CSS3D panel toggle (hotkey / top-bar button),
WASD + PointerLockControls walk mode, click-to-lock / Escape-to-unlock interact mode,
`INV.vue` Teleported into the wall panel with live data and full reactivity.

Key finding: Teleported buffers can depend on ambient Vue context (provide/inject —
`INV.vue` needs `tileStatePlugin`/`useTileState()`), not just DOM position. Every
future buffer candidate needs this same check before assuming a Teleport will "just
work."

## Phase 2 — Buffer panels, hardened — PAUSED (not fully done; moved to Phase 3 by explicit call)

Goal: go from "one buffer survives being teleported" to "arbitrary buffers can be
placed as wall panels reliably."

Carried over from Phase 1:

- **Side-effect leakage — RESOLVED.** Clicking a row in `INV.vue` calls
  `showBuffer(cmd)` (`src/infrastructure/prun-ui/buffers.ts`), which creates a real 2D
  floating window. Root cause confirmed live: the 3D overlay container sets
  `zIndex: 2147483646` (`src/game-3d/Renderer.ts`), so the new window painted
  underneath it — invisible until 3D mode exited. Fixed by
  `src/game-3d/buffer-window-guard.ts`, wired into `Game3D.ts`'s `start()`/`dispose()`:
  bumps new `.Window.window` elements to `OVERLAY_Z_INDEX + 1`, and — because the
  game's own window manager rewrites that same element's `style` attribute on every
  focus click/drag, clobbering a one-time bump — also watches `style` attribute
  mutations and re-applies the z-index every time the game overwrites it. Live-verified
  via game-tester: creation, title-bar click, real drag, and clean deactivation on exit
  (a fresh 2D-only buffer afterward gets an ordinary z-index again, no leak).
  - Note: some `onClickCmd` targets (e.g. `INV`) are our own XIT commands, registered
    in `src/features/XIT/xit-registry.ts` — `xit.get(cmd).component(params)` hands
    back a real Vue component we could Teleport directly instead. Others (e.g.
    `SHPI`, a native ship-cargo screen) are not ours at all and can only ever exist as
    a real 2D window — no component to Teleport. The z-index fix handles both cases
    the same way, so this distinction didn't block it, but keep it in mind if a future
    "open XIT commands as a new 3D panel instead" enhancement is considered.
- **Escape-to-unlock — CONFIRMED.** User confirmed manually on real hardware
  (2026-07-24): Escape does unlock pointer lock correctly outside the automation
  harness. The Phase 1 concern was a CDP-synthesized-input limitation of the test
  harness, not a `game-3d` bug, as suspected.
- **Iframe-embedding buffer — CODE ADDED, STILL NOT LIVE-VERIFIED.** Added
  `createCalcPanel()` in `src/game-3d/buffer-panel.tsx`, hosting `XIT CALC`
  (`src/features/XIT/CALC.vue`, a static iframe, no ambient Vue context deps) on the
  room's +X wall, wired into `Game3D.ts` alongside the existing INV panel. Compiles and
  lints clean. Two live-verification attempts so far: the first was interrupted by the
  user for taking too long; the second (2026-07-25) couldn't reach the panel at all —
  see the harness limitation noted under Phase 4 below (turning the camera requires
  pointer lock, which doesn't work under this CDP-driven harness). **Still not
  confirmed either way.** Needs either a manual human check, or a test-only way to
  rotate the camera without pointer lock.

Also likely work before Phase 2 is done (none of this started):

- Multiple simultaneous panels without perf falling over.
- A way to choose which buffer/command goes on which panel.
- Confirming ambient-Vue-context needs (per the Phase 1 `tileStatePlugin` finding)
  across several different buffer types, not just `INV.vue`.
- Deciding what happens to a panel when its buffer is closed/reopened in the 2D world.

**Definition of done:** at least 3-4 meaningfully different buffer types work as
panels simultaneously, at an acceptable frame rate, without visual/interaction
glitches, and all three carried-over items above are resolved (not just noted). **Not
met** — moved on to Phase 3 by explicit user direction rather than closing this out
first. Anyone resuming Phase 2 should pick up: live-verify the CALC iframe panel, then
the "also likely work" list above.

## Phase 3 — Region map hologram — LIVE-VERIFIED

Goal: a 3D representation of a region of the star map, driven by real data.

Decided: visual only for this pass, no click interaction (deferred, see below).

Shipped: `src/game-3d/hologram.ts`'s `buildHologram()` — a one-shot (non-reactive;
universe topology doesn't change mid-session) snapshot render. Picks a reference star
from the player's first `sitesStore` entry (via `getEntityNaturalIdFromAddress` →
`starsStore.getByPlanetNaturalId`), filters `starsStore.all` to that reference's
`sectorId` (the region), fits the bounding box of those positions to a `HOLOGRAM_SPAN`
of 2.4 world units, renders each star as a small emissive sphere colored by
`StarType` (standard stellar classification colors), and draws de-duplicated
`LineSegments` for in-region `connections`. Wired into `Game3D.ts`'s constructor,
floating at `(0, 1.4, 0)` — room center, doesn't collide with the INV/CALC wall
panels. Falls back to an empty group (renders nothing) if the player has no bases yet,
or star data hasn't loaded — no throw.

**Confirmed live (2026-07-25) via game-tester:** visible from spawn without turning —
correctly colored spheres connected by faint lines, matching the design. Frame rate
and full-scene layout (relative to the hangar/CALC panel, added afterward) not
separately re-checked.

Open design question: is it just a visual, or can you click a system in the hologram
to do something (open its buffer, navigate)? Decided NO for this pass — deferred,
matches the still-open Phase 2 panel-interaction/selection work, revisit once that
lands.

## Phase 4 — Ship hangar — CODE ADDED, STILL NOT LIVE-VERIFIED

Goal: a viewable hangar showing the player's ships, driven by `ships.ts`.

PrUn exposes no 3D ship models, so hangar ships need stylized placeholder meshes — not
"real" ship models. `PrunApi.Ship` turned out to have no reliable type/class field to
key placeholders on (the game's own SHP screen shows a "Type" like "Freighter", but
it's not present in the raw entity data we have), so — explicit decision this session —
placeholder size is driven by real cargo-hold `volumeCapacity`
(`warehousesStore` entry matching the ship's `idShipStore`) instead of a guessed
taxonomy.

Shipped: `src/game-3d/hangar.ts`'s `buildHangar()` — one-shot snapshot, same
non-reactive pattern as the hologram. Each ship is a box hull + smaller "bridge" box,
sized (length 0.35–1.1 world units) from its cargo capacity relative to the rest of the
fleet, laid out in wrapped rows along the +Z wall (mirroring the -Z wall INV panel).
Falls back to an empty group if there are no ships. Compiles clean.

**Hangar: LIVE-VERIFIED, working.** As of 2026-07-25, `src/game-3d/test-controls.ts`
added a pointer-lock bypass (`window.__rpGame3DTest.{rotate,move}`, driven via
`pw-act.mjs`'s `game3d-test-rotate`/`game3d-test-move` actions — pointer lock itself
still doesn't work under this CDP harness, gotcha #24) that unblocked turning the
camera and moving without a real mouse. A first `game-tester` pass with it reported the
hangar as empty despite confirmed ship ownership (9 ships via `FLT`) — but a direct
follow-up check (steep downward pitch close to the +Z wall) found the ship placeholder
meshes rendering correctly. The first pass's "empty" result was a viewing-angle
artifact, not a bug: ships sit very low (`SHIP_MIN_LENGTH * 0.22` ≈ 0.08 world units off
the floor) and are easy to miss without pitching down close to the wall. Worth a Phase 5
follow-up (raise the ships, or angle a light at them) so they're visible from a normal
eye-level glance, but the underlying render logic works.

**Fixed and live-verified (2026-07-25, later same day):** added `HANGAR_DISPLAY_HEIGHT
= 0.8` in `hangar.ts`, raising every ship's Y position by that amount (half of
`room.ts`'s `EYE_HEIGHT`) — a pure vertical-offset change, no other layout/sizing logic
touched. `game-tester` confirmed at a modest -8° to -15° pitch (well short of the
previous steep-pitch requirement) the hull boxes are now clearly visible along the wall,
with no floating/disconnected look and no ceiling clipping. One minor unresolved
cosmetic detail, not a regression from this change: the smaller "bridge" boxes on top of
each hull aren't visually distinguishable from a head-on angle (camera looks down the
ship's long axis, same axis the bridge's offset is on) — would need a broadside/
perpendicular viewing angle to confirm, not chased further as it doesn't affect the
height fix.

**CALC panel: real issue, not yet root-caused.** Same pointer-lock bypass used to
inspect it directly. The panel shell (CSS3D-transformed rectangle) renders correctly
with proper 3D perspective. DOM inspection confirmed the iframe's `@load` event fired
(its sibling `LoadingSpinner` — rendered as `v-if="loading"`, not `v-else`, in
`CALC.vue` — is gone from the DOM), ruling out a load/CSP failure. But the content area
renders as a flat solid dark-gray box with no visible calculator UI across multiple
close-range screenshots. Suspected cause: a known class of Chromium bug where iframe
content fails to composite/paint when nested inside a `CSS3DRenderer`-transformed
ancestor (`matrix3d` transforms) — possibly aggravated by WSLg's software-rendered GPU
path in this specific test environment. **Not resolved — needs either a real
GPU-accelerated browser check (to rule out a WSLg-only artifact) or three.js
CSS3D+iframe compositing research**, not more automated screenshot attempts.

**2026-07-25, later same day — mitigation attempted, verification deprioritized.**
Web research confirmed this matches a well-documented, longstanding class of Chromium
bug (cross-origin/OOPIF content failing to paint under an ancestor's CSS 3D
`matrix3d` transform — see three.js issues #11135, #20392, #26583 and related forum
threads); there's no canonical upstream fix, only empirical nudges. Added a scoped
mitigation in `createCalcPanel()` (`src/game-3d/buffer-panel.tsx`), following the same
host-quirk-compensation pattern as `buffer-window-guard.ts`: watch for the teleported
`<iframe>` via `MutationObserver`, attach a direct `load` listener, and on load force a
reflow (`display: none` → force layout → restore next rAF) to nudge Chrome into
recomputing the iframe's compositing layer. Compiles/lints clean. **Live verification
was started then explicitly stopped mid-way by user call** — only two minor features in
the whole extension use iframes, not worth further session time chasing. The fix is
left in place (harmless whether or not it actually works) but its effect is unconfirmed
either way. Don't spend more time on this without a specific reason to revisit.

## Phase 5 — Polish — IN PROGRESS

Room aesthetics, movement feel, entry/exit UX, settings if any, performance tuning
once several panels + hologram + hangar are live simultaneously.

**Shipped (2026-07-25):** a brief delayed "Loading 3D mode…" indicator in
`src/game-3d-launcher.ts` (only shows if the dynamic `import('@src/game-3d')` takes
>150ms, so it doesn't flash on a warm cache) — live-verified. Room aesthetics in
`src/game-3d/room.ts`: ceiling split into its own darker/cooler material (multi-material
box instead of one flat color), a one-shot procedural `CanvasTexture` panel-line grid on
walls/floor instead of flat color, and cooler-toned lighting — live-verified (ceiling
distinct from walls, grid visible, no regression to the Phase 3 hologram).

**Shipped (2026-07-25, later same day):** movement feel — `src/game-3d/movement.ts`'s
WASD now ramps via acceleration/deceleration (`ACCEL = 18`, `DECEL = 24`, top speed
unchanged at `MOVE_SPEED = 4.5`) instead of snapping instantly to full speed/stop.
**Not live-verifiable under this harness**: it only takes effect when
`PointerLockControls.isLocked`, which requires real pointer lock (broken under CDP,
gotcha #24) — the `game3d-test-move` bypass calls `PointerLockControls.moveForward`/
`moveRight` directly and skips this code entirely. Compiles/lints clean; needs a human
with a real mouse to actually feel it.

Entry/exit UX: reviewed, no change made. Toggle is already idempotent (`launchGame3D()`
in `src/game-3d/index.ts` — first call opens, second call or in-scene EXIT tears down
cleanly), has a contextual overlay hint that updates per mode
(`src/game-3d/overlay.ts`), and the loading indicator already covers the one real gap
(slow dynamic import). No concrete UX complaint on record to fix; adding more chrome
(e.g. fade transitions) would be exactly the kind of unjustified new element
`docs/contributing.md`'s "Minimize New Elements" warns against. Treating this item as
closed absent a specific future complaint.

Multi-element perf: **checked for the first time this session** with room + hologram +
hangar + INV panel + CALC panel all live simultaneously — measured 4.2-4.7 FPS via
`game-tester`, confirmed not a harness-wide freeze (a blank tab in the same browser hit
60fps at the same moment). Root cause found: this test browser's WebGL context reports
`ANGLE (Google, Vulkan (SwiftShader Device...), SwiftShader driver)` — a pure software
rasterizer, no real GPU, confirmed via `WEBGL_debug_renderer_info`. This is the same
environment-level cause already suspected for the CALC panel's compositing bug (below).
Software-rendering a combined WebGL+CSS3D scene is expected to be 10-50x slower than
real GPU hardware, so the 4.2-4.7 FPS number is not a trustworthy perf signal — no code
optimization is justified from this reading alone. **Needs a real-GPU browser check
before any perf work is undertaken**; don't spend further session time chasing FPS
numbers produced by this harness.

No settings added — nothing so far has needed one.

## Open questions (deferred, not blocking early phases)

- One room, or multiple/expandable station areas?
- Does the hangar show only the player's own ships, or fleet-mates/company ships too?
- Any accessibility/non-desktop story? (Pointer lock assumes a desktop mouse — likely
  an accepted non-goal, but not formally decided.)
- Where does the on/off toggle live in the UI, and is it a userData setting or
  something else?

## Session log

Append a short entry at the end of any session that does real work here — date, what
happened, what was learned, what's next. Read the whole log before starting work, not
just the Vision section. This is separate from running the `/distill` skill (which
captures reusable cross-session learnings into `AGENTS.md`/`docs/architecture.md`/
`.claude/skills/*`) — updating this log is normal work on this plan, not a distill run.

**2026-07-24** — Phase 1 spike built on `3d-game-mode-spike`, pushed, no PR yet.
Core mechanic proven: walkable room, WebGL+CSS3D combo, real buffer (`INV.vue`)
Teleported in with full reactivity, toggle via hotkey + top-bar button through a
single `toggleGame3D()` seam. Biggest finding: Teleported buffers can depend on
ambient Vue context, not just DOM position. Two things left open: buffer-internal
actions opening invisible 2D buffers behind the overlay, and Escape-to-unlock
unconfirmed on real hardware.

**2026-07-24** — This plan moved into `docs/game-3d-plan.md` for tracking. Started
Phase 2: root-caused the invisible-2D-buffer issue to the overlay's
`zIndex: 2147483646` in `src/game-3d/Renderer.ts` beating any real floating window;
chose a z-index/stacking fix over a parallel-3D-panel redirect system, since it covers
both XIT-owned and native-APEX `onClickCmd` targets uniformly. Confirmed `INV.vue`'s
`SHPI` click target is a native screen (`docs/game/screens-fleet.md`), not one of our
XIT commands — meaning not every `showBuffer()` target can ever become a 3D panel,
which is why the z-index fix (general) was chosen over redirect-to-panel (XIT-only).
Next: implement the z-index fix, verify live, find an iframe-embedding buffer
candidate to test, and get a human to confirm Escape-to-unlock on real hardware.

**2026-07-24** — Implemented and live-verified the z-index fix
(`buffer-window-guard.ts`): first pass only bumped z-index at window-creation time,
which `game-tester` caught failing on a plain title-bar click (game's window manager
clobbers the element's `style` attribute on focus/drag); second pass added a `style`
attribute-mutation observer to re-apply the bump, confirmed passing on click, drag, and
clean exit. User confirmed Escape-to-unlock manually on real hardware. Added a second
wall panel (`createCalcPanel()`, XIT CALC) as an iframe test candidate — compiles
clean, but live verification was interrupted before completing (not confirmed working
or broken). Per explicit user direction, moving on to Phase 3 without closing out
Phase 2's remaining items (iframe live-check, multi-panel work, panel-selection
mechanism, close/reopen behavior) — those remain open for whoever returns to Phase 2.

**2026-07-25** — Started Phase 3: added `src/game-3d/hologram.ts` (`buildHologram()`),
a one-shot star-region hologram centered on the player's home sector, colored by star
type, with connection lines; visual-only for this pass per explicit user decision.
Compiles clean. Live verification blocked — the local test browser harness had died
(CDP `ECONNREFUSED`) and the user chose to skip relaunching/verifying for now rather
than wait. **Not confirmed to render correctly.** Next session: relaunch the harness,
verify the hologram live (rendering, position/scale, frame rate) before building
anything further on top of it, then decide whether to close out Phase 2's leftovers or
continue Phase 3.

**2026-07-25** — Distilled prior session findings into `docs/architecture.md` (z-index
gotcha), `docs/feature-patterns.md` (`xit.get()`), and `.claude/skills/run/SKILL.md`
(2 new test-harness gotchas). Discovered mid-fix that three protected files
(`settings.json`, `run/SKILL.md`, `game-tester.md`) had silently failed to update
during this session's initial branch checkout (sandbox file lock) — restored them from
HEAD before re-applying new content, so nothing from intervening commits was lost.
User approved allowlisting the `grok -p` delegation command (turned out already
present at HEAD). Started and shipped Phase 4: `src/game-3d/hangar.ts`
(`buildHangar()`), placeholder ships sized off real cargo-hold capacity since `Ship`
has no type/class field. Relaunched the browser harness and live-verified: the Phase 3
hologram renders correctly. The CALC panel and hangar could not be reached for
verification — camera turning needs pointer lock, which doesn't engage under this
CDP-driven harness (same root cause as the pre-existing gotcha #24). Next session:
verify the hangar and CALC panel via a manual human check (real mouse can turn the
camera), then decide whether to close out Phase 2/3/4's remaining unverified items or
continue to Phase 5.

**2026-07-25** — User chose to skip the manual-check/pointer-lock-fix decision for
Phase 4 and move to Phase 5 instead. Shipped a first Phase 5 slice (scoped to what's
verifiable without pointer lock): a delayed "Loading 3D mode…" indicator in
`src/game-3d-launcher.ts`, and room aesthetics in `src/game-3d/room.ts` (distinct
ceiling material, procedural `CanvasTexture` panel-grid on walls/floor, cooler
lighting) — both live-verified by `game-tester`. Then, since the pointer-lock blocker
had now hit three separate phases, built the test-only bypass infrastructure the plan
had flagged as an option: `src/game-3d/test-controls.ts`
(`window.__rpGame3DTest.{rotate,move}`) plus `pw-act.mjs` actions
`game3d-test-rotate`/`game3d-test-move`, documented in `run/SKILL.md`. Used it to
finally verify Phase 4's hangar and CALC panel: hangar renders correctly (a first
automated pass wrongly reported it empty — root-caused to a viewing-angle artifact,
ships sit very low near the floor); CALC panel shell renders but its iframe content
area stays a blank dark box despite the iframe's `@load` firing (loading spinner
confirmed gone from DOM) — a real unresolved issue, suspected Chromium
CSS3D-transform+iframe compositing quirk, possibly WSLg-software-rendering-specific,
not yet root-caused. Next session: either get a real-GPU browser check on the CALC
panel to rule out a harness-only artifact, or research the three.js CSS3D+iframe
compositing issue directly. All code changes (grok-authored, human-reviewed) compile
and lint clean; nothing committed yet this session.

**2026-07-25, later same day** — Researched the CALC iframe compositing bug (web
search: matches a known Chromium/three.js class of issue, no canonical fix) and shipped
a scoped empirical mitigation (reflow-on-load nudge) in `buffer-panel.tsx`, following
the `buffer-window-guard.ts` host-quirk-compensation precedent. Live verification of
that fix was interrupted mid-way by explicit user call — iframes are a minor part of
the extension (two features total), not worth more time. Pivoted to the rest of Phase
5: shipped WASD acceleration/deceleration smoothing (`movement.ts`), reviewed
entry/exit UX and found no concrete gap to close, and ran the first-ever combined-scene
FPS check (room + hologram + hangar + both panels together) — found 4.2-4.7 FPS, then
root-caused it to this test browser having no real GPU (`SwiftShader` software
rasterizer, confirmed via `WEBGL_debug_renderer_info`), the same environment cause
already suspected for the CALC bug. That makes the FPS number untrustworthy as a real
signal — no code perf work started, none is justified without a real-GPU baseline
first. All other live checks passed clean: hologram, hangar (low-to-floor per existing
gotcha #27), INV panel live data, and exit/re-entry all regression-free, no new console
errors. Phase 5 is now close to done — the only remaining concrete gaps are the
still-unverified CALC fix and getting a real-GPU perf baseline; both need hardware this
harness doesn't have. Next session: get a human/real-GPU check for those two items, or
decide they're acceptable to ship unverified for a spike.

**2026-07-25, later same day (continued)** — Both remaining Phase 5 gaps needed hardware
this harness doesn't have, so picked the one concrete, hardware-independent follow-up
explicitly flagged under Phase 4: hangar ships sitting almost on the floor, invisible
without a steep camera pitch. Fixed with a single vertical-offset constant
(`HANGAR_DISPLAY_HEIGHT = 0.8` in `hangar.ts`) and live-verified via `game-tester` — now
visible at a normal glance-down angle. Minor unrelated cosmetic finding (bridge boxes
hard to distinguish head-on) noted but not chased. Phase 5's only remaining open items
are the CALC fix and real-GPU perf baseline, both blocked on hardware/human access this
session doesn't have.
