---
name: run
description: Launch a real Chromium browser with the refined-prun extension loaded via a persistent profile, so you can log into Prosperous Universe once and then drive/observe the live game UI (navigate, click, screenshot) across many tool calls. Triggers on "run the app", "test this in the browser", "verify this feature", "take a screenshot of the game". Do NOT use for pure unit/type checks (use `pnpm run compile`) — this is for visual/behavioral verification against the real game. ONLY works in the local WSL2 checkout (needs WSLg + .local/pw-tools); in any other environment (Claude Code on the web, cloud agents, CI) do NOT attempt it or report its absence — just note once that browser verification needs the local WSL2 session, and move on.
---

# Run: Local Browser Test Harness

**Delegate verification to the `game-tester` agent by default.** Screenshots and DOM
dumps are the most expensive thing a main session can hold in context — spawn the
`game-tester` agent (defined in `.claude/agents/game-tester.md`, it reads this skill
itself) with a concrete checklist of what to verify, and consume its text-only report.
Drive the browser directly from the main session only for a single quick call (one
`list-windows`, one targeted `styles` check) or when the user asks to watch a specific
interaction live; anything multi-step or screenshot-heavy goes to the agent. Pass
`model: haiku` for cheap smoke checks; the default (sonnet) handles normal verification.

**Environment gate: this skill only works in the local WSL2 checkout** (the one with
WSLg and the gitignored `.local/` directory). Quick check: `/mnt/wslg` and
`.local/pw-tools/node_modules/playwright` both exist. If either is missing — Claude Code
on the web, a cloud agent, CI, a fresh clone — do not launch anything, do not retry, and
do not pepper the user with failure messages: say once that browser verification needs
the local WSL2 session, then continue with whatever else the task allows.

This is a Manifest V3 browser extension (see `docs/architecture.md`) — it intercepts
the game's WebSocket and injects a page-level `<script>` at `document_start`, so it
**must** run as a real unpacked extension in a real Chromium-based browser. It cannot
be tested by just visiting the game as a webpage.

This skill launches Playwright's own downloaded Chromium (Linux-native under WSL2; the
window is visible on the Windows desktop via WSLg) with the built extension, using a
persistent profile so login survives across runs. It exposes a CDP
debug port so follow-up steps can attach and drive the page without relaunching.

## Prerequisites (one-time per machine)

1. **pnpm on PATH.** Install the version pinned in `package.json`'s `packageManager`
   field:
   ```
   npm install -g pnpm@10.32.1
   ```
   Verify with `pnpm --version`. If a global install isn't possible, fall back to
   `npx pnpm@10.32.1 <cmd>` for every command below. (Windows-era note: `corepack
   prepare` fails there with `EPERM` under `C:\Program Files` — the global npm install
   is the fix on that platform too.)

2. **Isolated Playwright install.** Playwright is deliberately **not** a project
   devDependency (kept out of `package.json`/`pnpm-lock.yaml`) — it's a personal testing
   tool, installed once under the gitignored `.local/` directory:
   ```
   mkdir -p .local/pw-tools
   cd .local/pw-tools && npm init -y
   npm install playwright --no-save --prefix .
   npx playwright install chromium
   cd -
   ```
   The harness launches Playwright's own downloaded Chromium (no `channel` option), so
   **both** halves are required: the npm package in `.local/pw-tools/node_modules`
   (`pw-helper.mjs` `require()`s it from there) *and* the browser build under
   `~/.cache/ms-playwright` — one without the other fails. If a browser build is already
   cached, install the playwright version matching its revision (chromium-1228 ↔
   playwright@1.61.1) or just re-run `npx playwright install chromium`. The download does
   **not** include Chromium's OS-level shared libraries: on a fresh distro the launch dies
   with `libnspr4.so: cannot open shared object file`. Fix needs sudo (password —
   ask the user to run it in their own terminal):
   ```
   sudo apt-get install -y libnss3 libnspr4 libasound2t64
   ```
   Diagnose any repeat with `ldd ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome |
   grep "not found"`. Check `.local/pw-tools/node_modules/playwright` exists before
   redoing this step. npm installs write to `~/.npm/_cacache`, which the Bash sandbox
   denies (EROFS) — run them unsandboxed.

