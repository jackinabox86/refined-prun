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

Verifying UI-visible behaviour against the live game: `docs/browser-testing.md`.

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

See `docs/feature-patterns.md` for registration, and its index for the split-out topic docs (tiles/DOM helpers, tile UI, CSS, data stores, formatting).

---

## `src/game-3d/` — 3D Game Mode (Spike)

A top-level sibling to `features/`, `infrastructure/`, etc. — a fullscreen three.js scene (WebGLRenderer room geometry + CSS3DRenderer panels hosting refined-prun buffers) that runs in the same JS realm as the rest of the extension. That's the whole reason it lives in this repo instead of a separate extension: no cross-extension messaging bridge needed to reach entity stores (`prun-api/data/*`) or mount real Vue components.

**Dependency rule:** `src/game-3d/` may import from `infrastructure/`, `core/`, `store/`, `utils/` — same as `features/`. Nothing outside `src/game-3d/` may import from it, with exactly one exception: a single dynamic `import('@src/game-3d')` call, in `src/game-3d-launcher.ts`'s `toggleGame3D()` function. That one call is the entire seam between the 2D extension and 3D mode — verify it with:

```
grep -rn "import(['\"]@src/game-3d['\"])" src --include=*.ts --include=*.tsx
```

which should always show just that one line, in `src/game-3d-launcher.ts`.

`toggleGame3D()` itself has two callers — a hotkey listener in `src/main.ts` (Ctrl+Alt+3) and a top-bar button (`src/features/basic/game-3d-launch-button.ts`) — but both funnel through the same single `import()` call rather than each dynamically importing `@src/game-3d` themselves. Any future trigger (another button, a context-menu entry, whatever) should call `toggleGame3D()` too, not add a new `import('@src/game-3d')` call site.

**Why dynamic, not static import:** `three` is a few hundred KB. A static import anywhere in the base app's module graph would force every user to download and parse it, even if they never open 3D mode. The build (`vite.config.mts`) emits ES modules with `preserveModules: true`, injected as `<script type="module">` (`src/refined-prun-startup.ts`), so dynamic `import()` is natively supported — the `game-3d` module graph is only fetched once the toggle actually fires.

**Isolated failure:** `toggleGame3D()` wraps the dynamic import and launch call in try/catch, logging to `console.error` on failure. A bug or exception inside `game-3d` can't take down the base 2D extension, regardless of which trigger fired it.

**Exception — `game-3d` importing from `features/`:** unlike every other module, `src/game-3d/` is explicitly permitted to import Vue components straight out of `features/XIT/` (e.g. `INV.vue`) to Teleport them into a CSS3D panel — see `src/game-3d/buffer-panel.tsx`. This is a deliberate, permanent exception for 3D-mode work, not a temporary spike shortcut to be cleaned up later: `features/XIT/` buffers are already eagerly bundled for every user (`features/index.ts`'s `import.meta.glob(..., { eager: true })`), so this import adds no bundle-size cost, and it isn't enforced by tooling (no ESLint rule polices the dependency layers in this repo). The tradeoff is purely maintenance blast-radius — a `features/XIT/` reorg could silently break `game-3d` — accepted as low-priority for now given the small surface area. Do not "fix" this by relocating buffer components unless asked.

**Known spike-only wiring:** buffer components that use `useTileState()` (`src/store/user-data-tiles.ts`) expect a real XIT tile host to have installed `tileStatePlugin` on an ancestor Vue app — without it, `inject(tileStateKey())` returns `undefined` and the component throws on mount. The `game-3d` Teleport bridge installs `tileStatePlugin` itself with a synthetic tile ID (see `src/game-3d/buffer-panel.tsx`) to replicate that ambient context. Any future buffer swapped into the CSS3D panel needs the same check: does it rely on context normally supplied by the real XIT panel host, beyond just DOM position?

**2D floating windows over the fullscreen overlay:** the overlay container (`src/game-3d/Renderer.ts`) sets `zIndex: 2147483646` so the 3D scene paints over the entire 2D UI. But a Teleported buffer can still trigger `showBuffer()` (`src/infrastructure/prun-ui/buffers.ts`) to open a real 2D floating window — confirmed via live devtools that its ancestor chain up to `<body>` establishes no competing stacking context, so the *only* reason it was invisible was its own z-index (~1000) losing to the overlay's. `src/game-3d/buffer-window-guard.ts` fixes this with a `MutationObserver` that bumps any new `.Window.window` element's z-index above the overlay's. One subtlety that isn't obvious from the fix alone: a one-time bump at creation is not enough — the game's own window manager rewrites that same element's `style` attribute (including `zIndex`) on every focus click or drag, silently clobbering the override. The observer must also watch `attributeFilter: ['style']` mutations and re-apply the bump every time the host rewrites it, not just once. This is a general pattern worth remembering for any future code that needs to keep an inline override alive on an element owned by the host game rather than by us.
