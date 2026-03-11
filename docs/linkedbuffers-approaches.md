# XIT LINKEDBUFFERS - Implementation Approaches

## Current Branch: `xit-linkedbuffers`

## Approach 1: Split Tile (WORKING - commit 35f069ed)

The control panel (input + command list) lives in a dedicated left tile created by splitting the window. Child tiles occupy the right side.

### How it works
1. `XIT LB <preset>` opens in a floating window
2. On first mount (solo buffer), the window is resized and split with `|` (horizontal split)
3. The game destroys the original tile and creates two tiles: left + right
4. XIT re-mounts the LINKEDBUFFERS component in the left tile
5. The right tile is the first child. If more children are needed, the right tile is split further using `–` (vertical/en-dash) and `|` (horizontal) to form a grid
6. Clicking a command in the left panel changes the corresponding child tile's command via `UI_TILES_CHANGE_COMMAND`

### Pros
- Reliable: uses the game's native split system (same pattern as ACT/action packages)
- Child tile commands update correctly on click
- Grid layout works for 1-6+ commands

### Cons
- Left panel takes a full tile with frame/header, making it wider than needed
- Can't programmatically control the split ratio (user must drag divider)
- The tile frame (title bar, control buttons) adds visual overhead

### Key commit
```
35f069ed - Fix input sizing, text alignment, and buffer size persistence
```

### To revert to this approach
```bash
git revert --no-commit 7019d4ef
git checkout 35f069ed -- src/features/XIT/LINKEDBUFFERS/
git add -A && git commit -m "Revert to split tile approach"
```

Or more simply:
```bash
git revert 7019d4ef
```

---

## Approach 2: CXPO-style Overlay Panel (BROKEN - commit 7019d4ef)

Inspired by `cxpo-order-book`, the control panel is a floating overlay appended directly to `Window.body`, positioned absolutely on the left edge. All window space goes to child tiles.

### How it works
1. `XIT LB <preset>` opens in a floating window
2. On first mount, the XIT tile splits itself to create child tiles (no dedicated control tile)
3. A `ControlPanel.vue` component is appended to `Window.body` as an absolute-positioned overlay
4. The overlay has a collapse toggle (arrow) and sits at z-index 10

### What went wrong
- After the XIT tile splits itself, the component gets destroyed and re-created. The new tile may not have the XIT command anymore (it could be an empty command prompt or the first child command)
- The `createFragmentApp(ControlPanel, ...).appendTo(body)` mounts the panel, but the `handleCommandClick` closure loses its connection to the child tile references
- The child tiles array may be empty or stale when a command is clicked
- The overlay approach requires careful lifecycle management that wasn't fully solved

### Key files introduced
- `ControlPanel.vue` - standalone overlay panel (140px wide, collapsible)

### Lessons learned
- The game's tile split destroys and recreates tiles, so any component that splits itself gets unmounted
- Appending Vue components to game DOM elements outside the tile anchor requires careful lifecycle management
- The CXPO order book works because it appends to an element WITHIN its own tile (the form parent), not to a parent window element

---

## Recommended Next Steps

1. **Revert to Approach 1** (split tile)
2. **Improve the left panel appearance** within the split tile approach:
   - Hide the tile frame header (`C.TileFrame.header`) via CSS or DOM manipulation after re-mount
   - This removes the title bar and control buttons, making it look more like a frameless sidebar
   - The content (input + commands) would be all that's visible
3. **Alternative**: Instead of hiding the frame, observe the XIT tile after re-mount and apply CSS to make the header ultra-compact (single-line, no padding)

## File Structure
```
src/features/XIT/LINKEDBUFFERS/
├── LINKEDBUFFERS.ts          # XIT registration (command: LINKEDBUFFERS/LB)
├── LINKEDBUFFERS.vue         # Main component
├── ControlPanel.vue          # Overlay panel (Approach 2, can be deleted if reverting)
├── PresetList.vue            # Preset list view (XIT LB with no params)
└── CreatePresetOverlay.vue   # Create preset dialog
```

## Data Model
```ts
// In userData.linkedBuffersPresets
interface LinkedBuffersPreset {
  id: string;
  name: string;
  commands: LinkedBuffersCommand[];
  lastBufferSize?: [number, number];  // saved window dimensions
}

interface LinkedBuffersCommand {
  id: string;
  label: string;
  template: string;  // e.g. "MAT {input}" — {input} replaced with text box value
}
```

## Key Patterns Used
- **ACT tile-allocator**: `splitBuffer()` pattern for initial split, `getCompanionTile()` for finding sibling, `changeTileCommand()` for updating child tiles
- **CMDL**: Command list UI with edit mode, drag-to-reorder, add/delete
- **Tile controls**: `|` = horizontal split, `–` (en-dash U+2013) = vertical split, `:` = change command, `x` = close
- **Buffer sizing**: `setBufferSize(id, w, h)` via `UI_WINDOWS_UPDATE_SIZE` client message
