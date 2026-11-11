import { describe, expect, it } from 'vitest';
import { isRtHost, PRODUCTION_HOST, rtRunBlock, STAGING_HOST } from './rt-host';

describe('RT host gate', () => {
  it('runs on the production host', () => {
    expect(isRtHost(PRODUCTION_HOST)).toBe(true);
    expect(rtRunBlock(PRODUCTION_HOST)).toBeUndefined();
  });

  it('runs on the staging host', () => {
    expect(isRtHost(STAGING_HOST)).toBe(true);
    expect(rtRunBlock(STAGING_HOST)).toBeUndefined();
  });

  it('does not run on another host', () => {
    expect(isRtHost('example.com')).toBe(false);
    expect(rtRunBlock('example.com')).toMatch(/only runs on/);
    expect(isRtHost('')).toBe(false);
    expect(rtRunBlock('')).toMatch(/only runs on/);
  });
});
