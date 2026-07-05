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
- Execute, use skills and commands that can help solve the task
- Verify UI-visible changes in the real game via the run skill (`.claude/skills/run/SKILL.md`)

For small tasks (one-line fixes, running tests, infra chores, questions): skip the plan-approval round trip. Still read the docs relevant to whatever you touch.

## DISTILL

The distill skill captures session learnings into the docs. Run it once per session, near the end — not after every task.

- Before writing a PR: ALWAYS run distill and commit its output first. No exceptions.
- Otherwise, when the session is wrapping up, ask the user whether to run distill. Never let a session end without at least asking.

## MEMORY

`MEMORY.md` is maintained exclusively by the harness's auto-memory system.
Skills, tasks, and distill must NEVER write to it — only auto-memory itself maintains that file and its index. No exceptions.

## EDITING THIS FILE

Do not rewrite this file on your own initiative. Propose changes to the user first — distill findings are the usual channel.
