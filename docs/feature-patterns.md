# Feature Patterns

Core conventions for registering a feature file. For everything else, jump to the doc
that owns the topic:

- **XIT commands / ACT action packages:** `docs/xit-act-patterns.md`
- **DOM query helpers (`$`/`$$`/`_$`/`_$$`), tile observation, mounting Vue, reactive DOM wrappers:** `docs/dom-helpers.md`
- **Tile/window UI gotchas, opening panels, splitting buffers, sidebar, context controls:** `docs/tile-ui-patterns.md`
- **Accessing game data stores, reactivity rules:** `docs/data-reactivity.md`
- **CSS module conventions and recipes:** `docs/css-patterns.md`
- **Date/number/currency formatters:** `docs/formatting.md`

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
