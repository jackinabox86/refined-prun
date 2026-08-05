# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.
It is deliberately agent-neutral: anything true only of one CLI, one model, or one
machine belongs in that tool's own config (for Claude Code, `.claude/harness-notes.md`),
not here.

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
- Read `docs/README.md` — it indexes every doc and says what each is for
- Read docs based on task type:
  - **New feature / Fix feature**: `docs/feature-patterns.md`, `docs/game/ui-concepts.md`, relevant game docs
  - **Refactor infra**: `docs/architecture.md`
  - **PR review**: `docs/contributing.md`, plus `docs/feature-patterns.md` if PR adds features
  - **Any task**: `docs/contributing.md` for style rules when writing code
- Analyze examples from docs
- Revise the plan and present todo items to the user
- Once the user accepts, create revised todo items
- Execute — delegate per `## DELEGATION` below
- Check your work: `pnpm run compile` (types + lint) always; verify UI-visible changes
  against the real game per `docs/browser-testing.md`

For small tasks (one-line fixes, running tests, infra chores, questions): skip the plan-approval round trip. Still read the docs relevant to whatever you touch.

## DELEGATION

Implementation and verification are both delegated, not done in the orchestrating session:

- **Coding tasks (writing/editing code):** delegate to Grok Build (`grok` CLI) rather than
  editing files yourself:
  ```
  grok --no-auto-update --no-alt-screen --always-approve -p "<task description>"
  ```
  Give it what you'd give any sub-agent — file paths, which doc sections apply, what "done"
  looks like — and start the prompt with an explicit "IMPLEMENT NOW, do not ask for
  confirmation"; in `-p` mode it otherwise restates the plan and stops. For anything longer
  than a couple of sentences, write the brief to a file and point at it
  (`-p "Read <absolute path> and implement it exactly."`). Then review its diff
  (`git diff`) against `docs/contributing.md` and the plan: Grok writes, you verify. Keep
  direct edits for one-line fixes, this file, and cleaning up whatever Grok gets wrong.
  Auth is set up once per machine by the user — never run `grok login` on their behalf.
  If the `grok` CLI isn't available in the current environment, say so once and implement
  directly instead of working around it.
- **Browser/UI verification:** drive the harness in `docs/browser-testing.md` from a
  sub-agent where your tooling has one (Claude Code: the `game-tester` agent), so
  screenshots and DOM dumps stay out of the orchestrating session's context.

## DISTILL

Capture session learnings into the docs (Claude Code: the `distill` skill) once per
session, near the end — not after every task.

- Before writing a PR: ALWAYS distill and commit its output first. No exceptions.
- Otherwise, when the session is wrapping up, ask the user whether to distill. Never let a session end without at least asking.
- Distilled findings go to the doc that owns the subject: game behaviour to `docs/game/`,
  extension patterns to `docs/feature-patterns.md`, harness traps to
  `docs/browser-testing.md`. Compress to the rule; keep the incident only when it is the
  evidence for the rule. Cross-reference by section title, never by list number — numbered
  references break silently the moment the list is reordered.

## MEMORY

`MEMORY.md` is maintained exclusively by the harness's auto-memory system.
Skills, tasks, and distill must NEVER write to it — only auto-memory itself maintains that file and its index. No exceptions.

## EDITING THIS FILE

Do not rewrite this file on your own initiative. Propose changes to the user first — distill findings are the usual channel.