Both are already satisfied if `.local/pw-tools/node_modules/playwright` and a working
`pnpm` exist — skip straight to "Every session" below.

## Every session

### 1. Build the extension

Check out the branch/commit under test first if it isn't already current, then:
```
pnpm install   # only if node_modules is missing
pnpm run build:fast
```
`build:fast` skips `tsc --noEmit` (faster; run `pnpm run compile` separately if you want
type errors surfaced). Output goes to `dist/`.

**If the browser is already running**, don't relaunch it — rebuild, then run
`node scripts/pw-act.mjs reload-extension` to pick up the change (see action list in
step 3). That's the full loop for iterating on a change without a fresh launch or an
agent: rebuild, reload-extension, look.

### 2. Launch the browser

```
node scripts/local-browser-test.mjs
```
Run this with a **backgrounded/non-blocking** shell call — the process blocks forever on
purpose (`await new Promise(() => {})`) to keep the browser subprocess alive and to hold
the CDP port open at `http://127.0.0.1:9333`. Killing the process kills the browser.

**Every pw script must run unsandboxed.** The Bash sandbox kills the launch (Chromium's
crashpad needs `~/.config`, its process singleton needs a unix socket — `Read-only file
system` / `socket() failed: Operation not permitted`) and blocks every `pw-act.mjs` call
too: the sandbox gives commands an isolated loopback, so its `127.0.0.1` is not the
host's — connecting to the browser's CDP port fails with `ECONNREFUSED` even when
`127.0.0.1` is in the sandbox network allowlist (verified: sandboxed curl to :9333
refused while unsandboxed got HTTP 200 at the same moment). Allowlisting the host
cannot fix this. `.claude/settings.json` handles it via `sandbox.excludedCommands`:
the pw scripts (and `curl`, for the :9333 up-check) run outside the sandbox
automatically, so call them as plain Bash commands — do NOT set
`dangerouslyDisableSandbox`, which forces a permission prompt the exclusion exists to
avoid; there is no legitimate reason to use that flag in this repo, every known need
has an exclusion. Exclusion entries are wildcard patterns matched against the whole
command string (`node scripts/pw-act.mjs *`), so a *chained* command only matches when
its FIRST segment is an excluded one — `sleep 5 && node scripts/pw-act.mjs ...` works
(`sleep *` is excluded), but an env-var prefix (`SCRATCH=...; node scripts/...`), a
`cat > file` heredoc first, or a `for` loop does not. Set variables in a prior call or
inline the value, write files with the Write tool instead of heredocs, and unroll
loops so each iteration starts with the pw command. If a pw call fails with
`ECONNREFUSED` while the browser is up, restructure the chain pw-first; check the
exclusion list is intact before suspecting the browser.

**Ad-hoc CDP scripts** (a bespoke Playwright/CDP script that `pw-act.mjs` actions don't
cover) must be written to `.local/scratch/` in the repo — NOT the session scratchpad —
and run as `node .local/scratch/<name>.mjs` (first in any chain). That path is
sandbox-excluded and allowlisted, so it runs prompt-free; the same script under the
scratchpad path is not excluded, gets the sandbox's isolated loopback, and dies with
`ECONNREFUSED`. `.local/` is gitignored; `mkdir -p .local/scratch` if missing. If the
same script keeps getting rewritten across sessions, promote it to a real `pw-act.mjs`
action (gotcha #8). Invoke it with that exact relative form — an absolute path (e.g.
`node /home/.../repo/.local/scratch/foo.mjs`) does not match the exclusion pattern and
silently falls back to the sandboxed isolated loopback, producing the same misleading
`ECONNREFUSED` as running it from the scratchpad; this looks like a dead browser but
isn't (confirmed live: `curl :9333` and `pw-act.mjs` both worked fine at the same
moment an absolute-path script got `ECONNREFUSED`). A sandbox-killed launch leaves a partial
process tree holding the profile lock, so the next launch fails with "Opening in
existing browser session" (gotcha #9) — run `node scripts/pw-kill.mjs` before retrying.

