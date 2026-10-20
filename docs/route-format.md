# Route import and export format

XIT ROUTECONFIG can export a route as JSON and import one back as a new route. Use it to share
routes with other players, or to write routes in your own tools and bring them into the game.

- **EXPORT** (next to RENAME) shows the selected route's JSON in a box and copies it to the
  clipboard.
- **IMPORT** (next to NEW) opens the same box. Paste JSON and press **IMPORT AS NEW ROUTE**.
  Import always creates a new route; it never changes an existing one.

After an import, pick a ship if the file did not set one you own, and press **TRANSITS** to
measure flight times. **SET ROUTE** then builds the game route.

## A minimal route

Only `stops` is required:

```json
{
  "stops": [
    { "kind": "cx", "id": "AI1" },
    { "kind": "base", "id": "ZV-759c" }
  ]
}
```

This loops AI1 → ZV-759c → AI1, and supplies ZV-759c from supply days.

## Route fields

| Field            | Type             | Default            | Meaning                                                                                                                                |
| ---------------- | ---------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `format`         | `"rpr-route"`    | —                  | Marks the file as a route. Optional; any other value is refused.                                                                      |
| `version`        | whole number     | —                  | Format version. Optional. This extension reads version `1` and refuses newer ones.                                                    |
| `name`           | string           | `"Imported route"` | Route name.                                                                                                                            |
| `stops`          | list of stops    | required           | The waypoints in order. See below.                                                                                                     |
| `ship`           | string           | none               | Ship registration, such as `AVI-00090`. Dropped on import when you do not own that ship.                                               |
| `supplyDays`     | number, 0 or more | from flight times | How many days of consumption each base receives. Snapped to 0.1, at most 999.                                                         |
| `loop`           | `true` / `false` | `true`             | `true` uses the game's Loop toggle, so the ship flies back to the first stop and starts again. `false` runs the stops once.            |
| `returnToOrigin` | `true` / `false` | none               | Only on a one-way route. Records that TRANSITS was told the route ends back at its origin. The final origin visit is already in `stops`. |
| `wait`           | object           | none               | A pause after the last waypoint: `{"amount": 3, "unit": "days"}`. Units are `seconds`, `minutes`, `hours`, `days`. Amount 0 means no wait. |

Flight times, fuel and reactor settings, and the game route id are not part of the file. They
belong to one player's ship, so TRANSITS measures them again after an import.

## Stops

```json
{ "kind": "base", "id": "ZV-759c", "supply": { "RAT": 120 }, "steps": ["unload ALO all all"] }
```

