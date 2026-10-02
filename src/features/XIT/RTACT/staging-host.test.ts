import { describe, expect, it } from 'vitest';
import { isStagingHost, STAGING_HOST, stagingRunBlock } from './staging-host';

describe('staging host gate', () => {
  it('accepts only the staging host', () => {
    expect(isStagingHost(STAGING_HOST)).toBe(true);
    expect(stagingRunBlock(STAGING_HOST)).toBeUndefined();
  });

  it('does not run on the production host', () => {
    expect(isStagingHost('apex.prosperousuniverse.com')).toBe(false);
    expect(stagingRunBlock('apex.prosperousuniverse.com')).toMatch(/inert/);
  });

  it('does not run on an empty host', () => {
    expect(isStagingHost('')).toBe(false);
    expect(stagingRunBlock('')).toMatch(/inert/);
  });
});