First time ever: tell the user the window is open at `apex.prosperousuniverse.com` and
**wait for them to log in manually** — do not attempt this yourself. After that, the
profile at `.local/browser-profile` persists the session; **you will not need to log in
again in future sessions** unless the user clears that directory.

To verify persistence after a fresh checkout of this skill: close cleanly with
`node scripts/pw-close.mjs` (sends `browser.close()` over CDP — a clean shutdown flushes
the profile), then relaunch and confirm the page loads straight into the game (no login
form). Skip this check once you've already confirmed it works on this machine.

### 3. Drive and observe the page

Use `scripts/pw-act.mjs` for everything else — it attaches to the already-running
browser via `chromium.connectOverCDP()` each time, so it never touches the profile or
relaunches anything:

```
node scripts/pw-act.mjs reload-extension                    # rebuild picked up: clicks the reload
                                                             # icon for this extension on
                                                             # chrome://extensions (piercing its
                                                             # shadow DOM) then refreshes the game
                                                             # tab, so a rebuilt dist/ actually takes
                                                             # effect. Run `pnpm run build:fast`
                                                             # first — this only reloads whatever is
                                                             # already on disk. The user can also run
                                                             # this directly themselves, no agent
                                                             # needed, for their own quick checks.
node scripts/pw-act.mjs open-buffer '<CMD>'                # opens ANY tile — see below, use this
                                                             # first for every feature test
node scripts/pw-act.mjs click '<selector>'
node scripts/pw-act.mjs click-force '<selector>'          # bypass actionability checks
node scripts/pw-act.mjs type '<selector>' <text>           # page.fill
node scripts/pw-act.mjs fill-file '<selector>' <path>       # page.fill from a file — use for
                                                             # large/multiline text (JSON, etc.)
                                                             # instead of shell-quoting it inline
node scripts/pw-act.mjs fill-nth '<selector>' <index> <text>
node scripts/pw-act.mjs click-nth '<selector>' <index>
node scripts/pw-act.mjs press '<key>'                       # keyboard.press, global focus
node scripts/pw-act.mjs press-on '<selector>' '<key>'        # press targeted at one element
node scripts/pw-act.mjs ctrl-click '<selector>'              # real Control+click (keydown/
                                                             # click/keyup) — the game's
                                                             # multi-stack selection toggle in
                                                             # inventory grids; a synthetic
                                                             # MouseEvent with ctrlKey set
                                                             # does NOT work
node scripts/pw-act.mjs list-windows                         # index + leading text of every
                                                             # open window/buffer — use this
                                                             # instead of an eval that does
                                                             # querySelectorAll('[class*=Window__window]')
node scripts/pw-act.mjs dump-windows [index]                 # structured dump of open
                                                             # floating buffers (command,
                                                             # context-bar items, columns,
                                                             # buttons, labels, links) — use
                                                             # this to study a screen's
                                                             # content/connections instead
                                                             # of a bespoke eval
node scripts/pw-act.mjs styles '<selector>' 'prop1,prop2'    # computed style values off the
                                                             # first match — use this instead
                                                             # of an eval getComputedStyle snippet
node scripts/pw-act.mjs local-storage-get '<key>'            # reads one localStorage key — use
                                                             # this instead of an eval
                                                             # localStorage.getItem snippet
node scripts/pw-act.mjs real-drag-stack '<ticker>' '<box>'   # CONTD Drag tab via a REAL mouse
                                                             # drag (Playwright mouse down/
                                                             # move/up) — exercises the full
                                                             # browser drag pipeline. Use THIS
                                                             # for final drop verification;
                                                             # see gotcha #12. Fails loudly if
                                                             # the stack or zone is covered by
                                                             # a window (move-window first)
node scripts/pw-act.mjs drag-stack '<ticker>' '<box>'        # CONTD Drag tab: simulates the
                                                             # native HTML5 drag of a material
                                                             # stack from any open inventory
                                                             # onto one of the quick-amount
                                                             # boxes (AMT/1/10/.../HLF/ALL);
                                                             # prints the ready-list rows.
                                                             # mouse-drag can't drive real
                                                             # DnD — this dispatches the
                                                             # DragEvent sequence instead.
                                                             # Passing a bogus box label
                                                             # (e.g. BOGUS) prints the boxes
                                                             # on offer without dropping.
node scripts/pw-act.mjs drag-probe '<ticker>' '<window-text>' [shot-path] ['<hover-selector>']
                                                             # starts a native drag and hovers
                                                             # a window (or a selector inside
                                                             # it) WITHOUT dropping: prints
                                                             # every DropTargetView box that
                                                             # appears (labels/geometry/styles),
                                                             # optionally screenshots mid-drag,
                                                             # then cancels. Safe for GAME
                                                             # inventories (a real drop would
                                                             # transfer materials server-side —
                                                             # never dispatch that yourself)
node scripts/pw-act.mjs move-window '<window-text>' <left> <top>
                                                             # reposition a floating buffer
                                                             # (style.left/top — safe, unlike
                                                             # size); use before multi-buffer
                                                             # tests so windows don't overlap
node scripts/pw-act.mjs resize-window '<window-text>' <width> <height>
                                                             # resize via the real se-resize
                                                             # handle drag (gotcha #10); raises
                                                             # the window first so the handle
                                                             # is on top
node scripts/pw-act.mjs eval "() => { ...; return x; }"      # see gotcha #1 and #8 below —
                                                             # last resort, not first reach
node scripts/pw-act.mjs screenshot '<absolute-output-path>'
node scripts/pw-act.mjs contd-template-fields ['<draft substring>']
  # CONTD-specific: dumps every field value on an open template screen
  # (template type, currency, amounts, commodities, prices, addresses,
  # deadline) as JSON — use this to verify imports/fills instead of a
  # bespoke eval.
node scripts/pw-act.mjs open-contd-template ['<draft name substring>']
  # CONTD-specific, built on open-buffer: also opens a draft (View) and
  # clicks "Select Template" to reach the commodity template screen (see
  # gotcha #5). Omit the arg to open the first draft in the list, or pass a
  # substring of its row name to pick a specific one. Prints "Template screen
  # ready." on success. Reuses an already-open window for that draft instead
  # of duplicating it, so it's safe to call repeatedly. Treat this as the
  # pattern to follow if another feature area needs its own compound helper —
  # build it on `openBuffer()`, don't re-hand-roll the buffer-opening steps.
```

