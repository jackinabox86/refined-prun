# Architecture

Browser extension for Prosperous Universe. Intercepts the game's WebSocket and DOM to enhance the APEX terminal interface.

Stack: TypeScript, Vue 3, Vite (content scripts), CSS Modules. Package manager: pnpm.

## Commands

| Command | Does |
|---------|------|
| `pnpm run compile` | `tsc --noEmit` + eslint. **The check to run on any change** — some rules (e.g. `strict-boolean-expressions`) fail only here, not in tsc. |
| `pnpm run build` | clean + compile + `vite build` → `dist/` |
| `pnpm run build:fast` | clean + `vite build`, skipping the checks — for the browser-test loop |
| `pnpm run fix` | eslint `--fix` |
| `pnpm run dev` | watch-mode development build |
| `pnpm run test` | `vitest run` |

**`pnpm run compile` does not type-check `.vue` script blocks.** `tsc` cannot read SFCs and
there is no `vue-tsc` in this repo, so a green `compile` covers `.ts` only. An identifier used
in a `<script setup>` block but never imported passes both `tsc` and eslint and throws at
runtime — an unimported `percent0` in `LineChart.vue` got that far during the FINCH
growth-rate work. Move logic worth checking into a plain `.ts` module next to the component
and unit-test it there, and verify what stays in the SFC against the live game
(`docs/browser-testing.md`). Treat "compile is green" as saying nothing about a `.vue` change.

A fresh clone has no `node_modules` — run `pnpm install --frozen-lockfile` before
`pnpm run compile` / `pnpm run lint`, or `tsc` reports missing `chrome`/`node`/`vite/client`
type libraries, which reads like a broken tsconfig rather than a missing install. Cloud
sessions (Claude Code on the web) always start from a fresh clone.

**Keep test files out of `src/features/index.ts`'s `import.meta.glob` sweeps** — each one
carries a matching `!./<dir>/**/*.{test,spec}.{ts,tsx}` pattern. That glob is the only thing
that ever pulls a test into the import graph, and a build emits exactly what is in the graph,
so dropping the exclusion puts compiled `*.test.js` into `dist/`. Vitest 4 no longer excludes
`dist/**` by default (its `defaultExclude` is just `node_modules` and `.git`), so it then
collects those copies and the suite dies on `document is not defined`, thrown from
`src/infrastructure/shell/config.ts` at import time. That failure names a *source* file and
reads like a real regression — the giveaway is a `dist/` path in the failing-suite header.
The same symptom appears from a `dist/` built before this exclusion existed; `pnpm run clean`
clears it.

Verifying UI-visible behaviour against the live game: `docs/browser-testing.md`.

## Release Workflows

> **Current Firefox version policy (JAC-11):** Firefox ships the UTC calendar version
> `YYYY.M.D.<run_number>` (for example, `2026.8.14.19`), calculated by
> `scripts/firefox-version.mjs`. It must not use Chrome's `VERSION`: `1.1.1.19` is lower than
> legacy Firefox builds such as `2026.8.9.18`, so it cannot update them. Chrome and Firefox
> have independent installed-version streams, while `CHANGELOG.md` remains the cross-store
> release identity.

All release workflows are `workflow_dispatch` only, and dispatch runs the definition from
whatever ref you pick — a workflow change has to land on `main` before it affects a real
release.

| Workflow | Publishes | Versioning |
|----------|-----------|------------|
| `release-chrome.yml` | Chrome Web Store, via the CWS API | semver read from `VERSION`, bumped by a `patch`/`minor`/`major` input, then committed and tagged |
| `release-firefox.yml` | self-hosted unlisted XPI on GCS, signed by Mozilla, with a generated `updates.json` | stamps the manifest with the UTC `YYYY.M.D.<run_number>` version from `scripts/firefox-version.mjs`, e.g. `2026.8.14.47`; does not read or bump `VERSION` |

Firefox's installed version follows the legacy date-stamped sequence, independently of
Chrome's `VERSION`: a Chrome-style version such as `1.1.1.19` is lower than existing Firefox
releases such as `2026.8.9.18`, so it cannot update them. The run-number suffix makes a second
Firefox dispatch on the same UTC day strictly newer, as required by `updates.json` auto-updates.
Run the two workflows in either order; Firefox does not read or modify `VERSION`.

