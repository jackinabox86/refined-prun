// Attaches to the already-running browser (launched by local-browser-test.mjs)
// via CDP and takes a screenshot without touching the profile or relaunching.
// Same as `pw-act.mjs screenshot`, plus the current URL/title — handy as a
// first "what is on screen right now" call.
// Usage: node scripts/pw-screenshot.mjs <output-path>
import { connect } from './pw-helper.mjs';

const outPath = process.argv[2];
if (!outPath) {
  console.error('Usage: node scripts/pw-screenshot.mjs <output-path>');
  process.exit(1);
}

const { page } = await connect();
console.log('URL:', page.url());
console.log('Title:', await page.title());
await page.screenshot({ path: outPath });
console.log('Saved screenshot to', outPath);
// Deliberately not calling browser.close() here: over CDP that terminates the
// real browser process. Just let this process exit; the connection drops on its own.
process.exit(0);
