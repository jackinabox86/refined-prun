import { describe, expect, it } from 'vitest';
import { formatRepairCell } from '@src/features/XIT/REP/repair-cell';

const countUp = {
  countdown: false,
  target: 60,
  red: 3,
  yellow: 7,
};

describe('formatRepairCell', () => {
  it('counts up by default and shows the age', () => {
    expect(formatRepairCell({ ...countUp, age: 61.5 }).text).toBe('61');
    expect(formatRepairCell({ ...countUp, age: 40.9 }).text).toBe('40');
  });

  it('colours a count-up cell from the red and yellow thresholds', () => {
    expect(formatRepairCell({ ...countUp, age: 58 })).toEqual({
      text: '58',
      missing: true,
      warning: true,
      supplied: false,
    });
    expect(formatRepairCell({ ...countUp, age: 54 })).toEqual({
      text: '54',
      missing: false,
      warning: true,
      supplied: false,
    });
    expect(formatRepairCell({ ...countUp, age: 40 })).toEqual({
      text: '40',
      missing: false,
      warning: false,
      supplied: true,
    });
  });

  it('does not colour a count-up cell from the target alone', () => {
    // Age 54 is well short of the 60-day target but inside yellow; raising
    // yellow past it must clear the warning, which a target-only rule cannot do.
    const cell = formatRepairCell({ ...countUp, age: 54, red: 0, yellow: 0 });
    expect(cell.warning).toBe(false);
    expect(cell.supplied).toBe(true);
  });

  it('counts down to the supplied target', () => {
    expect(formatRepairCell({ ...countUp, countdown: true, age: 10, target: 40 }).text).toBe('30');
    expect(formatRepairCell({ ...countUp, countdown: true, age: 10, target: 60 }).text).toBe('50');
    expect(formatRepairCell({ ...countUp, countdown: true, age: 70 }).text).toBe('-10');
  });

  it('colours a countdown the same way as a count-up cell', () => {
    const countdown = { ...countUp, countdown: true };
    for (const age of [58, 54, 40]) {
      const up = formatRepairCell({ ...countUp, age });
      const down = formatRepairCell({ ...countdown, age });
      expect({ ...down, text: '' }).toEqual({ ...up, text: '' });
    }
  });
});
