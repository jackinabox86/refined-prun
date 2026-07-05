# Prosperous Universe APEX UI Reference

Dense conceptual guide to the APEX interface system.

## Overview

APEX is a highly customizable, terminal-style dashboard made from resizable, draggable panels called **tiles**. Dark-themed, data-dense, text-heavy interface closer to a financial trading terminal than a typical game UI.

Core principle: Everything is a **command** (all-caps 2–6 letter codes). Commands are invoked by text entry or clicking links.

## Screens & Tile Layout

### Screens
- **Screen**: Named, saved layout of tiles. Players create multiple screens (e.g., "NAVIGATION", "FINANCES", "CX", "TRADING").
- Switch via a selection bar at top (SCRNS).
- Each screen has independent tile arrangement.

### Tile Docking
- **Docked tiles**: Embedded in screen grid. Resize by dragging dividers (horizontal/vertical splits).
- **Floating buffers**: Detached windows that float above screen. Can be popped out/docked any time.
- Each tile has header (command name), control buttons (minimize, pop-out, close), and content area.
- **Context-command bar**: tile headers list related commands as clickable links with labels (e.g. `CONTD: Contract Drafts`) — the primary lateral navigation between related screens.
- Tiles auto-expand if adjacent tile closes.

### NEW BFR Button
- Bottom-left corner: Opens empty floating buffer (Ctrl+Space).
- Fill with content via command entry or drag/drop.

### Opening a Buffer (Two Paths)
1. **Shortcut link**: if a left-sidebar shortcut or in-tile link for the target command already exists, click it directly.
2. **Command entry**: otherwise, click **NEW BFR** (bottom-left) to open an empty floating buffer, type the command code (e.g. `CONTD`) into its input box, and hit Enter to load that buffer.

Opening a buffer that is already open (same command + params) re-focuses the existing window instead of creating a new one.

## UI Layout

### Left Sidebar
- Always visible.
- Top toggles: SCRNS (screen selector), SDBR (right sidebar visibility), BFRS (buffer list).
- 12 shortcut buttons open buffers (not tied to specific screen): BS, CONT (opens CONTS), COM, CORP, CXL, FIN, FLT, INV, MAP (opens MU), PROD, LEAD, CMDS. Per-screen details: `docs/game/sidebar-screens.md`.

### Top Navigation Bar (SCRNS / Screen Selector)
- **SCRN: [NAME]** — Current screen (click to rename)
- **ADD** — Create new empty tile in current screen
- **FULL** — Toggle full-screen mode
- Right side:
  - **LIC: [FREE/BASIC/PRO]** — Subscription tier
  - **NOTS [#]** — Unread notification count (flashes green when new)
  - **[USERNAME]** — Company name (hover for a game menu)

### Right Sidebar (SDBR, when enabled)
- **Account balance** — Current currency amounts (all 4 currencies)
- **Pending Contracts** — List of contracts awaiting action

### Bottom Status Bar
- **NEW BFR** — Open floating buffer (Ctrl+Space)
- **CONS [#]** — Connected users counter

## Data Display Conventions

### Material Icons
- A colored square icon with a ticker an (optional) quantity.
- 3-letter **ticker** (e.g., INS, HCP, FF, RAT)
- Colored icon represents material category (green=agricultural, blue=construction, pink=chemicals, etc)

### Tables & Lists
- Compact, dense, column-based

### Status Bars & Indicators
- **Percentage bars** (green→yellow→red) for building condition, workforce satisfaction. Fuel and cargo hold do not have danger levels, so they are always yellow.
- **Colored text** (green=positive/profit, red=negative/loss)
- **Relative time** (e.g., "1d 10h (07:38 +1d)") for ETAs combining countdown + wall-clock

### Number formatting
- Number formatting is always done in the user's locale (e.g., 1,000,000.00)

## Key Interaction Patterns

### Drag & Drop
- Drag tile dividers to resize
- Drag material tiles between inventories to transfer
- Drag buffers to pop in/out of screen

### Shortcuts & Links
- Light blue text is (usually) a clickable link to other tiles/commands

### Modal Dialogs
- Overlay confirmation dialogs (e.g., "Confirm production order") are opened inside tiles
- Modal dialogs pause interaction with background
- Require user to confirm or cancel before proceeding

## Accessibility Notes

- All-caps command language may appear cryptic but is intentional: precise, searchable, unmistakable.
- UI assumes keyboard + mouse (no touchscreen support).
- Data density makes mobile play difficult; desktop/laptop recommended.

---

**Note**: No Refined PrUn features included. All mechanics described are base-game APEX only.
