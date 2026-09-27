import { describe, expect, it } from 'vitest';
import { shouldNarrowShipContextCommand } from './shpi-context-command';

describe('shouldNarrowShipContextCommand', () => {
  it('narrows the ship links that carry a registration on SHPI', () => {
    expect(
      ['SHP', 'SHPF', 'SFC', 'LM', 'INV', 'WAR', null, undefined].filter(x =>
        shouldNarrowShipContextCommand(x),
      ),
    ).toEqual(['SHP', 'SHPF', 'SFC']);
  });
});
