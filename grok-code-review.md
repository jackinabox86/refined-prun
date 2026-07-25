# Refined PrUn — AI Code Review Context

**Repo**: https://github.com/jackinabox86/refined-prun  
**Project**: Browser extension that enhances the Prosperous Universe (PrUn) APEX terminal UI.

When you ask me to review code, **always include a link to this file** so I load the full ruleset.

---

## Core Instructions (from AGENTS.md)

- Be extremely concise. Sacrifice grammar for brevity.
- Never blindly assume how the game works. If unsure → read relevant docs first.
- If no doc exists, state assumption clearly and ask for confirmation before proceeding.
- Pay attention: if you see something stupid, call it out immediately.

---

## Mandatory Review Checklist

For **every** code review, verify compliance with:

### 1. Style & Code Quality (docs/contributing.md)
- Early returns / inverted conditions (no deep nesting).
- Single-param lambdas use `x` (except `subscribe` callbacks that match class name).
- Minimal type annotations (let TS infer).
- Use `!` for guaranteed DOM properties (`parentElement!`).
- Comments: separate line, capital letter, full stop.
- Unicode: prefer escapes for Font Awesome.
- CSS: `0` instead of `0px`.
- No auto import sorting in PRs (project-wide only).
- Reuse existing components (`PrunButton`, `PrunLink`, etc.) and Vue slots.

### 2. Feature Design Rules (docs/contributing.md + docs/feature-patterns.md)
- **Basic** vs **Advanced**: information-removing/hiding features go in `advanced/`.
- One responsibility per feature. No hidden coupling.
- All features enabled by default. Minimize (ideally eliminate) settings.
- New vertical-space or controversial features need Discord poll (~75% yes).
- Vanilla bug fixes → `src/features/basic/prun-bugs.ts`.
- Feature ID = filename (from `import.meta.url`).
- Clear description in `features.add(...)`.

### 3. Architecture & Patterns (docs/architecture.md + docs/dom-helpers.md + docs/data-reactivity.md)
- Respect dependency layers (features → core → infrastructure → utils; no upward imports).
- Use **only** auto-imported symbols where possible (`$`, `$$`, `C`, `tiles`, `subscribe`, `createFragmentApp`, etc.).
- Prefer `C.` selectors over raw class names (hashes change).
- DOM helpers:
  - `$` / `$$` for async (MutationObserver).
  - `_$` / `_$$` for sync when elements are guaranteed present.
- Reactivity: prefer `computed` over `watch`/`watchEffect`.
- Game data: use entity stores from `@src/infrastructure/prun-api/data/*` (never raw strings for identification).
- Tiles: `tiles.observe(...)`.
- No server requests without explicit user click (ToS).

### 4. UI/UX Philosophy
- Minimize new DOM elements.
- Match PrUn’s muted visual style (use game palette colors).
- Tooltips via `data-tooltip` attribute.
- Respect vertical space.

### 5. Documentation & Workflow
- Always check relevant docs first (`docs/README.md` lists them).
- Do not edit `CHANGELOG.md` in PRs.
- Follow exact patterns from `docs/feature-patterns.md` (registration) and its split-out topic docs — XIT commands (`docs/xit-act-patterns.md`), Vue mounting / reactive DOM (`docs/dom-helpers.md`), tile/window UI (`docs/tile-ui-patterns.md`).

---

## Key Docs to Reference During Review

| Purpose                        | File                                      |
|--------------------------------|-------------------------------------------|
| Feature registration/naming    | `docs/feature-patterns.md`                |
| XIT commands / ACT actions     | `docs/xit-act-patterns.md`                |
| DOM helpers / mounting Vue     | `docs/dom-helpers.md`                     |
| Tile/window UI patterns        | `docs/tile-ui-patterns.md`                |
| Game data access / reactivity  | `docs/data-reactivity.md`                 |
| CSS patterns                   | `docs/css-patterns.md`                    |
| Date/number formatting         | `docs/formatting.md`                      |
| Style + design rules           | `docs/contributing.md`                    |
| Architecture & layers          | `docs/architecture.md`                    |
| Game UI concepts               | `docs/game/ui-concepts.md`                |
| Game concepts                  | `docs/game/game-concepts.md`              |
| Commands reference             | `docs/game/commands.csv`                  |

---

**When reviewing**:
1. Summarize what the code does.
2. List any violations of the above rules (with quotes/locations).
3. Suggest fixes in the exact style of the codebase.
4. Highlight good patterns or opportunities for improvement.
