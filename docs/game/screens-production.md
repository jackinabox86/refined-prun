# Production Screens (PROD, PRODQ, PRODCO)

## PROD — All Production Lines

Bases grouped under headers; table columns per base: Planet, Efficiency, Slots. Each production line row shows the building name (link) with `Queue` and `Order` buttons:
- `Queue` → `PRODQ <line-id>` (order queue)
- `Order` → `PRODCO <line-id>` (create order form)

Context bar: `BS`.

## PROD `<base-id>` — Local Production Lines

Same data scoped to one base; rendered as one panel per line (building name, `new order` button, `Details` button, active order chips with output ticker, units, countdown, % done, wall-clock ETA). Context bar: `PROD` (all lines), `BS <planet>`.

This is also the view embedded in docked base screens.

## PRODQ — Production Line Queue

Order queue of one line. Columns: (drag handle), (order), Fee, Input, Output, Completion / Duration, Status, plus per-order `cancel` button (server). Fees link to the planet government (`POPI`-adjacent screens). `New Order` button → `PRODCO <line-id>`.

Context bar: `PROD` (all), `BS <planet>`, `PROD <base-id>` (local), `PRODCO <line-id>` (create order).

## PRODCO — Create Production Order

Order configuration form (recipe pick, amount). Queuing the order is a server action — safe to open, do not submit in tests.
