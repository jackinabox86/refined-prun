# Tile & Window UI Patterns

Tile/buffer/window-chrome gotchas: sizing, scrolling, forms, splitting, sidebar, and
context-control bars. Split out of `docs/feature-patterns.md`.

## Tile UI Gotchas

### Let the game's ScrollView do the scrolling

Never create an inner scroll container inside a tile (`height: 100%` on the root plus
`overflow: auto` on a pane). The game wraps every tile in its own ScrollView; an inner
scroller reserves a second scrollbar's width next to the game's scroll gutter, making
the buffer visibly wider on the right than every other buffer (this was DISPATCH's
right-edge gap). Let content flow at natural height and the game scrolls it.

### Forms need `@submit.prevent`

A native form submission navigates the page — i.e. force-reloads the whole game tab.
`PrunButton` renders `type="button"`, so extension forms usually have no submit button,
but the HTML implicit-submission rule still fires a native submit on Enter in a form
with a **single** text input (GOVBURN's Add Planet form reloaded the game this way; an
Enter handler on the input does not stop it). Put `@submit.prevent` on every `<form>`
in extension UI.

### Auto-fitting a window to its content

The game applies the registered `bufferSize` asynchronously around tile creation, so a
direct `style.width` write gets clobbered — dispatch `setBufferSize(tile.id, ...)` after
the first data render instead (one-shot watch; see `DISPATCH.vue`). Measure width as
`content + (bodyEl.offsetWidth − contentEl.clientWidth)`; that chrome term is real
structural overhead on every floating window: a 6px `Tile__tile` margin per side plus
the ScrollView's 10px right gutter (which hosts its 6px scrollbar track).

For **height**, call `useMinBufferHeight()` (`src/hooks/use-min-buffer-height.ts`) in
the window component's setup — at mount it grows the floating window body by the
largest content overflow (`scrollHeight − clientHeight` over all descendants), so table
rows and the action bar are never hidden behind a scrollbar. Origin: BURNACT; also used
by GOVBURN's planner and runner windows.

### Matching the ACT runner window look

A planner/companion window meant to feel like `ExecuteActionPackage` (GOVBURNEXEC, ACT
runs) mirrors its layout: a `height: 100%` flex-column root; a main pane with
`flex-grow: 1; margin: 5px 0 0 4px; background: #23282b; border: 1px solid #2b485a`
(the LogWindow/ConfigureWindow look); status/summary lines below it with
`margin-left: 5px`; and a bottom-anchored `ActionBar` with `margin-left: 2px;
justify-content: flex-start`. The flex-grow pane is what pins the action bar to the
window's bottom edge (see `GovBurnActWindow.vue`).

### Invisible FontAwesome glyphs in templates

Icon buttons like the clear-✕ (`<PrunButton :class="[fa.solid, ...]">{{ '' }}</PrunButton>`
in `BS.vue`/`INV.vue`) hold the icon as a literal private-use glyph (U+F00D) inside the
seemingly empty `'…'` string — it renders as nothing in file reads and diffs. Copying or
moving such markup by retyping what you see silently drops the glyph and ships an empty
button. Move the original bytes (cut the exact lines) instead, and after any relocation
verify with `sed -n '<line>p' file | od -c` that the multi-byte glyph survived.

The `v-draggable` directive binds once at mount, and a template binding
(`v-draggable="[list, opts]"`) auto-unwraps a ref — the directive captures that array
instance and mutates it in place on drag. Two safe patterns:

- A reactive array that is only ever mutated in place (TODO/SORT/ACT lists) — the
  template binding is fine.
- If any code REPLACES the array (`ids.value = next` in a sync watcher), the directive
  is left mutating an orphaned snapshot and drags silently revert. Pass the ref itself
  by building the tuple in script (`const dragBinding = [idsRef, opts]`) — the library
  handles refs natively (see `DISPATCH.vue`).

### Clamping a numeric input needs a raw input + DOM write-back

