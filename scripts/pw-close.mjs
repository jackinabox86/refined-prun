// Gracefully closes the browser launched by local-browser-test.mjs, so the
// profile (login session) is flushed to disk on a clean shutdown.
// Usage: node scripts/pw-close.mjs
import { connect } from './pw-helper.mjs';

const { browser } = await connect();
await browser.close();
console.log('Browser closed.');
