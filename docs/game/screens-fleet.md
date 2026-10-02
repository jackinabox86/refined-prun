# Fleet Screens (FLT, SFC, SHP, SHPI, SHPF, RT)

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

Opened from a BLU row's `test` action, or directly as `BTF <blueprint natural id>`. It takes one origin and one destination (address selectors), not an ordered multi-stop list. Two different locations fill the same mission-plan table as SFC, including the summary row (empty index and type) with total duration and STL/FTL consumption. A `LOCKED` blueprint computes the same way: `BP-STRT-0000` is `LOCKED` and returned a valid Amethyst b → Amethyst e plan. Setting the two locations is local form state plus a read-only address lookup; it does not launch a ship. `delete` on the BLU list removes a blueprint.

The loadout above the table is local form state and is an input to that plan. Fuel usage, Inventory, STL Fuel, FTL fuel, and Condition are `rc-slider` handles (`role="slider"`, `aria-valuenow`), not range inputs. FTL preferences is a `<select>` (`least jumps` / `shortest FTL route`) plus a Use gateways toggle. Reactor usage is `--` when the blueprint has no reactor choice. One ArrowRight or ArrowLeft changes a fuel handle by 1 unit. A pointer drag on the STL track (378px for 0..1500 on `BP-STRT-0000`) lands within about one unit of the aimed value, so a drag alone is not an exact tank level. Dropping STL from a full tank to about half on that blueprint changed Amethyst b → Amethyst e from `7h 27m 58s` / 175 STL to `14h 56m 56s` / 138 STL. When the tank is below what the route needs, the other sliders unmount and the status reads that more STL fuel is necessary.

The computed plan arrives as `SHIP_FLIGHT_MISSION` (`eta`, `stlFuelConsumption`, `ftlFuelConsumption`, `status: OK`). `C.MissionPlan.table` then carries that `missionId` as `data-prun-id`. The id stays the same when the route is edited or submitted again; each submit replaces the plan object, including a repeat of the same origin and destination, and selecting the origin alone submits against the destination still on screen. The table mounts after the message.

Segment addresses carry a `SYSTEM` line plus a location line. A planet stop's location line is `PLANET` with the planet natural id (`IA-158b`). A commodity-exchange stop's location line is `STATION` with the station natural id (`ANT`, `BEN`), not the system id. The requested leg is `segments[0].origin` and the last segment's `destination`.

Plan-level fuel is `0` for a type the leg does not use (in-system Amethyst b → Amethyst e was STL 227 and FTL 0; Benten Station → Antares Station was STL 270 and FTL 0). Per-segment `ftlFuelConsumption` is `null` on those same plans. The Duration cell can show a day unit and whole minutes (`1 day 5h 17m`) while `eta.millis` still rounds to that same minute (`105478126`).

## SHP — Ship Information

Fields: Type (e.g. Freighter), Commissioned, Blueprint, Project History (link to shipyard project), Fuel Tanks (STL/FTL levels), Cargo Hold, Operating empty mass, Volume, STL/FTL operating time, Condition ⓘ, Repair costs ⓘ, `repair` button (server). Context bar: `SFC <transponder>`.

The Blueprint line shows the blueprint's name, or its natural id when the name is null. That natural id is `Ship.blueprintNaturalId`. The BLU list uses the same display rule, so a named blueprint does not show its id there. Checked across 10 ships and 21 blueprints: each ship id matched exactly one loaded blueprint, including `AVI-05Y2T` → `BP-PSXY-5838` (`1st 2k`). An already-open BLU buffer does not refill the extension store after an extension reload; focusing it does not request `BLUEPRINT_BLUEPRINTS` again.

## SHPI — Ship Cargo Hold

Same material-grid UI as `INV <store-id>` (weight/volume gauges, sort tabs) scoped to the ship's hold. Context bar: `SHP`, `SHPF`, `SFC`.

Below the weight/volume gauges sits a standalone primary `unload` button (`Button__primary` style, live-verified) — a server action that dumps the entire hold into the local store in one click, same as FLT's per-row `unload`. It renders enabled even when the hold is empty. Used by the ACT `SHPI_UNLOAD` step for full-cargo offloads.

## SHPF — Ship Fuel Tanks

Two grids: STL fuel tank (SF) and FTL fuel tank (FF), each with weight/volume gauges. Context bar: `SHP`, `SHPI`, `SFC`.

## RT — Routes

`RT` lists routes. `RT <id>` opens one. Creating a route, adding a waypoint, saving a step or waypoint, assigning a ship, and the Loop toggle are server actions. `delete` on the list, and `Delete waypoint`, `Delete step`, and `CANCEL` in the editors, are server actions the staging runner does not click.

The route view has a Settings row labeled Loop. The switch is a small `div` whose own text is `Loop`, next to a `span` with the same word. It is not a button, and it is not the sidebar `Frame` toggle. A new route starts with that switch off: the div's text color is `rgb(153, 153, 153)`. On, that color is `rgb(221, 221, 221)`. The class does not change. A script-dispatched click leaves it off. The runner calls the div's React `onClick`. If the color does not change, it waits for the operator to flip the switch and press ACT. On an older route the same word was a sidebar `Frame` toggle whose indicator class includes `Active`. On staging, `RT-SNXV-3853` had Loop on and three waypoints — Antares Station (Antares I), Antares II - Deimos (ZV-759c), Antares I - Phobos (ZV-307d). The origin was not listed again at the end. The ROUTECONFIG bridge sets this toggle and does not append the origin as a final waypoint. The first stop's unload-all is what clears cargo the ship still holds when the loop comes back. A duplicate origin was not submitted; this is the shape of an existing looping route.

Each waypoint has an `Edit waypoint` button, separate from `Edit step`. The form is local until SAVE. It shows Destination, Fuel usage and Reactor usage as `rc-slider` handles (`role="slider"`, marks at 1%, 50%, and 100%), a Route preferences select (`least jumps` / `shortest FTL route`), a Use gateways check beside that select, and CANCEL and SAVE. The runner writes the leg's stored fuel usage, reactor usage, and gateway onto that form and leaves the route-preferences select alone. It tries the stored reactor number once. If the handle does not show that number, it waits for the operator to set Reactor usage and press ACT, then reads the handle again. A leg with no reactor slider cannot take a reactor value. SAVE is the commit.

Other waypoint commands on the route view are Load, Unload, Refuel, Wait, Load shipment, and Unload shipment. Shipment steps are not part of the ROUTECONFIG bridge.