**`open-buffer` is the standard way to open any tile for feature testing** (PROD, INV,
FLT, XIT, CONTD, all of them) — always reach for it first instead of hand-rolling "click
NEW BFR, type the command, press Enter." It already has the Escape-before-Enter fix from
gotcha #4 baked in; hand-rolling the sequence yourself will hit that bug again.

For one-off screenshots without any interaction, `scripts/pw-screenshot.mjs <path>` is
a shorthand that also prints the current URL and title.

**Don't screenshot after every step.** Screenshots are for the user, not for you to
narrate progress — take one to confirm the feature you're testing actually succeeded or
failed, or when you're stuck and need to see what's actually on screen. Routine
navigation (logging in, opening a buffer, submitting a command) doesn't need a
screenshot; use a targeted `styles`/`list-windows` call to confirm state cheaply instead
of a screenshot or a bespoke `eval`. Floating buffers don't persist across a reload, so if
test clutter builds up, `node scripts/pw-act.mjs reload` resets to a clean screen instead
of manually closing each one.

**Never call `browser.close()` in an observe/act script.** Over `connectOverCDP`,
`browser.close()` terminates the real browser process (unlike `chromium.connect()` to a
Playwright server, where it just disconnects). Only `pw-close.mjs` should call it, and
only when you actually intend to shut the browser down.

