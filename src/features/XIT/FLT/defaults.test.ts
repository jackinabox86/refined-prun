import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  DEFAULT_SORT_DIRECTION_BY_KEY,
  FLT_LAYOUT_MODES,
  FLT_REFUEL_BUFFER_COMMAND,
  fuelHeaderAction,
  unconfiguredOptionalColumns,
} from './defaults';

const here = dirname(fileURLToPath(import.meta.url));

describe('XIT FLT unconfigured defaults', () => {
  it('shows name, cargo, eta, and fuel', () => {
    expect(unconfiguredOptionalColumns()).toEqual(['name', 'cargo', 'eta', 'fuel']);
  });

  it('uses cargo layout and status descending', () => {
    expect(DEFAULTS.layoutMode).toBe('cargo');
    expect(DEFAULTS.primarySortKey).toBe('status');
    expect(DEFAULT_SORT_DIRECTION_BY_KEY.status).toBe('desc');
  });
});

describe('XIT FLT fuel header', () => {
  it.each(FLT_LAYOUT_MODES)(
    'is the refuel action in %s and does not keep a standalone REFUEL button',
    layout => {
      const header = fuelHeaderAction(layout);
      expect(header.label).toBe('fuel');
      expect(header.command).toBe(FLT_REFUEL_BUFFER_COMMAND);
      expect(header.showStandaloneRefuel).toBe(false);
    },
  );

  it('renders the fuel label as the header button', () => {
    const source = readFileSync(join(here, 'FleetRefuelHeader.vue'), 'utf8');
    expect(source).toContain('FLT_FUEL_HEADER_LABEL');
    expect(source.includes('REFUEL')).toBe(false);
    expect(source.includes('ResizeObserver')).toBe(false);
  });
});
