import { describe, expect, it } from 'vitest';
import { govBurnUseCXInv } from '@src/features/XIT/GOVBURN/govburn-cx-buy';

describe('govBurnUseCXInv', () => {
  it('keeps CX inventory when the force toggle is off or unset', () => {
    expect(govBurnUseCXInv(false)).toBe(true);
    expect(govBurnUseCXInv(undefined)).toBe(true);
  });

  it('skips CX inventory when the force toggle is on', () => {
    expect(govBurnUseCXInv(true)).toBe(false);
  });
});
