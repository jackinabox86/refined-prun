# Agent-docs backlog

Findings from the 2026-07-25 audit of `AGENTS.md`, `docs/`, the browser harness and
`.claude/` that were deliberately **not** actioned in that pass — each is a judgement call
the repo owner should make. Delete an entry once it is done or rejected.

## Docs structure

- ~~**Split `docs/feature-patterns.md`.**~~ Done 2026-07-25: split into
  `feature-patterns.md` (registration/naming core + index), `xit-act-patterns.md`,
  `dom-helpers.md`, `tile-ui-patterns.md`, `data-reactivity.md`, `css-patterns.md`,
  `formatting.md`. Went further than this entry's original suggestion (which proposed
  keeping DOM/tile-UI/data/formatting bundled as ~600 "general" lines) — repo owner opted
  for finer granularity instead.
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
