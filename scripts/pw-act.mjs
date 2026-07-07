// Attaches to the already-running browser via CDP and runs one action, then
// takes a screenshot. Actions: click <selector>, ctrl-click <selector>,
// type <selector> <text>, press <key>, screenshot <path>, list-windows,
// styles <selector> <props-csv>, local-storage-get <key>,
// mouse-drag <x1> <y1> <x2> <y2> [steps],
// drag-stack <ticker> <amount-box-label>, reload, eval <js-expression>
//
// Prefer click/click-nth/type/fill-nth/list-windows/styles/local-storage-get
// over eval whenever possible. Playwright selectors support :has-text("...")
// directly, so most "find this button/row by its text and click it" or
// "which window has X" tasks don't need a bespoke eval at all — e.g.
//   click '[class*="Window__window"]:has-text("CD-1234") button:has-text("Select Template")'
// Every eval call passes a *different* piece of arbitrary JS to run against a
// live logged-in session, which is a fundamentally different (and pricier,
// approval-wise) thing than a fixed action taking plain string arguments —
// see gotcha #8 in .claude/skills/run/SKILL.md. If you catch yourself
// reaching for eval to read/check *anything*, stop and add a fixed action for
// it instead — that mistake has already happened once (see gotcha #8).
import { readFileSync } from 'node:fs';
import { playwright, CDP_ENDPOINT } from './pw-helper.mjs';

const { chromium } = playwright;
const [action, ...rest] = process.argv.slice(2);

const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
const context = browser.contexts()[0];
const page = context.pages()[0];

// Resolves an index argument ("last", "first", or a number) against a
// locator — lets click-nth/fill-nth pick the top-most/last-opened window
// among several :has-text() matches without needing an eval to count first.
function nthLocator(page, selector, index) {
  const locator = page.locator(selector);
  if (index === 'last') return locator.last();
  if (index === 'first') return locator.first();
  return locator.nth(Number(index));
}

// Opens a new floating buffer and loads it with the given command. Used by
// every feature test, not just CONTD — factored out here so the fix below
// only has to be learned once.
async function openBuffer(page, command) {
  await page.getByText('NEW BFR', { exact: true }).click();
  const buffer = page.locator('[class*="Window__window"]').last();
  const cmdInput = buffer.locator('input[placeholder="Enter content command"]');
  await cmdInput.click();
  await cmdInput.fill(command);
  // This input is a react-autosuggest combobox: typing opens a suggestions
  // dropdown that captures Enter (to pick a highlighted suggestion) instead
  // of submitting. Escape closes the dropdown without clearing the typed
  // value, so the following Enter submits the raw command instead.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  return buffer;
}

