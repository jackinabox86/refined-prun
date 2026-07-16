# Feature Patterns

## Feature types

- **Basic** (`src/features/basic/`): enhances UI without removing information. Loaded for all users.
- **Advanced** (`src/features/advanced/`): removes, shortens, or hides information. Loaded for user that turned on FULL feature mode.

## Adding a Feature

Each feature is a self-contained `.ts` or `.tsx` file registered at the end:

```ts
function init() {
  tiles.observe('BBL', onTileReady);
}

features.add(import.meta.url, init, 'BBL: Short description of what this does.');
```

- `import.meta.url` → the filename (without extension) becomes the feature ID.
- The file is auto-imported via `import.meta.glob` in `src/features/index.ts` — no manual registration needed.

### Naming

If a feature targets a specific buffer command, prefix the feature ID and mention it in the description:

```ts
// Feature file: src/features/basic/sysi-blue-negative-value.ts
features.add(import.meta.url, init, 'SYSI: Makes lower negative planet values blue instead of red.');
```

If a feature touches more than one command, don't prefix with a single command name.

```ts
// Bad: feature affects PROD, PRODQ, and PRODCO
features.add(import.meta.url, init, 'PROD: Highlights orders with errors.');

// Good
features.add(import.meta.url, init, 'Highlights production orders with errors.');
```

### File Organization

If a feature has more than a `.ts` + `.module.css` pair, create a folder for it.

Vue component filenames must match the import name:

```ts
// If you write: import ContextRow from './ContextRow.vue';
// The file MUST be: ContextRow.vue (not my-feature.vue)
```

