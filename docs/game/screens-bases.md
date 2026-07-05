# Base Screens (BS, BBL, BBC, WF, EXP)

## BS — Bases List

Table of all owned bases. Columns: Planet, Used Area, Permits ⓘ, Change Permits (with `add`/`rmv` buttons — server), plus a `view base` button per row → `BS <planet>`. Planet names are links.
Context bar: `HQ`, `BRA`, `ARC`.

## BS `<planet>` — Base Detail

Header `BASE: <planet name>`. Context bar: `PLI <planet>` (planet info), `INV <planet>` (inventories at address), `HQ`, `BRA <planet>`, `ARC`.

Top button row opens the base's sub-screens:

| Button | Opens |
|---|---|
| HQ | `HQ` (company headquarters — see `screens-company.md`) |
| Buildings | `BBL <base-id>` |
| Construct | `BBC <planet>` |
| Workforce | `WF <base-id>` |
| Experts | `EXP <base-id>` |
| Production | `PROD <base-id>` (see `screens-production.md`) |
| Inventory | `INV <store-id>` (focuses if already open — see `screens-inventory.md`) |

Sections: **Overview** (area Developed / avail / total with bar; permits), **Workforce Overview** (table: Level, Required, Current ⓘ, Capacity, Satisfaction — one row per tier), **Buildings** (ticker chips with counts, e.g. `HB1 2`).

## BBL — Buildings List

All buildings at a base, grouped by category (Infrastructure first). Per building: name, description, `repair` and `demolish` buttons (both server), Established age, Last repair, Repair costs ⓘ. Context bar: `BRA <planet>`.

## BBC — Building Construction

Buildable buildings grouped by category tabs: Infrastructure, Resources, Pioneers, Settlers, Technicians, Engineers, Scientists. Per building: name, description, required materials with missing counts (e.g. `MCG 40, 40 missing`), and a `build` button (server). Context bar: `BS`, `BS <planet>`, `PLI <planet>`.

## WF — Workforce

Tier tabs: PIO SET TEC ENG SCI. Table columns: Needs, Category, Essential ⓘ, Total ⓘ, Days ⓘ, then one column per tier (Pioneers…Scientists). Rows: Workforce Size / Capacity, Required, Total Satisfaction, then one row per consumable (ticker + name) showing supply days per tier. Read-only.

## EXP — Experts

Header: total experts, `Active / Max` (per-category max 5). Table columns: Category, Active, Efficiency Gain, Controls (`act`/`rmv` buttons — server), Available, Progress, ETA. One row per industry category (Agriculture, Chemistry, Construction, Electronics, …).
