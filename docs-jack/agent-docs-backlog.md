# Agent-docs backlog

Findings from the 2026-07-25 audit of `AGENTS.md`, `docs/`, the browser harness and
`.claude/` that were deliberately **not** actioned in that pass — each is a judgement call
the repo owner should make. Delete an entry once it is done or rejected.

## Docs structure

- **Split `docs/feature-patterns.md` (~1050 lines).** It is four docs in one: feature
  conventions (`:1-73`), XIT ACT / agent-channel internals (`:104-245` + the hidden-buffer
  block around `:700`), DOM/Vue API reference (`:350-690`), CSS recipes (`:880-1050`).
  Extracting `docs/act-runner.md` and `docs/css-recipes.md` would leave ~600 lines of
  genuinely general patterns — and, more importantly, stop routing every ACT session's
  distill output into the one file every feature task must read.
- **Compress the remaining war stories.** Already done: `ExecuteActionPackage` mount split,
  companion-buffer splitting, the localStorage preference block. Still narrative-heavy:
  component-basename collision (`### File Organization`), invisible FontAwesome glyphs,
  auto-fitting a window to content, `td:first-child` border reset, matching native input
  styling, agent-channel id uniqueness. Rule first, incident only as evidence.
- **`docs/game/planetary-governance.md`** — the POPI and COGC payload paragraphs are two
  ~200-500 word forensic reconstructions. They should be: payload shape → tick formula →
  the "unresolved, do not trust" warnings. Not compressed here because the game facts
  couldn't be re-verified against a live session.
- **Game-doc duplication.** `game/ui-concepts.md` repeats the context-command bar,
  re-focus behaviour and the sidebar button table already in `game/sidebar-screens.md`;
  `game-concepts.md` repeats CoGC facts owned by `planetary-governance.md`. Cut to
  cross-references.
- **`docs/contributing.md`** mixes agent-actionable code rules with human process
  (changelog, editor import sorting, the Discord ≥75% approval poll). The human process
  could live in a human-facing contributing guide instead.

## `.claude/` surface

- **`bootstrap-docs`, `explore-project`, `restructure-docs` (595 lines) look dead.** All
  three revolve around `docs/exploration-manifest.md`, which has never existed —
  `explore-project` hard-stops in its first phase because of it. None has been touched
  since the original import; the doc-maintenance workflow actually in use is `distill`.
  Either delete them or collapse to one small manifest-free `docs-audit` skill.
- **`create-skill` (544 lines)** duplicates the harness's own skill-creator with no
  repo-specific content.
- **The review trio** (`review-pr` → `augment-review` → `resolve-review`) is coherent, but
  the PR-number resolution block is copy-pasted into all three and the pre-fill rules are
  restated verbatim in two. Extract `scripts/pr-number.sh`, delete the restatement.
  `resolve-review` also invents its own `Co-Authored-By` trailer with a pinned model name,
  competing with the harness-supplied one.
- **`.github/scripts/pr-review.sh`** carries its own hardcoded review checklist that
  overlaps `review-pr`'s categories — two rule sets that can drift.
- **Permissions.** With `autoAllowBashIfSandboxed: true`, the read-only Bash allows
  (`cat`, `grep`, `head`, `find`, …) only matter for commands that are also
  sandbox-excluded, which most are not. They are harmless but noise. The `curl` exclusion
  was narrowed to the CDP up-check in this pass — widen it again if a legitimate
  unsandboxed curl shows up.
