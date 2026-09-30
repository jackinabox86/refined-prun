import { describe, expect, it } from 'vitest';
import { readHasLocalMarket } from './planet-local-market';

describe('readHasLocalMarket', () => {
  it('reads the FIO boolean', () => {
    expect(readHasLocalMarket({ HasLocalMarket: true })).toBe(true);
    expect(readHasLocalMarket({ HasLocalMarket: false })).toBe(false);
  });

  it('returns undefined when the field is missing or not a boolean', () => {
    expect(readHasLocalMarket({})).toBeUndefined();
    expect(readHasLocalMarket({ HasLocalMarket: 'yes' })).toBeUndefined();
    expect(readHasLocalMarket(null)).toBeUndefined();
  });
});
