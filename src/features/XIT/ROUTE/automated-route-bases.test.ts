import { beforeEach, describe, expect, it, vi } from 'vitest';

const { routes } = vi.hoisted(() => ({
  routes: [] as {
    loop?: boolean;
    stops: { kind: string; id: string }[];
  }[],
}));

vi.mock('@src/store/user-data', () => ({
  userData: { routes },
}));

import {
  compareEnRouteLast,
  hasRepairsDue,
  isOnAutomatedRoute,
} from '@src/features/XIT/ROUTE/automated-route-bases';

beforeEach(() => {
  routes.length = 0;
});

describe('isOnAutomatedRoute', () => {
  it('is true for a base stop on a looping route', () => {
    routes.push({
      stops: [
        { kind: 'cx', id: 'AI1' },
        { kind: 'base', id: 'VH-331a' },
      ],
    });
    expect(isOnAutomatedRoute('VH-331a')).toBe(true);
  });

  it('is true when loop is absent (defaults to automated)', () => {
    routes.push({ stops: [{ kind: 'base', id: 'OT-580b' }] });
    expect(isOnAutomatedRoute('OT-580b')).toBe(true);
  });

  it('is false for a base only on an on-demand route', () => {
    routes.push({
      loop: false,
      stops: [{ kind: 'base', id: 'VH-331a' }],
    });
    expect(isOnAutomatedRoute('VH-331a')).toBe(false);
  });

  it('is false for a CX stop id and for an unknown base', () => {
    routes.push({
      stops: [
        { kind: 'cx', id: 'AI1' },
        { kind: 'base', id: 'VH-331a' },
      ],
    });
    expect(isOnAutomatedRoute('AI1')).toBe(false);
    expect(isOnAutomatedRoute('ZZ-999z')).toBe(false);
  });
});

describe('hasRepairsDue', () => {
  it('is true at and past the repair target', () => {
    expect(hasRepairsDue(60, 60)).toBe(true);
    expect(hasRepairsDue(80, 60)).toBe(true);
  });

  it('is false before the target or without an age', () => {
    expect(hasRepairsDue(59, 60)).toBe(false);
    expect(hasRepairsDue(undefined, 60)).toBe(false);
  });
});

describe('compareEnRouteLast', () => {
  it('puts an en-route base after an off-route base', () => {
    expect(compareEnRouteLast(true, false)).toBe(1);
    expect(compareEnRouteLast(false, true)).toBe(-1);
    expect(compareEnRouteLast(true, true)).toBe(0);
  });

  it('lets repairs due break through only when that option is on', () => {
    expect(
      compareEnRouteLast(true, false, {
        repairsDueBreaksThrough: true,
        aRepairsDue: true,
        bRepairsDue: false,
      }),
    ).toBe(0);
    expect(
      compareEnRouteLast(true, false, {
        repairsDueBreaksThrough: true,
        aRepairsDue: false,
        bRepairsDue: false,
      }),
    ).toBe(1);
    expect(
      compareEnRouteLast(true, false, {
        aRepairsDue: true,
        bRepairsDue: false,
      }),
    ).toBe(1);
  });
});
