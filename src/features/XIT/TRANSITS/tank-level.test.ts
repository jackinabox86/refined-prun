import { describe, expect, it } from 'vitest';
import {
  blueprintTestFlightBlock,
  matchingFieldLabel,
  settingTarget,
  sliderNudgeLimit,
  sliderTarget,
  sliderValue,
  tankForLeg,
  tankKind,
  tanksToCheck,
} from '@src/features/XIT/TRANSITS/tank-level';

describe('tankForLeg', () => {
  it('keeps the confirmed tank when nothing has burned yet', () => {
    expect(tankForLeg(1500, [])).toBe(1500);
  });

  it('subtracts every preceding leg', () => {
    expect(tankForLeg(1500, [175])).toBe(1325);
    expect(tankForLeg(1500, [175, 138])).toBe(1187);
  });

  it('does not go below zero', () => {
    expect(tankForLeg(100, [175])).toBe(0);
  });
});

describe('sliderTarget', () => {
  const stl = { label: 'STL Fuel', value: 1500, tank: 'stl' as const };
  const inventory = { label: 'Inventory', value: 200, tank: undefined };

  it('decrements only a fuel tank', () => {
    expect(sliderTarget(stl, [175], [])).toBe(1325);
    expect(sliderTarget(inventory, [175], [40])).toBe(200);
  });
});

describe('sliderValue', () => {
  it('reads a handle value', () => {
    expect(sliderValue('0.282')).toBe(0.282);
    expect(sliderValue('0')).toBe(0);
  });

  it('reads an empty or absent value as no value, not 0', () => {
    expect(sliderValue('')).toBeUndefined();
    expect(sliderValue('  ')).toBeUndefined();
    expect(sliderValue(null)).toBeUndefined();
    expect(sliderValue('--')).toBeUndefined();
  });
});

describe('settingTarget', () => {
  it('keeps a setting this leg can take', () => {
    expect(settingTarget(0.5, 0.282, 1)).toBe(0.5);
    expect(settingTarget(0.05, 0.01, 1)).toBe(0.05);
  });

  it('starts a setting below this leg minimum at the minimum', () => {
    expect(settingTarget(0.05, 0.282, 1)).toBe(0.282);
    expect(settingTarget(0, 0.01, 1)).toBe(0.01);
  });

  it('starts a setting above this leg maximum at the maximum', () => {
    expect(settingTarget(0.9, 0.303, 0.678)).toBe(0.678);
  });
});

describe('tanksToCheck', () => {
  const stl = { label: 'STL Fuel', value: 1500, tank: 'stl' as const };
  const ftl = { label: 'FTL fuel', value: 300, tank: 'ftl' as const };
  const fuelUsage = { label: 'Fuel usage', value: 0.05, tank: undefined };

  it('checks both tanks on a ship with an FTL tank', () => {
    expect(tanksToCheck([stl, ftl, fuelUsage], ['stl', 'ftl'])).toEqual(['stl', 'ftl']);
  });

  it('does not require an FTL tank the flight does not show', () => {
    expect(tanksToCheck([stl, fuelUsage], ['stl'])).toEqual(['stl']);
  });

  it('still checks an FTL tank that was confirmed or is on the flight', () => {
    expect(tanksToCheck([stl, ftl], ['stl'])).toEqual(['stl', 'ftl']);
    expect(tanksToCheck([stl], ['stl', 'ftl'])).toEqual(['stl', 'ftl']);
  });
});

describe('matchingFieldLabel', () => {
  const labels = ['Fuel usage', 'STL Fuel', 'FTL fuel'];

  it('uses the nearest ancestor that contains one label', () => {
    expect(
      matchingFieldLabel(['0 375 750', 'STL Fuel 0 375 750', 'Fuel usage STL Fuel'], labels),
    ).toBe('STL Fuel');
  });

  it('does not treat a sibling field as the label', () => {
    expect(matchingFieldLabel(['Fuel usage MIN MAX'], labels)).toBe('Fuel usage');
  });
});

describe('tankKind', () => {
  it('marks the two fuel labels and nothing else', () => {
    expect(tankKind('STL Fuel', 'STL Fuel', 'FTL fuel')).toBe('stl');
    expect(tankKind('FTL fuel', 'STL Fuel', 'FTL fuel')).toBe('ftl');
    expect(tankKind('Inventory', 'STL Fuel', 'FTL fuel')).toBeUndefined();
  });
});

describe('sliderNudgeLimit', () => {
  it('covers the pixel width of the narrow test-flight pane', () => {
    expect(sliderNudgeLimit(3500, 103)).toBe(Math.ceil(3500 / 103) + 2);
    expect(sliderNudgeLimit(3500, 103)).toBeGreaterThan(17);
  });

  it('covers the wider standalone track too', () => {
    expect(sliderNudgeLimit(3500, 378)).toBe(Math.ceil(3500 / 378) + 2);
  });

  it('does not invent a bound when the track has no width', () => {
    expect(sliderNudgeLimit(3500, 0)).toBeUndefined();
  });
});

describe('blueprintTestFlightBlock', () => {
  it('does not reject a locked blueprint', () => {
    expect(blueprintTestFlightBlock({ status: 'LOCKED' }, 'BP-STRT-0000')).toBeUndefined();
    expect(blueprintTestFlightBlock({ status: 'VALID' }, 'BP-STRT-0000')).toBeUndefined();
  });

  it('still reports a blueprint that is not loaded', () => {
    expect(blueprintTestFlightBlock(undefined, 'BP-STRT-0000')).toBe(
      'blueprint BP-STRT-0000 is not loaded',
    );
  });
});
