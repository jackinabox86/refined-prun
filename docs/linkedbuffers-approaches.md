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

## Approach 3: Independent Floating Buffers (CURRENT - branch `xit-linkedbuffers-approach-c`)

The control panel is a small floating CMDL-like buffer. Each child command gets its own independent floating window, positioned in a grid next to the control panel.

### How it works
1. `XIT LB <preset>` opens as a compact floating buffer (220x400)
2. On mount, if floating and preset has commands, spawns independent child windows via `showBuffer()` sequentially
3. After all children are created, positions them in a grid to the right of the control panel using direct DOM `style.left`/`style.top` manipulation
4. Each child window is sized via `setBufferSize()` (400x300)
5. Clicking a command in the control panel resolves the `{input}` template and updates the corresponding child window via `UI_TILES_CHANGE_COMMAND`
6. Closing the control panel automatically closes all child windows

### Pros
- Full control over individual child window size and position
- No frame overhead on the control panel (it's its own buffer, naturally compact)
- No split ratio issues — each buffer is independently sized
- Children can be freely rearranged by the user after initial layout
- Simpler component lifecycle — no split/remount dance

### Cons
- Child windows are created sequentially (showBuffer mutex), so initial spawn takes 1-2 seconds for 4-6 commands
- Game may reposition windows on certain events (needs testing)
- More floating windows = more dock bar entries

### Key insight
Floating windows in PrUn use inline `style="left: Xpx; top: Ypx"` for positioning (confirmed via `PmmgMigrationGuide.vue`). This means we can reposition windows after creation by setting `window.style.left`/`style.top` directly.

### Key commit
```
(current HEAD on xit-linkedbuffers-approach-c)
```

---

## File Structure
```
src/features/XIT/LINKEDBUFFERS/
├── LINKEDBUFFERS.ts          # XIT registration (command: LINKEDBUFFERS/LB)
├── LINKEDBUFFERS.vue         # Main component
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
}

interface LinkedBuffersCommand {
  id: string;
  label: string;
  template: string;  // e.g. "MAT {input}" — {input} replaced with text box value
}
```

## Key Patterns Used
- **showBuffer()**: Creates independent floating windows programmatically
- **setBufferSize()**: Controls child window dimensions via `UI_WINDOWS_UPDATE_SIZE`
- **DOM positioning**: `window.style.left`/`style.top` for grid layout
- **changeTileCommand()**: Updates child tile commands via `UI_TILES_CHANGE_COMMAND`
- **onNodeDisconnected()**: Tracks child window lifecycle for cleanup
- **CMDL**: Command list UI with edit mode, drag-to-reorder, add/delete
