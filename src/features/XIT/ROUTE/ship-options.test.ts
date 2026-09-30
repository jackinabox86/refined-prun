import { describe, expect, it } from 'vitest';
import { shipOptions } from '@src/features/XIT/ROUTE/ship-options';

function ship(registration: string, name: string) {
  return { registration, name } as PrunApi.Ship;
}

describe('shipOptions', () => {
  it('labels a named ship with its registration', () => {
    expect(shipOptions([ship('AA-001', 'Ace')])).toStrictEqual([
      { value: 'AA-001', label: 'Ace (AA-001)' },
    ]);
  });

  it('falls back to the registration when the name is blank or the same', () => {
    expect(shipOptions([ship('BB-002', '  '), ship('CC-003', 'CC-003')])).toStrictEqual([
      { value: 'BB-002', label: 'BB-002' },
      { value: 'CC-003', label: 'CC-003' },
    ]);
  });

  it('sorts by label', () => {
    expect(shipOptions([ship('ZZ-9', 'Zeta'), ship('AA-1', 'Alpha')])).toStrictEqual([
      { value: 'AA-1', label: 'Alpha (AA-1)' },
      { value: 'ZZ-9', label: 'Zeta (ZZ-9)' },
    ]);
  });
});
