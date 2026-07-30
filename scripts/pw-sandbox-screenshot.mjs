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
//
// Auto-detects real GPU vs forced CPU/SwiftShader rendering by checking whether
// /dev/dxg (WSL2's GPU passthrough device) is visible — hidden by the mount namespace
// for sandboxed and excludedCommands calls alike, present only when the caller's Bash
// invocation sets `dangerouslyDisableSandbox: true` (see .claude/harness-notes.md).
// GPU mode is ~2.7x faster when it works, confirmed against the current AAA-pass scene
// (bloom/PMREM/anisotropic textures pushed software rendering to 60-70s/shot) — but it's
// also been observed to hang navigation outright (real GPU device contention under WSL2,
// not fully root-caused), so a GPU-mode failure falls back to a second attempt with
// SwiftShader rather than surfacing an error — this script should never be *less*
// reliable than plain SwiftShader, only sometimes faster.
import { existsSync } from 'node:fs';
import { loadPlaywright } from './pw-helper.mjs';

const PRESETS = [
  'overview',
  'viewscreen',
  'console',
  'hologram',
  'pit',
  'ramp',
  'rampUnder',
  'underside',
];

const [preset, outputPath, port = '5183'] = process.argv.slice(2);
const SANDBOX_URL = `http://127.0.0.1:${port}/`;

if (preset === undefined || outputPath === undefined || !PRESETS.includes(preset)) {
  console.error('Usage: node scripts/pw-sandbox-screenshot.mjs <preset> <output-path>');
  console.error(`  preset: one of ${PRESETS.join(', ')}`);
  process.exit(1);
}

const { chromium } = loadPlaywright();

async function launchAndCapture(useGpu) {
  const browser = await chromium.launch({
    headless: true,
    args: useGpu
      ? ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const url = `${SANDBOX_URL}?cam=${preset}`;
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (response === null || !response.ok()) {
      throw new Error(`Could not load ${url}. Is 'pnpm run dev:3d-sandbox' running?`);
    }
    await page.waitForFunction(() => window.__rpSandboxReady === true, { timeout: 15000 });
    // Dev-only camera-preset switcher bar — not part of any reviewed piece, would
    // otherwise bleed into HUD-overlay critic rounds as if it were real game UI.
    await page.evaluate(() => document.getElementById('sandbox-preset-bar')?.remove());
    await page.screenshot({ path: outputPath, timeout: 60000 });
  } finally {
    await browser.close();
  }
}

const gpuAvailable = existsSync('/dev/dxg');

try {
  if (gpuAvailable) {
    try {
      await launchAndCapture(true);
      console.log(`Saved ${outputPath} (preset: ${preset}, gpu)`);
    } catch (gpuError) {
      console.error(`GPU-mode capture failed (${String(gpuError).split('\n')[0]}), retrying with SwiftShader...`);
      await launchAndCapture(false);
      console.log(`Saved ${outputPath} (preset: ${preset}, swiftshader fallback)`);
    }
  } else {
    await launchAndCapture(false);
    console.log(`Saved ${outputPath} (preset: ${preset})`);
  }
} catch (error) {
  console.error(`Could not capture screenshot: ${String(error).split('\n')[0]}`);
  console.error('If this is a sandboxed Bash call failing on a device/mount error (not a');
  console.error('network error), retry with dangerouslyDisableSandbox — see .claude/harness-notes.md.');
  process.exit(1);
}
