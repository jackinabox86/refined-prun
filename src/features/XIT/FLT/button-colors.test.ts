import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyInitialUserData, initialUserData, userData } from '@src/store/user-data';
import {
  DEFAULT_FLT_BUTTON_COLORS,
  FLT_BUTTON_COLOR_OPTIONS,
  FLT_BUTTONS_BUFFER_COMMAND,
  resolveFltButtonColor,
  setFltButtonColor,
} from './button-colors';

const here = dirname(fileURLToPath(import.meta.url));

function productSource(name: string) {
  return readFileSync(join(here, name), 'utf8');
}

describe('resolveFltButtonColor', () => {
  beforeEach(() => {
    applyInitialUserData();
  });

  it('keeps historic blue/orange at a base and at a CX until the player picks a color', () => {
    const historic = {
      baseEmpty: '#43a4df',
      baseCargo: '#f7a600',
      cxEmpty: '#43a4df',
      cxCargo: '#f7a600',
    };
    expect(DEFAULT_FLT_BUTTON_COLORS).toEqual(historic);
    expect(initialUserData.settings.fltButtonColors).toEqual(historic);
    expect(resolveFltButtonColor(false, false)).toBe('#43a4df');
    expect(resolveFltButtonColor(false, true)).toBe('#f7a600');
    expect(resolveFltButtonColor(true, false)).toBe('#43a4df');
    expect(resolveFltButtonColor(true, true)).toBe('#f7a600');
  });

  it('reads customized colors from user settings', () => {
    setFltButtonColor('baseEmpty', '#2a9d8f');
    setFltButtonColor('cxCargo', '#d9534f');
    expect(resolveFltButtonColor(false, false)).toBe('#2a9d8f');
    expect(resolveFltButtonColor(true, true)).toBe('#d9534f');
  });

  it('falls back to defaults when the settings object is missing', () => {
    // @ts-expect-error intentional missing nested field
    delete userData.settings.fltButtonColors;
    expect(resolveFltButtonColor(false, true)).toBe(DEFAULT_FLT_BUTTON_COLORS.baseCargo);
  });
});

describe('FLT_BUTTON_COLOR_OPTIONS', () => {
  it('includes the long-standing blue/orange unload colors plus six others', () => {
    const values = FLT_BUTTON_COLOR_OPTIONS.map(x => x.value);
    expect(values).toContain('#43a4df');
    expect(values).toContain('#f7a600');
    expect(FLT_BUTTON_COLOR_OPTIONS).toHaveLength(8);
  });
});

describe('XIT FLT button color wiring', () => {
  it('opens XIT FLTBUTTONS from the filters panel', () => {
    expect(FLT_BUTTONS_BUFFER_COMMAND).toBe('XIT FLTBUTTONS');
    expect(productSource('FLT.vue')).toContain('SET BUTTON COLOR');
    expect(productSource('FLT.vue')).toContain('FLT_BUTTONS_BUFFER_COMMAND');
    expect(productSource('FLTBUTTONS.ts')).toContain("command: ['FLTBUTTONS', 'FLTCOLORS']");
  });

  it('resolves unload color through settings instead of hardcoded light purple/red classes', () => {
    const timeCell = productSource('TimeCell.vue');
    expect(timeCell).toContain('resolveFltButtonColor');
    expect(timeCell).toContain('isStationLine');
    expect(timeCell).not.toContain('bgLightPurple');
    expect(timeCell).not.toContain('bgLightRed');
  });
});
