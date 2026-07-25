---
name: run
description: Launch a real Chromium browser with the refined-prun extension loaded via a persistent profile, so you can log into Prosperous Universe once and then drive/observe the live game UI (navigate, click, screenshot) across many tool calls. Triggers on "run the app", "test this in the browser", "verify this feature", "take a screenshot of the game". Do NOT use for pure unit/type checks (use `pnpm run compile`) — this is for visual/behavioral verification against the real game. ONLY works in the local WSL2 checkout (needs WSLg + .local/pw-tools); in any other environment (Claude Code on the web, cloud agents, CI) do NOT attempt it or report its absence — just note once that browser verification needs the local WSL2 session, and move on.
---

# Run: Local Browser Test Harness

**`docs/browser-testing.md` is the harness manual** — setup, the build/launch/drive loop,
the `pw-act.mjs` action list, the safety rule about server actions, and every gotcha
learned the hard way. Read it before driving the browser. This file only covers what is
specific to running it from Claude Code.

## Delegate it

Spawn the `game-tester` agent (`.claude/agents/game-tester.md`) with a concrete checklist
and consume its text-only report. Screenshots and DOM dumps are the most expensive thing a
main session can hold, and the agent reads the manual itself. Pass `model: haiku` for cheap
smoke checks; the default handles normal verification.

Drive the browser from the main session only for a single quick call (one `list-windows`,
one targeted `styles`) or when the user asks to watch a specific interaction live. Anything
multi-step or screenshot-heavy goes to the agent.

**Testing `src/game-3d/` specifically?** Also read the `run3d` skill and
`docs/browser-testing-3d.md` — pointer-lock-under-CDP mechanics kept out of this file and
the base manual so an ordinary 2D-feature session never has to load them.

## Environment gate

This works only in the local WSL2 checkout: `/mnt/wslg` and
`.local/pw-tools/node_modules/playwright` must both exist. If either is missing — Claude
Code on the web, a cloud agent, CI, a fresh clone — do not launch anything, do not retry,
and do not pepper the user with failure messages. Say once that browser verification needs
the local WSL2 session, then continue with whatever else the task allows.

## Permissions and the sandbox

See `.claude/harness-notes.md` for the full rules. The short version:

- The pw scripts are in `sandbox.excludedCommands`, so run them as plain Bash commands.
  **Never** set `dangerouslyDisableSandbox` — it forces a prompt the exclusion exists to
  avoid, and every legitimate need already has an exclusion.
- Sandboxed commands get an isolated loopback, so a sandboxed call to the browser's CDP
  port fails with `ECONNREFUSED` even while the browser is up and answering. Exclusion
  patterns match the whole command string, so a chain only qualifies when its FIRST segment
  is excluded (`sleep 5 && node scripts/pw-act.mjs ...` works; an env-var prefix, heredoc,
  or `for` loop first does not). Invoke scripts by their relative path — an absolute path
  matches neither the allowlist nor the exclusion.
- Ad-hoc CDP scripts go in `.local/scratch/` (excluded and allowlisted), never the session
  scratchpad, and are created with the Write tool rather than a heredoc.
- Every `eval` is a fresh approval because its argument *is* the code; every other action
  takes plain data and is covered by one allowlist entry. That is the cost behind the
  manual's "prefer a fixed action over `eval`" rule — one session burned ~20 approvals on
  things `click` with a `:has-text()` selector or `styles` already covered. Each separate
  Bash call is also an approval-eligible event, so chain steps that need no intermediate
  inspection.

## Launching from a session

`node scripts/local-browser-test.mjs` blocks forever on purpose to keep the browser alive,
so start it with a backgrounded/non-blocking call and stop it with `TaskStop` on its task
id. First launch ever: tell the user the window is open and wait for them to log in by
hand. Ask before closing the browser — it is not a routine cleanup step.
