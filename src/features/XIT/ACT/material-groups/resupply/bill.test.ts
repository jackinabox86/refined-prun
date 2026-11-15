import { describe, expect, it, vi } from 'vitest';
// The module graph reaches shell/config, which reads `document` at import time.
vi.mock('@src/infrastructure/shell/config', () => ({ default: {} }));
import { consumedOver } from '@src/features/XIT/ACT/material-groups/resupply/bill';

describe('consumedOver', () => {
  it('scales daily use by the days without a workforce floor', () => {
    expect(consumedOver(0.5, 10, 4)).toBe(5);
    expect(consumedOver(2, 10, 4, 1)).toBe(20);
  });

  it('covers a full day of workforce need under 1 day', () => {
    // 4/day workforce only: a 0.3 day route still carries the whole day.
    expect(consumedOver(0.3, 4, 4, 1)).toBeCloseTo(4);
    expect(consumedOver(0, 4, 4, 1)).toBe(4);
    // 6/day production input plus 4/day workforce over half a day: 3 + 4.
    expect(consumedOver(0.5, 10, 4, 1)).toBe(7);
    // No workforce share, no floor.
    expect(consumedOver(0.5, 10, 0, 1)).toBe(5);
  });
});