(A third workflow, `release.yml`, was inherited from upstream and deleted — it was never
dispatched and would have failed, wanting `CLIENT_ID`/`CLIENT_SECRET`/`REFRESH_TOKEN`
secrets this fork does not define. Don't reintroduce it by re-syncing upstream wholesale.)

GitHub records a run under Deployments/Environments only when the *job* declares an
`environment:` key — publishing to a store is not itself enough. This is why Chrome
releases were long invisible there while Firefox ones showed up. Use the
`{ name, url }` mapping form rather than a bare string, so the Deployments entry links
somewhere: the store listing for Chrome, the latest self-hosted XPI for Firefox.

Environment-scoped jobs still read repository-level secrets, so adding `environment:` to a
job does not cut it off from existing secrets. It can, however, introduce an approval gate
if that environment carries protection rules.

Chrome and Firefox have independent installed-version streams: Chrome uses `VERSION` while
Firefox uses its UTC date/run-number version. Anything that needs a stable, cross-store
"release identity" (e.g. `XIT
WHATSNEW`'s changelog view, `src/features/XIT/WHATSNEW/changelog-data.ts`) should still key
off `CHANGELOG.md`'s own version headings, never `chrome.runtime.getManifest().version` /
`config.version`.

## Path Aliases

| Alias | Resolves to |
|-------|-------------|
| `@src/*` | `src/*` |
| `~/*` | `src/assets/*` |

---

## Dependency Layers

```
features/  ──→  core/  ──→  infrastructure/  ──→  utils/
   │                              │                  ▲
   │                              ▼                  │
   └──────────────────────→   store/   ──────────────┘
```

Do not import upward (e.g. no `infrastructure` → `features` imports).

---

## Build Targets & Startup Sequence

Three Vite content scripts run in order:

1. **`refined-prun-prepare.ts`** (`document_start`) — Serializes PrUn app scripts to pause game loading until socket proxies are injected.
2. **`refined-prun-startup.ts`** (content script) — Loads user data from `chrome.storage.local`, injects CSS and main script as page-level `<script>` elements.
3. **`refined-prun.ts`** (page context) — Imports shell, utils, all features, then calls `main()`.

Important: the extension only uses the lightweight context scripts at the startup, and the main part is injected as a page-level `<script>` element. This allows the extension to work in the page context, instead of a content script sandbox.

Check **`src/main.ts`** for runtime startup orchestration.

---

## Source Layout

```
src/
├── infrastructure/             # See "Infrastructure Details" below
│   ├── prun-api/               # WebSocket interception & reactive data stores
│   ├── prun-ui/                # DOM interaction (C, tiles, applyCssRule)
│   ├── storage/                # chrome.storage.local relay (page ↔ content script)
│   ├── fio/                    # FIO REST API (rest.fnar.net) + local fallback
│   └── shell/                  # Extension bootstrap (config, deserialize)
├── store/
│   └── user-data.ts            # userData reactive object — all persisted prefs
├── features/
│   ├── feature-registry.ts     # features.add(), features.init()
│   ├── basic/                  # All users. Auto-imported via import.meta.glob
│   ├── advanced/               # FULL mode only. Auto-imported via import.meta.glob
│   └── XIT/                    # Custom tile commands. Auto-imported via import.meta.glob
├── components/                 # Shared Vue components
├── utils/                      # Pure utilities (no game/extension deps)
├── core/                       # Domain logic
└── hooks/                      # Vue composition hooks
```

---

## Infrastructure Details

### `prun-api/` — Game Data

Intercepts socket.io WebSocket. Messages flow:
```
Game Server → socket.io WebSocket
  → socket-io-middleware.ts (intercept)
    → api-messages.ts (dispatch by message type)
      → 30+ entity stores (createEntityStore pattern)
        → features consume via .getById(), .all, .fetched
```

**Entity stores** (in `data/`) are created with `createEntityStore()`. Each provides:
- `.all` — `Ref<Entity[] | undefined>` (undefined until first fetch)
- `.fetched` — `Ref<boolean>`
- `.getById(id)` — reactive lookup

Stores reset on `CLIENT_CONNECTION_OPENED` (reconnect).

To get a list of all entity stores, list the files in `prun-api/data/`.

The stores listen for api messages:
```ts
import { onApiMessage } from '@src/infrastructure/prun-api/data/api-messages';
onApiMessage({ SOME_MESSAGE_TYPE(data) { /* ... */ } });
```

Stores fed only by ad-hoc `DATA_DATA` payloads (data that arrives per opened buffer, with
no bulk fetch — e.g. `populations`, `population-projects`) must call `store.setFetched()`
inside the handler: `.getById()`/`.all` return `undefined` until `fetched` flips, so
without it the store looks permanently empty no matter how many payloads arrive.

### `prun-ui/` — DOM Layer

- **`C`** (`prun-css.ts`) — Object of runtime CSS class names parsed from PrUn's hashed stylesheets. E.g. `C.TileFrame.frame`. Available globally (auto-import).
- **`tiles`** (`tiles.ts`) — Tracks active game tiles. `tiles.observe('CMD', cb)` fires `cb(tile)` for every tile matching the command. `tile` has `.command`, `.parameter`, `.frame`, `.anchor`.
- **`showBuffer(cmd)`** (`buffers.ts`) — Opens a new game floating buffer programmatically with the provided command.
- **`applyCssRule`** (`refined-prun-css.ts`) — Injects CSS rules, optionally scoped to a command.

### `storage/` — Persistence

User settings live in `userData` (`src/store/user-data.ts`), a reactive object auto-synced to `chrome.storage.local` via a `postMessage` relay between page and content script contexts.

#### User Data Migrations

Migrations (`user-data-migrations.ts`) run on every load to transform stored data to the current schema. New migrations go at the **top** of the list. A legacy versioned system (`user-data-versioned-migrations.ts`) exists for old data — do not add to it.

---

## Auto-Imports

See the table in `docs/feature-patterns.md` → "Auto-Imports" (single source of truth — the two copies had already drifted once).

---

## Feature Development

See `docs/feature-patterns.md` for all patterns (registration, tiles, DOM helpers, CSS, data stores, formatting).
