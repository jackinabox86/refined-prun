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

Scope that bypass to commands that actually write config, though — a plain
`git push origin <branch>` (no `-u`) touches only refs, and github.com is already an
allowed host, so it runs fine sandboxed. Reaching for `dangerouslyDisableSandbox` "because
it's a push" spends a user approval for nothing.

Watch one non-obvious config write: `git branch -f <branch> origin/main`, used to reset a
merged branch, *also* re-points that branch's upstream to `origin/main` via
`branch.autoSetupMerge`. Restore it with
`git branch --set-upstream-to=origin/<branch> <branch>` or the next bare `git push` on it
targets main.

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

Ad-hoc CDP scripts go in `.local/scratch/` (excluded and allowlisted, so prompt-free),
never the session scratchpad — and create them with the Write tool, not a `cat > file`
heredoc.

## grok

`grok` refreshes its OAuth token against `auth.x.ai` on every invocation, not just at
`grok login`, so both `api.x.ai` and `auth.x.ai` must be in
`sandbox.network.allowedDomains` in `.claude/settings.json` or every call falls back to a
manual sandbox-bypass approval. That setting isn't exposed through the `/sandbox`
command; edit the file directly.