### 4. Cleanup

**Ask before closing the browser** — see gotcha #9. It's not a routine end-of-task step;
only do this when the user asks or a rebuilt extension needs a fresh load.

```
node scripts/pw-close.mjs
```
then stop the backgrounded launcher process (`TaskStop` on its task id, or Ctrl+C if
running in a foreground terminal — the launcher also has a SIGINT handler that closes
the context cleanly). If a later launch fails with "Opening in existing browser
session" (see gotcha #9), run `node scripts/pw-kill.mjs` to force-kill any leftover
process for this profile, then retry.

## Gotchas learned the hard way

1. **`page.evaluate(someString)` does not auto-invoke a function-literal string.** Unlike
   passing a real JS function reference, a string is evaluated as a raw expression — a
   string like `"() => document.title"` evaluates to the function object itself (which
   serializes to `undefined`), it does not call it. `pw-act.mjs`'s `eval` action already
   wraps this correctly (`(${code})()`) — just use it, don't call `page.evaluate` raw
   with an unwrapped string elsewhere.

2. **Button/link text is often styled all-caps via CSS but the DOM text is mixed-case**
   (e.g. the "VIEW" button's actual `textContent` is `"View"`, "NEW BFR" is real caps,
   "SELECT TEMPLATE"'s real text is `"Select Template"`, the "all" button is genuinely
   lowercase). Match case-insensitively (`.toLowerCase()`) when searching by text, or
   prefer matching on stable class names / attributes once you've found them once.

3. **A just-filled input keeps focus, and its focus-ring can cover a sibling button.**
   Several of the game's custom form-input components render an absolutely-positioned
   focus-ring pseudo-element (`::before`) on the wrapper div. A statically-positioned
   sibling (like an injected action button) painted *before* that pseudo-element in the
   normal stacking order ends up *underneath* it while the input has focus — Playwright
   reports this as `<div ...> intercepts pointer events` and the click times out. Fix:
   blur first (`document.activeElement.blur()` via `eval`, or click a neutral area) and
   retry. This exact issue was a real bug in the CONTD "all" button feature (fixed by
   giving the button `position: relative; z-index: 1` in
   `src/features/basic/contd-fill-all-button.module.css`) — when testing any injected
   button that sits next to an editable field, always test the click **immediately after
   typing** (the natural user flow), not after an unrelated pause where focus may have
   already moved on.

4. **Opening any buffer (applies to every tile/feature, not just CONTD):** either click
   an existing shortcut (left sidebar, or an in-tile link), or click **NEW BFR**
   (bottom-left corner) to open an empty floating buffer, then type the command code
   (e.g. `PROD`, `INV`, `CONTD`) into its "Enter content command" input and press Enter.
   This input is a react-autosuggest combobox — typing opens a suggestions dropdown that
   captures Enter (to pick a highlighted suggestion) instead of submitting the buffer.
   **Press `Escape` to close the dropdown before pressing Enter**, or the keystroke
   silently no-ops and the input just sits there with unsubmitted text. Use
   `node scripts/pw-act.mjs open-buffer '<CMD>'` — it has this fix built in, for any tile.
   Don't hand-roll this sequence again; it's the one gotcha every feature test hits. See
   `docs/game/ui-concepts.md` → "Opening a Buffer (Two Paths)".

5. **`CONTD` with no draft ID opens the CONTRACT DRAFTS list**, not a template directly.
   Click "View" on a draft row to open it, then "Select Template" to reach the
   BUYING/SELLING commodity template (the screen with Amount / Price per unit /
   "add commodity" — this is what `C.TemplateSelection.group` in
   `contd-fill-all-button.tsx` targets). "add commodity" appends another row, useful for
   testing anything that needs 2+ commodity sections. Note: "View" opens a **new** window
   for a draft that isn't already open elsewhere, but just re-focuses the existing window
   (no new one, no DOM-order change) if that exact draft is already open in another
   buffer — don't assume the result is always "the last window in the DOM"; the
   `open-contd-template` action locates the target by content instead. Use
   `open-contd-template` for this whole flow rather than repeating it by hand.

