---
name: run3d
description: Extends the `run` skill for testing refined-prun's 3D Game Mode (`src/game-3d/` — the walkable bridge/operations-center spike/expansion). Triggers on "test 3d mode", "verify game-3d", "test the bridge/consoles", "check the hologram/hangar". Requires the `run` skill's harness already set up (build, launch, generic pw-act actions) — read that skill first if you haven't; this one only covers what's different for 3D. Do NOT load this for ordinary 2D feature testing — that's `run`'s job alone.
---

# Run3D: Testing refined-prun's 3D Game Mode

**`docs/browser-testing-3d.md` is the 3D testing manual** — the pointer-lock-under-CDP
limitation, the test-only camera bypass (`game3d-test-rotate`/`game3d-test-move`), the
perf/FPS caveat, and every 3D-specific gotcha. Read it before driving 3D mode; read
`docs/browser-testing.md` first if you haven't already, since this extends it rather
than replacing it. This file only covers what is specific to running it from Claude
Code — which is nothing beyond what `.claude/skills/run/SKILL.md` already says. Follow
that skill's delegation, environment-gate, and permissions guidance unchanged.