switch (action) {
  case 'reload': {
    // Floating buffers don't persist across a reload, so this is a quick way
    // to clear test clutter instead of closing each window individually.
    await page.reload();
    break;
  }
  case 'reload-extension': {
    // Rebuilding dist/ (pnpm run build:fast) isn't enough on its own — Chromium
    // keeps running the extension code it already loaded until the extension
    // itself is reloaded, same as clicking the reload icon on chrome://extensions
    // by hand. This drives that same click via CDP (piercing the page's nested
    // shadow DOM: extensions-manager > extensions-item-list > extensions-item),
    // then refreshes the game tab so the freshly-reloaded content script
    // re-injects. One command instead of the manual "chrome://extensions, find
    // the card, click reload, switch tabs, refresh" dance.
    const extPage = await context.newPage();
    await extPage.goto('chrome://extensions/');
    // `pnpm run build:fast` runs `rimraf dist` before rebuilding, so the
    // unpacked extension's files briefly vanish and come back different. With
    // Developer Mode off, Chrome treats that as "may have been corrupted" and
    // auto-disables the extension (silently — the reload click still "works",
    // it just reloads a disabled extension, which is why every XIT buffer
    // then falls back to a broken green placeholder). Force Developer Mode on
    // first so the reload never trips this.
    await extPage.evaluate(() => {
      const manager = document.querySelector('extensions-manager');
      const devToggle = manager?.shadowRoot
        ?.querySelector('extensions-toolbar')
        ?.shadowRoot?.querySelector('#devMode');
      if (devToggle && devToggle.getAttribute('aria-pressed') !== 'true') {
        devToggle.click();
      }
    });
    const clicked = await extPage.evaluate(() => {
      const manager = document.querySelector('extensions-manager');
      const itemList = manager?.shadowRoot?.querySelector('extensions-item-list');
      const items = [...(itemList?.shadowRoot?.querySelectorAll('extensions-item') ?? [])];
      const item =
        items.find(x => x.shadowRoot?.querySelector('#name')?.textContent?.includes('RPrUn')) ??
        items[0];
      // The extension can be left disabled from a previous corrupted-reload
      // (see above) even after Developer Mode is back on — re-enable it
      // before reloading, not just after.
      const enableToggle = item?.shadowRoot?.querySelector('#enableToggle');
      if (enableToggle && !enableToggle.hasAttribute('checked')) {
        enableToggle.click();
      }
      const button = item?.shadowRoot?.querySelector('#dev-reload-button');
      if (!button) return false;
      button.click();
      return true;
    });
    await extPage.waitForTimeout(500);
    await extPage.close();
    if (!clicked) {
      console.error(
        'Could not find the extension reload button on chrome://extensions ' +
          '(is it still loaded via --load-extension?).',
      );
      process.exit(1);
    }
    await page.reload();
    console.log('Extension reloaded; game tab refreshed.');
    break;
  }
  case 'click': {
    await page.click(rest[0]);
    break;
  }
  case 'click-force': {
    await page.click(rest[0], { force: true });
    break;
  }
  case 'ctrl-click': {
    // Holds Control while clicking — the game's ctrl-click multi-stack
    // selection in inventory grids. Real keydown+click+keyup (not a
    // synthetic MouseEvent with ctrlKey set), per gotcha #8's "don't
    // reach for eval" — this is a fixed, data-only (just a selector)
    // action like click/click-force.
    await page.keyboard.down('Control');
    await page.click(rest[0]);
    await page.keyboard.up('Control');
    break;
  }
  case 'type': {
    const [selector, ...textParts] = rest;
    await page.fill(selector, textParts.join(' '));
    break;
  }
  case 'press': {
    await page.keyboard.press(rest[0]);
    break;
  }
  case 'press-on': {
    const [selector, key] = rest;
    await page.press(selector, key);
    break;
  }
  case 'fill-nth': {
    const [selector, index, ...valueParts] = rest;
    await nthLocator(page, selector, index).fill(valueParts.join(' '));
    break;
  }
  case 'fill-file': {
    // Reads file content server-side and fills it in — avoids shell-quoting
    // large/multiline text (e.g. pasted JSON) into the command line.
    const [selector, filePath] = rest;
    await page.fill(selector, readFileSync(filePath, 'utf8'));
    break;
  }
  case 'open-buffer': {
    // Generic: opens a new floating buffer loaded with any command (PROD,
    // INV, FLT, XIT ..., anything). This is the standard way to open a tile
    // for feature testing — use it instead of hand-rolling NEW BFR + type +
    // Enter, which silently fails to submit without the Escape fix above.
    const [command] = rest;
    const buffer = await openBuffer(page, command);
    await buffer.waitFor({ timeout: 10000 });
    console.log(`Opened buffer with command "${command}".`);
    break;
  }
  case 'open-contd-template': {
    // CONTD-specific: opens CONTD, opens a draft (optionally filtered by a
    // substring of its row name via rest[0]), and clicks "Select Template" to
    // reach the commodity template screen. Built on open-buffer above — see
    // that action for testing any other tile.
    const [draftNameSubstr] = rest;
    const buffer = await openBuffer(page, 'CONTD');

    const viewBtn = draftNameSubstr
      ? buffer.locator('tr', { hasText: draftNameSubstr }).getByRole('button', { name: /view/i })
      : buffer.getByRole('button', { name: /view/i }).first();
    await viewBtn.waitFor({ timeout: 10000 });
    await viewBtn.click();

    // "View" opens a new window for a draft not already open elsewhere, but
    // re-focuses an existing window (no new one, no DOM-order change) if that
    // exact draft is already open in another buffer from earlier testing —
    // so locate by content, not by "last window", to handle both cases.
    const target = page
      .locator('[class*="Window__window"]:has-text("Select Template"), [class*="Window__window"]:has-text("Template selection")')
      .last();
    await target.waitFor({ timeout: 10000 });

    const selectBtn = target.getByRole('button', { name: /select template/i });
    if (await selectBtn.count()) {
      await selectBtn.click();
      await target.getByText('Template selection').waitFor({ timeout: 10000 });
    }

    console.log('Template screen ready.');
    break;
  }
  case 'contd-template-fields': {
    // CONTD-specific: reads back every field value on an open contract
    // template screen — template type, currency, per-group amounts/commodities,
    // prices, address inputs, deadline, auto-provision options. Optional
    // argument narrows to the draft window containing that substring (e.g. its
    // natural id); otherwise the last template window wins. Data-only, so use
    // this to verify imports/fills instead of a bespoke eval — that eval got
    // hand-rolled three times before this action existed.
    const [draftSubstr] = rest;
    const result = await page.evaluate(substr => {
      const wins = Array.from(document.querySelectorAll('[class*="Window__window"]')).filter(
        w =>
          w.textContent.toLowerCase().includes('apply template') &&
          (!substr || w.textContent.includes(substr)),
      );
      const win = wins.at(-1);
      if (!win) return { error: 'no open template screen' + (substr ? ` matching "${substr}"` : '') };
      const selects = Array.from(win.querySelectorAll('select')).map(s => ({
        value: s.value,
        text: s.options[s.selectedIndex]?.text,
        options: s.options.length,
      }));
      const named = {};
      for (const i of win.querySelectorAll('input[name]')) named[i.name] = i.value;
      const commodities = Array.from(
        win.querySelectorAll('input[placeholder="commodity name"]'),
      ).map(i => i.value);
      const addresses = Array.from(win.querySelectorAll('input[placeholder="Enter location"]')).map(
        i => i.value,
      );
      return { selects, named, commodities, addresses };
    }, draftSubstr);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'click-nth': {
    const [selector, index] = rest;
    await nthLocator(page, selector, index).click();
    break;
  }
  case 'screenshot': {
    await page.screenshot({ path: rest[0] });
    console.log('Saved screenshot to', rest[0]);
    break;
  }
  case 'list-windows': {
    // Lists every open floating buffer/window with its index and leading text,
    // so you can identify which one to target (by index with click-nth, or by
    // :has-text(...) in a selector) without writing a bespoke eval to enumerate
    // document.querySelectorAll('[class*=Window__window]') every time.
    const windows = page.locator('[class*="Window__window"]');
    const count = await windows.count();
    const result = [];
    for (let i = 0; i < count; i++) {
      const text = (await windows.nth(i).innerText()).replace(/\s+/g, ' ').slice(0, 80);
      result.push({ index: i, text });
    }
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'dump-windows': {
    // Structured dump of every open floating buffer (or one, by 0-based index
    // passed as the optional argument): command, context-bar items, table
    // columns, buttons, links, form labels. Use this to study what a screen
    // contains and how it links to other commands instead of a bespoke eval —
    // data-only arguments, so it's safe to allowlist broadly.
    const index = rest[0] === undefined ? -1 : Number(rest[0]);
    const result = await page.evaluate(index => {
      const wins = Array.from(document.querySelectorAll('[class*="Window__window"]'));
      const picked = index >= 0 ? wins.slice(index, index + 1) : wins;
      const texts = (el, sel) =>
        [...new Set(Array.from(el.querySelectorAll(sel)).map(e => e.textContent.trim()))]
          .filter(t => t && !'–|x:'.includes(t));
      return picked.map(w => ({
        index: wins.indexOf(w),
        cmd: w.querySelector('[class*="TileFrame__cmd"]')?.textContent.trim(),
        ctx: texts(w, '[class*="ContextControls__item"]'),
        cols: texts(w, 'thead th').slice(0, 20),
        buttons: texts(w, 'button').slice(0, 20),
        labels: texts(w, 'label, [class*="FormComponent__label"]').slice(0, 20),
        links: texts(w, '[class*="Link__link"]').slice(0, 25),
      }));
    }, index);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'styles': {
    // Reads computed style properties off the first element matching a
    // selector. Takes plain data (selector + prop names) as arguments, not
    // code, so it's safe to allowlist broadly — unlike eval, whose argument
    // *is* arbitrary JS run against your live logged-in session. Use this
    // instead of a bespoke `eval "() => getComputedStyle(...)"` snippet.
    const [selector, propsCsv] = rest;
    const props = propsCsv.split(',');
    const result = await page.locator(selector).first().evaluate((el, props) => {
      const cs = getComputedStyle(el);
      const out = {};
      for (const p of props) out[p] = cs[p];
      return out;
    }, props);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'local-storage-get': {
    // Reads one localStorage key. Data-only (just a key name), so it's safe
    // to allowlist broadly — use this instead of a bespoke
    // `eval "() => localStorage.getItem(...)"` snippet.
    const [key] = rest;
    console.log(await page.evaluate(k => localStorage.getItem(k), key));
    break;
  }
  case 'mouse-drag': {
    // Genuine mouse down/move/up sequence from (x1,y1) to (x2,y2) — the real
    // interaction a player performs, unlike setting an element's style.width
    // directly. Needed for anything driven by mousedown+mousemove+mouseup
    // rather than a click or native HTML5 drag: resize handles (e.g. a
    // buffer's bottom-right se-resize corner), tile-split dividers, etc.
    // Resizing a floating buffer this way — instead of overwriting
    // Window__window's style.width — is what actually keeps the inner
    // content in sync with the outer frame, since buffer size lives in
    // framework state that the resize handle updates, not raw CSS.
    const [x1, y1, x2, y2, steps] = rest.map(Number);
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: steps || 10 });
    await page.mouse.up();
    break;
  }
  case 'drag-stack': {
    // Simulates dragging a material stack into the CONTD paste-import Drag tab
    // and dropping it on one of the quick-amount boxes (AMT/1/10/100/HLF/ALL).
    // Data-only arguments (ticker + box label). Material stacks use native
    // HTML5 drag-and-drop (draggable="true"), which mouse-drag's mousedown/
    // mousemove/mouseup cannot trigger, and the quick-amount drop targets only
    // exist mid-drag — so this dispatches the DragEvent sequence the feature's
    // listeners actually consume (dragstart on the stack, dragenter on the
    // zone, drop on the chosen box). Prints the resulting ready-list rows.
    const [ticker, optionLabel] = rest;
    const result = await page.evaluate(
      async ({ ticker, optionLabel }) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const byText = (els, text) =>
          [...els].filter(el => el.textContent?.trim().toLowerCase() === text.toLowerCase());

        // The drop zone only renders while the Drag tab is active.
        if (!document.querySelector('[class*="dropZone_"]')) {
          const tab = byText(document.querySelectorAll('[class*="tabRow_"] button'), 'drag')[0];
          if (!tab) return { error: 'No Drag tab found — is the CONTD template screen open?' };
          tab.click();
          await sleep(100);
        }
        const zone = document.querySelector('[class*="dropZone_"]');
        if (!zone) return { error: 'Drop zone did not render after activating the Drag tab.' };

        const source = [...document.querySelectorAll('[draggable="true"]')].find(
          el => byText(el.querySelectorAll('[class*="ColoredIcon__label"]'), ticker).length > 0,
        );
        if (!source) return { error: `No draggable stack found for ticker "${ticker}".` };
        const sourceQuantity = source
          .querySelector('[class*="MaterialIcon__indicator"]')
          ?.textContent?.trim();

        const fire = (el, type) =>
          el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true }));
        fire(source, 'dragstart');
        fire(zone, 'dragenter');
        fire(zone, 'dragover');
        await sleep(150);

        const options = zone.querySelectorAll('[class*="overlayCell_"]');
        const option = byText(options, optionLabel)[0];
        if (!option) {
          fire(zone, 'drop'); // clear the hover overlay before bailing
          fire(source, 'dragend');
          return {
            error: `No quick-amount box "${optionLabel}" in the overlay.`,
            available: [...options].map(el => el.textContent?.trim()),
            sourceQuantity,
          };
        }
        fire(option, 'drop');
        // End the drag from the game's perspective too — its own dragstart
        // listener saw our synthetic dragstart, and without a dragend every
        // other inventory keeps rendering its transfer drop boxes forever.
        fire(source, 'dragend');
        await sleep(150);

        const rows = [...zone.querySelectorAll('[class*="materialRow_"]')].map(row => ({
          ticker: row.querySelector('[class*="materialTicker_"]')?.textContent?.trim(),
          amount: row.querySelector('input')?.value,
        }));
        return { dropped: { ticker, option: optionLabel, sourceQuantity }, rows };
      },
      { ticker, optionLabel },
    );
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case 'real-drag-stack': {
    // Like drag-stack, but performs a REAL browser drag via mouse down/move/up
    // (Playwright drives Chromium's actual drag pipeline), so it exercises
    // everything synthetic DragEvent dispatch skips: drag-allowed negotiation,
    // dropEffect, and the game's own top-level drag listeners. Use this for
    // final verification of any drop behavior — synthetic drag-stack can pass
    // where a real player drag fails.
    const [ticker, optionLabel] = rest;
    const info = await page.evaluate(
      async ({ ticker }) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const byText = (els, text) =>
          [...els].filter(el => el.textContent?.trim().toLowerCase() === text.toLowerCase());
        if (!document.querySelector('[class*="dropZone_"]')) {
          const tab = byText(document.querySelectorAll('[class*="tabRow_"] button'), 'drag')[0];
          if (!tab) return { error: 'No Drag tab found — is the CONTD template screen open?' };
          tab.click();
          await sleep(100);
        }
        const zone = document.querySelector('[class*="dropZone_"]');
        if (!zone) return { error: 'Drop zone did not render.' };
        const source = [...document.querySelectorAll('[draggable="true"]')].find(
          el => byText(el.querySelectorAll('[class*="ColoredIcon__label"]'), ticker).length > 0,
        );
        if (!source) return { error: `No draggable stack for "${ticker}".` };
        const sr = source.getBoundingClientRect();
        const zr = zone.getBoundingClientRect();
        // Real mouse input lands on whatever is topmost — getBoundingClientRect
        // doesn't know about occlusion, and a mouse-down on a covering window
        // silently drags/clicks THAT instead (and can shuffle the layout for
        // every later call). Fail loudly and let the caller move windows.
        const sTop = document.elementFromPoint(sr.x + sr.width / 2, sr.y + sr.height / 2);
        if (!source.contains(sTop)) {
          return {
            error: `Stack "${ticker}" is covered by another element — reposition windows first (move-window).`,
            coveredBy: String(sTop && (sTop.className || sTop.tagName)).slice(0, 80),
          };
        }
        const zTop = document.elementFromPoint(zr.x + zr.width / 2, zr.y + zr.height / 2);
        if (!zone.contains(zTop)) {
          return {
            error: 'Drop zone center is covered by another element — reposition windows first (move-window).',
            coveredBy: String(zTop && (zTop.className || zTop.tagName)).slice(0, 80),
          };
        }
        return {
          sx: sr.x + sr.width / 2,
          sy: sr.y + sr.height / 2,
          zx: zr.x + zr.width / 2,
          zy: zr.y + zr.height / 2,
        };
      },
      { ticker },
    );
    if (info.error) {
      console.log(JSON.stringify(info, null, 2));
      break;
    }
    await page.mouse.move(info.sx, info.sy);
    await page.mouse.down();
    await page.mouse.move(info.sx + 8, info.sy + 8); // cross the drag-start threshold
    await page.mouse.move(info.zx, info.zy, { steps: 20 });
    await page.waitForTimeout(300); // overlay renders on real dragenter
    const cell = await page.evaluate(
      ({ optionLabel }) => {
        const cells = [...document.querySelectorAll('[class*="overlayCell_"]')];
        const target = cells.find(
          el => el.textContent?.trim().toLowerCase() === optionLabel.toLowerCase(),
        );
        if (!target) {
          return {
            error: `No quick-amount box "${optionLabel}" while hovering.`,
            available: cells.map(el => el.textContent?.trim()),
          };
        }
        const r = target.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      },
      { optionLabel },
    );
    if (cell.error) {
      await page.mouse.up();
      console.log(JSON.stringify(cell, null, 2));
      break;
    }
    await page.mouse.move(cell.x, cell.y, { steps: 8 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(200);
    const rows = await page.evaluate(() => {
      const zone = document.querySelector('[class*="dropZone_"]');
      return [...(zone?.querySelectorAll('[class*="materialRow_"]') ?? [])].map(row => ({
        ticker: row.querySelector('[class*="materialTicker_"]')?.textContent?.trim(),
        amount: row.querySelector('input')?.value,
      }));
    });
    console.log(JSON.stringify({ dropped: { ticker, option: optionLabel }, rows }, null, 2));
    break;
  }
  case 'drag-probe': {
    // Explores the game's own inventory-transfer drag UI without transferring
    // anything: starts a native-DnD drag of the stack with the given ticker
    // (found outside the target window), hovers the center of the target
    // window (matched by its text), records every DropTargetView drop box
    // that appears (labels, geometry, key styles), optionally screenshots
    // mid-drag, then cancels the drag (dragleave + dragend — never drop, a
    // real drop would transfer materials on the server).
    // Optional 4th arg: a CSS selector (resolved inside the target window)
    // for the element to hover instead of the window's center — needed for
    // drop zones that don't sit at the center, like the CONTD paste box.
    const [ticker, targetWindowText, shotPath, hoverSelector] = rest;
    const setup = await page.evaluate(
      async ({ ticker, targetWindowText, hoverSelector }) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const windows = [...document.querySelectorAll('[class*="Window__window"]')];
        const target = windows.find(w => w.innerText.includes(targetWindowText));
        if (!target) return { error: `No window matching "${targetWindowText}".` };

        const source = [...document.querySelectorAll('[draggable="true"]')].find(
          el =>
            !target.contains(el) &&
            [...el.querySelectorAll('[class*="ColoredIcon__label"]')].some(
              l => l.textContent?.trim().toLowerCase() === ticker.toLowerCase(),
            ),
        );
        if (!source) return { error: `No draggable stack for "${ticker}" outside the target.` };
        const sourceQuantity = source
          .querySelector('[class*="MaterialIcon__indicator"]')
          ?.textContent?.trim();

        // Hover the given selector inside the window, or the element at the
        // window's center, so the dragenter bubbles up through whatever
        // ancestor actually owns the drop handler.
        const rect = target.getBoundingClientRect();
        const hoverEl =
          (hoverSelector && target.querySelector(hoverSelector)) ??
          document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) ??
          target;
        const fire = (el, type) =>
          el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true }));
        fire(source, 'dragstart');
        fire(hoverEl, 'dragenter');
        fire(hoverEl, 'dragover');
        await sleep(250);
        // Re-fire dragover on whatever now sits at the hover element's center
        // (a quick-amount box rendered by the dragenter above), so per-box
        // hover state shows up in the capture. dragover only — a second
        // dragenter would unbalance enter/leave depth counting in the target.
        const hr = hoverEl.getBoundingClientRect();
        const over = document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
        if (over) {
          fire(over, 'dragover');
          await sleep(100);
        }

        const boxes = [...document.querySelectorAll('[class*="DropTargetView"]')].map(el => {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return {
            class: el.className,
            text: el.textContent?.trim(),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            styles: {
              display: cs.display,
              width: cs.width,
              height: cs.height,
              flex: cs.flex,
              justifyContent: cs.justifyContent,
              alignItems: cs.alignItems,
              fontSize: cs.fontSize,
              border: cs.border,
              background: cs.backgroundColor,
            },
          };
        });
        return { sourceQuantity, hoverClass: hoverEl.className, boxes };
      },
      { ticker, targetWindowText, hoverSelector },
    );
    if (shotPath && !setup.error) {
      await page.screenshot({ path: shotPath });
    }
    // Always cancel the drag state, even after a successful probe.
    await page.evaluate(
      ({ ticker, targetWindowText, hoverSelector }) => {
        const windows = [...document.querySelectorAll('[class*="Window__window"]')];
        const target = windows.find(w => w.innerText.includes(targetWindowText));
        const source = [...document.querySelectorAll('[draggable="true"]')].find(
          el =>
            (!target || !target.contains(el)) &&
            [...el.querySelectorAll('[class*="ColoredIcon__label"]')].some(
              l => l.textContent?.trim().toLowerCase() === ticker.toLowerCase(),
            ),
        );
        const fire = (el, type) =>
          el?.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true }));
        if (target) {
          const rect = target.getBoundingClientRect();
          const hoverEl =
            (hoverSelector && target.querySelector(hoverSelector)) ??
            document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) ??
            target;
          fire(hoverEl, 'dragleave');
        }
        fire(source, 'dragend');
      },
      { ticker, targetWindowText, hoverSelector },
    );
    console.log(JSON.stringify(setup, null, 2));
    break;
  }
  case 'move-window': {
    // Repositions a floating buffer by its text (style.left/top on the outer
    // Window__window div is safe — unlike size, position isn't mirrored in
    // framework state; see gotcha #10/#11). Use before multi-buffer drag
    // tests so windows don't overlap.
    const [windowText, left, top] = rest;
    const moved = await page.evaluate(
      ({ windowText, left, top }) => {
        const w = [...document.querySelectorAll('[class*="Window__window"]')].find(el =>
          el.innerText.includes(windowText),
        );
        if (!w) return false;
        w.style.left = `${left}px`;
        w.style.top = `${top}px`;
        return true;
      },
      { windowText, left: Number(left), top: Number(top) },
    );
    console.log(moved ? 'Moved.' : `No window matching "${windowText}".`);
    break;
  }
  case 'resize-window': {
    // Resizes a floating buffer to a target size by dragging its real
    // bottom-right se-resize handle — setting style.width/height on
    // Window__window desyncs the framework's own layout state (gotcha #10).
    // Probes several points inside the handle's rect for one where the handle
    // is genuinely on top (siblings overlap most of its box) before dragging.
    const [windowText, targetW, targetH] = rest;
    // Raise the window first — elementFromPoint sees whatever is topmost, so
    // an overlapped window's handle is unreachable until it's frontmost. A
    // real click near the left of its title strip (away from the _/x buttons)
    // is the same raise a player performs.
    const title = await page.evaluate(
      ({ windowText }) => {
        const w = [...document.querySelectorAll('[class*="Window__window"]')].find(el =>
          el.innerText.includes(windowText),
        );
        if (!w) return undefined;
        const r = w.getBoundingClientRect();
        return { x: r.left + 40, y: r.top + 8 };
      },
      { windowText },
    );
    if (title) await page.mouse.click(title.x, title.y);
    const start = await page.evaluate(
      ({ windowText }) => {
        const w = [...document.querySelectorAll('[class*="Window__window"]')].find(el =>
          el.innerText.includes(windowText),
        );
        if (!w) return { error: `No window matching "${windowText}".` };
        const handle = [...w.querySelectorAll('*')].find(
          e => getComputedStyle(e).cursor === 'se-resize',
        );
        if (!handle) return { error: 'No se-resize handle found in that window.' };
        const r = handle.getBoundingClientRect();
        const points = [];
        for (const fx of [0.97, 0.9, 0.8, 0.65, 0.5, 0.35, 0.2, 0.05]) {
          for (const fy of [0.97, 0.9, 0.8, 0.65, 0.5, 0.35, 0.2, 0.05]) {
            points.push([r.left + r.width * fx, r.top + r.height * fy]);
          }
        }
        const pt = points.find(([x, y]) => {
          const el = document.elementFromPoint(x, y);
          return el === handle || handle.contains(el);
        });
        if (!pt) {
          return {
            error: 'Resize handle not on top at any probed point.',
            handleRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            topAtCorner: document.elementFromPoint(r.right - 2, r.bottom - 2)?.className ?? null,
          };
        }
        const wr = w.getBoundingClientRect();
        return { x: pt[0], y: pt[1], winW: wr.width, winH: wr.height };
      },
      { windowText },
    );
    if (start.error) {
      console.log(JSON.stringify(start));
      break;
    }
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + Number(targetW) - start.winW, start.y + Number(targetH) - start.winH, { steps: 15 });
    await page.mouse.up();
    const size = await page.evaluate(
      ({ windowText }) => {
        const w = [...document.querySelectorAll('[class*="Window__window"]')].find(el =>
          el.innerText.includes(windowText),
        );
        const r = w.getBoundingClientRect();
        return { width: Math.round(r.width), height: Math.round(r.height) };
      },
      { windowText },
    );
    console.log(JSON.stringify(size));
    break;
  }
  case 'eval': {
    // page.evaluate(string) evaluates the raw expression without auto-invoking
    // function literals, so wrap-and-call explicitly.
    const result = await page.evaluate(`(${rest.join(' ')})()`);
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  default: {
    console.error('Unknown action:', action);
    process.exit(1);
  }
}

process.exit(0);
