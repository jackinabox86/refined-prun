import { describe, expect, it } from 'vitest';
import { btfLegActions } from '@src/features/XIT/ROUTE/btf-leg-actions';

describe('btfLegActions', () => {
  it('does not delete, copy, or create a blueprint', () => {
    expect(btfLegActions).not.toContain('delete');
    expect(btfLegActions).not.toContain('copy');
    expect(btfLegActions).not.toContain('create');
  });

  it('applies the loadout after the destination, then reads the plan', () => {
    expect(btfLegActions).toEqual([
      'select-origin',
      'select-destination',
      'apply-loadout',
      'confirm-loadout',
      'read-summary',
    ]);
  });
});
