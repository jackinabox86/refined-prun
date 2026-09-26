import { describe, expect, it } from 'vitest';
import { formatRepairCell } from '@src/features/XIT/REP/repair-cell';

const countUp = {
  countdown: false,
  target: 60,
  offset: 10,
  red: 3,
  yellow: 7,
};

describe('formatRepairCell', () => {
  it('counts up by default and colours from the target and offset', () => {
    expect(formatRepairCell({ ...countUp, age: 61.5 })).toEqual({
      text: '61',
      missing: true,
      warning: true,
      supplied: false,
    });
    expect(formatRepairCell({ ...countUp, age: 55 })).toEqual({
      text: '55',
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

  it('does not colour a count-up cell from the red and yellow thresholds', () => {
    const cell = formatRepairCell({ ...countUp, age: 55, red: 0, yellow: 0 });
    expect(cell.warning).toBe(true);
    expect(cell.missing).toBe(false);
  });

  it('counts down to the supplied target', () => {
    expect(formatRepairCell({ ...countUp, countdown: true, age: 10, target: 40 }).text).toBe('30');
    expect(formatRepairCell({ ...countUp, countdown: true, age: 10, target: 60 }).text).toBe('50');
  });

  it('colours a countdown from the repair red and yellow thresholds', () => {
    const countdown = { ...countUp, countdown: true };
    expect(formatRepairCell({ ...countdown, age: 58 })).toMatchObject({
      text: '2',
      missing: true,
      warning: true,
      supplied: false,
    });
    expect(formatRepairCell({ ...countdown, age: 54 })).toMatchObject({
      text: '6',
      missing: false,
      warning: true,
      supplied: false,
    });
    expect(formatRepairCell({ ...countdown, age: 50 })).toMatchObject({
      text: '10',
      missing: false,
      warning: false,
      supplied: true,
    });
    expect(formatRepairCell({ ...countdown, age: 70 }).text).toBe('-10');
  });
});
