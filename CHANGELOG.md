# Changelog

## Unreleased

### Added

- `XIT WHATSNEW`: Shows release notes since last update, opened automatically after an update
- `XIT GOVBURN`: Import a planet's POPI plan from JSON in the config pane, with a preview of what it overwrites
- `bs-inv-base-store-link`: Makes the `INV` context link on `BS` open the base store directly
- `XIT BS`: Shows a green 🚀 next to a base's inventory bar 24 hours before its produced goods fill the ship picked in `XIT PLANETS`, and hides it while a ship is already in flight there
- - `XIT PLANETS`: New Pickup column allows users to specify a size of ship to receive an alert for when sufficient goods will be produced to fill it within 24 hours
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

Existing features and the 1.1.0 patch additions can be found at 
