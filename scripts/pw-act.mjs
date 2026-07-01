// Attaches to the already-running browser via CDP and runs one action, then
// takes a screenshot. Actions: click <selector>, type <selector> <text>,
// press <key>, screenshot <path>, eval <js-expression>
import { readFileSync } from 'node:fs';
import { playwright, CDP_ENDPOINT } from './pw-helper.mjs';

const { chromium } = playwright;
const [action, ...rest] = process.argv.slice(2);

const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
const context = browser.contexts()[0];
const page = context.pages()[0];

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
    await page.locator(selector).nth(Number(index)).fill(valueParts.join(' '));
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
    await page.locator(selector).nth(Number(index)).click();
    break;
  }
  case 'screenshot': {
    await page.screenshot({ path: rest[0] });
    console.log('Saved screenshot to', rest[0]);
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
