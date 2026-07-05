# Contract Screens (CONTS, CONT, CONTD)

## CONTS — Contracts List

All contracts. Status filter chips (toggle): draft, open, rejected, deadline exceeded, breached, cancelled, terminated, closed, partially fulfilled, fulfilled — plus `all` / `none` / `hide filters` controls. Columns: Contract (natural id, e.g. `Y8JC07P`), Partner (company link), Created, Due, Status, Cmds (`view` button → `CONT <id>`). "Click to load more" pagination. Context bar: `CONTD`.

## CONT `<id>` — Contract Detail

Sections: **Preamble** (partner, negotiated terms) and **Contract conditions** table: Index, Condition, Deadline ⓘ, Party, Status, Depends on, Cmds. Condition text embeds material links (`MAT`) and location links. Per-condition `fulfill` buttons and `request termination` are server actions. Context bar: `CONTS`, `CONTD`.

## CONTD — Contract Drafts

List of contract drafts; `View` on a row opens the draft editor (re-focuses an existing window if that draft is already open). **`Create New` is a server action** — it creates a real draft on the account (see run-skill gotcha #6); never click it in tests.

The draft editor's "Select Template" leads to the BUYING/SELLING commodity template screen (Amount, Price per unit, "add commodity" appends rows).
