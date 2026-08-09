# Browser Testing

How to verify a refined-prun change against the live game in a real browser. Everything
here is agent-agnostic: it is the harness, the rules, and the traps. Agent-specific
plumbing (who drives it, permissions, sandboxing) lives with that agent's own config —
for Claude Code that is `.claude/skills/run/SKILL.md`.

This is a Manifest V3 extension (see `architecture.md`): it intercepts the game's
WebSocket and injects a page-level `<script>` at `document_start`, so it **must** run as
a real unpacked extension in a real Chromium-based browser. Visiting the game as a plain
webpage tests nothing.

**Environment gate.** The harness only runs in a checkout that has the gitignored
`.local/` directory and a graphical session (the owner's WSL2 machine: `/mnt/wslg` and
`.local/pw-tools/node_modules/playwright` both exist). Anywhere else — a cloud agent, CI,
a fresh clone — do not launch anything and do not retry: say once that browser
verification needs that machine, then continue with whatever else the task allows.
Type/lint checks (`pnpm run compile`) run anywhere and are not a substitute for it.

## One-time setup

1. **pnpm on PATH**, at the version pinned in `package.json`'s `packageManager`:
   `npm install -g pnpm@10.32.1`. If a global install isn't possible, prefix every
   command with `npx pnpm@10.32.1`.

2. **Isolated Playwright install.** Playwright is deliberately *not* a project
   devDependency — it is a personal testing tool, installed under gitignored `.local/`:
   ```
   mkdir -p .local/pw-tools
   cd .local/pw-tools && npm init -y
   npm install playwright --no-save --prefix .
   npx playwright install chromium
   cd -
   ```
   Both halves are required: the npm package in `.local/pw-tools/node_modules` (loaded by
   `pw-helper.mjs`) *and* the browser build under `~/.cache/ms-playwright`. If a browser
   build is already cached, install the matching Playwright version (chromium-1228 ↔
   playwright@1.61.1) or just re-run `npx playwright install chromium`.

   The download does **not** include Chromium's OS-level shared libraries; on a fresh
   distro the launch dies with `libnspr4.so: cannot open shared object file`. The fix
   needs sudo, so ask the machine's owner to run it themselves:
   `sudo apt-get install -y libnss3 libnspr4 libasound2t64`. Diagnose repeats with
   `ldd ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | grep "not found"`.

## Every session

### 1. Build

```
pnpm install          # only if node_modules is missing
pnpm run build:fast   # skips tsc; run `pnpm run compile` separately for type/lint errors
```

**A stale build fails silently, and this is the single most common false bug report.**
The browser holds whatever was last built, `dist/` and the checked-out branch are shared
mutable state, and the owner switches branches often — so assume the loaded build is not
yours. A feature missing from it renders zero DOM and logs no error, which is
indistinguishable from a broken feature. Always rebuild and reload before verifying, and
before concluding anything is broken, grep `dist/` for a string unique to your change.
Re-check mid-run if a long session starts producing surprising results (this has happened
live: another session rebuilt `dist/` from a different branch mid-test).

**From a git worktree the harness needs two bridges.** `.local/` is gitignored, so a
worktree has neither `pw-tools/` nor `browser-profile/`, and `scripts/pw-act.mjs` resolves
them from its own repo root — every call dies with `Playwright is not installed at
<worktree>/.local/pw-tools/node_modules/playwright`. Symlink it once
(`ln -sfn <main-checkout>/.local <worktree>/.local`); it stays gitignored. Second, the
running browser was launched with `--load-extension=<main-checkout>/dist`, so building in
the worktree changes nothing it can see — copy the worktree's `dist/` over the main
checkout's before reloading. That overwrites shared state the whole machine tests against,
which is the hazard the worktree existed to avoid: confirm with the owner first if another
session might be mid-run.

### 2. Launch