**Component basenames must be unique across the whole project.** CSS-module scoping
hashes only the file's basename and class name, so two features that each have a
`BaseRow.vue` emit rules under the same `rp-BaseRow__*` selectors — both land in the
built CSS and the later one silently overrides the earlier (found live: DISPATCH's
BaseRow styles were overridden by BS's and leaked back into XIT BS). Same-named files
also break `[class*="rp-BaseRow__"]`-style test selectors, which match every feature
sharing the basename. Pick a distinct name instead (DISPATCH's row is `PlanetRow.vue`).

### Parameter Checks

If a tile command can't be opened without a parameter (like `PRODQ`), don't guard against missing parameters.

```ts
// Bad (PRODQ always has a parameter)
if (!tile.parameter) {
  return;
}

// Just use tile.parameter directly
```

## XIT Filter Bars

XIT panels with filter toggles use `C.ComExOrdersPanel.filter` as the container and `RadioItem` with `horizontal` prop for each toggle. Labels must be ALL CAPS:

```html
<div :class="C.ComExOrdersPanel.filter">
  <RadioItem v-model="showFoo" horizontal>FOO</RadioItem>
  <RadioItem v-model="showBar" horizontal>BAR</RadioItem>
</div>
```

`RadioItem` is a boolean toggle, not a true radio group — the above pattern gives independent (AND-able) toggles. For an **exclusive** single-select filter (choosing one option clears any other), bind each option against one shared ref instead of `v-model`:

```html
<div :class="C.ComExOrdersPanel.filter">
  <RadioItem
    v-for="option in filterOptions"
    :key="option.code"
    :model-value="selected === option.code"
    horizontal
    @update:model-value="v => (selected = v ? option.code : undefined)">
    {{ option.label }}
  </RadioItem>
</div>
```

Each option's `active` state is a computed read of the same `selected` ref, so setting one option re-evaluates the others to `false` automatically — no manual "clear the others" step needed. Clicking the active option again clears `selected` (shows everything).

---

## Adding an XIT Command

XIT commands are custom in-game panels opened via the `XIT` buffer. Register in a `.ts` file:

```ts
xit.add({
  command: ['CMD', 'CMDALIAS'],  // one or more
  name: 'Panel Title',            // or (params) => string for dynamic title
  description: 'What it does.',
  mandatoryParameters: 'PARAM1',  // optional
  optionalParameters: 'PARAM2',   // optional
  component: params => MyVue,     // Vue component factory; params is string[]
  bufferSize: [600, 400],         // optional default window size [w, h]
  contextItems: params => [{ cmd: 'XIT OTHER', label: 'Link' }],  // optional
});
```

The file is auto-imported via `import.meta.glob` in `src/features/index.ts` — no manual registration needed.

The command should be short. Refer to `docs/game/commands.csv` for an example of game commands. Alias is usually added for backwards compatibility or if the community REALLY wants it.

### One-Click Preconfigured Action Packages

To give users a single button that runs a specific ACT action package without opening the ACT editor (e.g. `BURNACT`, `REFUELACT`), pair two files next to the relevant action:

```ts
// <NAME>ACT.ts
import '@src/features/XIT/ACT/actions/refuel/refuel'; // ensure the action type is registered

xit.add({
  command: 'REFUELACT',
  name: 'REFUEL ALL EXCHANGES',
  description: 'Executes a refuel action package for all ships docked at exchanges.',
  component: () => RefuelActWindow,
});
```

```vue
<!-- <Name>ActWindow.vue -->
<script setup lang="ts">
import ExecuteActionPackage from '@src/features/XIT/ACT/ExecuteActionPackage.vue';

const pkg: UserData.ActionPackageData = {
  global: { name: 'Refuel All Exchanges' },
  groups: [],
  actions: [{ type: 'Refuel', name: 'Refuel', origin: allExchangesValue, buyMissingFuel: true }],
};
</script>

<template>
  <ExecuteActionPackage :pkg="pkg" />
</template>
```

The `pkg` is a plain hardcoded object, not persisted user data — `ExecuteActionPackage` runs it exactly like a saved package (CONFIGURE only appears if an action still needs runtime input; PREVIEW/EXECUTE always available). Trigger it from anywhere with `showBuffer('XIT REFUELACT')` (see `PlanetHeader.vue`'s `XIT BURNACT` button for a row-level example, or `FLT.vue`'s Fuel-column header button for another).

**Never embed `ExecuteActionPackage` inside a long-lived planner tile.** The runner
splits its host tile to allocate command buffers, which remounts the host component —
non-persisted state resets and the run dies (this broke DISPATCH's first embedded-run
design). Instead stage the built package in a module-level ref and open a dedicated
XIT command whose window renders `ExecuteActionPackage` (see
`src/features/XIT/DISPATCH/staged.ts` + `DISPATCHACT.ts`). Besides `afterExecute`,
`ExecuteActionPackage` accepts `beforeExecute` — logs emitted there land at the top of
the run log. (DISPATCH used to print its offload JSONs that way; they now go through
`LOG_JSON` steps emitted by MTRA's `offloadGroups` path, with `agentGroups` controlling
the agent-channel posts.)

**A host `v-if`/`v-else` gating `ExecuteActionPackage` must not depend on data the run
itself mutates.** `XIT AGENT`'s `ExecuteStoredPackage.vue` used to resolve its `pkg` via
a `computed` over `agentReadyPackages`, gated by `v-if="!entry"`. The run's own
`AGENT_DONE` step posts a completion marker to the agent channel, which drops the
message from `agentReadyPackages` (by design, to hide it from AGENT next time) —
flipping the `v-if` and unmounting `ExecuteActionPackage`, and its runner, before later
chained steps (e.g. `OPEN_SFC`) could execute. Resolve such an `entry` once as a plain
non-reactive snapshot at setup instead of a live `computed`, so a step's own side effect
can't unmount the component that's running it.

**Automated posts to the agent channel must stay hidden.** `agent-channel.ts` exposes
both a hidden path (`postAgentMessage` — `showBuffer` with `autoClose`) and a visible one
(`openAgentChannel`/`openAgentChannelWithDraft`). Use the hidden path for anything an ACT
step posts on the user's behalf (`POST_AGENT`, `AGENT_DONE`'s completion marker) —
reserve the visible path for flows where the player is meant to review/send the message
themselves (e.g. the AGENT panel's manual "dismiss" button).

### Reminder Pauses in ACT Steps

When a step needs the player to do something manually in a companion buffer before the
run continues (repair buildings in BRA, submit the flight in SFC, adjust a transfer
amount in MTRA), call `waitAct(status, { actDelayMs: 2000 })`. The step machine grays
the ACT button for the delay while SKIP/CANCEL stay live, then re-arms ACT — see
`OPEN_BRA.ts` / `OPEN_SFC.ts` / `MTRA_TRANSFER.ts`'s `playerReview` mode (which reads
the player-adjusted input value after the pause instead of rewriting it).
Don't add a bare `sleep()` for this; the delay belongs in `waitAct` so skipping/canceling
during the pause is handled.

### Action-Specific Sentinel Values

`configurableValue` and `groupTargetPrefix` (`shared-types.ts`) are sentinels shared across every ACT action/material-group type. If an action needs an extra dropdown option unique to itself (e.g. Refuel's "All Exchanges" origin, alongside "Configure on Execution" and specific storages), define that sentinel in the action's own `utils.ts`/`config.ts` instead of adding it to `shared-types.ts`.

---

## Tile UI Gotchas

### Let the game's ScrollView do the scrolling

Never create an inner scroll container inside a tile (`height: 100%` on the root plus
`overflow: auto` on a pane). The game wraps every tile in its own ScrollView; an inner
scroller reserves a second scrollbar's width next to the game's scroll gutter, making
the buffer visibly wider on the right than every other buffer (this was DISPATCH's
right-edge gap). Let content flow at natural height and the game scrolls it.

### Auto-fitting a window to its content

The game applies the registered `bufferSize` asynchronously around tile creation, so a
direct `style.width` write gets clobbered — dispatch `setBufferSize(tile.id, ...)` after
the first data render instead (one-shot watch; see `DISPATCH.vue`). Measure width as
`content + (bodyEl.offsetWidth − contentEl.clientWidth)`; that chrome term is real
structural overhead on every floating window: a 6px `Tile__tile` margin per side plus
the ScrollView's 10px right gutter (which hosts its 6px scrollbar track).

### Drag-reorder with vue-draggable-plus

The `v-draggable` directive binds once at mount, and a template binding
(`v-draggable="[list, opts]"`) auto-unwraps a ref — the directive captures that array
instance and mutates it in place on drag. Two safe patterns:

- A reactive array that is only ever mutated in place (TODO/SORT/ACT lists) — the
  template binding is fine.
- If any code REPLACES the array (`ids.value = next` in a sync watcher), the directive
  is left mutating an orphaned snapshot and drags silently revert. Pass the ref itself
  by building the tuple in script (`const dragBinding = [idsRef, opts]`) — the library
  handles refs natively (see `DISPATCH.vue`).

### Tile state is ephemeral for floating buffers

`useTileState` persists only for docked tiles (non-numeric tile ids). Floating buffers
get numeric ids and their state is deleted on close (`tileRemoved` in
`user-data-tiles.ts`). Don't promise cross-open persistence for a floating-buffer
feature; put durable state in `userData` instead.

---

## Auto-Imports (no explicit import needed)

| Symbol | Source |
|--------|--------|
| Vue composables (`ref`, `computed`, `reactive`, `watch`, …) | `vue` |
| `$`, `$$`, `_$`, `_$$` | `@src/utils/select-dom` |
| `C` | `@src/infrastructure/prun-ui/prun-css` |
| `subscribe` | `@src/utils/observable` |
| `tiles` | `@src/infrastructure/prun-ui/tiles` |
| `features` | `@src/features/feature-registry` |
| `xit` | `@src/features/XIT/xit-registry` |
| `config` | `@src/infrastructure/shell/config` |
| `createFragmentApp` | `@src/utils/vue-fragment-app` |
| `applyCssRule` | `@src/infrastructure/prun-ui/refined-prun-css` |
| `sumBy` | `@src/utils/sum-by` |

ESLint bans `.reduce()` for summation (`no-restricted-syntax`) — use `sumBy(array, x => x.value)` instead.

---

## `C` Object

`C` maps all PrUn CSS class names with auto-complete. Always prefer `C` over hardcoded hashed class names — hashes change between game updates.

```typescript
// Bad: brittle
applyCssRule('.Frame__logo___qu6xPzo', $style.logo);

// Good: robust
applyCssRule(`.${C.Frame.logo}`, $style.logo);
```

---

## DOM Helpers

Four auto-imported functions for finding elements by CSS class name (`C.X.y`) or HTML tag name.

| Function | Returns | Mechanism | Use When |
|----------|---------|-----------|----------|
| `$` | `Promise<Element>` | MutationObserver — resolves when first match appears | Waiting for element to render (gate pattern) |
| `$$` | `AsyncIterable<Element>` | MutationObserver — yields existing + future matches | Processing current and dynamically added elements |
| `_$` | `Element \| undefined` | Sync `getElementsByClassName` / `getElementsByTagName` | Element is guaranteed to exist already |
| `_$$` | `Element[]` | Sync snapshot of all matches | All target elements exist already |

### Selectors

Selectors are **not CSS selector strings**. Internally they resolve to `getElementsByClassName` or `getElementsByTagName`.

Valid selectors:
- `C.ComponentName.className` — a PrUn CSS class name (preferred)
- HTML tag names: `'div'`, `'tr'`, `'td'`, etc

### `$` — Async Single Element (Gate Pattern)

`Promise` that resolves when the first matching element appears. Blocks execution until the element exists — acts as a natural gate that filters out tiles without the expected DOM structure.

```ts
// Wait for container before proceeding
const container = await $(tile.anchor, C.StoreView.container);

// Chain awaits for nested elements
const text = await $(container, C.CommodityAd.text);
```

### `$$` — Async Iterable (Subscribe Pattern)

`AsyncIterable` that yields existing matches immediately, then watches for new ones via MutationObserver. Almost always paired with `subscribe()`.

```ts
// Process each row as it appears (current + future)
subscribe($$(tile.anchor, 'tr'), row => {
  // Called once per row, including rows added later
});

// Nested subscribes for hierarchical DOM traversal
subscribe($$(tile.anchor, C.ScrollView.view), scroll => {
  subscribe($$(scroll, 'table'), async table => {
    // ...
  });
});

// Async operations inside subscribe callback
subscribe($$(tile.anchor, C.FormComponent.containerPassive), async container => {
  const label = await $(container, 'label');
  hideField(container, label, 'MaterialInformation.ticker');
});
```

### `_$` — Sync Single Element

Immediate lookup — returns first match or `undefined`. Use inside `subscribe` callbacks or other contexts where the parent is already available.

```ts
// Check for element existence
const isHeader = _$(row, 'th') !== undefined;

// Find a specific child
const label = _$(row, C.ColoredIcon.label);
if (label) {
  row.classList.toggle(css.hidden, !visibleMaterials.value?.includes(label.textContent!));
}
```

### `_$$` — Sync All Elements

Returns an array snapshot of all current matches. Use when all target elements are already rendered.

```ts
// Get all cells in a row
const cells = _$$(row, 'td');
if (isEmpty(cells)) {
  return;
}

// Combine: $$ for parent iteration, _$$ for child lookup
subscribe($$(tile.anchor, C.InventoriesListContainer.filter), async filter => {
  for (const label of _$$(filter, C.RadioItem.value)) {
    label.textContent = map.get(label.textContent!) ?? label.textContent;
  }
});
```

### Choosing the Right Function

```
Need to wait for element? → $ (async single) or $$ (async iterable)
Element already exists?   → _$ (sync single) or _$$ (sync all)
Processing one element?   → $ or _$
Processing many elements? → $$ or _$$
```

Prefer async (`$`/`$$`) over sync (`_$`/`_$$`) when possible — they're type-safe (no `undefined` return for `$`) and handle timing automatically.

---

## Observing Tiles

**Tiles** are the game's UI panels — each opened by a command (e.g., `INV`, `PROD`, `FLT`). See `docs/game/ui-concepts.md` for full APEX interface reference.

```ts
function onTileReady(tile: PrunTile) {
  // tile.command, tile.parameter, tile.frame, tile.anchor
}

tiles.observe('BBL', onTileReady);          // single command
tiles.observe(['FLT', 'FLTS'], onTileReady); // multiple commands
tiles.observeAll(onTileReady);              // every command

// subscribe() calls callback for each match, including future ones
subscribe($$(tile.anchor, C.SectionList.section), section => { ... });
```

---

## Mounting Vue Components

```ts
createFragmentApp(MyComponent, { prop: value })
  .appendTo(container)   // also: .prependTo(), .before(sibling), .after(sibling)

// Reactive props — wrap in reactive() so Vue sees live values
subscribe($$(tile.anchor, 'tr'), row => {
  createFragmentApp(MyComponent, reactive({ id: refPrunId(row) })).appendTo(row);
});
// Note: refPrunId() returns Ref<string | null>. Vue auto-unwraps Refs nested inside
// reactive(), so the component receives a live string | null, not a Ref object.
// The prop type should be declared as `string | null`, not `Ref<string | null>`.

// Inline TSX (no .vue file needed for simple UI)
createFragmentApp(() => (
  <div class={[C.MaterialIcon.indicator, hiddenClass.value]}>
    {count.value}
  </div>
)).appendTo(container);
```

Auto-unmounts when the parent node disconnects from the DOM.

Extract external DOM handling from Vue components into the feature `.ts` file. Vue components handle rendering; feature files handle DOM wiring and game data access. Use callback props to communicate values from Vue to the feature.

---

## Reactively Mutating DOM Attributes

Watcher stops automatically when the node disconnects from the DOM.

```ts
import { watchEffectWhileNodeAlive } from '@src/utils/watch';

watchEffectWhileNodeAlive(row, () => {
  const value = someComputed.value;
  if (value !== undefined) {
    element.dataset.tooltip = value;
    element.dataset.tooltipPosition = 'right';
  } else {
    delete element.dataset.tooltip;
    delete element.dataset.tooltipPosition;
  }
});
```

`watchEffectWhileNodeAlive` runs immediately — don't duplicate initialization code before it.

### MutationObserver Cleanup

MutationObservers on `tile.anchor` don't need explicit `disconnect()`. When the tile closes and anchor is removed from the DOM, the observer becomes inert and is garbage collected with the closure. This is the established pattern across the codebase (`inv-custom-item-sorting.ts`, `reactive-dom.ts`, `mutation-observer.ts`).

---

## Appending Reactive Text to Existing Elements

Lighter than a full Vue component. `undefined` hides the element, string shows it.

```ts
import { createReactiveSpan } from '@src/utils/reactive-element'; // also: createReactiveDiv

const text = computed(() => someCondition ? 'value' : undefined);
existingElement.appendChild(createReactiveSpan(owner, text));
```

---

## Wrapping DOM Values as Refs

```ts
import { refTextContent, refAttributeValue, refValue, refAnimationFrame } from '@src/utils/reactive-dom';

refTextContent(element)              // Ref<string | null> — MutationObserver on textContent
refAttributeValue(element, 'attr')   // Ref<string | null> — MutationObserver on attribute
refValue(inputElement)               // Ref<T> — polls .value via rAF
refAnimationFrame(element, x => x.someProperty)  // Ref<K> — polls via rAF, auto-cleans when disconnected

// Shorthand for data-prun-id attribute
import { getPrunId, refPrunId } from '@src/infrastructure/prun-ui/attributes';
getPrunId(element)   // string | null — sync read
refPrunId(element)   // Ref<string | null> — reactive
```

---

## Accessing Game Data

All stores in `@src/infrastructure/prun-api/data/`. File name matches entity: `sites.ts` → `sitesStore`, `planets.ts` → `planetsStore`, etc.

```ts
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';

const site = computed(() => sitesStore.getById(siteId));  // reactive
sitesStore.all.value      // undefined until fetched, then array
sitesStore.fetched.value  // boolean
```

### Store key shapes (verified the hard way)

Map getters are keyed by API values, which don't always match what the game UI shows:

- `materialsStore.getByName` is keyed by the API's camelCase internal name (`basicRations`). UI text holds the i18n **display** name ("Basic Rations") — resolve that with `getMaterialByName` from `@src/infrastructure/prun-ui/i18n` instead (reverse direction: `getMaterialName`).
- `stationsStore.getByNaturalId` is keyed by the station's **own** natural id (`MOR`), but game address fields canonicalize stations to their **system** id (`OT-580`). To resolve a system id to its station, search `stationsStore.all.value` by `getSystemLineFromAddress(x.address)?.entity.naturalId`.

---

## Data & Reactivity Rules

### Identifying Things in the UI

Never rely on strings in HTML to identify game entities. Use IDs from API stores — they're stable across localizations and UI changes.

```ts
// Bad: fragile, breaks with localization or UI changes
const planet = element.textContent?.includes('Promitor');

// Good: use store IDs
const store = getInvStore(tile.parameter);
const site = sitesStore.getById(store?.addressableId);
const naturalId = getEntityNaturalIdFromAddress(site?.address);
```

### Localized Text

Avoid matching on localized text (like "Weight", "Volume"). Use element index or `PrunI18N` lookup instead.

**Exception — fixed structural UI labels:** Matching `textContent` is acceptable for identifying fixed structural UI rows (e.g. project-type rows in `C.PlanetaryProjectsList.row`) because PrUn is English-only and these labels are static game UI strings, not user-generated game entity names. Do not extend this exception to anything that could change with a game update or user action.

### Reactivity

**Prefer `computed` over `watch`/`watchEffect`.** Thinking in computed produces more compact and readable code.

```ts
// Good: store.getById is reactive under the hood
const line = computed(() => productionStore.getById(tile.parameter));
```

**Never use `onApiMessage` in features.** It's a low-level API for entity stores in `infrastructure/prun-api`. All API data lands in entity stores — derive what you need with `computed` or `watchEffect`.

**Timestamps in ETAs must stay reactive.** Use `timestampEachMinute` (not `Date.now()`) when calculating ETAs, so it re-renders automatically.

### Persisting a Small UI Preference

For a single feature-local preference (e.g. a collapsed/expanded toggle), a plain
`localStorage`-backed `ref` is enough — see `relayUrl` in `src/infrastructure/prun-api/relay.ts`
for the established pattern. Don't reach for the tile-state store (`useTileState`/
`user-data-tiles.ts`) for this; that's for state scoped to a specific saved tile instance
(used by XIT panels), not a general feature preference.

**Don't use `removeItem` to represent a falsy/off state if the key's absence already means
something else (like "never configured, use the default").** `getItem` returns `null` for
both "key was removed" and "key was never set" — those collapse into the same value, so a
`?? defaultValue` fallback silently overrides an explicit off state on the next load. Store
an explicit value (e.g. `''`) for the off state instead, so presence vs. absence of the key
stays meaningful:

```ts
// Bad: hiding removes the key, so the next `getItem` returns null and falls
// through to the "open by default" default — the hidden state doesn't stick.
watch(isOpen, value => {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
});

// Good: always set — absence of the key only ever means "never configured".
const state = ref(localStorage.getItem(key) ?? 'default');
watch(state, value => localStorage.setItem(key, value));
```

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

To split a tile and set a companion command, click the tile's split button then wait for the node and change the companion's command.

Split button characters (found via `C.TileControls.control`):
- `'–'` (en-dash) = vertical split (top / bottom)
- `'|'` = horizontal split (left / right)

**Important:** `tile.frame` may be destroyed after a split. Capture `windowEl` and read `tile.container` / `tile.id` *before* clicking.

```ts
import { setBufferSize } from '@src/infrastructure/prun-ui/buffers';
import { clickElement, changeInputValue } from '@src/util';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';

async function splitVertically(tile: PrunTile, companionCommand: string) {
  // Capture window reference before the split destroys tile.frame.
  const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement;

  if (tile.container.classList.contains(C.Window.body)) {
    // Solo floating buffer: make taller, then split.
    const w = parseInt(tile.container.style.width, 10) || 600;
    const h = parseInt(tile.container.style.height, 10) || 400;
    setBufferSize(tile.id, w, h + 450);

    const splitBtn = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '–');
    await clickElement(splitBtn);

    // MutationObserver waits for the Node to appear after the split.
    const node = await $(windowEl, C.Node.node);
    const companion = _$$(node, C.Node.child)[1]; // new tile is always the second child
    if (companion) await setTileCommand(companion, companionCommand);
  } else if (tile.container.classList.contains(C.Node.child)) {
    // Already in a split: reuse the sibling.
    const node = tile.container.parentElement!;
    const sibling = _$$(node, C.Node.child).find(x => x !== tile.container);
    if (sibling) await setTileCommand(sibling, companionCommand);
  }
}

async function setTileCommand(child: Element, command: string) {
  const tileEl = _$(child, C.Tile.tile) as HTMLElement | null;
  if (!tileEl) return;
  const id = getPrunId(tileEl)!;
  if (!dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(id, command))) {
    const input = (await $(child, C.PanelSelector.input)) as HTMLInputElement;
    changeInputValue(input, command);
    input.form!.requestSubmit();
  }
}
```

See also `src/features/XIT/ACT/runner/tile-allocator.ts` for the full horizontal-split companion pattern used by ACT.

> **Note:** `openCompanionBuffer` + `setChildCommand` (horizontal variant of the above) is duplicated across `inv-analysis-button.tsx`, `shpi-base-inv-button.tsx`, and `shpi-warehouse-button.tsx`. Consider extracting to a shared utility in `buffers.ts` if a fourth caller appears.

---

## Left Sidebar Replacement

The `custom-left-sidebar` feature hides the base-game sidebar buttons (`#TOUR_TARGET_SIDEBAR_LEFT_02`) and renders its own configurable set from `userData.settings.sidebar` (label → command pairs, drag-reorderable). Defaults remap several labels to XIT buffers (CONT → `XIT CONTS`, FIN → `XIT FIN`, MAP → `MU`) and append extension-only entries (ACT, BURN, REP, SET, HELP → `XIT *`). Consequence for testing: sidebar clicks in the harness hit extension buttons, not base-game ones — the base mapping is documented in `docs/game/sidebar-screens.md`.

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

---

## CSS

Each feature needing CSS gets a `.module.css` alongside the `.ts`. `applyCssRule` and `C` are auto-imported.

```ts
import $style from './my-feature.module.css';

function init() {
  applyCssRule(`.${C.Frame.logo}`, $style.logo);                              // global
  applyCssRule('PROD', `.${C.OrderTile.overlay}`, $style.disablePointerEvents); // scoped to command
  applyCssRule(['PROD', 'PRODQ'], `.${C.OrderTile.overlay}`, $style.x);        // scoped to multiple
}
```

`applyCssRule` must be called during feature `init()`.

For hover/focus/etc., use CSS Nesting inside the module — one `applyCssRule` call handles both base and nested rules:

```css
.logo {
  cursor: pointer;

  &:hover {
    background-color: rgba(128, 128, 128, 0.5);
  }
}
```

### Class Names

Name classes after where they're applied, not what they do. Fall back to "what it does" only when "where" makes no sense.

```css
/* Bad */
.padLeftRight { }
.flexRow { }

/* Good */
.sortControls { }
.storeInfoColumn { }
```

### Scoping

If a feature targets specific commands, always use scoped CSS rules. Otherwise, styles leak to other commands that share the same DOM structure.

```ts
// Bad: leaks to SHPI and other store views
applyCssRule(`.${C.StoreView.row}`, $style.storeInfo);

// Good: only affects INV
applyCssRule('INV', `.${C.StoreView.row}`, $style.storeInfo);
```

For more specific selectors (descendant combinators, `:nth-child`, etc.), tighten them further to improve performance.

### Import Naming

When importing CSS modules into feature `.ts` files, use `$style` for consistency with Vue's `$style` object.

```ts
import $style from './my-feature.module.css';
```

### Reuse

Use `css.hidden` from `@src/utils/css-utils.module.css` instead of creating your own hidden class.

### Matching Native Input Styling

When adding a new `<input>`/`<textarea>` into the game UI, don't hand-code colors to match
the theme — apply the game's own input class from `C` directly, the same way you'd reuse
any other `C.Component.class`. For a textarea, `C.TextareaInput.textarea` gives the exact
dark background, monospace font, and amber focus-underline used by the game's own inputs
(e.g. the contract draft preamble box), and stays correct automatically if the game
re-themes:

```tsx
<textarea class={[C.TextareaInput.textarea, $style.textarea]} ... />
```

Layer your own module class alongside it for structural overrides only (width, resize,
min-height) — let the `C` class own the colors/border/font.

Two verified quirks when pairing such an input with sibling elements:

- `C.TextareaInput.textarea` sets colors and the focus underline but leaves the font at
  the browser default (13.3333px monospace). A sibling element meant to read like the
  textarea's placeholder (e.g. an empty-state hint on an alternate pane) must set
  `font: 13.3333px monospace` explicitly — panel text is otherwise Droid Sans.
- A bare `<textarea>` is inline-block: it sits on the text baseline and leaves a few px
  of descender gap below it. Give it `display: block` when its footprint must match a
  block-level sibling pane, or the panes' total heights differ even with identical rects.

For a `<select>` there is no class on the element itself — the game styles selects
through an ancestor: `.${C.forms.input} select` provides the standard look (17px
height, dark background, amber bottom border, amber focus underline). When using the
shared `SelectInput` outside a game form (e.g. in a table cell), wrap it in a div
carrying `C.forms.input`:

```html
<div :class="[C.forms.input, $style.selectWrap]">
  <SelectInput v-model="value" :options="options" />
</div>
```

### Matching the Game's Scrollbar

An overflowing element added to the game UI gets the wide native browser scrollbar
(arrow buttons included), which looks foreign in a buffer. The game's narrow gray
scrollbar (chat, command suggestions, production lines) is plain CSS — mirror its own
rules verbatim:

```css
.textarea {
  scrollbar-width: thin;
  scrollbar-color: rgb(51, 51, 51) transparent;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgb(51, 51, 51);
    border-radius: 5px;
  }
}
```

There is no game class to reuse for this: the game's main `ScrollView` machinery never
restyles the scrollbar — it hides the native one by pushing it outside a clipped parent
(`margin-right: -15px`) — so copy the values.

### Beating the Game's `td:first-child` Border Reset

The game's base table CSS includes `table tbody td:first-child { border-left-style: none }`. A feature's own `.myFirstColumnCell { border-left: ... }` rule loses to it: both selectors have one class/pseudo-class-level selector, and CSS specificity compares that count before type-selector count, so the game rule's three type selectors (`table`, `tbody`, `td`) become the tiebreaker and it wins regardless of source order. This silently drops a border-left declared on a table's first column (found live: DISPATCH's Assign-column divider rendered nowhere despite a correct, present-in-build rule).

Beat it with a compound selector using two local classes instead of one — e.g. the cell's own class plus its row's class:

```css
/* Loses to the game's td:first-child reset */
.cell {
  border-left: 1px solid gold;
}

/* Wins: two class selectors outrank the game rule's one pseudo-class */
.row .cell {
  border-left: 1px solid gold;
}
```

Matching the exact header row **height** of another panel also needs more than matching font-size: the game's unstyled `<th>` carries native padding (roughly `5px 8px 2px`). A feature that sets `thead th { padding: 0 4px }` collapses its header to about half that height even with identical font-size — to match another panel's header, don't override `th` padding at all and let it inherit the native value.

### `:has` Selector

Use `:has` to implement conditional styling in pure CSS, avoiding unnecessary JS.

```js
/* Highlights the parent when a descendant has the error class */
applyCssRule(`.${C.InputsOutputsView.input}:has(.${C.InputsOutputsView.amountMissing})`, $style.input);
```

---

## Formatting Dates and Numbers

All formatters are locale-aware (use `Intl.DateTimeFormat` / `Intl.NumberFormat` with the user's preferred locale). Import from `@src/utils/format`.

### Date Formatters

Signature: `(date?: number | Date | undefined) => string`

| Formatter | Output | Example |
|-----------|--------|---------|
| `ddmm` | Month + day | `"03/09"` |
| `ddmmyyyy` | Month + day + year | `"03/09/2026"` |
| `hhmm` | Hours + minutes (respects user's 12H/24H setting) | `"14:30"` |
| `hhmmss` | Hours + minutes + seconds | `"14:30:00"` |

### Number Formatters

Signature: `(value: number) => string`. Do **not** accept `undefined`.

| Formatter | Decimals | Example | Use For |
|-----------|----------|---------|---------|
| `fixed0` | 0 | `"1,235"` | Integer amounts, large values |
| `fixed01` | 0–1 | `"1,234"`, `"1,234.5"` | Mid-range values |
| `fixed02` | 0–2 | `"1,234"`, `"1,234.56"` | Values where trailing zeros are noise |
| `fixed1` | 1 | `"1,234.6"` | Always 1 decimal |
| `fixed2` | 2 | `"1,234.56"` | Prices, always exactly 2 decimals |
| `percent0` | 0 | `"43%"` | Large percentages (>100%) |
| `percent1` | 1 | `"42.5%"` | Medium percentages (10–100%) |
| `percent2` | 2 | `"3.45%"` | Small percentages (<10%) |

Always use number formatters when showing numbers in the UI.

### `formatEta(from, to)`

Takes two timestamps, returns time string with day offset. Uses `hhmm` internally.

```ts
formatEta(timestampEachMinute.value, arrival.value)  // "14:30" or "14:30 +2d"
```

### `formatCurrency(value, format?)`

Formats a number with the user's currency symbol, position, and spacing. Returns `'--'` for `null`/`undefined`.

```ts
formatCurrency(price)              // "1,235 ₳" (defaults to fixed0)
formatCurrency(price, fixed2)      // "1,234.56 ₳"
```

Dynamic format selection based on value magnitude:

```ts
let format = fixed02;
if (price >= 100) format = fixed0;
else if (price >= 10) format = fixed01;
return formatCurrency(price, format);
```
