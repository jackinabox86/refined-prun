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

### Action-Specific Sentinel Values

`configurableValue` and `groupTargetPrefix` (`shared-types.ts`) are sentinels shared across every ACT action/material-group type. If an action needs an extra dropdown option unique to itself (e.g. Refuel's "All Exchanges" origin, alongside "Configure on Execution" and specific storages), define that sentinel in the action's own `utils.ts`/`config.ts` instead of adding it to `shared-types.ts`.

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
