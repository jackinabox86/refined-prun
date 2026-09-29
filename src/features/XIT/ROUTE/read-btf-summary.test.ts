import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  parseDurationSeconds,
  readBtfSummary,
} from '@src/features/XIT/ROUTE/read-btf-summary';
import { formatRouteTotal } from '@src/features/XIT/ROUTE/route-results';

const headers = [
  '#',
  'Type',
  'Destination',
  'Duration',
  'Distance',
  'Damage',
  'Fees',
  'Consumption',
];

describe('readBtfSummary', () => {
  it('reads the trip summary duration and both fuels', () => {
    const summary = readBtfSummary(headers, [
      '',
      '',
      'Acetares d',
      '12h 22m 59s',
      '148,799,512 km',
      '0.457%',
      '6,000 AIC',
      '246 units STL fuel 39 units FTL fuel',
    ]);
    expect(summary).toEqual({
      ok: true,
      duration: '12h 22m 59s',
      seconds: 12 * 3600 + 22 * 60 + 59,
      stl: 246,
      ftl: 39,
    });
  });

  it('does not treat a dashed plan as zero time or zero fuel', () => {
    const summary = readBtfSummary(headers, ['', '', '', '--', '', '', '', '--']);
    expect(summary).toEqual({ ok: false, reason: 'no flight plan' });
  });

  it('does not invent fuel when the duration is present but consumption is empty', () => {
    const summary = readBtfSummary(headers, ['', '', 'Acetares d', '10s', '', '', '', '']);
    expect(summary).toEqual({ ok: false, reason: 'no fuel figures' });
  });
});

describe('parseDurationSeconds', () => {
  it('parses the forms the test-flight table uses', () => {
    expect(parseDurationSeconds('5h 41m')).toBe(5 * 3600 + 41 * 60);
    expect(parseDurationSeconds('10m 0s')).toBe(600);
    expect(parseDurationSeconds('10s')).toBe(10);
    expect(parseDurationSeconds('--')).toBeUndefined();
  });
});

describe('formatDuration', () => {
  it('omits zero seconds when a longer unit is present', () => {
    expect(formatDuration(5 * 3600 + 41 * 60)).toBe('5h 41m');
    expect(formatDuration(10)).toBe('10s');
  });
});

describe('formatRouteTotal', () => {
  it('sums resolved legs and calls out unresolved ones', () => {
    expect(formatRouteTotal([{ ok: true, seconds: 10, stl: 5, ftl: 1 }, { ok: false }])).toBe(
      'Total (1 leg): 10s, 5 STL + 1 FTL; 1 unresolved',
    );
  });
});