```
node scripts/local-browser-test.mjs
```
Run it **backgrounded**: the process blocks forever on purpose to keep the browser alive
and hold the CDP port at `http://127.0.0.1:9333`. Killing the process kills the browser.

First time ever, tell the owner the window is open at `apex.prosperousuniverse.com` and
**wait for them to log in by hand** — never attempt a login yourself. After that the
profile at `.local/browser-profile` persists the session across launches.

If the launch reports `Opening in existing browser session`, a previous browser still
holds the profile lock: `node scripts/pw-kill.mjs` force-kills only processes bound to
this profile, then relaunch.

**If the browser is already running, don't relaunch it.** Rebuild, then
`node scripts/pw-act.mjs reload-extension`. That is the whole iteration loop: rebuild →
reload-extension → look.

### 3. Drive and observe

`scripts/pw-act.mjs` attaches over CDP on each call, so it never touches the profile or
relaunches anything. `node scripts/pw-act.mjs help` prints every action with its
arguments — that list lives in the script and is not duplicated here. Grouped by job:

| Job | Actions |
| --- | --- |
| Build/session | `reload-extension`, `reload` |
| Open a tile | `open-buffer '<CMD>'`, `open-contd-template` |
| Interact | `click`, `click-force`, `click-nth`, `ctrl-click`, `type`, `fill-nth`, `fill-file`, `press`, `press-on`, `select-option` |
| Read state | `list-windows`, `dump-windows`, `window-text`, `styles`, `local-storage-get`, `contd-template-fields` |
| Look | `screenshot`, `screenshot-window` |
| Window layout | `move-window`, `resize-window`, `close-window` |
| Drag & drop | `mouse-drag`, `drag-stack`, `real-drag-stack`, `drag-probe` |
| Escape hatch | `eval` |

Four rules govern which one to reach for:

- **`open-buffer` is the standard way to open any tile** (PROD, INV, FLT, XIT, CONTD —
  all of them). It bakes in the Escape-before-Enter fix below; hand-rolling "click NEW
  BFR, type, Enter" re-introduces that bug every time.
- **Prefer a fixed action over `eval`.** Every action but `eval` takes plain data with the
  logic fixed in `pw-act.mjs`, so it is reviewable, repeatable and cheap; `eval` ships
  different arbitrary JS into a live logged-in session each time. Before reaching for it,
  check the list *every time*: can this be a selector string, `window-text`,
  `list-windows`, `styles`, `local-storage-get`? Playwright's `:has-text("...")` composes
  directly in any selector, so most "find this by its text and act on it" tasks need no
  `eval` at all. **If an `eval` pattern recurs, add it to `pw-act.mjs` as a new
  fixed-argument action** — one entry replaces N future one-offs. Put fixes that apply to
  any feature in the shared `openBuffer()` helper; build feature-specific compound actions
  (like `open-contd-template`) on top of the shared primitives.
- **Batch, and screenshot only at decision points.** Chain steps that need no intermediate
  inspection with `&&`. Screenshots are for confirming a feature actually succeeded or
  failed, or for seeing what is really on screen when stuck — not for narrating progress.
  Prefer `screenshot-window` over a full-page shot: cropping to the buffer under test is
  cheaper and easier to read. `reload` clears accumulated test clutter in one call.
- **Two attempts per verification method.** If the same approach fails twice, it is the
  approach that is wrong. Switch to a cheaper, more reliable one (usually reading computed
  style or DOM attributes instead of a pixel screenshot); if that isn't feasible either,
  report what was tried and stop. Never rewrite the same script a third time hoping the
  selector or timing will work.

### 4. Cleanup

**Ask before closing the browser.** It is not a routine end-of-task step — closing it
discards the open buffers and the next relaunch costs real time. Only when the owner asks,
or a rebuilt extension genuinely needs a fresh load:

