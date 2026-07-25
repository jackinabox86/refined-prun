# Accessing Game Data & Reactivity Rules

Entity stores and the reactivity conventions for using them safely. Split out of
`docs/feature-patterns.md`.

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
- `PrunApi.Ship` has no type/class field (no "Freighter" vs. "Shuttle" distinction), even though the game's own `SHP` screen shows one — it's not present in the raw entity data. A ship's cargo-hold capacity is a reliable stand-in for "how big is this ship": resolve it via `warehousesStore.all.value?.find(x => x.storeId === ship.idShipStore)`, then read `.volumeCapacity`/`.weightCapacity` off the matched `Warehouse`.

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

**A `watchEffect` that writes its own dependency must gate on value inequality, not
just a condition.** DISPATCH's persisted-config migration rebuilt the patched object
whenever the migration *condition* held; with a repair offset of 0 the migrated value
equaled the old one — same values, new object identity, so the effect re-fired on its
own write in an unbounded loop. Before a self-write, prove the patch actually changes a
value (e.g. `newDefault !== oldDefault`), not merely that the migration applies.

**Never use `onApiMessage` in features.** It's a low-level API for entity stores in `infrastructure/prun-api`. All API data lands in entity stores — derive what you need with `computed` or `watchEffect`.

**Timestamps in ETAs must stay reactive.** Use `timestampEachMinute` (not `Date.now()`) when calculating ETAs, so it re-renders automatically.

**Don't rebuild editable UI state when its source store object is rewritten.** Data
capture rewrites whole `userData` objects on any change, so a `watch` that
reinitializes a local editable structure from that object re-fires mid-edit and wipes
the user's input. Merge instead: keep still-valid user picks, only fill new/missing
entries (see the slots watch in `GovBurnActWindow.vue`).

### Persisting a Small UI Preference

For a single feature-local preference (e.g. a collapsed/expanded toggle), a plain
`localStorage`-backed `ref` is enough — see `relayUrl` in `src/infrastructure/prun-api/relay.ts`
for the established pattern. Don't reach for the tile-state store (`useTileState`/
`user-data-tiles.ts`) for this; that's for state scoped to a specific saved tile instance
(used by XIT panels), not a general feature preference.

**Always `setItem` an explicit off-value; never `removeItem`.** `getItem` returns `null`
for both "removed" and "never set", so a `?? defaultValue` fallback silently overrides an
explicit off state on the next load. Keep absence of the key meaning only "never
configured":

```ts
const state = ref(localStorage.getItem(key) ?? 'default');
watch(state, value => localStorage.setItem(key, value));
```
