# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## YOUR ROLE

Pay attention to the task and code. If you see a stupid thing/idea, stop and report it.
Be extremely concise in chat. Sacrifice grammar for the sake of concision. (Code comments and docs follow `docs/contributing.md` style instead.)

NEVER blindly assume how the game works. If you don't 100% know how a feature or UI component works, read the appropriate docs.
If there is no relevant info in the docs, make an assumption and ask the user if it is correct. Only then you are allowed to follow an assumption.

## PROJECT

Refined PrUn (rprun) is a browser extension for Prosperous Universe (PrUn) that enhances the game interface.

## THE MAIN FLOW

For feature work (new feature, fix feature, refactor, PR review), create the following to-do list immediately. ALL STEPS ARE MANDATORY. DO NOT SKIP ANY.

- Analyze user request
- Run `find docs/ -name "*.md" | sort` for available docs
- Read `docs/README.md`
- Read docs based on task type:
  - **New feature / Fix feature**: `docs/feature-patterns.md`, `docs/game/ui-concepts.md`, relevant game docs
  - **Refactor infra**: `docs/architecture.md`
  - **PR review**: `docs/contributing.md`, plus `docs/feature-patterns.md` if PR adds features
  - **Any task**: `docs/contributing.md` for style rules when writing code
- Analyze examples from docs
- Revise the plan and present todo items to the user
- Once the user accepts, create revised todo items
- Execute — delegate per `## DELEGATION` below; use skills and commands that can help solve the task
- Verify UI-visible changes in the real game via the run skill (`.claude/skills/run/SKILL.md`)

For small tasks (one-line fixes, running tests, infra chores, questions): skip the plan-approval round trip. Still read the docs relevant to whatever you touch.

## DELEGATION

Implementation and verification are delegated, not done in the main session — one place for both:

- **Coding tasks (writing/editing code):** delegate to Grok Build (`grok` CLI, xAI's Grok 4.5)
  instead of editing files directly or spawning a Claude subagent for it:
  ```
  grok --no-auto-update --no-alt-screen --always-approve -p "<task description>"
  ```
  Give it the same context you'd give a subagent — file paths, which doc sections apply, what
  "done" looks like. Review its diff (`git diff`) against `docs/contributing.md` and the plan
  before calling the task done; Grok writes, Claude verifies. Keep direct edits for one-line
  fixes, `AGENTS.md` itself, and cleaning up whatever Grok gets wrong. Auth
  (`GROK_CODE_XAI_API_KEY` env var, or an already-completed `grok login`) is set up once per
  machine by the user — never run `grok login` on their behalf.
- **Browser/UI verification:** delegate to the `game-tester` agent
  (`.claude/agents/game-tester.md`), per `.claude/skills/run/SKILL.md`. Screenshots and DOM
  dumps stay in its context, not the main session's.

## SANDBOX & GIT

The Bash sandbox denies writes to `.claude/` control files (skills, hooks, settings) by design. Some of those files are also git-tracked and differ between branches, so a sandboxed `git checkout`/`git stash` crossing them fails **midway** ("Read-only file system"), leaving git half-done. You can't know in advance whether `.claude/` files differ, so never attempt the sandboxed version first: run any `git checkout`/`git stash` crossing main unsandboxed from the start.

The sandbox also denies writes to `.git/config`, so any git command that writes repo
config (`git push -u`, `git branch --set-upstream-to`, `git config --local`,
`git remote add/set-url`) fails sandboxed with a **misleading** error:
`could not lock config file .git/config: File exists`. There is no stale lock — don't
hunt for one (a sandboxed `ls` even shows a phantom `config.lock` that doesn't exist
outside the sandbox). Sneakiest case: sandboxed `git push -u` pushes successfully but
silently drops the tracking config, leaving the branch pushed but untracked. Run
config-writing git commands unsandboxed from the start; the `.git/config` deny is
intentional, so never work around it by widening the allowlist.

`grok` also refreshes its OAuth token against `auth.x.ai` on every invocation, not just at
`grok login` — that host needs to be in `sandbox.network.allowedDomains` in
`.claude/settings.json`, or every call falls back to a manual sandbox-bypass approval. That
setting isn't exposed through the `/sandbox` command; edit `.claude/settings.json` directly.

When invoking `grok -p`, never build the prompt with command substitution (`-p "$(cat
brief.md)"`) — `$(...)` trips Claude Code's injection detection and forces a manual
approval even though the `grok --no-auto-update --no-alt-screen --always-approve -p *`
prefix is allowlisted. Write the brief to a file and pass a literal prompt instead:
`-p "Read <absolute path> and implement it exactly."`. Also start the prompt with an
explicit "IMPLEMENT NOW, do not ask for confirmation" — in `-p` mode grok otherwise tends
to restate the plan and end with "OK to proceed?" without touching any files.

The same injection detection flags heredoc-fed interpreter code (`python3 - <<'EOF'`),
bypassing both the allowlist and sandboxed auto-allow. Use `python3 -c '...'` for
one-liners, or write the script to the scratchpad or `.local/scratch/` and run the
path — `python3 -c *`, `python3 /tmp/claude-1000/*`, and `python3 .local/scratch/*`
are allowlisted.

## DISTILL

The distill skill captures session learnings into the docs. Run it once per session, near the end — not after every task.

- Before writing a PR: ALWAYS run distill and commit its output first. No exceptions.
- Otherwise, when the session is wrapping up, ask the user whether to run distill. Never let a session end without at least asking.

## MEMORY

`MEMORY.md` is maintained exclusively by the harness's auto-memory system.
Skills, tasks, and distill must NEVER write to it — only auto-memory itself maintains that file and its index. No exceptions.

## EDITING THIS FILE

Do not rewrite this file on your own initiative. Propose changes to the user first — distill findings are the usual channel.
