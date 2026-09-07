import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULTS,
  DEFAULT_SORT_DIRECTION_BY_KEY,
  FLT_FUEL_HEADER_LABEL,
  FLT_REFUEL_BUFFER_COMMAND,
} from './defaults';

vi.mock('@src/infrastructure/prun-ui/buffers', () => ({
  showBuffer: vi.fn(),
}));

import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { openRefuelAllExchanges } from './refuel';

const here = dirname(fileURLToPath(import.meta.url));

function productSource(name: string) {
  return readFileSync(join(here, name), 'utf8');
}

describe('XIT FLT unconfigured defaults', () => {
  it('enables name, cargo, eta, and fuel', () => {
    expect(DEFAULTS.showColName).toBe(true);
    expect(DEFAULTS.showColCargo).toBe(true);
    expect(DEFAULTS.showColTime).toBe(true);
    expect(DEFAULTS.showColFuel).toBe(true);
    expect(DEFAULTS.showColShipClass).toBe(false);
    expect(DEFAULTS.showColSize).toBe(false);
    expect(DEFAULTS.showColCargoSize).toBe(false);
    expect(DEFAULTS.showColRepair).toBe(false);
    expect(DEFAULTS.showColProblems).toBe(false);
  });

  it('uses cargo layout and status descending', () => {
    expect(DEFAULTS.layoutMode).toBe('cargo');
    expect(DEFAULTS.primarySortKey).toBe('status');
    expect(DEFAULT_SORT_DIRECTION_BY_KEY.status).toBe('desc');
  });
});

describe('XIT FLT fuel header', () => {
  it('opens XIT REFUELACT through the action FLT wires', () => {
    expect(FLT_REFUEL_BUFFER_COMMAND).toBe('XIT REFUELACT');
    vi.mocked(showBuffer).mockClear();
    openRefuelAllExchanges();
    expect(showBuffer).toHaveBeenCalledWith('XIT REFUELACT');
  });

  it('keeps the fuel column gated in the template, grid, and body', () => {
    const flt = productSource('FLT.vue');
    const header = productSource('FuelHeaderButton.vue');

    expect(flt.match(/showFuelColumn\(/g)?.length).toBe(3);
    expect(flt).toContain('if (showFuelColumn(showColFuel.value))');
    expect(flt.match(/v-if="showFuelColumn\(showColFuel\)"/g)?.length).toBe(2);
    expect(flt).toContain('@refuel="openRefuelAllExchanges"');
    expect(flt).not.toMatch(/>\s*REFUEL\s*</);
    expect(flt).toMatch(/colProblems[\s\S]*?>\s*Problems\s*</);

    expect(FLT_FUEL_HEADER_LABEL).toBe('fuel');
    expect(header).toMatch(/<PrunButton[^>]*@click\.stop="emit\('refuel'\)"/);
    expect(header).not.toMatch(/>\s*REFUEL\s*</);
  });
});
