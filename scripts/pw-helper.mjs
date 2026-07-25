// Shared helpers for local-browser-test.mjs and ad-hoc follow-up scripts.
// Playwright is intentionally NOT a project devDependency (kept out of package.json/pnpm-lock) —
// it's a personal testing tool, installed in isolation under .local/pw-tools (gitignored).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, '..');
export const distDir = path.join(root, 'dist');
export const profileDir = path.join(root, '.local', 'browser-profile');
export const CDP_PORT = 9333;
export const CDP_ENDPOINT = `http://127.0.0.1:${CDP_PORT}`;
export const APEX_URL = 'https://apex.prosperousuniverse.com';

const playwrightPath = path.join(root, '.local', 'pw-tools', 'node_modules', 'playwright');
const require = createRequire(import.meta.url);

// Loaded on demand, not at import time: the isolated install sits outside the normal
// node_modules lookup chain, so a missing one throws MODULE_NOT_FOUND from deep inside
// require(). Callers that never touch the browser (`pw-act.mjs help`) shouldn't need it
// at all, and callers that do deserve the setup pointer instead of a stack trace.
export function loadPlaywright() {
  try {
    return require(playwrightPath);
  } catch {
    console.error(`Playwright is not installed at ${playwrightPath}.`);
    console.error('This harness only runs from a checkout with the one-time local install —');
    console.error('see docs/browser-testing.md ("One-time setup").');
    process.exit(1);
  }
}

// Attaches to the browser launched by local-browser-test.mjs. The first context's
// first page is the game tab.
export async function connect() {
  const { chromium } = loadPlaywright();
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  } catch (error) {
    console.error(`Could not attach to a browser at ${CDP_ENDPOINT}. Either:`);
    console.error('  - it is not running — launch node scripts/local-browser-test.mjs, or');
    console.error('  - this call ran with its own isolated loopback, so its 127.0.0.1 is not');
    console.error('    the host\'s — see docs/browser-testing.md ("Why calls must not be');
    console.error('    isolated from the host network").');
    console.error(String(error).split('\n')[0]);
    process.exit(1);
  }
  const context = browser.contexts()[0];
  return { browser, context, page: context.pages()[0] };
}
