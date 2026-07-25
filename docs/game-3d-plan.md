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
- **Iframe-embedding buffer — CODE ADDED, NOT LIVE-VERIFIED.** Added
  `createCalcPanel()` in `src/game-3d/buffer-panel.tsx`, hosting `XIT CALC`
  (`src/features/XIT/CALC.vue`, a static iframe, no ambient Vue context deps) on the
  room's +X wall, wired into `Game3D.ts` alongside the existing INV panel. Compiles and
  lints clean. Live verification (does the iframe render/scale correctly under the
  CSS3D transform, accept clicks, avoid unexpected reloads) was started via
  `game-tester` but interrupted by the user for taking too long — **not confirmed
  either way**. Don't treat this as resolved; re-run the live check before relying on
  iframe buffers working.

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

## Phase 3 — Region map hologram — NOT STARTED

Goal: a 3D representation of a region of the star map, driven by real data.

Data sources already exist and are reactive: `stars.ts`, `sectors.ts`, `planets.ts` in
`src/infrastructure/prun-api/data/`. No new data plumbing needed — this phase is a
rendering layer (likely instanced points/spheres) consuming stores that already exist.

Open design question: is it just a visual, or can you click a system in the hologram
to do something (open its buffer, navigate)? Decide when the phase starts, based on
what Phase 2 teaches about panel interaction.

## Phase 4 — Ship hangar — NOT STARTED

Goal: a viewable hangar showing the player's ships, driven by `ships.ts`.

PrUn exposes no 3D ship models, so hangar ships need stylized placeholder meshes keyed
by ship type — not "real" ship models. Scope the visual ambition down accordingly.

## Phase 5 — Polish — NOT STARTED

Room aesthetics, movement feel, entry/exit UX, settings if any, performance tuning
once several panels + hologram + hangar are live simultaneously.

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
just the Vision section.

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