`NumberInput` (a `defineModel` + computed v-model wrapper) cannot enforce min/max: its
attrs land on the wrapper div, and when the parent clamps the emitted value back to what
the store already holds, no prop change occurs, so Vue never rewrites the DOM and the
input keeps displaying the out-of-range typed value. For clamped fields use a raw
`<input type="number" :min :max :value @change>` and, in the handler, write the clamped
value back explicitly (`input.value = String(clamped)`) after updating the store — the
`min`/`max` attributes bound the spinner arrows, the write-back fixes typed values (see
`GovBurnConfig.vue`).

### Opening a companion buffer (split pane) next to a tile

`openCompanionBuffer(tile, command)` in `src/infrastructure/prun-ui/companion-buffer.ts`
splits the tile's window (widening a floating window by 450px first) and loads `command`
into the sibling pane. Get the tile inside a Vue component via `useTile()`. Used by the
POPI details shift-click feature and GOVBURN's planet view.

### Planet names and the right-click planet menu

To display a planet the way BURN does, derive the name with
`getEntityNameFromAddress(planet.address)` — named planets show their name, unnamed
ones get a "SystemName letter" nickname when their system is named (raw natural id
otherwise). Pair it with the shared right-click menu (PLI/COGC/POPR/POPI/ADM):

```html
<td @contextmenu.prevent="planetContextMenu.showMenu($event, naturalId)">{{ name }}</td>
```

where `planetContextMenu` is `import { store as planetContextMenu } from
'@src/features/XIT/planet-context-menu'` (see `PlanetHeader.vue`, `GovBurnOverview.vue`).

### Tile state is ephemeral for floating buffers

`useTileState` persists only for docked tiles (non-numeric tile ids). Floating buffers
get numeric ids and their state is deleted on close (`tileRemoved` in
`user-data-tiles.ts`). Don't promise cross-open persistence for a floating-buffer
feature; put durable state in `userData` instead.

---

## Opening Panels Programmatically

```ts
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

showBuffer('CXM AI1.RAT');  // opens a buffer with the given command
```

### Repeatable Hidden-Buffer Fetches

`showBuffer(cmd, { autoClose: true, closeWhen })` (the `XIT BURN`-style invisible-fetch
pattern, see `docs/contributing.md` → "Server Communication & ToS") has two gotchas for
code that calls it more than once for the same command:

- **`autoClose` closes the window via a detached `closeWhenDone()` that `showBuffer()`
  doesn't await** — its returned promise resolves once the command is submitted, not
  once the window is actually removed from the DOM. A caller that needs to know the
  window is truly gone (e.g. before opening another one for the same command) must
  separately await `onNodeDisconnected(window, resolve)` on the returned element.
- **Without `{ force: true }`, `showBuffer()` silently reuses an existing non-docked
  tile for the same command instead of resubmitting it** — fine for the existing
  single-shot `request-hooks.ts` pattern (each command is only ever requested once per
  connection), but wrong for anything meant to be re-triggered repeatedly (e.g. a manual
  refresh button): a second call can reuse a tile that's still mid-close and never
  re-fetch.

Neither of these solves data staleness by itself — see `docs/game/screens-comms.md` for
a deeper case (channel data) where the server won't resend a full data set a second time
no matter how the buffer is managed client-side.

### Submitting a Formless Input Programmatically

Some game inputs (e.g. the chat channel compose box) have no `<form>` to call
`requestSubmit()` on — submission only happens via a real Enter keypress. A plain
`new KeyboardEvent(...)` Enter is **silently ignored** by these handlers: a constructed
event leaves the legacy `keyCode`/`which` fields at 0, the game reads them, nothing
sends, and no error surfaces anywhere (this shipped as a "verified" pattern and was
only caught by checking server-side history). The working, server-verified recipe —
reference implementation `postAgentMessage()` in
`src/infrastructure/prun-api/data/agent-channel.ts`:

1. `focusElement(input)`, then set the value with `changeInputValue`/`changeTextAreaValue`.
2. Wait ~300ms (a keydown fired immediately after the value change is silently dropped).
3. Dispatch the full `keydown`+`keypress`+`keyup` sequence with `keyCode`/`which`
   patched to 13 via `Object.defineProperty` (the constructor ignores them).