6. **Never click anything that would talk to the game server** (submitting a contract
   draft, placing an order, etc.) — per `docs/contributing.md`, every server-affecting
   action needs an explicit user click. Navigation, opening screens, filling local form
   fields, and screenshotting are all safe for you to drive; anything with a "Save" /
   "Submit" / "Send" effect is not — ask the user to click it themselves. This includes
   **"Create New" on the CONTD drafts list** — it looks like navigation but actually
   creates a real new contract draft on the account, same as Save/Submit/Send. This
   happened once already (scripting a click to reach an unconfigured draft's preamble
   screen for CSS inspection created a stray real draft) — if you need to see a screen
   that only exists on a fresh draft, ask the user to click "Create New" themselves, or
   use an existing draft that's already in that state instead.

7. **Scope every query to the specific floating buffer before clicking, once more than
   one is open.** An unscoped selector (`button`, `'button:has-text(\"View\")'` with no
   window prefix) matches elements across every open tile/buffer on screen, not just the
   one you're testing — clicking result `[0]` can land on a background contract-view tile
   instead of the CONTD draft you meant to drive. Playwright's `:has-text()` composes
   directly in a plain `click`/`click-nth` selector string, no `eval` needed: run
   `list-windows` first to see what's open and find distinguishing text (e.g. a draft's
   natural ID), then target with something like
   `click '[class*="Window__window"]:has-text("CD-1234") button:has-text("Select Template")'`.

8. **Approvals are the scarce resource — use codified data-only actions, and batch
   calls.** Three rules with one purpose:

   - **Don't default to `eval`.** `click`, `type`, `styles`, `list-windows`,
     `local-storage-get`, etc. take plain data (a selector, a path, a key) with the JS
     logic fixed inside `pw-act.mjs`, so one allowlist entry covers every call. `eval`'s
     argument *is* the code, run against a live logged-in session — every call is a
     fresh approval, and one session burned ~20 of them on needs already covered by
     `click` with a `:has-text()` selector or the `styles` action. Before reaching for
     `eval`, run the checklist *every time* (not "have I built tooling before" — that
     framing caused a repeat the very next round): can this be a selector string?
     `list-windows`? `styles`? `local-storage-get`? Reserve `eval` for genuinely
     one-off logic.
   - **If an eval pattern recurs, codify it as a new fixed-argument action** in
     `pw-act.mjs` — N future approvals become one. Put fixes that apply to *any*
     feature test (like the Escape-before-Enter fix in gotcha #4) in the shared
     `openBuffer()` helper; build feature-specific compound actions (like
     `open-contd-template`) on top of shared primitives only for genuinely
     tile-specific flows.
   - **Batch, don't drip-feed.** Every separate Bash call is an approval-eligible
     event even when each command in it is allowlisted. Chain steps that don't need
     intermediate inspection with `&&` (e.g. `... reload && ... open-contd-template`),
     and screenshot only at genuine decision points — not after every click as running
     commentary.

9. **`pw-close.mjs` reporting "Browser closed" doesn't guarantee the profile lock is
   released.** A prior session's browser process tree can survive an abnormal exit
   (killed shell, crashed script), or even outlive a clean `pw-close.mjs` call some other
   way, and keep holding `--user-data-dir=.local/browser-profile` — so the next
   `local-browser-test.mjs` launch fails with `browserType.launchPersistentContext:
   Opening in existing browser session`. Fix: run `node scripts/pw-kill.mjs` — it finds
   every browser process whose command line references this profile's
   `.local/browser-profile` path and force-kills the tree, then reports how many it
   killed (or that none were found). Prefer this over hand-rolling `pgrep`/`kill` (or
   `tasklist`/`taskkill` on Windows) — it's scoped to this tool's own profile so it
   can't touch an unrelated browser window, and it's a single allowlisted command
   instead of a manual dance. It's platform-branched: PowerShell + `taskkill` on
   Windows, `pgrep -f` on the profile path + SIGKILL on Linux/WSL2.

   **Never call this without asking first if the browser might still be in active use** —
   killing it discards the open windows/buffers and the next relaunch takes real time
   (relaunch + possible re-login). Closing the test browser is not a routine "cleanup"
   step; only do it when the user asks or a rebuilt extension genuinely needs a fresh
   load, and confirm first even then.

10. **To resize a floating buffer, drag its real bottom-right resize handle with
    `mouse-drag` — don't set `style.width`/`style.height` on `Window__window`.** The
    outer window div's inline style can be overridden freely for *position*
    (`style.left`/`style.top` — safe, used throughout this doc), but overriding its
    *size* directly desyncs the outer frame from the inner content: the framework
    re-renders internal layout (drop zones, form fields, everything) from its own state,
    which a raw CSS override on the wrapper never touches. The actual resize handle is an
    unclassed `<div>` near the bottom-right corner with `cursor: se-resize` — find it via
    `Array.from(el.querySelectorAll('*')).find(e => getComputedStyle(e).cursor ===
    'se-resize')` — then drag it with `node scripts/pw-act.mjs mouse-drag <x1> <y1> <x2>
    <y2>`. This one isn't native HTML5 drag-and-drop (its `draggable` property is
    `false`), so a `mouse-drag` (real mousedown/mousemove/mouseup) is correct here, unlike
    material stacks (gotcha for those: dispatch `DragEvent`s instead).

    **The handle's own `getBoundingClientRect()` can lie about where it's actually
    clickable** — sibling elements (scrollbar tracks, adjacent resize strips for the
    other edges) can overlap most of its box. Verify with `document.elementFromPoint(x,
    y) === handle` at a few points inside the rect before trusting the center; usually
    only a corner of the box is genuinely on top. Also make sure the handle's target
    position is inside the viewport (`window.innerWidth`/`innerHeight`) before dragging —
    a window whose bottom-right corner has drifted off-screen has an unreachable handle,
    so reposition with `style.left`/`style.top` first if needed.

