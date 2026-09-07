import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULTS,
  DEFAULT_SORT_DIRECTION_BY_KEY,
  FLT_REFUEL_BUFFER_COMMAND,
  showFuelColumn,
  type LayoutMode,
} from './defaults';

vi.mock('@src/infrastructure/prun-ui/buffers', () => ({
  showBuffer: vi.fn(),
}));

import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { openRefuelAllExchanges } from './refuel';

const here = dirname(fileURLToPath(import.meta.url));
const layouts: LayoutMode[] = ['compact', 'whitespace', 'cargo', 'legacy'];

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
  it.each(layouts)('keeps the fuel column available in %s when the column is on', layout => {
    expect(showFuelColumn(true, layout)).toBe(true);
    expect(showFuelColumn(false, layout)).toBe(false);
  });

  it('opens XIT REFUELACT through the action FLT wires', () => {
    vi.mocked(showBuffer).mockClear();
    openRefuelAllExchanges();
    expect(showBuffer).toHaveBeenCalledWith(FLT_REFUEL_BUFFER_COMMAND);
  });

  it('keeps the fuel header as the only refuel control in every layout', () => {
    const flt = productSource('FLT.vue');
    const header = productSource('FuelHeaderButton.vue');

    expect(flt).toContain('v-if="showFuelColumn(showColFuel, layoutMode)"');
    expect(flt).not.toMatch(/showColFuel\s*&&/);
    expect(flt).toContain('@refuel="openRefuelAllExchanges"');
    expect(flt).not.toMatch(/>\s*REFUEL\s*</);
    expect(flt).toMatch(/colProblems[\s\S]*?>\s*Problems\s*</);

    expect(header).toContain("@click.stop=\"emit('refuel')\"");
    expect(header).toContain('FLT_FUEL_HEADER_LABEL');
    expect(header).not.toMatch(/>\s*REFUEL\s*</);
  });
});
