# Changelog

Grouped by release, newest first. `Unreleased` holds changes merged to `main` that haven't
shipped yet. PRs with a user-facing change add an entry there (see `docs/contributing.md` →
Workflow → Changelog); release automation renames it to a version number when the release
ships and opens a fresh `Unreleased` section.

## Unreleased

### Added

- `XIT WHATSNEW`: Shows release notes since your last update, opened automatically after an update
- `bs-inv-base-store-link`: Makes the `INV` context link on `BS` open the base store directly
- `XIT PLANETS`: New Pickup column picks the cargo size of the ship you collect each base's output with, spelled out in tonnes and m³ so `3k/1k` can't be read backwards
- `XIT BS`: Shows a green 🚀 next to a base's inventory bar 24 hours before its produced goods fill the ship picked in `XIT PLANETS`, and hides it while a ship is already in flight there

### Changed

- `correct-commands`: `INV <planet>` opens the base store directly instead of the store list
- `XIT ACT`: Auto-SFC step now sets the destination planet with the same address-select helper used by CONTD import, dropping two redundant confirmation clicks
- `XIT ACT`: A commodity exchange short on stock no longer aborts the whole action package. The buy warns and offers whatever the order book can fill, so you can ACT on the partial amount, adjust it by hand, or SKIP it

### Fixed

- `XIT DATA`: Stabilize the agent query connection and parameter handling

## 1.1.0

Changelog tracking for this fork starts here. Earlier history lives in the git log.