11. **Position every buffer you'll need before starting a multi-buffer interaction (like
    a drag test), and verify the layout with one screenshot before touching anything
    else.** Stacking buffers on top of each other and hunting for the right one afterward
    wastes calls and risks grabbing the wrong window — text-based identification is
    especially fragile when the same string can appear in two places (e.g. a draft's ID
    shows up both in its own detail window *and* as a row in the drafts list — matching
    on the ID alone can silently grab the list instead of the detail view). Identify each
    target buffer by something unique to *that specific view* (a tab label, a heading
    only the detail screen has), position them side by side with non-overlapping
    `style.left`/`style.top`, confirm with a screenshot, and only then proceed.
    When no view-specific text is handy, the title-bar's `BUFFER n` label is unique
    per window and works as a match key (confirmed in practice after a draft-ID
    match grabbed the drafts list instead of the template window).

12. **A synthetic-DragEvent test can pass while a real player drag fails — always
    verify drop behavior with `real-drag-stack` (real mouse input), not just
    `drag-stack`.** This happened for real: the CONTD Drag tab passed every
    `drag-stack` test while being completely broken for actual users in three
    browsers. Two mechanisms synthetic dispatch skips:
    - **dropEffect negotiation.** The game's own top-level dragover handler runs
      after feature handlers in the bubble phase and resets
      `dataTransfer.dropEffect` to `'none'` for anything that isn't one of its own
      drop targets — and a dragover that ends with dropEffect `'none'` makes the
      browser cancel the drop outright (`dragend` fires, `drop` never does).
      A drop zone's dragenter/dragover handlers must therefore `preventDefault()`
      AND `stopPropagation()` AND set an explicit `dropEffect`. Dispatching a
      `drop` event directly at the handler never runs this negotiation, so it
      can't catch the bug.
    - **Occlusion.** Real mouse input lands on whatever is topmost;
      `getBoundingClientRect` doesn't know a floating window is covering the
      source stack. A mouse-down meant for a stack silently drags/clicks the
      covering window instead — and can shuffle the window layout, breaking every
      later call too (this compounds with gotcha #11). `real-drag-stack` checks
      `elementFromPoint` for both the stack and the zone and errors with the
      covering element's class; fix with `move-window` and retry.

    Diagnosis pattern that found this: attach capture+bubble listeners for all
    six drag event types logging `defaultPrevented` and `dropEffect`, run the
    real drag, and diff capture vs bubble values — `copy` at capture becoming
    `none` at bubble names the culprit; a missing `drop` entry confirms the
    browser cancelled.

13. **Tickers repeat across visible inventory grids, and every ticker-taking
    helper (`ctrl-click` by text, `drag-stack`, `real-drag-stack`, `drag-probe`)
    resolves the FIRST DOM match.** Two open inventories routinely share many
    tickers (one live check: COF, KOM, PWO, DW, RAT, OVE, EXO, PT, REP all in
    both grids), so a naive ticker selector silently hits the wrong grid — or a
    covered copy of the stack, failing the occlusion check for no apparent
    reason. Before multi-inventory tests, enumerate each grid's tickers (one
    `eval` over `ColoredIcon__label` per grid) and use tickers unique to the
    source grid, or scope the selector to that grid's container.