4. Verify the send: poll until the input clears (the game empties the compose box only
   on an actual send) and throw on timeout — never assume the dispatch worked.

Input clearing only proves the client dispatched the message — not that the server
received it. If a caller treats "sent" as authoritative (e.g. folding the message into
a local store, like the agent channel does), that's not enough: poll for the message's
`C.Message.unconfirmed` class to clear on its `C.Message.text` span instead (see
`docs/game/screens-comms.md` → "API Notes for Building on Channel Data", and
`waitForServerConfirmation()` in `agent-channel.ts` for the reference implementation).

```ts
focusElement(input);
changeInputValue(input, text);
await sleep(300);
for (const type of ['keydown', 'keypress', 'keyup'] as const) {
  const event = new KeyboardEvent(type, {
    key: 'Enter',
    code: 'Enter',
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, 'keyCode', { get: () => 13 });
  Object.defineProperty(event, 'which', { get: () => 13 });
  input.dispatchEvent(event);
}
// Poll input.value === '' against a deadline; throw if it never clears.
```

### Companion Buffers (Splitting)

Use `openCompanionBuffer(tile, command)` (see above) — it owns the whole sequence.
Splitting by hand is a trap: `tile.frame` is destroyed by the split, so anything read
from the tile has to be captured first, and the companion has to be located and
commanded after a MutationObserver wait. The split control characters (found via
`C.TileControls.control`) are `'–'` for a vertical split and `'|'` for a horizontal one.

ACT allocates its runner panes the same way — see
`src/features/XIT/ACT/runner/tile-allocator.ts` for the multi-pane variant.

---

## Left Sidebar Replacement

The `custom-left-sidebar` feature hides the base-game sidebar buttons (`#TOUR_TARGET_SIDEBAR_LEFT_02`) and renders its own configurable set from `userData.settings.sidebar` (label → command pairs, drag-reorderable). Defaults remap several labels to XIT buffers (CONT → `XIT CONTS`, FIN → `XIT FIN`, MAP → `MU`) and append extension-only entries (ACT, BURN, REP, SET, HELP → `XIT *`). Consequence for testing: sidebar clicks in a browser with the extension loaded hit extension buttons, not base-game ones — the base mapping is documented in `docs/game/sidebar-screens.md`.

## Context Controls

All tiles have a `C.ContextControls.container` element. Add items to it via `$(tile.frame, C.ContextControls.container)`.

For items that simply open a buffer, use the existing `ContextControlsItem` component:

```ts
import ContextControlsItem from '@src/components/ContextControlsItem.vue';

const contextBar = await $(tile.frame, C.ContextControls.container);
createFragmentApp(ContextControlsItem, { cmd: 'XIT BURN OT-580b' }).prependTo(contextBar);
```

For items with custom `onClick` behavior, use inline TSX with the same CSS classes:

```tsx
const contextBar = await $(tile.frame, C.ContextControls.container);
createFragmentApp(() => (
  <div
    class={[C.ContextControls.item, C.fonts.fontRegular, C.type.typeSmall]}
    onClick={() => doSomething()}>
    <span>
      <span class={C.ContextControls.cmd}>Label</span>
      {' - subtitle'}
    </span>
  </div>
)).prependTo(contextBar);
```

For items that need a reactive **grayed-out** state (always visible, disabled when nothing to act on), add `C.colors.textDisabled` conditionally and guard inside `onClick`:

```tsx
import { refAnimationFrame } from '@src/utils/reactive-dom';

const canAct = refAnimationFrame(tile.anchor, () => /* boolean check */);

createFragmentApp(() => (
  <div
    class={[
      C.ContextControls.item,
      C.fonts.fontRegular,
      C.type.typeSmall,
      !canAct.value && C.colors.textDisabled,
    ]}
    onClick={() => {
      if (canAct.value) doSomething();
    }}>
    <span>
      <span class={C.ContextControls.cmd}>Label</span>
    </span>
  </div>
)).prependTo(contextBar);
```
