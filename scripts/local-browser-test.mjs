// Launches a real Chromium instance with the built extension loaded, via a persistent
// profile under .local/browser-profile so login survives across runs.
//
// Usage: node scripts/local-browser-test.mjs
//
// Once running, log into PrUn in the opened window. The process stays alive so the
// browser stays alive; it also opens a CDP port (see pw-helper.mjs CDP_PORT) so
// follow-up scripts can attach via chromium.connectOverCDP() without relaunching
// the browser or touching the profile lock.
import { existsSync } from 'node:fs';
import { loadPlaywright, distDir, profileDir, APEX_URL, CDP_PORT } from './pw-helper.mjs';

const { chromium } = loadPlaywright();

// This machine's WSL2/WSLg GPU paravirtualization exposes the host's discrete GPU over
// /dev/dxg, but Mesa's d3d12 Gallium driver defaults to the first adapter (usually the
// integrated GPU, for battery life) and won't use it without being told. Set these
// before launch so every run gets real GPU acceleration instead of silently falling
// back to llvmpipe/SwiftShader software rendering; env vars set by the caller still
// win. This script only ever runs on this WSL2 checkout (see the `run` skill's
// environment gate), so there's no other machine profile to preserve.
process.env.GALLIUM_DRIVER ??= 'd3d12';
process.env.MESA_D3D12_DEFAULT_ADAPTER_NAME ??= 'NVIDIA';

// Chromium loads an unpacked extension from disk once, at launch. A missing dist/
// starts a browser with no extension at all, which looks exactly like a broken
// feature — fail here instead.
if (!existsSync(distDir)) {
  console.error(`No build at ${distDir}. Run: pnpm run build:fast`);
  process.exit(1);
}

let context;
try {
  context = await chromium.launchPersistentContext(profileDir, {
    // No `channel`: use Playwright's own downloaded Chromium (Linux-native under WSL2,
    // visible via WSLg) instead of a system browser — see docs-jack/wsl-migration-guide.md.
    headless: false,
    args: [
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`,
      `--remote-debugging-port=${CDP_PORT}`,
      // This launch must run with dangerouslyDisableSandbox (see
      // .claude/harness-notes.md) so /dev/dxg is visible to this process — a
      // sandboxed launch hides that device node, silently forcing SwiftShader
      // software rendering even though the host has a real GPU. Chromium's
      // GPU allowlist still blocks acceleration for what looks like an
      // unrecognized/virtualized adapter unless told otherwise.
      '--ignore-gpu-blocklist',
    ],
  });
} catch (error) {
  if (String(error).includes('Opening in existing browser session')) {
    console.error('A previous browser still holds this profile. Run: node scripts/pw-kill.mjs');
    process.exit(1);
  }
  throw error;
}

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
