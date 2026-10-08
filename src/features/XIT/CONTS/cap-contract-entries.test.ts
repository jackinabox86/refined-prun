import { describe, expect, it } from 'vitest';
import {
  applyContractEntryCap,
  capContractEntries,
  hiddenContractEntriesMarker,
  setCollapseLongContractCells,
  visibleContractEntries,
} from '@src/features/XIT/CONTS/cap-contract-entries';

describe('capContractEntries', () => {
  it('keeps a cell that has at most three entries', () => {
    expect(capContractEntries(['a', 'b', 'c'])).toEqual({
      entries: ['a', 'b', 'c'],
      hidden: false,
    });
    expect(hiddenContractEntriesMarker).toBe('(…)');
    expect(visibleContractEntries).toBe(3);
  });

  it('keeps the first three and marks a fourth slot when more remain', () => {
    expect(capContractEntries(['a', 'b', 'c', 'd', 'e'])).toEqual({
      entries: ['a', 'b', 'c'],
      hidden: true,
    });
  });
});

describe('applyContractEntryCap', () => {
  it('returns every entry while the feature is off', () => {
    setCollapseLongContractCells(false);
    expect(applyContractEntryCap(['a', 'b', 'c', 'd'])).toEqual({
      entries: ['a', 'b', 'c', 'd'],
      hidden: false,
    });
  });

  it('caps when the feature is on', () => {
    setCollapseLongContractCells(true);
    expect(applyContractEntryCap(['a', 'b', 'c', 'd'])).toEqual({
      entries: ['a', 'b', 'c'],
      hidden: true,
    });
    setCollapseLongContractCells(false);
  });
});
