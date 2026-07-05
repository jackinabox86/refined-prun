# Fleet Screens (FLT, SFC, SHP, SHPI, SHPF)

## FLT — Fleet

Table of all ships. Columns: Transponder, Name, Cargo, Status, Fuel, Location, Destination, ETA, Command. Transponder and name are links → `SHP <transponder>`.

Per-row command buttons:
- `view` → `SFC <transponder>` (flight control)
- `cargo` → `SHPI <transponder>`
- `fuel` → `SHPF <transponder>`
- `unload` — server action (transfers cargo to local store)
- `fly` — opens flight configuration; the departure submit is a server action

Optional Address parameter filters the fleet by location.

## SFC — Ship Flight Control

Shows Ship (name + transponder links), Origin, Destination and the flight segment table: #, Type, Destination, Duration, Distance, Damage, Consumption. `abort` button cancels an active flight (server). Location names are links (station/planet screens).

## SHP — Ship Information

Fields: Type (e.g. Freighter), Commissioned, Blueprint, Project History (link to shipyard project), Fuel Tanks (STL/FTL levels), Cargo Hold, Operating empty mass, Volume, STL/FTL operating time, Condition ⓘ, Repair costs ⓘ, `repair` button (server). Context bar: `SFC <transponder>`.

## SHPI — Ship Cargo Hold

Same material-grid UI as `INV <store-id>` (weight/volume gauges, sort tabs) scoped to the ship's hold. Context bar: `SHP`, `SHPF`, `SFC`.

## SHPF — Ship Fuel Tanks

Two grids: STL fuel tank (SF) and FTL fuel tank (FF), each with weight/volume gauges. Context bar: `SHP`, `SHPI`, `SFC`.
