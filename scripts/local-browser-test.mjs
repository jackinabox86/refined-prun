// Launches a real Chromium instance with the built extension loaded, via a persistent
// profile under .local/browser-profile so login survives across runs.
//
// Usage: node scripts/local-browser-test.mjs
//
// Once running, log into PrUn in the opened window. The process stays alive so the
// browser stays alive; it also opens a CDP port (see pw-helper.mjs CDP_PORT) so
// follow-up scripts can attach via chromium.connectOverCDP() without relaunching
// the browser or touching the profile lock.
import { playwright, distDir, profileDir, APEX_URL, CDP_PORT } from './pw-helper.mjs';

const { chromium } = playwright;

const context = await chromium.launchPersistentContext(profileDir, {
  // No `channel`: use Playwright's own downloaded Chromium (Linux-native under WSL2,
  // visible via WSLg) instead of a system browser — see docs-jack/wsl-migration-guide.md.
  headless: false,
  args: [
    `--disable-extensions-except=${distDir}`,
    `--load-extension=${distDir}`,
    `--remote-debugging-port=${CDP_PORT}`,
  ],
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(APEX_URL);

console.log(`Browser launched with extension from: ${distDir}`);
console.log(`Profile dir: ${profileDir}`);
console.log(`CDP endpoint: http://127.0.0.1:${CDP_PORT}`);
console.log('Log into PrUn in the opened window.');
console.log('Leave this process running — closing it will close the browser.');
console.log('Press Ctrl+C to close the browser and flush the profile.');

process.on('SIGINT', async () => {
  console.log('\nClosing browser...');
  await context.close();
  process.exit(0);
});

// Keep the process (and therefore the browser) alive.
await new Promise(() => {});
