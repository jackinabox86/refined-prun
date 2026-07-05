# WSL2 + Bash Sandbox — thinking-through notes

Context: repeated approval prompts during browser-based feature testing got annoying.
Claude Code has a real "Bash sandbox" feature (not just `--dangerously-skip-permissions`)
that could plausibly fix this, but it isn't supported on native Windows — only macOS,
Linux, or Windows-via-WSL2. These are scratch notes, not a decision or a plan.

## What the sandbox would actually buy us

- Sandboxed Bash commands run in an OS-enforced boundary (bubblewrap on WSL2/Linux):
  filesystem writes restricted to cwd + a temp dir, network restricted to an allowlist.
- In **auto-allow mode**, sandboxed commands run with no prompt at all — the boundary
  itself is the safety mechanism, not a blanket trust switch. Explicit `ask` rules
  (e.g. a `Bash(git push *)` rule) still force a prompt regardless.
- Our repeated `pw-act.mjs` calls (`eval`, `click`, `screenshot`, etc.) only write to the
  project dir/scratchpad and only reach the network at `127.0.0.1:9333` (the CDP port of
  the already-running browser). Pre-allowing `127.0.0.1` once via `sandbox.allowedDomains`
  would plausibly let all of these through automatically, regardless of which selector or
  file path differs per call — that's exactly the class of prompt that's been the pain
  point.
- The actual game network traffic happens inside the already-launched Edge process, not
  inside our sandboxed Bash commands, so it's unaffected either way.

## Where the browser dependency actually bites

- Native Windows isn't supported by the sandbox at all — WSL2 is required.
- Sandboxed WSL2 commands **cannot launch Windows binaries** (`cmd.exe`,
  `powershell.exe`, anything under `/mnt/c/`) — WSL hands those off to the Windows host
  over a Unix socket, which the sandbox blocks.
- `node scripts/local-browser-test.mjs` spawns a real `msedge.exe` (a Windows binary), so
  it would need to go in `sandbox.excludedCommands` to run at all under WSL2 — falling
  back to a normal one-time approval. Not a big deal since it's already a single
  low-frequency call, not the repetitive pain point.

## Migration considerations, if pursued

**Git/GitHub from WSL2** — not hard, one-time setup, no ongoing friction:
- Local commands (add/commit/diff/log/status) are unaffected — no network, no auth.
- Push/pull needs auth set up once inside WSL2: either share Windows' Git Credential
  Manager (reuses the existing cached GitHub login, no re-auth) or run `gh auth login` /
  set up an SSH key independently inside WSL2.
- Remote URL doesn't change.

**Where the repo lives:**
- Option A: keep it on the Windows filesystem, accessed from WSL2 via `/mnt/c/...` — zero
  migration effort, but cross-filesystem I/O is noticeably slower for git-heavy /
  `node_modules`-heavy operations (status, install, build).
- Option B: fresh clone into WSL2's native Linux filesystem (e.g. `~/refined-prun`) — much
  faster day-to-day, but requires re-cloning, reinstalling `pnpm`/`node_modules`, and
  recreating everything that isn't in git: `.claude/settings.local.json`,
  `.local/browser-profile` (would need re-login to the game), `.local/pw-tools`.
- The sandbox needs the repo actually running under WSL2 to provide isolation, which
  points toward Option B for real day-to-day use — but that's real setup work.

## WSL2 vs desktop experience, and remote control

- **Same experience.** Claude Code inside WSL2 is otherwise identical to the Windows
  desktop app/terminal — same tools, features, UI. The only documented difference is
  sandbox platform support itself, plus the "can't launch Windows binaries from a
  sandboxed command" restriction noted above.
- **Remote control is real and works from WSL2.** `claude remote-control` starts a
  session that can then be opened from another device — a browser at claude.ai/code, or
  the Claude mobile app (iOS/Android), via a session URL/QR code. Messages sync across
  devices. Important catch: the session runs *locally* on the WSL2 machine the whole
  time — nothing moves to the cloud, and closing the terminal / stopping Claude Code on
  the WSL2 side ends the remote session. So this isn't a way to offload the work
  elsewhere, just a way to check in on / drive the same local session from a phone or
  another screen while the WSL2 machine keeps running.

## Observed in practice (2026-07-04, sandbox live on WSL2)

- The sandbox masks sensitive paths (`.gitconfig`, `.mcp.json`, `.claude/hooks`,
  `.gitmodules`, editor configs, …) by mounting `/dev/null` over them. Inside sandboxed
  commands these show up as **character devices owned by `nobody:nogroup`** — so
  `git status` lists a pile of bogus "untracked files" and git warns
  `unable to access '.gitmodules': Permission denied`. Not real files; nothing to clean.
- `npm install` fails sandboxed with `EROFS` writing `~/.npm/_cacache` (only
  `~/.npm/_logs` is write-allowed). Watch out: piping the install to `tail` masks the
  failure as exit 0 — check the installed artifact, not the pipeline exit code.
- The `127.0.0.1` CDP allowlist entry anticipated above was still unset this session, so
  every `pw-act.mjs` call ran with the sandbox disabled — the payoff needs that entry
  actually added (todo filed).

## Open questions to resolve before deciding

- Is the payoff (fewer approval prompts during browser testing) worth: WSL2 setup,
  re-authenticating git, re-doing `.local/pw-tools` + browser profile + game login, and
  the `excludedCommands` carve-out for launching the browser?
- Alternative: keep tightening the existing allowlist/tooling approach (already reduced
  prompts significantly this session) instead of the platform change.
