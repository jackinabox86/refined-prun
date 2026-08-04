# Refined PrUn Documentation

The project is a browser extension for the game. Throughout the chat and the docs, anything related to the "game" includes ONLY the things that are available in the game; anything related to the "extension" includes ONLY the things that are available in the browser extension.

# Go-to places

- **Feature development:** `docs/feature-patterns.md`. One-stop cookbook: registration, naming, DOM helpers, reactivity rules, CSS patterns, data access, formatting.
- **Code review / style:** `docs/contributing.md`. Code style rules, feature design philosophy, UI/UX guidelines, workflow rules.
- **Architecture / infra:** `docs/architecture.md`. Build system, source layout, dependency layers, infrastructure internals.
- **Game concepts:** `docs/game/game-concepts.md`. Factions, materials, planets, bases, production, trading, shipping.
- **Game UI:** `docs/game/ui-concepts.md`. APEX terminal interface, tiles, screens, data display conventions.
- **Game commands:** `docs/game/commands.csv`. Columns: Command, Description, Mandatory parameters, Optional parameters.
- **Game screens:** `docs/game/sidebar-screens.md`. Left-sidebar shortcuts, screen connection map, server-action buttons to avoid in tests; per-area details in `docs/game/screens-*.md` (bases, production, inventory, fleet, trade, contracts, company, comms).
- **Browser testing / visual verification:** `.claude/skills/run/SKILL.md`. Launch harness, pw-act actions, hard-won gotchas. Use it for anything that must be verified against the live game.
- **Data catalog and agent queries:** `docs/data-catalog.md`. Passive snapshots, provenance and completeness semantics, `XIT DATA`, tile exports, and the authenticated loopback query protocol.
- **Planetary governance:** `docs/game/planetary-governance.md`. Population, happiness, governors, CoGC, POPI.
