# Changelog

## Unreleased

## 1.1.11

### Added

- `nots-notification-type-label`: Ship route notifications get a `ROUTE` label: route completed, route aborted (not flyable or no license), shipment too large, and shipment not unloaded.

### Changed

- `XIT FLOW`: Buy and sell prices default to VWAP7D on your pricing exchange, instead of the Ask for buy and the Bid for sell. Market-maker materials use the MM buy price. Your per-ticker price overrides still apply.

### Fixed

- `XIT TRANSITS`: Ships without an FTL drive can be timed. A run no longer stops on "FTL fuel was not confirmed", and a Fuel usage or Reactor usage carried over from the last leg starts at the nearest end of the next leg's range instead of failing that leg.
- `XIT TRANSITS`: An open TRANSITS follows stops added, removed, or reordered in XIT ROUTECONFIG. A run whose stops no longer match the route's stops does not save its flight times and fuel to the route, and the log says to run TRANSITS again.
- `cxos-hide-delete-filled`: DELETE FILLED is hidden again while the CXOS filters are collapsed.
- `XIT CXOS`: Opening a ticker's details opens the CXOS Filters section when it is collapsed, so the tile still filters to that ticker and exchange.
- `flt-shorten-addresses`: Only the Location and Destination columns are shortened. Ship names and the Route column are left as they are.
- `unclipped-tooltips`: Long tooltips wrap to fit on screen, and tooltips with line breaks keep them.

### Removed

- `contd-upward-search-results`: The game now shows CONTD user search results outside the tile.

## 1.1.10

### Added

