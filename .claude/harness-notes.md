# Claude Code harness notes

Everything here is about *this tool*, not about refined-prun. Project guidance lives in
`AGENTS.md`; browser-harness mechanics live in `docs/browser-testing.md`. Keep it that
way — nothing agent-neutral belongs in this file, and nothing Claude-Code-specific
belongs in those.

## Sandbox and git

The Bash sandbox denies writes to `.claude/` control files (skills, hooks, settings) by
design. Some of those files are also git-tracked and differ between branches, so a
sandboxed `git checkout`/`git stash` crossing them fails **midway** ("Read-only file
system"), leaving git half-done. You can't know in advance whether `.claude/` files
differ, so never try the sandboxed version first: run any `git checkout`/`git stash`
crossing main unsandboxed from the start.

The sandbox also denies writes to `.git/config`, so any git command that writes repo
config (`git push -u`, `git branch --set-upstream-to`, `git config --local`,
`git remote add/set-url`) fails sandboxed with a **misleading** error:
`could not lock config file .git/config: File exists`. There is no stale lock — don't
hunt for one (a sandboxed `ls` even shows a phantom `config.lock` that doesn't exist
outside the sandbox). Sneakiest case: a sandboxed `git push -u` pushes successfully but
silently drops the tracking config, leaving the branch pushed but untracked. Run
config-writing git commands unsandboxed from the start; the `.git/config` deny is
intentional, so never work around it by widening the allowlist.

More generally, sandbox-denied paths can surface as phantom character-device stubs
(`crw-rw-rw-`, owned by `nobody:nogroup`) that show up as untracked entries in `git
status` — not just the `.git/config.lock` case above. Seen for HOME dotfiles
(`.bashrc`, `.gitconfig`, `.profile`) and `.claude/` control paths, and not just at the
repo root: they can appear recursively at nested directory levels too (e.g.
`src/.claude/`, `src/features/.claude/`, `src/features/XIT/.claude/`). These are
sandbox artifacts, not real repo content — never `git add -A`/investigate/delete them;
just ignore them and stage files by explicit name as usual.

## Approvals are the scarce resource

Allowlisted prefixes in `.claude/settings.json` only help when the command matches
literally. Things that quietly cost the user a manual approval:

- **Command substitution.** `$(...)` anywhere in a command trips injection detection even
  when the prefix is allowlisted — notably `grok -p "$(cat brief.md)"`. Write the brief to
  a file and pass a literal prompt instead.
- **Heredocs.** `python3 - <<'EOF'` is flagged the same way, and bypasses both the
  allowlist and sandboxed auto-allow. Write the script with the Write tool and run the
  path.
- **Chained commands.** `sandbox.excludedCommands` patterns match the whole command
  string, so a chain is only excluded when its FIRST segment is. `sleep 5 && node
  scripts/pw-act.mjs ...` works; an env-var prefix, a heredoc, or a `for` loop first does
  not. Set variables in a prior call, and unroll loops so each iteration starts with the
  excluded command.
- **Absolute paths.** `node /home/.../repo/scripts/pw-act.mjs` matches neither the
  allowlist nor the exclusion. Always invoke repo scripts by their relative path.

## Browser harness specifics

`docs/browser-testing.md` explains why the pw scripts must run in the host's network
namespace. Under Claude Code that is handled by `sandbox.excludedCommands`, so call them
as plain Bash commands and **never** set `dangerouslyDisableSandbox` — it forces a
permission prompt that the exclusion exists to avoid, and every known need already has an
exclusion. If a pw call returns `ECONNREFUSED` while the browser is up, restructure the
chain pw-first and check the exclusion list is intact before suspecting the browser.

**One scoped exception: launching the browser itself needs `dangerouslyDisableSandbox`.**
`sandbox.excludedCommands` only lifts the *network* namespace — a separate mount/device
namespace still applies underneath it and hides `/dev/dxg` (WSL2's GPU passthrough
device) from sandboxed processes, even for an excluded command. Confirmed live: `ls
/dev/dxg` and `nvidia-smi -L` fail sandboxed ("No such file or directory" /
"GPU access blocked by the operating system") and succeed unsandboxed (reporting the
real GPU) on a machine that has one — this is *not* evidence the box lacks a GPU, check
this before concluding that. Because a process's mount namespace is fixed at spawn time,
this exception applies to the one `node scripts/local-browser-test.mjs` launch call
only: run that one command with `dangerouslyDisableSandbox: true`, and the Chrome process
it starts (plus every GPU/renderer child it forks) keeps real GPU access for its whole
life. Every later `pw-act.mjs`/`pw-close.mjs`/`pw-kill.mjs` call still runs sandboxed as
normal — they only attach to or signal the already-running browser, never touch the
device themselves, so they never need the flag and never prompt for it.

Ad-hoc CDP scripts go in `.local/scratch/` (excluded and allowlisted, so prompt-free),
never the session scratchpad — and create them with the Write tool, not a `cat > file`
heredoc.

## grok

`grok` refreshes its OAuth token against `auth.x.ai` on every invocation, not just at
`grok login`, so both `api.x.ai` and `auth.x.ai` must be in
`sandbox.network.allowedDomains` in `.claude/settings.json` or every call falls back to a
manual sandbox-bypass approval. That setting isn't exposed through the `/sandbox`
command; edit the file directly.

## codex (delegate-codex skill)

`codex exec` (codex-cli 0.142.5) does not accept `--ask-for-approval` — passing it
errors `unexpected argument '--ask-for-approval' found`. Exec mode is already
non-interactive; don't pass this flag. The `delegate-codex` wrapper script
(`~/.local/bin/delegate-codex`) currently passes it and is broken on this codex version
as a result — call `codex exec` directly instead when this happens (same
`--sandbox <mode> --ephemeral` flags, just omit `--ask-for-approval`).

`codex exec` supports `-i/--image <FILE>...` (attach images to the prompt) and
`-o/--output-last-message <FILE>` (write just the agent's final response to a file) —
`delegate-codex` exposes neither. For any task judging or reporting on screenshots
(e.g. a codex critic/builder round in a visual-iteration loop), invoke `codex exec`
directly with these flags rather than going through the wrapper.

**`codex exec --sandbox workspace-write` needs Claude Code's own Bash sandbox disabled
(`dangerouslyDisableSandbox: true`) to even start.** Its internal bubblewrap sandbox
tries to `mkdir /tmp/.git` during setup and fails with `bwrap: Can't mkdir /tmp/.git:
Read-only file system` — Claude Code's own sandbox only permits real writes under
`$TMPDIR`/`/tmp/claude`, not bare `/tmp`, and codex's bootstrap needs the latter.
Confirmed this is scoped to `workspace-write`: `--sandbox read-only` codex calls (e.g. a
review-only critic round) do not hit this and run fine fully sandboxed with no flag
needed — only give codex builder-role (file-editing) calls the disabled-sandbox
treatment, not critic-role (read-only) calls.

Never trust a codex round's own "done"/self-report as proof — independently run
`git diff --stat` (confirm only the intended files changed) and re-run `pnpm run
compile` after every codex builder round, same discipline as `delegate-codex`'s own
documented procedure.

**Before reaching for `dangerouslyDisableSandbox` on a script already listed in
`sandbox.excludedCommands`, verify the exclusion is actually failing rather than
assuming a stale note is still true.** A prior session's planning doc claimed
`node scripts/pw-sandbox-screenshot.mjs *` and `curl http://127.0.0.1:5183*` don't
reach the host network namespace in this environment despite being excluded — retested
live and both worked fine fully sandboxed, no bypass needed. The one real trap: a
`curl` invocation only matches the excluded prefix as a literal string — flags placed
before the URL (`curl -s -o out http://127.0.0.1:5183`) break the match against a
pattern like `"curl -s http://127.0.0.1:5183*"` even though the command is functionally
identical; put the URL immediately after the flags the pattern expects.
