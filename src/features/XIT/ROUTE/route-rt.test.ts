import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  addMaterials,
  subtractMaterials,
} from '@src/features/XIT/ACT/material-groups/resupply/milk-run';
import { buildRouteSpec, type RouteBuildInput } from '@src/features/XIT/ROUTE/route-rt';
import { parseRoutePayload } from '@src/features/XIT/RTACT/route-spec';

const here = dirname(fileURLToPath(import.meta.url));

function input(loop: boolean | undefined): RouteBuildInput {
  return {
    stops: [
      { kind: 'cx', id: 'ANT' },
      { kind: 'base', id: 'ZV-307d' },
      { kind: 'cx', id: 'BEN' },
      { kind: 'base', id: 'ZV-759c' },
    ],
    loop,
    legs: [
      { fuelUsage: 80, gateway: true },
      { fuelUsage: 40, reactorUsage: 50, gateway: false },
      { fuelUsage: 20 },
      { fuelUsage: 10, reactorUsage: 30, gateway: true },
    ],
    bills: [
      { id: 'ZV-307d', bill: { RAT: 2, DW: 4 } },
      { id: 'ZV-759c', bill: { DW: 1, SF: 0 } },
    ],
    sourced: { DW: 3 },
    loadedByStop: new Map<string, Record<string, number>>([
      ['ZV-307d', { FE: 10 }],
      ['ZV-759c', {}],
    ]),
    refuelStl: [false, true, false, false],
    refuelFtl: [false, false, false, true],
  };
}

