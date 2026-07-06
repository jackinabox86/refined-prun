# Contract Screens (CONTS, CONT, CONTD)

## CONTS — Contracts List

All contracts. Status filter chips (toggle): draft, open, rejected, deadline exceeded, breached, cancelled, terminated, closed, partially fulfilled, fulfilled — plus `all` / `none` / `hide filters` controls. Columns: Contract (natural id, e.g. `Y8JC07P`), Partner (company link), Created, Due, Status, Cmds (`view` button → `CONT <id>`). "Click to load more" pagination. Context bar: `CONTD`.

## CONT `<id>` — Contract Detail

Sections: **Preamble** (partner, negotiated terms) and **Contract conditions** table: Index, Condition, Deadline ⓘ, Party, Status, Depends on, Cmds. Condition text embeds material links (`MAT`) and location links. Per-condition `fulfill` buttons and `request termination` are server actions. Context bar: `CONTS`, `CONTD`.

## CONTD — Contract Drafts

List of contract drafts; `View` on a row opens the draft editor (re-focuses an existing window if that draft is already open). **`Create New` is a server action** — it creates a real draft on the account (see run-skill gotcha #6); never click it in tests.

The draft editor's "Select Template" leads to the template screen. The template type `<select>` offers `BUY`, `SELL`, `SHIP`, `LOAN_INTEREST`, `LOAN_ANNUITY`, `LOAN_STABLE`. Each template keeps its own form state — switching types back and forth does not lose entered values.

**Every field fill on this screen is local form state; "apply template" is the server call** (it sends the template and the server rewrites the draft's conditions). "cancel" discards locally. The address autosuggest is the one exception of a kind: typing fires a read-only `NOMENCLATURE_QUERY_ADDRESSES` query to the game's nomenclature-registry — a lookup, not a mutation.

### Template fields (verified live)

| Field | BUY / SELL | SHIP |
|---|---|---|
| Currency select (AIC/CIS/ICA/NCC) | ✓ | ✓ |
| Per-commodity group ×N | Amount (`trades[i].amount`), Commodity (MaterialSelector), Price per unit (`trades[i].pricePerUnit`) | Amount (`shipments[i].amount`), Commodity; Cargo t/m³ is computed |
| Contract-wide price | — (Total is computed) | single `price` input, charged once **per shipment row** (total = price × rows) |
| Location | 1× AddressSelector | 2× AddressSelector (Origin, Destination) |
| Auto-provision store select | — | ✓ options populate only after Origin resolves |
| Deadline (days, `deadline`) | ✓ | ✓ |

"add commodity" / "add shipment" appends a group.

After a commodity is picked, the MaterialSelector input holds the i18n **display name** ("Basic Rations"), and the ticker/icon markup disappears from the group — a ColoredIcon with the ticker exists only inside the open suggestion dropdown. Reading a selected commodity back therefore requires the display-name → material lookup (`getMaterialByName`), not DOM icon scraping.

### AddressSelector autosuggest gotchas

Suggestions render in `#autosuggest-portal` (outside the tile DOM; only one portal open at a time). On focus, the portal first shows a **default list** (own bases, warehouses, CX stations) for the empty query; the typed query's search results only arrive after the server round-trip. Code that clicks as soon as *any* suggestion exists picks from the stale default list — wait for an entry whose text matches the query. Picking a suggestion canonicalizes the input to the address's natural id: a station becomes its system id (`Moria Station` → `OT-580`), a planet its planet id (`Montem` → `OT-580b`).
