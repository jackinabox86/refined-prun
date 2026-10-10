import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fltRepairCommand, fltShipNameCommand } from './ship-commands';

const here = dirname(fileURLToPath(import.meta.url));
const flt = readFileSync(join(here, 'FLT.vue'), 'utf8');

describe('XIT FLT ship commands', () => {
  it('opens SHP from the ship name and the Repair cell', () => {
    expect(fltShipNameCommand('AVI-05Y2T')).toBe('SHP AVI-05Y2T');
    expect(fltRepairCommand('AVI-05Y2T')).toBe('SHP AVI-05Y2T');
    expect(flt).toContain('showBuffer(fltShipNameCommand(x.ship.registration))');
    expect(flt).toContain('showBuffer(fltRepairCommand(x.ship.registration))');
  });

  it('leaves the other row commands on SFC, SHPI, and SHPF', () => {
    const nameCell = flt.slice(flt.indexOf('v-if="showColName"'), flt.indexOf('showColShipClass'));
    expect(nameCell).not.toContain('SFC');
    expect(flt.match(/showBuffer\(`SFC \$\{x\.ship\.registration\}`\)/g)).toHaveLength(1);
    expect(flt).toContain('showBuffer(`SHPI ${x.ship.registration}`)');
    expect(flt).toContain('showBuffer(`SHPF ${registration}`)');
  });
});