describe('buildRouteSpec', () => {
  it('builds a looping route without repeating the origin', () => {
    const built = buildRouteSpec(input(undefined));
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const loadSource = readFileSync(join(here, 'route-load.ts'), 'utf8');
    const departureFn = loadSource.slice(loadSource.indexOf('export function departureBill'));
    expect(departureFn).toContain('addMaterials');
    expect(departureFn).toContain('subtractMaterials');
    let summed: Record<string, number> = {};
    for (const base of input(undefined).bills) {
      summed = addMaterials(summed, base.bill);
    }
    const departure = subtractMaterials(summed, { DW: 3 });
    expect(built.spec.loop).toBe(true);
    expect(built.spec.stops.map(stop => stop.query)).toEqual(['ANT', 'ZV-307d', 'BEN', 'ZV-759c']);
    expect(built.spec.stops[0]?.steps).toEqual([
      { kind: 'unload', ticker: 'DW', min: { mode: 'all' }, max: { mode: 'all' } },
      { kind: 'unload', ticker: 'FE', min: { mode: 'all' }, max: { mode: 'all' } },
      { kind: 'unload', ticker: 'RAT', min: { mode: 'all' }, max: { mode: 'all' } },
      {
        kind: 'refuel',
        tank: 'STL',
        source: 'local',
        min: { mode: 'capacity' },
        max: { mode: 'capacity' },
      },
      {
        kind: 'refuel',
        tank: 'FTL',
        source: 'local',
        min: { mode: 'capacity' },
        max: { mode: 'capacity' },
      },
      {
        kind: 'load',
        ticker: 'DW',
        min: { mode: 'units', amount: departure.DW },
        max: { mode: 'units', amount: departure.DW },
      },
      {
        kind: 'load',
        ticker: 'RAT',
        min: { mode: 'units', amount: departure.RAT },
        max: { mode: 'units', amount: departure.RAT },
      },
    ]);
    // Waypoints hold the leg that flies to them; the origin holds the return leg.
    expect(built.spec.stops[0]).toMatchObject({ fuelUsage: 10, reactorUsage: 30, gateway: true });
    expect(built.spec.stops[1]?.steps).toEqual([
      { kind: 'load', ticker: 'DW', min: { mode: 'units', amount: 0 }, max: { mode: 'capacity' } },
      {
        kind: 'unload',
        ticker: 'DW',
        min: { mode: 'units', amount: 4 },
        max: { mode: 'units', amount: 4 },
      },
      { kind: 'load', ticker: 'RAT', min: { mode: 'units', amount: 0 }, max: { mode: 'capacity' } },
      {
        kind: 'unload',
        ticker: 'RAT',
        min: { mode: 'units', amount: 2 },
        max: { mode: 'units', amount: 2 },
      },
      { kind: 'load', ticker: 'FE', min: { mode: 'units', amount: 0 }, max: { mode: 'capacity' } },
      {
        kind: 'refuel',
        tank: 'STL',
        source: 'local',
        min: { mode: 'capacity' },
        max: { mode: 'capacity' },
      },
    ]);
    expect(built.spec.stops[1]).toMatchObject({ fuelUsage: 80, gateway: true });
    expect(built.spec.stops[1]?.reactorUsage).toBeUndefined();
    expect(built.spec.stops[2]?.steps).toEqual([]);
    expect(built.spec.stops[2]).toMatchObject({
      fuelUsage: 40,
      reactorUsage: 50,
      gateway: false,
    });
    expect(built.spec.stops[3]).toMatchObject({ fuelUsage: 20 });
    expect(built.spec.stops[3]?.steps.map(step => step.kind)).toEqual(['load', 'unload', 'refuel']);
    expect(built.spec.stops[3]?.steps[2]).toMatchObject({ kind: 'refuel', tank: 'FTL' });
  });

  it('unloads picked-up outputs at the final stop when the route does not loop', () => {
    const built = buildRouteSpec(input(false));
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.spec.loop).toBe(false);
    expect(built.spec.stops.map(stop => stop.query)).toEqual(['ANT', 'ZV-307d', 'BEN', 'ZV-759c']);
    // Nothing flies to the first stop of a one-way route.
    const first = built.spec.stops[0];
    expect([first?.fuelUsage, first?.reactorUsage, first?.gateway]).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    const last = built.spec.stops[3]?.steps ?? [];
    expect(last[last.length - 1]).toEqual({
      kind: 'unload',
      ticker: 'FE',
      min: { mode: 'all' },
      max: { mode: 'all' },
    });
  });

  it('loads a whole output stack and unloads what the base uses of it itself', () => {
    const built = buildRouteSpec({
      ...input(true),
      loadedByStop: new Map<string, Record<string, number>>([
        ['ZV-307d', { FE: 10, AL: 4 }],
        ['ZV-759c', {}],
      ]),
      ownUseByStop: new Map([['ZV-307d', { FE: 7 }]]),
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const steps = built.spec.stops[1]?.steps.filter(
      step =>
        (step.kind === 'load' || step.kind === 'unload') && ['FE', 'AL'].includes(step.ticker),
    );
    expect(steps).toEqual([
      { kind: 'load', ticker: 'AL', min: { mode: 'units', amount: 0 }, max: { mode: 'capacity' } },
      { kind: 'load', ticker: 'FE', min: { mode: 'units', amount: 0 }, max: { mode: 'capacity' } },
      {
        kind: 'unload',
        ticker: 'FE',
        min: { mode: 'units', amount: 7 },
        max: { mode: 'units', amount: 7 },
      },
    ]);
  });

  it('loads the departure extra on top of the bill without changing drop-offs', () => {
    const plain = buildRouteSpec(input(true));
    const buffered = buildRouteSpec({ ...input(true), departureExtra: { DW: 2 } });
    expect(plain.ok && buffered.ok).toBe(true);
    if (!plain.ok || !buffered.ok) {
      return;
    }
    const dwLoad = (spec: typeof plain.spec) =>
      spec.stops[0]?.steps.find(step => step.kind === 'load' && step.ticker === 'DW');
    expect(dwLoad(plain.spec)).toMatchObject({ max: { mode: 'units', amount: 2 } });
    expect(dwLoad(buffered.spec)).toMatchObject({
      min: { mode: 'units', amount: 4 },
      max: { mode: 'units', amount: 4 },
    });
    expect(buffered.spec.stops.slice(1)).toEqual(plain.spec.stops.slice(1));
  });

  it('types a station name when the stored stop is an exchange code', () => {
    const built = buildRouteSpec({
      ...input(true),
      stops: [
        { kind: 'cx', id: 'AI1', query: 'Antares Station' },
        { kind: 'base', id: 'ZV-759c' },
      ],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.spec.stops.map(stop => stop.query)).toEqual(['Antares Station', 'ZV-759c']);
  });

  it('does not add a wait when the route has none', () => {
    const built = buildRouteSpec(input(true));
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.spec.stops.some(stop => stop.steps.some(step => step.kind === 'wait'))).toBe(
      false,
    );
  });

  it('appends a wait to the last waypoint', () => {
    const plain = buildRouteSpec(input(false));
    const built = buildRouteSpec({ ...input(false), wait: { amount: 2, unit: 'hours' } });
    expect(plain.ok && built.ok).toBe(true);
    if (!plain.ok || !built.ok) {
      return;
    }
    const last = built.spec.stops.at(-1);
    expect(last?.steps.at(-1)).toEqual({ kind: 'wait', amount: 2, unit: 'hours' });
    expect(last?.steps.slice(0, -1)).toEqual(plain.spec.stops.at(-1)?.steps);
  });

  it('reloads at a later origin for the next stretch only', () => {
    const built = buildRouteSpec({
      ...input(false),
      stops: [
        { kind: 'cx', id: 'ANT', query: 'Antares Station' },
        { kind: 'base', id: 'ZV-307d' },
        { kind: 'cx', id: 'ANT', query: 'Antares Station' },
        { kind: 'base', id: 'ZV-759c' },
      ],
      refuelStl: [false, false, false, false],
      refuelFtl: [false, false, false, false],
      segments: [
        {
          originIndex: 0,
          bills: [{ id: 'ZV-307d', bill: { RAT: 2 } }],
          sourced: {},
          loadedByStop: new Map([['ZV-307d', { FE: 10 }]]),
        },
        {
          originIndex: 2,
          bills: [{ id: 'ZV-759c', bill: { DW: 1 } }],
          sourced: {},
          loadedByStop: new Map([['ZV-759c', {}]]),
        },
      ],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const loads = built.spec.stops.map(stop =>
      stop.steps.filter(step => step.kind === 'load').map(step => step.ticker),
    );
    expect(loads[0]).toEqual(['RAT']);
    expect(loads[2]).toEqual(['DW']);
    expect(built.spec.stops[2]?.steps.slice(0, 4)).toEqual([
      { kind: 'unload', ticker: 'DW', min: { mode: 'all' }, max: { mode: 'all' } },
      { kind: 'unload', ticker: 'FE', min: { mode: 'all' }, max: { mode: 'all' } },
      {
        kind: 'refuel',
        tank: 'STL',
        source: 'local',
        min: { mode: 'capacity' },
        max: { mode: 'capacity' },
      },
      {
        kind: 'refuel',
        tank: 'FTL',
        source: 'local',
        min: { mode: 'capacity' },
        max: { mode: 'capacity' },
      },
    ]);
  });

  it('rejects a route with one stop', () => {
    const built = buildRouteSpec({
      ...input(false),
      stops: [{ kind: 'base', id: 'ANT' }],
    });
    expect(built.ok).toBe(false);
  });
});

describe('parseRoutePayload', () => {
  it('keeps flight fields and the loop flag', () => {
    const built = buildRouteSpec(input(true));
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const parsed = parseRoutePayload(JSON.stringify(built.spec));
    expect(parsed).toEqual(built);
  });

  it('rejects a payload that is not two stops', () => {
    expect(parseRoutePayload('[]').ok).toBe(false);
    expect(parseRoutePayload(JSON.stringify({ stops: [{ query: 'ANT', steps: [] }] })).ok).toBe(
      false,
    );
  });
});
