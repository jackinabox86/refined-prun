import { describe, expect, it } from 'vitest';
import { isPrunAppScript } from './prun-app-script';

const PRODUCTION_SRC = 'https://apex.prosperousuniverse.com/assets/index.js';
const STAGING_SRC = 'https://apex.staging.prosperousuniverse.com/assets/index.js';

describe('isPrunAppScript', () => {
  it('matches the production host in either build', () => {
    expect(isPrunAppScript(PRODUCTION_SRC, false)).toBe(true);
    expect(isPrunAppScript(PRODUCTION_SRC, true)).toBe(true);
  });

  it('matches the staging host only in a dev build', () => {
    expect(isPrunAppScript(STAGING_SRC, true)).toBe(true);
  });

  it('does not match the staging host in a production build', () => {
    expect(isPrunAppScript(STAGING_SRC, false)).toBe(false);
  });

  it('ignores unrelated script URLs', () => {
    expect(isPrunAppScript('https://example.com/app.js', true)).toBe(false);
    expect(isPrunAppScript('https://example.com/app.js', false)).toBe(false);
  });
});
