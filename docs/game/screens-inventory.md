# Inventory Screens (INV, UPCK, WAR)

## INV — Inventories List

Table of all stores. Columns: Type, Location, Name, Weight, Volume, plus an `open` button per row → `INV <store-id>`.

Type filter chips above the table (toggle to include/exclude): `BS` (base storage), `SHP` (ship cargo), `STL`/`FTL` (fuel tanks), `WAR` (warehouse), `CON` (?), `UPK` (?), `VTX` (?) — unverified expansions marked (?).

`INV <address>` shows only stores at that address (used by the `INV <planet>` context link on `BS <planet>`).

## INV `<store-id>` — Single Inventory

Grid of material stacks (colored ticker icons with quantity). Header: location link, Weight and Volume gauges (`used / max`).

Sort tabs: `ABC` (alphabetical), `CAT` (by material category), `AMT`, `TCK`, `WGT`, `VOL`. Clicking a tab re-sorts the grid.

Material stacks are **drag sources**: dragging a stack onto another open inventory transfers materials — the drop is a server action; never dispatch a real drop between game inventories in tests.

### Stack selection and drag-transfer (live-verified)

- **Ctrl-click toggles per-stack selection** (lighter border on selected icons); plain click opens the stack's `MAT` info buffer and does not affect selection. Selection is per-item with no exclusivity. In the DOM, the marker class `GridItemView__selected` sits on the `GridItemView__container` wrapper (parent of the `draggable="true"` image node) and **persists during and after a drag** — readable at drop time. Stacks belong to an enclosing `InventoryView__grid`, which scopes a selection query to one inventory.
- **Dragging a selected stack drags the whole selection; dragging an unselected stack drags only that stack and clears the selection.**
- **Drag-transfer works only between inventories at the same location.** Hovering a cross-location inventory renders a single red `DropTargetView__impossible` cell instead of amount boxes.
- **Quick-transfer overlay boxes** on a valid hover: `AMT`, powers of ten up to the stack size, `HLF`, `ALL` (plus an always-present "impossible" fallback cell). A **multi-stack drag omits the AMT box** — only numeric/HLF/ALL appear.
- **Dropping on AMT does not transfer** — it opens the `MTRA` (MATERIAL TRANSFER) buffer: source/target store selects prefilled to the dragged pair, a slider (min 1, max = stack size), a numeric text input prefilled `"1"` and **not auto-focused**, and a TRANSFER button (server action). The input is not clamped as you type (typed overflow stays; only the slider pins at max) — validation is at submit. Escape is not wired; cancel by closing the buffer.
- `INV <planet>` list rows' `open` button focuses an existing docked tile for that store instead of opening a new floating buffer.

Context bar: `WAR <planet>` (when a warehouse exists at the site), `UPCK <store-id>` (Unpack).

Ship variants of the same grid UI: `SHPI` (cargo hold), `SHPF` (fuel tanks) — see `screens-fleet.md`.

## UPCK — Unpack

Unpacking of consumable bundles in a store (server action to execute).

## WAR — Warehouse

General information about a rented warehouse unit (capacity, rent). Reached from `INV` context bar or CX station links.