```
node scripts/pw-close.mjs      # clean shutdown, flushes the profile
```
then stop the backgrounded launcher. `node scripts/pw-kill.mjs` is the fallback when a
relaunch still reports "Opening in existing browser session"; prefer it over hand-rolled
`pgrep`/`kill`, since it is scoped to this profile and can't touch an unrelated browser.

**Never call `browser.close()` from an observe/act script.** Over `connectOverCDP` that
terminates the real browser process. Only `pw-close.mjs` should ever call it.

## Hard rule: never trigger a server action

Every action that talks to the game server needs an explicit human click (see
`contributing.md`). Navigating, opening buffers, filling local form fields and
screenshotting are all fine to drive. Anything with a Save / Submit / Send / order /
fulfil effect is not — stop and report exactly what the owner must click.

This includes **"Create New" on the CONTD drafts list**, which looks like navigation but
creates a real draft on the account (this has happened: scripting that click to reach a
fresh draft's screen left a stray real draft behind). If a screen only exists on a fresh
draft, ask for the click or use an existing draft already in that state.

## Why calls must not be isolated from the host network

`pw-act.mjs` and friends connect to the browser's CDP port on `127.0.0.1`. Any execution
environment that gives commands their own network namespace has its own loopback, so its
`127.0.0.1` is not the host's and the connection fails with `ECONNREFUSED` even though the
browser is up and answering (verified: an isolated `curl` to :9333 was refused while an
unisolated one got HTTP 200 at the same moment). No host allowlist can fix this — the
calls have to run in the host's network namespace.

Two consequences worth knowing before blaming the browser:

- An `ECONNREFUSED` while the browser is demonstrably up means the *call* was isolated,
  not that the browser died. Check that before restarting anything.
- Ad-hoc scripts that `pw-act.mjs` can't cover belong in `.local/scratch/` and run as
  `node .local/scratch/<name>.mjs` — the same script elsewhere (a temp dir outside the
  repo) or invoked by absolute path can miss the environment's exemptions and produce that
  same phantom `ECONNREFUSED`. If such a script keeps getting rewritten across sessions,
  promote it to a `pw-act.mjs` action.

## Gotchas learned the hard way

### Build and extension state

- **A rebuild can silently disable the extension.** `build:fast` runs `rimraf dist`, so
  the unpacked files briefly vanish; with Developer Mode off, Chrome calls that corruption
  and disables the extension. Every XIT buffer then falls back to the game's
  unrecognized-command placeholder — a solid bright-green box that reads as a rendering
  crash. `reload-extension` now forces Developer Mode on and re-enables the extension
  first, so it shouldn't recur; if the green box appears, check `chrome://extensions`
  before suspecting the code. Treat `reload-extension`'s success message as "the click
  happened", not "the extension is running" — confirm with a real XIT tile.
- **After `reload-extension` the game tab reconnects.** The first `open-buffer` can time
  out while that happens; wait ~20s and retry before suspecting the build.

### Opening and targeting windows

- **The buffer command input swallows Enter.** It is a react-autosuggest combobox: typing
  opens a suggestion dropdown that captures Enter. Press `Escape` first, then Enter — but
  when no suggestion is showing, Escape can clear the field instead, so re-check the value.
  `open-buffer` handles both; see `game/ui-concepts.md` → "Opening a Buffer (Two Paths)".
- **Custom XIT panels are not commands.** The extension registers only `XIT` and parses
  the rest as a sub-command (`xit-commands.ts`). `open-buffer DEV` types a bare `DEV` into
  the game's own parser, which silently opens a dead "Illegal command" buffer. Always pass
  the full form: `open-buffer 'XIT DEV'`.
- **Scope every selector to one window once more than one is open.** An unscoped
  `button:has-text("View")` matches across every open tile, and CSS-module basenames
  collide between features (`[class*="rp-BaseRow__x"]` matches every feature's `BaseRow` —
  BS's was measured instead of ARMADA's for two rounds; see `feature-patterns.md` → "File
  Organization"). Resolve the window first, then query inside it.
- **Identify a window by something unique to *that view*.** The same string often appears
  twice (a draft's ID shows up in both the drafts list and its detail window). A tab label
  or a heading only the detail screen has works; when nothing else is handy, the title
  bar's `BUFFER n` label is unique per window.
- **Position every buffer before a multi-buffer interaction** and confirm the layout with
  one screenshot before touching anything. Hunting for the right window afterwards wastes
  calls and risks driving the wrong one.
- **Docked tiles are invisible to the window helpers.** `list-windows`, `dump-windows`,
  `move-window`, `resize-window`, `close-window` and `drag-probe`'s lookup only see
  floating buffers (`Window__window`); base-screen docked tiles (`TileFrame__`) never
  appear and can't be repositioned. Target their inner selectors directly and resolve
  occlusion with `elementFromPoint`.
- **Restore anything you resize.** A resize done purely for screenshot readability
  persists for the rest of the session, and the owner later reads the slack as a product
  layout bug (this cost a full diagnosis round). Resize back or close the buffer.

### Clicks and inputs

- **Button text is often all-caps by CSS while the DOM text is mixed-case** ("VIEW" is
  really `View`, "SELECT TEMPLATE" is `Select Template`, the "all" button is genuinely
  lowercase, "NEW BFR" is real caps). Match case-insensitively, or switch to stable class
  names once found.
- **A just-filled input keeps focus, and its focus ring can cover a sibling button.**
  Several game form components render an absolutely-positioned `::before` ring on the
  wrapper; a statically-positioned sibling painted earlier ends up underneath it, and
  Playwright reports `intercepts pointer events`. Blur first, then retry. This was a real
  bug in the CONTD "all" button (fixed with `position: relative; z-index: 1`), so always
  test an injected button *immediately after typing* — the natural user flow — not after
  an unrelated pause.
- **RadioItem toggles ignore clicks on their inner text.** Clicking the label or the
  `RadioItem__value` span silently no-ops. Click
  `[class*="RadioItem__container"]:has-text("...")` and confirm the toggle took via the
  `RadioItem__active` class rather than assuming.
- **In a scrolled tile the fixed `TileFrame__header` covers the topmost visible row.** A
  press aimed there lands on the header and no-ops, which looks like a broken feature.
  Verify the press point with `elementFromPoint` first and target rows fully below it.
- **Vue `@change` handlers don't fire from synthetic events.** Setting `input.value` and
  dispatching `input`/`blur`/`focusout` never triggers `@change`, so an edit looks like it
  "doesn't persist" — a false product bug that cost a diagnosis round on GOVBURN's config
  inputs. Use a real `fill()` plus a genuine `Tab`/`Enter`, and verify persistence from a
  freshly opened buffer, not the same DOM.

### Drag and drop

- **A synthetic-DragEvent test can pass while a real player drag fails.** The CONTD Drag
  tab passed every `drag-stack` test while being broken for real users in three browsers.
  Prove drops with `real-drag-stack` (real mouse input). Two mechanisms synthetic dispatch
  skips:
  - *dropEffect negotiation.* The game's top-level dragover handler runs after feature
    handlers in the bubble phase and resets `dataTransfer.dropEffect` to `'none'` for
    anything that isn't one of its own targets — and a dragover ending in `'none'` makes
    the browser cancel the drop outright (`dragend` fires, `drop` never does). Drop zones
    must `preventDefault()` **and** `stopPropagation()` **and** set an explicit
    `dropEffect`, in **both** dragenter and dragover.
  - *Occlusion.* Real mouse input lands on whatever is topmost; `getBoundingClientRect`
    doesn't know a floating window covers the source stack, so the press drags that window
    instead and shuffles the layout for every later call. `real-drag-stack` checks
    `elementFromPoint` for both ends and names the covering element — fix with
    `move-window` and retry.
- **This applies to the extension's own elements too.** A drop can "work" (state updates)
  while the game still resets `dropEffect` to `'none'`; the only symptom is the drag ghost
  playing a ~1s snap-back animation. Related: the default drag image snapshots overlapping
  neighbours (call `setDragImage` with the intended element), and a `data-tooltip` on the
  drag source bleeds into the ghost (ARMADA dropped its ship tooltip for this). To test
  extension-internal zones without a mouse, dispatch `dragstart`/`dragover`/`drop` sharing
  one `new DataTransfer()`, and check the result on the **next** tick (Vue renders async).
- **Tickers repeat across visible inventory grids**, and every ticker-taking helper
  (`ctrl-click` by text, `drag-stack`, `real-drag-stack`, `drag-probe`) resolves the FIRST
  DOM match — one live check had COF, KOM, PWO, DW, RAT, OVE, EXO, PT and REP in both
  grids. Enumerate each grid's tickers first and pick ones unique to the source grid, or
  scope the selector to that grid's container.
- **Resize buffers via the real handle, never `style.width`/`height`.** Position
  (`style.left`/`top`) is safe to override; size is not — the framework re-renders inner
  layout from its own state, which a CSS override on the wrapper never touches. The handle
  is an unclassed `<div>` with `cursor: se-resize`; `resize-window` finds and drags it.
  Its `getBoundingClientRect()` can lie about where it's clickable (scrollbar tracks and
  adjacent resize strips overlap most of the box), so `resize-window` probes points with
  `elementFromPoint` — and a window whose corner has drifted off-screen has an unreachable
  handle, so `move-window` it back into the viewport first. This handle is *not* HTML5 DnD
  (`draggable` is false), so a real mouse drag is correct here, unlike material stacks.
- **Diagnosis pattern for any drag mystery:** attach capture+bubble listeners for all six
  drag event types logging `defaultPrevented` and `dropEffect`, run a real drag, and diff
  capture against bubble — `copy` at capture becoming `none` at bubble names the culprit,
  and a missing `drop` entry confirms the browser cancelled.

### Verifying claims

- **Never report a visual claim from intended CSS.** Measure `getBoundingClientRect` live;
  in one incident the written CSS wasn't even applied to the element being described.
- **Client-side signals prove nothing about the server.** ACT log lines, local store
  echoes and reactive UI updates all happen without a server round trip. The authoritative
  check that something reached the server is `node scripts/pw-act.mjs reload` (fresh
  WebSocket) and re-reading the data from scratch.
- **Live game state drifts, so pure logic may need offline verification.** A calculation
  fix can become unobservable between coding and testing (a third party refilled the
  reserve that made the scenario exist). Don't force it live: import the built module from
  `dist/src/...` in a node script (strip the leading `import ".../shell/config.js"`
  side-effect line first) and assert the cases directly. The live check then only has to
  confirm the displayed values match current data.

## Files

`scripts/**/*.mjs` is excluded from eslint (`eslint.config.mjs`), so `pnpm run compile`
does **not** check anything below — `node --check <file>` is the syntax check, and
`node scripts/pw-act.mjs help` runs without a browser or the Playwright install, which
makes it a cheap smoke test after editing the runner.

- `scripts/pw-helper.mjs` — shared constants (paths, CDP port, APEX URL), the lazy loader
  for the isolated Playwright install, and `connect()` (attach + friendly failure).
- `scripts/local-browser-test.mjs` — the long-running launcher.
- `scripts/pw-act.mjs` — the action runner; `help` lists every action. Holds the shared
  `openBuffer()` helper used by every tile, plus compound actions built on it.
- `scripts/pw-screenshot.mjs` — one-off screenshot plus current URL/title.
- `scripts/pw-close.mjs` — clean shutdown (flushes the profile).
- `scripts/pw-kill.mjs` — force-kills leftover browser processes for this profile only.
  Platform-branched (Windows PowerShell/taskkill, Linux pgrep/SIGKILL).