- `XIT LOWSTRIFE`: Repair toggle (off by default) and Time Offset (default 1, like REPAIRACT's). With Repair on, the load includes repair materials for every production building on the base. They take ship room but do not lower Production Days. Repair rows read `repair` in the Days column and can be unchecked like burn materials.

### Fixed

- `XIT ROUTECONFIG`: SET ROUTE searches for each stop, so a planet that is not one of your bases, warehouses, or CX stations is picked in a fraction of a second instead of stalling and asking you to pick it by hand.
- `flt-ship-condition` / `flt-flight-status-icons`: Follow FLT's new layout after the game removed the Transponder column. The condition label is back next to the ship name, and the status styling is on Status instead of Fuel.

### Removed

- `flt-hide-transponder`: The game removed FLT's Transponder column. On the new layout this feature hid the ship name instead.

## 1.1.9

### Changed

- `XIT ROUTECONFIG`: SET ROUTE works on the live game server now that the game's route update has shipped there. The PREVIEW button that stood in for it is gone.

## 1.1.8

### Changed

- `XIT LOWSTRIFE`: With Consumable Days at 0, the planner loads production inputs only, as many days as fit, and DW tops up the rest.
- `XIT LOWSTRIFEACT`: The loaded ship's SFC goes to the base it was loaded for. LOWSTRIFEACT has the per-base auto SFC toggle, like BURNACT, REPAIRACT, and GOVBURNEXEC.
- Base pickers in `XIT ACT` (Quickstart's Planet to Resupply, and a resupply or repair Planet set to Configure on Execution) and in `XIT TODO` Resupply and Repair tasks are type-to-search. Type a base name or planet id, then pick with the mouse or the arrow keys and Enter. XIT TODO lists bases in the game's order.
- Material picks in `XIT ACT` MTRA and CONT steps, CONTD paste-import and fill-all, and the one-row XIT toolbars work with both the current game client and the upcoming game update.

### Fixed

- `XIT LOWSTRIFE`: A load that fills the ship exactly is no longer shown in red as over the limit, and EXECUTE stays enabled.

## 1.1.7

### Added

- `XIT ROUTECONFIG`: !BETA!  See https://oogcapitalmanagement.com/posts/oog-fork-shipping-routes-preview/ for more info.  Plan a shipping route. Drag a commodity exchange and bases into stop order, pick a ship, and set supply days. Each stop shows its loads, unloads, and fuel, and TRANSITS times the legs. SET ROUTE builds the route in the game's RT editor and needs the game's route update, which is on the staging server only for now.
- `XIT TRANSITS`: Runs a proposed route through blueprints to determine flight duration and fuel cost, as well as toggle gateway use. 
- `XIT ROUTEBURN`: One row per saved route with its lowest burn, production, and repair, split into Automated (looping) and On-Demand routes. Each exchange origin has a restock countdown, and RESTOCK buys the route departures due within the Route Supply days. ASSIGN buys an on-demand route's shortfall and assigns its ship.
- `XIT ROUTETRACK`: Ships on game routes, with the next arrival and when the route ends or loops.
- `cont-fulfill-route-stock`: CONT FULFILL asks before handing over CX warehouse stock a route restock bought for your routes. XIT ACT MTRA transfers ask the same, and CX Buy and Refuel do not count that stock as on hand.
- `XIT CXOS`: Taiyi Contribution! Trade overview with recent CX trades per ticker and CX inventory next to open asks. Clicking a ticker opens the CXOS tile filtered to it beside `CXPO`. The exchange, category, and search filters are for PRO players.
- `cxo-ticker-details-link`: A `TICKER.EXCHANGE` link in CXO opens the XIT CXOS details view instead of `CXP`.
- `XIT LOWSTRIFE`: Ship loading planner for a planet based on Lowstrife sheet. Pick a ship and it loads consumables for a set number of days (default 60), production inputs for as many days as fit, and fills the spare room with DW. EXECUTE runs the load in `XIT LOWSTRIFEACT`, and COPY copies the action package JSON.

### Changed

-  `XIT SET` Route: Route Supply days, plus the red and yellow thresholds for XIT ROUTEBURN origin countdowns.

### Fixed

- `XIT AGENT`: A package whose base is set to Configure on Execution, such as the single-group agent post from BURNACT, REPAIRACT, or GOVBURNEXEC, loads the base's output before Open SFC.
- `XIT BS`: Burn days are colored from the unrounded value, matching XIT BURN. 7.3 days against a yellow threshold of 7 is green.

## 1.1.6

### Changed

- `nots-shift-click-mark-read`: Shift-click companions the same buffer a plain click opens, so a COGC program change opens the repeat-program vote and a ship arrival opens `SHPI`. In a NOTS docked on a screen, shift-click acts as a plain click. Ctrl-click still marks the row read.

### Fixed

- `XIT BS`: An open CMDS menu keeps the row's gray highlight after the pointer leaves, until CMDS is clicked again.

## 1.1.5

### Added

- XIT Repair settings: Global repair settings are now managed in `XIT SET` Gameplay with Target age (default 60) and Red and Yellow thresholds (defaults 3 / 7). Also, a new countdown toggle: “on”, XIT BS and XIT DISPATCH repair cells count down to the planet target or the global target. “Off” still shows the age counting off.
- `XIT FLTBUTTONS`: Pick FLT unload-button colors for Base or CX, empty or loaded. Defaults stay blue when empty and orange with cargo.
- `XIT SET SFC`: Up to four SFC destination shortcuts, each a label plus an exchange or planet. Defaults remain ANT, BEN, HRT, and MOR. A blank destination hides that button. A button is grayed out when the ship is already there.
- `XIT GOVBURNACT`: Off-by-default force CX buy. On, the CX Buy bill ignores warehouse stock. Other CX Buy packages still subtract it.
- `XIT SET` Act: Optional XIT BS Days "one decimal", off by default. On, a burn under 10 days shows one decimal. Off keeps a whole number.
- `XIT INV`: A name click opens `BS`, `SHP`, or `CX`. The bar still opens inventory.
- `lm-link`: SHPI shows `LM {location}` at a commodity exchange or a planet with a local market, and the SHP / SHPF / SFC links drop the ship id. The planet right-click menu uses the same LM command.
- `XIT BURNACT`: REFUEL toggle, on by default and remembered globally. On, the package starts with Refuel on all exchanges.
- `xit-conts-collapse-long-cells`: On by default. XIT CONTS Item, Partner, and Self cells show three entries, then `(…)`.
- `unclipped-tooltips`: Tooltips draw past the tile edge.
- `chat-command-links`: Text in backticks in company, partner, and user chat becomes a command link.
- `favicon-notification-badge`: The tab icon shows the unseen notification count, up to 99.
- `inv-ship-names`: An INV row for a ship shows the ship name as a `SHP` link.
- `inv-ship-destination-location`: An in-flight ship shows its destination in the INV Location column.
- `XIT HELP AGT`: Agent guide, also `XIT HELP AGENT`. XIT AGENT has a "What is this?" button that opens it.

### Changed

- `XIT NOBUY`: The no-buy editor is the XIT SET Act tab. `XIT NOBUY` opens that tab. The stored list is unchanged.
- `XIT BS`: Clicking the cmds cell expands it, and clicking again collapses it.
- `XIT DISPATCH`: Shift-click a burn value expands that base's burn rows. A plain click still opens `XIT BURN`.
- Auto SFC arms the next stage as soon as departure is confirmed. The two-second pause is gone. The next flight still waits until that departure shows, or you skip.
- `XIT PRUNSTAT`: The financial report shortcut opens prun.raylu.net/stats.
- `correct-commands`: A station command that matches directly (`LM HRT`) is capitalized.
- `XIT BURN`: The tile title is `BURN`, not `ENHANCED BURN`.
- `XIT FLOW`: The ticker column still sorts, without a "Ticker" label.
- `nots-shift-click-mark-read`: Shift-click opens the notification's target as a companion buffer beside NOTS. Ctrl-click marks that row read without opening it. A plain click is unchanged.
- `XIT CONTC`: Conditions with no deadline are grouped after dated deadlines, then sorted by type, address, destination, ticker, and amount.

### Fixed

- `XIT AGENT`: A milk-run non-input pickup runs while the ship is still docked, then one Open SFC.
- `XIT ACT`: A failed or cancelled step stops the package. A missing CX order book fails the step. Ship cargo and fuel are stored by store id, so a nameless ship no longer hides a named one.
- `XIT ACT`: A CX buy whose order book cannot fill any units is skipped without taking the next buy's ACT click.
- The APEX alpha label stays behind the left sidebar shortcuts on a short window.
- `XIT FXTS`: Each day's totals include both the material amount and the currency side of the trade.
- POPID ALL skips a slider when the reserve bar cannot hold a move to max.
- `XIT ACT`: Fit to Ship wraps in a narrow pane.
- CX Buy price preview: a price under the refined-PrUn value reads `n% under`, with no warning color. At or above the value it still reads `n% over`.
- `XIT FLT`: The ship name and the Repair cell open `SHP`. Class, status, and ETA stay on `SFC`. Size and cargo stay on `SHPI`. Fuel stays on `SHPF`.
- `XIT DISPATCH`: A XIT SET Buffers rule keeps its width and height.

### Removed

- Repair time offset, including per-planet offsets. REPAIRACT's own Time Offset stays.

## 1.1.4

### Added

- `XIT BURNACT`: Remembers the CX buy exchange chosen for a base and defaults to that exchange and CX warehouse on subsequent use.
- `XIT FLT`: Optional name modifier (`XIT FLT ANT`, `XIT FLT ZV-307a`) filters the table to ships in that system or at that planet. CX tickers resolve like `FLTS` (ANT → Antares I).
- `nots-cogc-repeat-vote`: Clicking a COGC program-changed notification opens `COGCPD p-{planet} pn-{program}` so you can vote to repeat that program.
- `XIT BS`: Adds a DYNAMIC toggle that ranks bases by the closer of burn days and repair age to their red thresholds.
- `act-auto-close`: Off by default in XIT SET. When enabled, closes `XIT ACT` / `XIT BURNACT` / `XIT REPAIRACT` / `XIT DISPATCHACT` / `XIT GOVBURNEXEC` after a successful package run.
- `XIT BURNACT` / `XIT REPAIRACT` / `XIT GOVBURNEXEC`: Auto SFC toggle under MTRA To. On by default; off is remembered per base and skips opening SFC.
- `XIT NOBUY`: Yellow and Red percent fields (default 10 / 20) warn in ACT before a CX buy that exceeds the refined-PrUn price.
- `XIT DISPATCH` / CX Buy: Optional PRICES toggle (default off) asks for one ACT click per missing CX category, then shows a ranked cost preview in the CX pane before the buys.
- `XIT NOBUY`: All Materials excludes every ticker from CX Buy bills without clearing the specified list.

### Changed

- `XIT DISPATCH/AGENT`: Major Change! Multiple bases w/ one ship using AGENT now account for inputs available at stops on route, instead of buying the full bill on the CX. Load cells show route peak to avoid overloads mid-route..
- Port upstream's typed `L` localization API. UI string matching uses locale keys (with English fallback) instead of the old `PrunI18N` dictionary.
- `XIT BURNACT`: Fit-to-ship offers only ship sizes you currently own.
- `XIT ACT`: A CX buy past the NOBUY yellow/red threshold shows a blocking Price Warning overlay with the overage before Act/Skip.

### Fixed

- `sfc-flight-cost`: SFC fee amounts that use a space or apostrophe thousands separator no longer undercount the Cost overlay.

## 1.1.3

### Added

- `XIT FLOW (from Erendrake)`: One row per material across your bases — daily production, consumption (including workforce), net delta, and what that delta is worth. Click a Buy or Sell price to set a FLOW-only override; `XIT FLOW <planet…>` / `XIT FLOW NOT <planet…>` use BURN's parameter grammar.
- `XIT FINCH`: New Equity Growth chart (also `XIT FINCH EQUITY GROWTH`) plots percent-per-day equity change across data points.
- `nots-shift-click-mark-read`: Shift-click a NOTS row to mark that notification read without opening it, and without selecting the page text.
- `ship-unload-to-warehouse`: Shift-click a landed ship's Unload control to move its cargo into the local warehouse instead of base inventory.
- `XIT DATA`: Adds passive `burn`, `repair`, and `planet-settings` sources to the in-memory data catalog.

### Changed

- `XIT BS`: Clicking a base's burn days expands that base's burn rows inline; shift-click opens `XIT BURN {planet}` in a new buffer.
- `XIT FLT`: The Fuel column header is now a gray refuel button — same label size as the other headers — and opens `XIT REFUELACT`; the standalone REFUEL button is gone.
- `XIT BURNACT` / `XIT DISPATCH`: Fit-to-ship now resolves to 0.01-day steps instead of whole days.

### Fixed

- `XIT DISPATCHACT`: The first SFC stage sizes the host through game messages instead of a 975×750 style write, so a later drag-resize sticks.
- `XIT AGENT`: Loads action packages from the refined-agent channel even when other comms buffers restore first.
- `XIT BURN`: A material whose production and consumption cancel out no longer shows 0 days left, in both the per-planet rows and the Overall row.

## 1.1.2

### Added

- `shortcut-placeorder`: Type an exchange shortcut and a material ticker (`a dw`) to open the CXPO place-order buffer for that material on that exchange (a=ANT, b=BEN, i=HRT, h=HUB, l=ARC)
- `XIT DISPATCH`: Clicking a planet's Burn or Repair value opens its detailed XIT BURN or XIT REP buffer

### Fixed

- `XIT ACT`: Waits for a game action's final success or error state instead of intermittently aborting successful package steps

## 1.1.1

### Added

- `XIT WHATSNEW`: Shows release notes since last update, opened automatically after an update
- `XIT GOVBURN`: Import a planet's POPI plan from JSON in the config pane, with a preview of what it overwrites
- `bs-inv-base-store-link`: Makes the `INV` context link on `BS` open the base store directly
- `XIT BS`: Shows a green 🚀 next to a base's inventory bar 24 hours before its produced goods fill the ship picked in `XIT PLANETS`, and hides it while a ship is already in flight there
- `XIT PLANETS`: New Pickup column allows users to specify a size of ship to receive an alert for when sufficient goods will be produced to fill it within 24 hours
- `production-companion-buffers`: Shift-click a production line button in PROD, PRODQ or PRODCO to open PRODCO and PRODQ side by side as a companion pair

### Changed

- `XIT GOVBURNACT`: Upkeep material slot picks are saved, instead of being re-guessed every time the buffer opens
- `correct-commands`: `INV <planet>` opens the base store directly instead of the store list
- `XIT ACT`: Auto-SFC step now sets the destination planet with the same address-select helper used by CONTD import, dropping two redundant confirmation clicks
- `XIT ACT`: A commodity exchange short on stock no longer aborts the whole action package. The buy warns and offers whatever the order book can fill, so you can ACT on the partial amount, adjust it by hand, or SKIP it
- `popi-details-companion-buffer`: Companion buffers now open at the width and height registered for their own command instead of a fixed 450px, and the split divider is positioned to match those widths instead of 50/50

### Fixed

- `XIT DATA`: Stabilize the agent query connection and parameter handling
- `XIT DISPATCH`: Keeps long ship names inside their cell instead of spilling over the panel, and widens the ship columns to fit more of a name

## 1.1.0

### Notes

- Existing features and the 1.1.0 patch additions can be found at https://chromewebstore.google.com/detail/oog-rprun-test-fork/pcakabdnefjhjdgbiapchkejbkhdeebn
