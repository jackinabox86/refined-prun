# Inventory Screens (INV, UPCK, WAR)

## INV — Inventories List

Table of all stores. Columns: Type, Location, Name, Weight, Volume, plus an `open` button per row → `INV <store-id>`.

Type filter chips above the table (toggle to include/exclude): `BS` (base storage), `SHP` (ship cargo), `STL`/`FTL` (fuel tanks), `WAR` (warehouse), `CON` (?), `UPK` (?), `VTX` (?) — unverified expansions marked (?).

`INV <address>` shows only stores at that address (used by the `INV <planet>` context link on `BS <planet>`).

## INV `<store-id>` — Single Inventory

Grid of material stacks (colored ticker icons with quantity). Header: location link, Weight and Volume gauges (`used / max`).

Sort tabs: `ABC` (alphabetical), `CAT` (by material category), `AMT`, `TCK`, `WGT`, `VOL`. Clicking a tab re-sorts the grid.

Material stacks are **drag sources**: dragging a stack onto another open inventory transfers materials — the drop is a server action; never dispatch a real drop between game inventories in tests.

Context bar: `WAR <planet>` (when a warehouse exists at the site), `UPCK <store-id>` (Unpack).

Ship variants of the same grid UI: `SHPI` (cargo hold), `SHPF` (fuel tanks) — see `screens-fleet.md`.

## UPCK — Unpack

Unpacking of consumable bundles in a store (server action to execute).

## WAR — Warehouse

General information about a rented warehouse unit (capacity, rent). Reached from `INV` context bar or CX station links.
