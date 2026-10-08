import { afterEach, describe, expect, it } from 'vitest';
import { defaultFreshInstallToFullMode, isFreshInstall } from '@src/store/fresh-install';
import { userData } from '@src/store/user-data';

describe('defaultFreshInstallToFullMode', () => {
  const original = userData.settings.mode;

  afterEach(() => {
    userData.settings.mode = original;
  });

  it('sets FULL and records a fresh install when mode was never chosen', () => {
    userData.settings.mode = undefined;
    expect(defaultFreshInstallToFullMode()).toBe(true);
    expect(userData.settings.mode).toBe('FULL');
    expect(isFreshInstall()).toBe(true);
  });

  it('leaves a stored BASIC mode alone', () => {
    userData.settings.mode = 'BASIC';
    expect(defaultFreshInstallToFullMode()).toBe(false);
    expect(userData.settings.mode).toBe('BASIC');
    expect(isFreshInstall()).toBe(false);
  });

  it('leaves a stored FULL mode alone', () => {
    userData.settings.mode = 'FULL';
    expect(defaultFreshInstallToFullMode()).toBe(false);
    expect(userData.settings.mode).toBe('FULL');
    expect(isFreshInstall()).toBe(false);
  });
});
