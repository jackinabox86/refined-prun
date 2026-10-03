import { describe, expect, it } from 'vitest';
import { parseRouteId, parseRouteSpec, routeSummaryLines } from './route-spec';

const twoStops = `ZV-307d
ANT | load DW 1 100
`;

describe('parseRouteSpec', () => {
  it('requires two stops', () => {
    expect(parseRouteSpec('ZV-307d').ok).toBe(false);
    expect(parseRouteSpec('').ok).toBe(false);
  });

  it('parses a stop list with load, unload, wait, and refuel', () => {
    const parsed = parseRouteSpec(`# comment
ZV-307d
ANT | load DW 1 100
ZV-759c | unload DW 1 all
OT-580 | wait 1 minutes
AI1 | refuel STL local 100 capacity
`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.spec.stops).toHaveLength(5);
    expect(parsed.spec.stops[1].steps[0]).toEqual({
      kind: 'load',
      ticker: 'DW',
      min: { mode: 'units', amount: 1 },
      max: { mode: 'units', amount: 100 },
    });
    expect(parsed.spec.stops[2].steps[0]).toMatchObject({ kind: 'unload', ticker: 'DW' });
    expect(parsed.spec.stops[3].steps[0]).toEqual({ kind: 'wait', amount: 1, unit: 'minutes' });
    expect(parsed.spec.stops[4].steps[0]).toMatchObject({
      kind: 'refuel',
      tank: 'STL',
      source: 'local',
    });
  });

  it('rejects capacity on unload and all on load', () => {
    expect(parseRouteSpec(`${twoStops}X | unload DW capacity 1`).ok).toBe(false);
    expect(parseRouteSpec(`A\nB | load DW all 1`).ok).toBe(false);
  });
});

describe('parseRouteId', () => {
  it('allows a blank id', () => {
    expect(parseRouteId('  ')).toEqual({ ok: true });
  });

  it('accepts a route id and rejects anything else', () => {
    expect(parseRouteId('rt-suul-0521')).toEqual({ ok: true, id: 'RT-SUUL-0521' });
    expect(parseRouteId('ANT').ok).toBe(false);
  });
});

describe('routeSummaryLines', () => {
  it('spells out every waypoint setting and step', () => {
    const lines = routeSummaryLines(
      {
        stops: [
          {
            query: 'Antares Station',
            fuelUsage: 1,
            reactorUsage: 30,
            steps: [
              { kind: 'unload', ticker: 'DW', min: { mode: 'all' }, max: { mode: 'all' } },
              {
                kind: 'load',
                ticker: 'RAT',
                min: { mode: 'units', amount: 120 },
                max: { mode: 'units', amount: 120 },
              },
            ],
          },
          {
            query: 'Deimos',
            steps: [
              {
                kind: 'load',
                ticker: 'FE',
                min: { mode: 'units', amount: 0 },
                max: { mode: 'capacity' },
              },
              {
                kind: 'refuel',
                tank: 'STL',
                source: 'local',
                min: { mode: 'capacity' },
                max: { mode: 'capacity' },
              },
            ],
          },
        ],
        loop: true,
      },
      'AVI-0008Z',
    );
    expect(lines).toEqual([
      'Stop 1: Antares Station (fuel 1%, reactor 30%)',
      'Antares Station: Unload all DW carried',
      'Antares Station: Load 120 RAT',
      'Stop 2: Deimos',
      'Deimos: Load FE (min 0, max capacity)',
      'Deimos: Refuel STL from local, capacity',
      'Loop on',
      'Assign AVI-0008Z',
    ]);
  });
});
