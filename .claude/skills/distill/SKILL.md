---
name: distill
description: Analyze session learnings and capture corrections, guidelines, and open questions as actionable items. Triggers on "distill", "distill session", "consolidate learnings", "session review".
---

# Distill Session Learnings

**Recommended:** Sonnet max effort. Opus only for complex architectural sessions.

Distill this session into corrections, new knowledge, and guidelines. Prioritize reasoning from context over file reads.

## Phase 1: Pre-flight

Scan the conversation context for a previous distill report (look for `**Distilled N items from this session.**`).

**If found:** Only analyze content after that report. Ignore everything before it.

**If not found:** Analyze the full session.

## Phase 2: Analyze the Session

Output a structured analysis. Do NOT read any files — work from the conversation context only.

For each finding, write one line in this format:

```
[CORRECTION] <what was wrong> → <what is correct>
[NEW FACT] <the fact> — <where it should be recorded>
[GUIDELINE] <the rule in one sentence>
[OPEN QUESTION] <what needs verification>
```

If nothing substantive was learned (trivial session, test run, single quick fix), say so and stop. Do not fabricate findings.

### Permission-prompt audit (always run this check)

Separately from the corrections/facts/guidelines above, always check whether this
session generated repeated or avoidable tool-approval prompts — this is a standing
check, not something to skip because nothing else stood out:

- Did any Bash command pattern need a fresh approval more than once with only its
  arguments differing (a different file path, a different inline script, a different
  PID)? That's a signal a wildcard or a new fixed-argument helper is missing.
- Did any command pass caller-supplied *code* as an argument (`eval`, `node -e`,
  `python -c`, and similar) rather than plain data (a path, a selector, a flag)? That's
  not fixable by widening an allowlist — allowlisting arbitrary code execution is unsafe
  regardless of how repetitive it feels. The fix is a new fixed-logic action that takes
  data-only arguments instead (see `.claude/skills/run/SKILL.md` gotcha #8 for a worked
  example: `list-windows`/`styles` actions replacing bespoke `eval` snippets).
- Did an existing allowlist entry fail to match because of a quote-style or
  absolute-vs-relative-path mismatch? Fix the invocation habit (record it as a
  `[GUIDELINE]`) rather than widening the pattern to match every variant.
- Prompts aren't only Bash. With `autoAllowBashIfSandboxed` on, sandboxed bash never
  prompts — if the user still clicked approvals, scan the transcript's `tool_use`
  *names*, not just commands: unallowlisted tools like `Agent`, `SendMessage`, or
  `Skill` each prompt per call (one session racked up 16 dialogs from agent spawns
  alone while every bash command sailed through). Fix: allowlist the tool name itself
  in `permissions.allow`.

Write findings from this audit using the same `[GUIDELINE]`/`[CORRECTION]` format as
above, e.g. `[GUIDELINE] Prefer scripts/pw-act.mjs list-windows over an eval enumerating
windows — data-only argument, already covered by the existing wildcard`. Their fixes
usually land as edits to `.claude/settings.json` (narrow, safe, data-only entries only)
or to whatever script/tool generated the repeated calls — treat these as ordinary
Phase 4 edits, not a separate category.

## Phase 3: Re-acquire Write Targets

Only if Phase 4 needs to edit a doc whose contents are no longer in context (e.g. read early in the session and since compressed).

Run `find docs/ -name "*.md" | sort` to locate the right file. Read at most 2 docs, using `limit: 80`, to find the edit target. Do not read for verification — the session already proved the finding. Skip this phase entirely if you can already construct the edit from context.

## Phase 4: Capture Findings

For each finding from Phase 2, choose the right action:

**Corrections to existing docs/code:**
- Edit the file directly. Show the user what changed.

**New facts or guidelines worth keeping:**
- If it belongs in `CLAUDE.md` → edit it in.
- If it belongs in a `docs/` file → edit it in.
- If it's too minor for docs → create a `TaskCreate` item so the user can decide.

**Open questions:**
- Create a `TaskCreate` item with subject `Investigate: <question>`.

Prefer direct edits over todos. A todo that says "update X" is worse than just updating X.

**Exception:** if a permission-prompt fix from the audit above would require widening a
risky pattern (a mutating command, an interpreter/`eval`-style wildcard) rather than
adding a narrow data-only entry or a new fixed-logic helper, don't make that judgment
call yourself — create a `TaskCreate` item describing the tradeoff instead.

Never write to `MEMORY.md` or any memory file as part of distill. Project docs are the only write target.

## Phase 5: Report

```
**Distilled N items from this session.**

- Edits: list files changed (1 line each)
- Todos: N open questions to investigate
```
