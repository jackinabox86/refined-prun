---
name: run
description: Launch a real Edge browser with the refined-prun extension loaded via a persistent profile, so you can log into Prosperous Universe once and then drive/observe the live game UI (navigate, click, screenshot) across many tool calls. Triggers on "run the app", "test this in the browser", "verify this feature", "take a screenshot of the game". Do NOT use for pure unit/type checks (use `pnpm run compile`) — this is for visual/behavioral verification against the real game.
---

# Run: Local Browser Test Harness

This is a Manifest V3 browser extension (see `docs/architecture.md`) — it intercepts
the game's WebSocket and injects a page-level `<script>` at `document_start`, so it
**must** run as a real unpacked extension in a real Chromium-based browser. It cannot
be tested by just visiting the game as a webpage.

This skill launches Edge (already installed on Windows) with the built extension via
Playwright, using a persistent profile so login survives across runs. It exposes a CDP
debug port so follow-up steps can attach and drive the page without relaunching.

## Prerequisites (one-time per machine)

1. **pnpm on PATH.** `corepack prepare pnpm@<version> --activate` fails with `EPERM`
   writing to `C:\Program Files\nodejs\pnpm` (no admin rights). Fix once:
   ```
   npm install -g pnpm@10.32.1
   ```
   (Match the version pinned in `package.json`'s `packageManager` field.) Verify with
   `pnpm --version`. If this still isn't available, fall back to `npx pnpm@10.32.1 <cmd>`
   for every command below.

2. **Isolated Playwright install.** Playwright is deliberately **not** a project
   devDependency (kept out of `package.json`/`pnpm-lock.yaml`) — it's a personal testing
   tool, installed once under the gitignored `.local/` directory:
   ```
   mkdir -p .local/pw-tools
   cd .local/pw-tools && npm init -y
   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright --no-save --prefix .
   cd -
   ```
   `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` skips downloading Playwright's bundled Chromium —
   unnecessary since we launch the system Edge via `channel: 'msedge'`. Check
   `.local/pw-tools/node_modules/playwright` exists before redoing this step.

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

### 2. Launch the browser

```
node scripts/local-browser-test.mjs
```
Run this with a **backgrounded/non-blocking** shell call — the process blocks forever on
purpose (`await new Promise(() => {})`) to keep the browser subprocess alive and to hold
the CDP port open at `http://127.0.0.1:9333`. Killing the process kills the browser.

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
node scripts/pw-act.mjs list-windows                         # index + leading text of every
                                                             # open window/buffer — use this
                                                             # instead of an eval that does
                                                             # querySelectorAll('[class*=Window__window]')
node scripts/pw-act.mjs styles '<selector>' 'prop1,prop2'    # computed style values off the
                                                             # first match — use this instead
                                                             # of an eval getComputedStyle snippet
node scripts/pw-act.mjs eval "() => { ...; return x; }"      # see gotcha #1 and #10 below —
                                                             # last resort, not first reach
node scripts/pw-act.mjs screenshot '<absolute-output-path>'
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

8. **Prefer the codified actions (`open-buffer`, `open-contd-template`, `list-windows`,
   `styles`, etc.) over rediscovering navigation by hand with `eval`.** Every ad-hoc
   exploratory `eval` call is a command the user has to approve, and unlike the other
   actions it passes *arbitrary JS* as its argument rather than plain data — see gotcha
   #10. Ten rounds of "find the button, check its rect, try clicking, screenshot, adjust"
   is ten approvals for one navigation step that only needs to be figured out once. When
   you learn a fix or pattern that applies to *any* feature test (like the
   Escape-before-Enter fix in gotcha #4), put it in the shared `openBuffer()` helper, not
   inside a feature-specific action — otherwise the next session testing a different tile
   hits the same bug again with no way to know it's already solved. Only build a
   feature-specific compound action (like `open-contd-template`) on top of that shared
   primitive for navigation steps that are genuinely specific to one tile.

9. **`pw-close.mjs` reporting "Browser closed" doesn't guarantee the profile lock is
   released.** A prior session's `msedge.exe` process tree can survive an abnormal exit
   (killed shell, crashed script), or even outlive a clean `pw-close.mjs` call some other
   way, and keep holding `--user-data-dir=.local/browser-profile` — so the next
   `local-browser-test.mjs` launch fails with `browserType.launchPersistentContext:
   Opening in existing browser session`. Fix: run `node scripts/pw-kill.mjs` — it finds
   every `msedge.exe` process whose command line references this profile's
   `.local/browser-profile` path and force-kills the tree, then reports how many it
   killed (or that none were found). Prefer this over hand-rolling
   `tasklist`/`wmic process`/`taskkill` — it's scoped to this tool's own profile so it
   can't touch an unrelated Edge window, and it's a single allowlisted command instead of
   a three-step manual dance.

   **Never call this without asking first if the browser might still be in active use** —
   killing it discards the open windows/buffers and the next relaunch takes real time
   (relaunch + possible re-login). Closing the test browser is not a routine "cleanup"
   step; only do it when the user asks or a rebuilt extension genuinely needs a fresh
   load, and confirm first even then.

10. **`eval` is fundamentally different from every other action, and defaulting to it is
    what causes approval fatigue.** `click`, `type`, `screenshot`, `list-windows`,
    `styles`, etc. take plain data (a selector string, a file path, a list of CSS property
    names) — the JS logic is fixed inside `pw-act.mjs` itself, so a single allowlist entry
    covers every call regardless of the specific argument. `eval`'s argument *is* the code
    to run against a live, logged-in game session, so every call is a genuinely new,
    unreviewed piece of JS — one session drove ~20 fresh approvals in a single turn this
    way, almost all of which were really "find this element by its text and click it" or
    "read this element's computed style," both already covered by `click`/`click-nth` with
    a `:has-text()` selector, or by the `styles` action. Before reaching for `eval`, check:
    can this be a selector string instead? Is this "list what windows are open" (→
    `list-windows`) or "read computed style" (→ `styles`)? If a *pattern* of eval snippet
    keeps recurring (not just this once), add it as a new fixed-argument action in
    `pw-act.mjs` rather than writing the JS inline again — that turns N future approvals
    into one. Reserve `eval` for genuinely one-off logic that doesn't fit any of the above.

## Files

- `scripts/pw-helper.mjs` — shared constants (paths, CDP port, APEX URL) and the
  `require()`-via-absolute-path trick that loads the isolated Playwright install
  (plain `import 'playwright'` won't resolve since it's outside the normal
  `node_modules` lookup chain from `scripts/`).
- `scripts/local-browser-test.mjs` — the long-running launcher.
- `scripts/pw-close.mjs` — clean shutdown (flushes the profile).
- `scripts/pw-kill.mjs` — force-kills leftover `msedge.exe` processes for this profile
  only (see gotcha #9); use when a relaunch fails with "Opening in existing browser
  session" even after `pw-close.mjs`.
- `scripts/pw-screenshot.mjs` — quick one-off screenshot + URL/title.
- `scripts/pw-act.mjs` — generic action runner, plus the shared `openBuffer()` helper
  (used by every tile via `open-buffer`) and feature-specific compound actions built on
  top of it (`open-contd-template`) for multi-step navigation flows worth reusing.
