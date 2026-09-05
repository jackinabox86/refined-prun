# Claude Code harness notes

Everything here is about *this tool*, not about refined-prun. Project guidance lives in
`AGENTS.md`; browser-harness mechanics live with the harness itself, which is personal
tooling outside this repository. Keep it that way — nothing agent-neutral belongs in this
file, and nothing Claude-Code-specific belongs in `AGENTS.md`.

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

Scope that bypass to commands that actually write config, though — a plain
`git push origin <branch>` (no `-u`) touches only refs, and github.com is already an
allowed host, so it runs fine sandboxed. Reaching for `dangerouslyDisableSandbox` "because
it's a push" spends a user approval for nothing. Same trap on the branch side:
`git checkout -b <new-branch>` off current HEAD moves no files and (branching from a local
HEAD, not a remote-tracking ref) writes no config, so it needs no bypass either — the
checkout rule above is about *switching between* existing branches.

**Never `git add -A` from inside the sandbox.** The sandbox materializes its deny-mounts as
`/dev/null` character devices at paths under the working directory — a sandboxed
`git status` in a worktree listed `.bashrc`, `.gitconfig`, `.gitmodules`, `.zshrc` and a
dozen more as untracked, and `git add -A` then aborted with
`error: .bash_profile: can only add regular files, symbolic links or git-directories`,
staging nothing. They are not real files (`git status` unsandboxed shows only your actual
changes) and `git fetch` warning `unable to access '.gitmodules': Permission denied` is the
same illusion. Stage explicit paths (`git add src/ CHANGELOG.md`) and the problem
disappears — no bypass needed.

A sandboxed command can also fail spuriously with
`bwrap: Can't find source path /home/cyrus/.claude/local: No such file or directory`. That
is a transient sandbox-setup race, not a denial: re-run the same command and it works.
Reaching for `dangerouslyDisableSandbox` on the first sight of a `bwrap:` line spends an
approval that a plain retry would have saved.

## Bash working directory does not persist

The tool description's "working directory persists between calls" does not hold here — a
standalone `cd /some/path` returns `Shell cwd was reset to <session cwd>`. You cannot `cd`
into the main checkout to run repo scripts by their relative path from a worktree session
(and a compound `cd X && node scripts/...` breaks the `sandbox.excludedCommands` match,
since only the FIRST segment is tested). Bridge the missing files into the worktree
instead, or run the tool from its own directory by relative path.

Watch one non-obvious config write: `git branch -f <branch> origin/main`, used to reset a
merged branch, *also* re-points that branch's upstream to `origin/main` via
`branch.autoSetupMerge`. Restore it with
`git branch --set-upstream-to=origin/<branch> <branch>` or the next bare `git push` on it
targets main.

## `sudo` needs a real terminal

Anything requiring `sudo` cannot run from this session — not from a Bash tool call, and not
from the `!` prefix either. Both land in a non-interactive shell with no TTY, so `sudo` dies
with `sudo: A terminal is required to authenticate` before doing anything. Suggesting `!` for
a sudo command wastes the user's time twice: once when it fails, once when they retry it.

When a task needs sudo (upgrading `gh` off the distro package, installing a browser's
OS-level shared libraries), hand the user the command and say to run
it in a real WSL terminal — Windows Terminal, or `wsl` from PowerShell — where it can prompt
for their password. Everything after the install is normally sudo-free and runs fine in-session.

The sandbox blocks reads of dotfile paths by bind-mounting `/dev/null` over them, and it does
that relative to the *working directory* as well as `$HOME`. So a sandboxed `git status` in the
repo root reports phantom untracked entries — `.bashrc`, `.zshrc`, `.profile`, `.gitconfig`,
`.gitmodules`, `.mcp.json`, `.ripgreprc`, `.vscode`, `.claude/commands` — none of which exist
outside the sandbox (`ls -l` shows them as character devices, `crw-rw-rw- ... 1, 3`). The same
mounts make `git fetch` print `warning: unable to access '.gitmodules': Permission denied`; it is
cosmetic and the fetch succeeds. Two consequences: never stage with `git add -A`/`git add .` from
inside the sandbox — it would try to add character devices — always stage explicit paths; and
read the real working-tree state with an unsandboxed `git status` before trusting it.

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
  scripts/build-x.mjs ...` works; an env-var prefix, a heredoc, or a `for` loop first does
  not. Set variables in a prior call, and unroll loops so each iteration starts with the
  excluded command.
- **Absolute paths.** `node /home/.../repo/scripts/build-x.mjs` matches neither the
  allowlist nor the exclusion. Always invoke repo scripts by their relative path.

## Web/cloud sessions

The container is a fresh clone with **no `node_modules`**, so the first
`pnpm run compile` fails with `Cannot find type definition file for 'chrome'` and
`File '@vue/tsconfig/tsconfig.dom.json' not found` — that is a missing install, not a
broken tsconfig. Run `pnpm install --frozen-lockfile` first. `grok` is not installed
either, so implement directly per `AGENTS.md`, and the browser harness is unavailable —
say so once, don't try to stand it up.

## grok

`grok` refreshes its OAuth token against `auth.x.ai` on every invocation, not just at
`grok login`, so both `api.x.ai` and `auth.x.ai` must be in
`sandbox.network.allowedDomains` in `.claude/settings.json` or every call falls back to a
manual sandbox-bypass approval. That setting isn't exposed through the `/sandbox`
command; edit the file directly.
