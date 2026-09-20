import { describe, expect, it } from 'vitest';
import { shipSizes, shipSizesOwnedByFleet } from '@src/core/ship-sizes';

const catalog = shipSizes;
const holds = new Map<string, { weightCapacity: number; volumeCapacity: number }>([
  ['small', { weightCapacity: 500, volumeCapacity: 500 }],
  ['std', { weightCapacity: 2000, volumeCapacity: 2000 }],
  ['odd', { weightCapacity: 4000, volumeCapacity: 4000 }],
  ['weight-only', { weightCapacity: 2000, volumeCapacity: 1000 }],
]);

function getHold(id: string) {
  return holds.get(id);
}

describe('shipSizesOwnedByFleet', () => {
  it('returns no sizes when the fleet has not been fetched', () => {
    expect(shipSizesOwnedByFleet(catalog, undefined, getHold)).toEqual([]);
  });

  it('returns no sizes when the fleet is empty', () => {
    expect(shipSizesOwnedByFleet(catalog, [], getHold)).toEqual([]);
  });

  it('keeps a catalog size when at least one ship hold matches both capacities', () => {
    const owned = shipSizesOwnedByFleet(
      catalog,
      [{ idShipStore: 'small' }, { idShipStore: 'std' }],
      getHold,
    );
    expect(owned.map(x => x.id)).toEqual(['500/500', '2k/2k']);
  });

  it('lists a size once when several ships share that hold', () => {
    const owned = shipSizesOwnedByFleet(
      catalog,
      [{ idShipStore: 'std' }, { idShipStore: 'std-2' }],
      id => (id === 'std-2' ? holds.get('std') : getHold(id)),
    );
    expect(owned.map(x => x.id)).toEqual(['2k/2k']);
  });

  it('skips a ship whose cargo hold is not loaded yet', () => {
    expect(
      shipSizesOwnedByFleet(catalog, [{ idShipStore: 'missing' }], getHold).map(x => x.id),
    ).toEqual([]);
  });

  it('does not treat a weight-only match as ownership of a catalog size', () => {
    expect(
      shipSizesOwnedByFleet(catalog, [{ idShipStore: 'weight-only' }], getHold).map(x => x.id),
    ).toEqual([]);
  });

  it('does not list a catalog size with zero matching holds', () => {
    const owned = shipSizesOwnedByFleet(catalog, [{ idShipStore: 'small' }], getHold);
    expect(owned.map(x => x.id)).not.toContain('1k/3k');
    expect(owned.map(x => x.id)).not.toContain('3k/1k');
    expect(owned.map(x => x.id)).not.toContain('5k/5k');
    expect(owned.map(x => x.id)).not.toContain('2k/2k');
  });

  it('does not list a non-catalog hold as a fit-to-ship size', () => {
    expect(
      shipSizesOwnedByFleet(catalog, [{ idShipStore: 'odd' }], getHold).map(x => x.id),
    ).toEqual([]);
  });

  it('does not mutate the catalog', () => {
    const before = catalog.map(x => x.id);
    shipSizesOwnedByFleet(catalog, [{ idShipStore: 'small' }], getHold);
    expect(catalog.map(x => x.id)).toEqual(before);
  });
});