| Field    | Type                | Meaning                                                                                                                 |
| -------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `kind`   | `"cx"` or `"base"`  | A commodity exchange or a planet.                                                                                       |
| `id`     | string              | Exchange code (`AI1`, `NC1`) or planet natural id (`ZV-759c`). Exchange codes are upper-cased; planet ids keep their case. |
| `supply` | object, bases only  | A set delivery in place of the supply-days bill. See [Set deliveries](#set-deliveries).                                 |
| `steps`  | list of strings     | Extra steps at this stop. See [Stop steps](#stop-steps).                                                                |

Rules:

- The first stop is the origin. Routes work best when it is an exchange: Restock and ROUTEBUY buy
  what the route loads there.
- Only the origin may appear again. Each later visit starts a new stretch: the ship drops what it
  carries, refuels, and loads only for the stops up to the next origin visit.
- Any other stop listed twice is refused.
- A planet where you have no base stays on the route, but the plan delivers nothing there. Its own
  `steps` still run.

## Set deliveries

By default each base receives what it consumes over `supplyDays`. Give a base a `supply` to
choose the materials and units yourself:

```json
{ "kind": "base", "id": "ZV-759c", "supply": { "RAT": 120, "DW": 80, "OVE": 20 } }
```

- Keys are material tickers. Values are whole units, 0 or more. A 0 is dropped.
- `{}` delivers nothing to that base. Its outputs are still picked up.
- A set delivery is planned the same way as a supply-days bill: the ship loads it at the origin,
  the cargo check and FIT count it, ROUTEBUY and Restock buy it, and the base keeps exactly that
  much of each material when the ship calls.
- Fuel the ship refuels at that base is still added on top.
- The delivery is per visit. Supply days no longer change it, though they still size the base's
  output pickups.

In ROUTECONFIG, press **EDIT** on a stop and type the delivery as `RAT 120, DW 80`, or `none`.
Clear the field to go back to supply days. **EDIT\*** marks a stop with its own settings.

## Stop steps

`steps` adds game route steps at a stop, after the ones the plan creates. Use them to haul
cargo the plan does not know about: load at one stop, unload at another.

```json
{
  "stops": [
    { "kind": "cx", "id": "AI1", "steps": ["load ALO 0 capacity retain 500"] },
    { "kind": "base", "id": "ZV-759c", "steps": ["unload ALO all all"] }
  ]
}
```

The syntax is the same as one step on an XIT RTACT stop line. Words are separated by spaces;
tickers and words are not case-sensitive.

| Step                                    | Example                         | Meaning                                                                                 |
| --------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `load TICKER MIN MAX`                   | `load RAT 100 100`              | Load between MIN and MAX units. Each is a number or `capacity`.                         |
| `load TICKER MIN MAX retain N`          | `load RAT 0 capacity retain 50` | Same, but leave N units at the location. This one takes everything above 50.             |
| `unload TICKER MIN MAX`                 | `unload DW all all`             | Unload between MIN and MAX units. Each is a number or `all` (everything carried).       |
| `refuel TANK SOURCE MIN MAX`            | `refuel STL local capacity capacity` | TANK is `STL` or `FTL`; SOURCE is `ship` or `local`. MIN and MAX are units or `capacity`. |
| `wait AMOUNT UNIT`                      | `wait 2 hours`                  | Pause at the stop. UNIT is `seconds`, `minutes`, `hours`, or `days`.                    |

At each stop the order is: the plan's unloads and loads, its refuels, then the stop's own steps
in the order listed. The route `wait` comes last, at the final stop.

Stop steps are outside the plan. The cargo check, FIT, ROUTEBUY and Restock do not count them,
so leave room in the hold for them. The game takes whole numbers for wait amounts.

In ROUTECONFIG, press **EDIT** on a stop and type the steps on one line, separated by `|`:
`unload ALO all all | load DW 0 capacity retain 20`.

Contract shipments (the game's Load shipment and Unload shipment steps) are not supported yet.

## A full example

```json
{
  "format": "rpr-route",
  "version": 1,
  "name": "Antares supply",
  "stops": [
    { "kind": "cx", "id": "AI1" },
    { "kind": "base", "id": "ZV-759c" },
    { "kind": "base", "id": "ZV-307d", "supply": { "RAT": 200, "DW": 200 } },
    { "kind": "cx", "id": "AI1" },
    { "kind": "base", "id": "ZV-194a", "steps": ["unload ALO all all", "wait 30 minutes"] }
  ],
  "ship": "AVI-00090",
  "supplyDays": 7,
  "loop": true,
  "wait": { "amount": 1, "unit": "days" }
}
```

This route supplies ZV-759c for 7 days and ZV-307d with a set 200 RAT and 200 DW, returns to
AI1 to reload, then flies to ZV-194a, unloads any ALO it carries, waits 30 minutes, and loops
after a one-day wait.

## Import errors

Import stops at the first problem and says where it is, for example:

- `Stop 3 (ZV-307d): RAT amount must be a whole number, 0 or more.`
- `Stop 1 (AI1): supply is for bases only. Use steps on an exchange.`
- `Stop 2 (ZV-759c): step 1 (unload DW capacity all): unload uses units or all, not capacity.`
- `Stop 4 (ZV-759c) is already on the route. Only the first stop can repeat.`
- `Route version 2 is newer than this extension.`

Nothing is created until the whole file is valid.
