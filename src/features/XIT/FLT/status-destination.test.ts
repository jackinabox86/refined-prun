import { describe, expect, it } from 'vitest';
import { getFltStatusDestination } from './status-destination';

function entity(naturalId: string, name = naturalId) {
  return { id: `id-${naturalId}`, naturalId, name };
}

function address(lines: PrunApi.AddressLine[]): PrunApi.Address {
  return { lines };
}

const system = (naturalId: string, name: string): PrunApi.AddressLine => ({
  type: 'SYSTEM',
  entity: entity(naturalId, name),
});

describe('XIT FLT status destination', () => {
  it('opens GTW and the gateway inventory for a gateway destination', () => {
    const destination = address([
      system('ZV-307', 'Antares'),
      { type: 'GATEWAY', entity: entity('VTX', 'Vortex Gateway') },
    ]);
    expect(getFltStatusDestination(destination)).toEqual({
      name: 'Vortex Gateway',
      command: 'GTW VTX',
      inventoryCommand: 'INV VTX',
    });
  });

  it('falls back to the gateway id when the gateway has no name', () => {
    const destination = address([
      system('ZV-307', 'Antares'),
      { type: 'GATEWAY', entity: entity('UPK', '') },
    ]);
    expect(getFltStatusDestination(destination).name).toBe('UPK');
  });

  it('keeps the planet link and inventory link for a planet destination', () => {
    const destination = address([
      system('ZV-307', 'Antares'),
      { type: 'PLANET', entity: entity('ZV-307a', 'Antares I') },
    ]);
    expect(getFltStatusDestination(destination)).toEqual({
      name: 'Antares I',
      command: 'PLI ZV-307a',
      inventoryCommand: 'INV ZV-307a',
    });
  });

  it('keeps the station link for a station destination', () => {
    const destination = address([
      system('ZV-307', 'Antares'),
      { type: 'STATION', entity: entity('ANT', 'Antares Station') },
    ]);
    expect(getFltStatusDestination(destination).command).toBe('STNS ANT');
  });
});
