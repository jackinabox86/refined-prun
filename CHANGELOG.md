# Changelog

## Unreleased

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
