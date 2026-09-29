import { describe, expect, it, vi } from 'vitest';

vi.mock('@src/features/XIT/BURN/utils', () => ({
  formatBurnDays: (days: number) => `dec:${days}`,
}));

import { formatBsBurnDays } from '@src/features/XIT/BS/format-bs-burn-days';

describe('formatBsBurnDays', () => {
  it('does not use the decimal formatter when off, and keeps the 500-day cutoff', () => {
    expect(formatBsBurnDays(3.2, false)).toBe('3');
    expect(formatBsBurnDays(9.9, false)).toBe('9');
    expect(formatBsBurnDays(499.9, false)).toBe('499');
    expect(formatBsBurnDays(500, false)).toBe('∞');
    expect(formatBsBurnDays(999, false)).toBe('∞');
  });

  it('delegates to the decimal formatter when on', () => {
    expect(formatBsBurnDays(3.2, true)).toBe('dec:3.2');
    expect(formatBsBurnDays(500, true)).toBe('dec:500');
    expect(formatBsBurnDays(1000, true)).toBe('dec:1000');
  });
});