14. **Docked tiles are invisible to the window helpers.** `list-windows`,
    `dump-windows`, `move-window`, `resize-window`, and `drag-probe`'s target
    lookup only see floating buffers (`Window__window`); base-screen docked
    tiles (`TileFrame__`) never appear in them and can't be repositioned. To
    interact with content inside a docked tile, target its inner selectors
    directly, and resolve occlusion with `elementFromPoint` checks — not
    `move-window`.

15. **A rebuilt extension can get silently auto-disabled by Chrome, breaking every XIT
    tile with no error.** `pnpm run build:fast` runs `rimraf dist` before rebuilding, so
    the unpacked extension's on-disk files briefly disappear and come back different.
    If Developer Mode is off in `chrome://extensions`, Chrome treats that file churn as
    "may have been corrupted" and disables the extension — `reload-extension`'s click
    still reports success (it did click reload), but it reloaded a now-disabled
    extension. Every XIT buffer then falls back to the game's own
    unrecognized-command placeholder, rendered as a solid bright-green box, which reads
    as a rendering crash rather than "extension not running." `reload-extension` now
    forces Developer Mode on and re-enables the extension before every reload click, so
    this shouldn't recur — but if the green-box symptom ever shows up again, check
    `chrome://extensions` for a disabled/corrupted card before assuming the code broke.
    Treat `reload-extension`'s success message as "the click happened," not "the
    extension is confirmed running" — verify with a screenshot or `dump-windows` on a
    real XIT tile before telling the user a change is live. This happened for real: a
    reload was reported as working and only caught because the user noticed the green
    screens themselves.

## Files

- `scripts/pw-helper.mjs` — shared constants (paths, CDP port, APEX URL) and the
  `require()`-via-absolute-path trick that loads the isolated Playwright install
  (plain `import 'playwright'` won't resolve since it's outside the normal
  `node_modules` lookup chain from `scripts/`).
- `scripts/local-browser-test.mjs` — the long-running launcher.
- `scripts/pw-close.mjs` — clean shutdown (flushes the profile).
- `scripts/pw-kill.mjs` — force-kills leftover browser processes for this profile
  only (see gotcha #9); use when a relaunch fails with "Opening in existing browser
  session" even after `pw-close.mjs`. Platform-branched (Windows PowerShell/taskkill,
  Linux pgrep/SIGKILL).
- `scripts/pw-screenshot.mjs` — quick one-off screenshot + URL/title.
- `scripts/pw-act.mjs` — generic action runner, plus the shared `openBuffer()` helper
  (used by every tile via `open-buffer`) and feature-specific compound actions built on
  top of it (`open-contd-template`) for multi-step navigation flows worth reusing.
