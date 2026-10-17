# Changelog

## Unreleased

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
