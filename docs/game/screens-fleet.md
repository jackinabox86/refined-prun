# Fleet Screens (FLT, SFC, SHP, SHPI, SHPF)

## FLT — Fleet

Table of all ships. Columns: Transponder, Name, Cargo, Status, Fuel, Location, Destination, ETA, Command. Transponder and name are links → `SHP <transponder>`.

Per-row command buttons:
- `view` → `SFC <transponder>` (flight control)
- `cargo` → `SHPI <transponder>`
- `fuel` → `SHPF <transponder>`
- `unload` — server action (transfers cargo to local store)
- `fly` — opens flight configuration; the departure submit is a server action. Selecting a destination renders the full mission-plan table (including the fee-bearing `Fees` column) as a client-side preview — safe for testing without launching a flight.

Optional Address parameter filters the fleet by location.

## SFC — Ship Flight Control

Shows Ship (name + transponder links), Origin, Destination and the flight segment table: #, Type, Destination, Duration, Distance, Damage, Consumption. `abort` button cancels an active flight (server). Location names are links (station/planet screens). On flights that incur fees the segment table gains a `Fees` column and the `Damage` header gains an ⓘ info icon (both absent otherwise — column indices shift and header text changes); fee cells can contain multiple currency amounts concatenated without spacing, e.g. `12,000 AIC4,000 CIS`, and the summary row totals them per currency. The summary row (empty first cell) sits in its own `tbody` inside the table — that `tbody` is what `C.MissionPlan.stats` matches (there is no separate stats bar), so extension content injected into a summary-row cell is a descendant of `stats`.

## BTF — Blueprint Test Flight

Opened from a BLU row's `test` action, or directly as `BTF <blueprint natural id>`. It takes one origin and one destination (address selectors), not an ordered multi-stop list. On a `VALID` blueprint, two different locations fill the same mission-plan table as SFC, including the summary row (empty index and type) with total duration and STL/FTL consumption. A `LOCKED` blueprint stays at `--` and does not compute. Setting the two locations is local form state plus a read-only address lookup; it does not launch a ship. `delete` on the BLU list removes a blueprint.

The computed plan arrives as `SHIP_FLIGHT_MISSION` (`eta`, `stlFuelConsumption`, `ftlFuelConsumption`, `status: OK`). `C.MissionPlan.table` then carries that `missionId` as `data-prun-id`. The id stays the same when the route is edited or submitted again; each submit replaces the plan object, including a repeat of the same origin and destination. `0` fuel is a real figure. The table mounts after the message.

## SHP — Ship Information

Fields: Type (e.g. Freighter), Commissioned, Blueprint, Project History (link to shipyard project), Fuel Tanks (STL/FTL levels), Cargo Hold, Operating empty mass, Volume, STL/FTL operating time, Condition ⓘ, Repair costs ⓘ, `repair` button (server). Context bar: `SFC <transponder>`.

## SHPI — Ship Cargo Hold

Same material-grid UI as `INV <store-id>` (weight/volume gauges, sort tabs) scoped to the ship's hold. Context bar: `SHP`, `SHPF`, `SFC`.

Below the weight/volume gauges sits a standalone primary `unload` button (`Button__primary` style, live-verified) — a server action that dumps the entire hold into the local store in one click, same as FLT's per-row `unload`. It renders enabled even when the hold is empty. Used by the ACT `SHPI_UNLOAD` step for full-cargo offloads.

## SHPF — Ship Fuel Tanks

Two grids: STL fuel tank (SF) and FTL fuel tank (FF), each with weight/volume gauges. Context bar: `SHP`, `SHPI`, `SFC`.
