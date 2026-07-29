// Screenshots the 3D Game Mode visual-iteration sandbox (src/game-3d/sandbox/) —
// `pnpm run dev:3d-sandbox` must already be running. Deliberately NOT pw-act.mjs's
// CDP-attach-to-a-persistent-profile flow: there's no login/session to preserve, so this
// launches and closes its own throwaway browser each call. See
// docs/browser-testing-3d.md ("Visual-iteration sandbox").
//
// Usage: node scripts/pw-sandbox-screenshot.mjs <preset> <output-path> [port]
//   preset: overview | console | hologram | pit | ramp | underside  (must match main.ts's PRESETS keys)
//   port: defaults to 5183. Pass a different port when running against a
//   `dev:3d-sandbox -- --port <n>` instance (e.g. one isolated builder among several
//   running concurrently in separate worktrees).
import { loadPlaywright } from './pw-helper.mjs';

const PRESETS = ['overview', 'console', 'hologram', 'pit', 'ramp', 'rampUnder', 'underside'];

const [preset, outputPath, port = '5183'] = process.argv.slice(2);
const SANDBOX_URL = `http://127.0.0.1:${port}/`;

if (preset === undefined || outputPath === undefined || !PRESETS.includes(preset)) {
  console.error('Usage: node scripts/pw-sandbox-screenshot.mjs <preset> <output-path>');
  console.error(`  preset: one of ${PRESETS.join(', ')}`);
  process.exit(1);
}

const { chromium } = loadPlaywright();

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
} catch (error) {
  console.error(`Could not launch a browser: ${String(error).split('\n')[0]}`);
  console.error('If this is a sandboxed Bash call failing on a device/mount error (not a');
  console.error('network error), retry with dangerouslyDisableSandbox — see .claude/harness-notes.md.');
  process.exit(1);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const url = `${SANDBOX_URL}?cam=${preset}`;
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  if (response === null || !response.ok()) {
    console.error(`Could not load ${url}. Is 'pnpm run dev:3d-sandbox' running?`);
    process.exit(1);
  }
  await page.waitForFunction(() => window.__rpSandboxReady === true, { timeout: 15000 });
  // Dev-only camera-preset switcher bar — not part of any reviewed piece, would
  // otherwise bleed into HUD-overlay critic rounds as if it were real game UI.
  await page.evaluate(() => document.getElementById('sandbox-preset-bar')?.remove());
  await page.screenshot({ path: outputPath });
  console.log(`Saved ${outputPath} (preset: ${preset})`);
} finally {
  await browser.close();
}
