// Attaches to the already-running browser via CDP and runs one action, then
// takes a screenshot. Actions: click <selector>, type <selector> <text>,
// press <key>, screenshot <path>, list-windows, styles <selector> <props-csv>,
// eval <js-expression>
//
// Prefer click/click-nth/type/fill-nth/list-windows/styles over eval whenever
// possible. Playwright selectors support :has-text("...") directly, so most
// "find this button/row by its text and click it" or "which window has X"
// tasks don't need a bespoke eval at all — e.g.
//   click '[class*="Window__window"]:has-text("CD-1234") button:has-text("Select Template")'
// Every eval call passes a *different* piece of arbitrary JS to run against a
// live logged-in session, which is a fundamentally different (and pricier,
// approval-wise) thing than a fixed action taking plain string arguments —
// see gotcha #8/#10 in .claude/skills/run/SKILL.md.
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
  case 'click': {
    await page.click(rest[0]);
    break;
  }
  case 'click-force': {
    await page.click(rest[0], { force: true });
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
