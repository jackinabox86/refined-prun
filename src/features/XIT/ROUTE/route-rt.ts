import {
  addMaterials,
  subtractMaterials,
} from '@src/features/XIT/ACT/material-groups/resupply/milk-run';
import { arrivingLeg, transitStopIds } from '@src/features/XIT/ROUTE/route-calc';
import type {
  RefuelStep,
  RouteSpec,
  RouteStep,
  RouteStop,
} from '@src/features/XIT/RTACT/route-spec';

export interface RouteBuildStop {
  kind: 'cx' | 'base';
  id: string;
  // Address-selector text when the stored id is not what the game suggests.
  // An exchange code such as AI1 never appears in the suggestion list.
  query?: string;
}

export interface RouteBuildLeg {
  gateway?: boolean;
  fuelUsage?: number;
  reactorUsage?: number;
}

export interface RouteBuildInput {
  stops: readonly RouteBuildStop[];
  loop: boolean | undefined;
  legs?: readonly RouteBuildLeg[];
  bills: readonly { id: string; bill: Record<string, number> }[];
  sourced: Record<string, number>;
  loadedByStop: ReadonlyMap<string, Record<string, number>>;
  // What a base uses of its own outputs over the supply days. The ship loads the
  // whole stack, then unloads this back, the same way inputs are handled.
  ownUseByStop?: ReadonlyMap<string, Record<string, number>>;
  // Loaded at the first stop on top of the bill, see sourcedDayBuffer.
  departureExtra?: Record<string, number>;
  refuelStl: readonly boolean[];
  refuelFtl: readonly boolean[];
  // Present when the route visits its origin more than once. Each entry is one
  // stretch, already billed on its own. A single visit leaves this unset.
  segments?: readonly RouteBuildSegment[];
  // Appended to the last waypoint. Absent means the route does not wait.
  wait?: { amount: number; unit: 'seconds' | 'minutes' | 'hours' | 'days' };
}

export interface RouteBuildSegment {
  originIndex: number;
  bills: readonly { id: string; bill: Record<string, number> }[];
  sourced: Record<string, number>;
  loadedByStop: ReadonlyMap<string, Record<string, number>>;
  ownUseByStop?: ReadonlyMap<string, Record<string, number>>;
  departureExtra?: Record<string, number>;
}

const capacity = { mode: 'capacity' as const };
const carried = { mode: 'all' as const };
// Pick up whatever is there: no minimum to wait for, up to what the hold takes.
const nothing = { mode: 'units' as const, amount: 0 };

// Same reduction as departureBill: sum the base bills, then drop what the route sources.
function departureAmounts(
  bills: readonly { bill: Record<string, number> }[],
  sourced: Record<string, number>,
  extra: Record<string, number> | undefined,
) {
  let bill: Record<string, number> = {};
  for (const base of bills) {
    bill = addMaterials(bill, base.bill);
  }
  return addMaterials(subtractMaterials(bill, sourced), extra);
}

function positiveTickers(record: Record<string, number> | undefined) {
  if (record === undefined) {
    return [];
  }
  return Object.entries(record)
    .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
    .map(([ticker]) => ticker)
    .sort((a, b) => a.localeCompare(b));
}

function units(amount: number) {
  return { mode: 'units' as const, amount };
}

function refuel(tank: RefuelStep['tank']): RefuelStep {
  return { kind: 'refuel', tank, source: 'local', min: capacity, max: capacity };
}

function kindOf(stops: readonly RouteBuildStop[], id: string) {
  return stops.find(stop => stop.id === id)?.kind;
}

function searchQuery(stops: readonly RouteBuildStop[], id: string) {
  const named = stops.find(stop => stop.id === id)?.query?.trim();
  if (named !== undefined && named.length > 0) {
    return named;
  }
  return id;
}

function billFor(input: RouteBuildInput, id: string) {
  return input.bills.find(base => base.id === id)?.bill;
}

function routeMaterials(input: {
  bills: readonly { bill: Record<string, number> }[];
  loadedByStop: ReadonlyMap<string, Record<string, number>>;
}) {
  const tickers = new Set<string>();
  for (const base of input.bills) {
    for (const ticker of positiveTickers(base.bill)) {
      tickers.add(ticker);
    }
  }
  for (const record of input.loadedByStop.values()) {
    for (const ticker of positiveTickers(record)) {
      tickers.add(ticker);
    }
  }
  return [...tickers].sort((a, b) => a.localeCompare(b));
}

function unionTickers(groups: readonly (readonly string[])[]) {
  const tickers = new Set<string>();
  for (const group of groups) {
    for (const ticker of group) {
      tickers.add(ticker);
    }
  }
  return [...tickers].sort((a, b) => a.localeCompare(b));
}

function segmentMaterials(segment: RouteBuildSegment) {
  return routeMaterials(segment);
}

function segmentOutputs(segment: RouteBuildSegment) {
  return routeMaterials({ bills: [], loadedByStop: segment.loadedByStop });
}

function appendRouteWait(stops: RouteStop[], wait: RouteBuildInput['wait']) {
  if (wait === undefined || !Number.isFinite(wait.amount) || wait.amount <= 0) {
    return;
  }
  const unit = wait.unit;
  if (unit !== 'seconds' && unit !== 'minutes' && unit !== 'hours' && unit !== 'days') {
    return;
  }
  const last = stops.at(-1);
  if (last === undefined) {
    return;
  }
  last.steps.push({ kind: 'wait', amount: wait.amount, unit });
}

function applyLeg(stop: RouteStop, leg: RouteBuildLeg | undefined) {
  if (leg === undefined) {
    return;
  }
  if (leg.fuelUsage !== undefined) {
    stop.fuelUsage = leg.fuelUsage;
  }
  if (leg.reactorUsage !== undefined) {
    stop.reactorUsage = leg.reactorUsage;
  }
  if (leg.gateway !== undefined) {
    stop.gateway = leg.gateway;
  }
}

// One ShippingRoute, already billed, becomes the stop list RT_BUILD drives.
// A looping route uses the game Loop toggle. RT-SNXV-3853 has that toggle on
// and does not list its origin again, so the return stop from transitStopIds
// is not a waypoint. The first stop's unload-all covers what the ship brings home.
function segmentAt(segments: readonly RouteBuildSegment[], index: number) {
  let found: RouteBuildSegment | undefined;
  for (const segment of segments) {
    if (segment.originIndex <= index) {
      found = segment;
    }
  }
  return found;
}

function previousSegment(segments: readonly RouteBuildSegment[], index: number) {
  let found: RouteBuildSegment | undefined;
  for (const segment of segments) {
    if (segment.originIndex < index) {
      found = segment;
    }
  }
  return found;
}

function pushUnloadAll(steps: RouteStep[], tickers: readonly string[]) {
  for (const ticker of tickers) {
    steps.push({ kind: 'unload', ticker, min: carried, max: carried });
  }
}

function pushDepartureLoads(steps: RouteStep[], departure: Record<string, number>) {
  for (const ticker of positiveTickers(departure)) {
    const amount = departure[ticker] ?? 0;
    steps.push({ kind: 'load', ticker, min: units(amount), max: units(amount) });
  }
}

// A base visit leaves exactly one bill of each input on the base. Every bill is
// dropped first, so the hold has room when each input's sweep loads all of it
// off the base; the unused rest rides home. Outputs are loaded last.
function pushBaseSteps(
  steps: RouteStep[],
  bill: Record<string, number> | undefined,
  loaded: Record<string, number> | undefined,
  ownUse: Record<string, number> | undefined,
) {
  const inputs = positiveTickers(bill);
  for (const ticker of inputs) {
    const amount = bill?.[ticker] ?? 0;
    steps.push({ kind: 'unload', ticker, min: units(amount), max: units(amount) });
  }
  for (const ticker of inputs) {
    const amount = bill?.[ticker] ?? 0;
    steps.push(
      { kind: 'load', ticker, min: nothing, max: capacity },
      { kind: 'unload', ticker, min: units(amount), max: units(amount) },
    );
  }
  for (const ticker of positiveTickers(loaded)) {
    steps.push({ kind: 'load', ticker, min: nothing, max: capacity });
    const amount = ownUse?.[ticker] ?? 0;
    if (amount > 0) {
      steps.push({ kind: 'unload', ticker, min: units(amount), max: units(amount) });
    }
  }
}

// Each origin visit drops what the ship still carries, refuels, and loads only
// the stretch up to the next visit.
function buildSegmentedRouteSpec(
  input: RouteBuildInput,
): { ok: true; spec: RouteSpec } | { ok: false; error: string } {
  const looping = input.loop !== false;
  const ids = transitStopIds(input.stops, false);
  if (ids.length < 2) {
    return { ok: false, error: 'Need at least 2 stops' };
  }
  const segments = input.segments ?? [];
  const everything = unionTickers(segments.map(segment => segmentMaterials(segment)));
  const last = ids.length - 1;
  const stops: RouteStop[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] ?? '';
    const steps: RouteStep[] = [];
    const segment = segmentAt(segments, i);
    const origin = segment?.originIndex === i;
    if (origin && segment !== undefined) {
      const previous = previousSegment(segments, i);
      const drop =
        i === 0
          ? everything
          : unionTickers([
              previous === undefined ? [] : segmentOutputs(previous),
              segmentMaterials(segment),
            ]);
      pushUnloadAll(steps, drop);
      steps.push(refuel('STL'), refuel('FTL'));
      pushDepartureLoads(
        steps,
        departureAmounts(segment.bills, segment.sourced, segment.departureExtra),
      );
    } else if (segment !== undefined && kindOf(input.stops, id) === 'base') {
      pushBaseSteps(
        steps,
        segment.bills.find(base => base.id === id)?.bill,
        segment.loadedByStop.get(id),
        segment.ownUseByStop?.get(id),
      );
    }
    if (!origin && input.refuelStl[i] === true) {
      steps.push(refuel('STL'));
    }
    if (!origin && input.refuelFtl[i] === true) {
      steps.push(refuel('FTL'));
    }
    if (i === last && !looping && !origin && segment !== undefined) {
      pushUnloadAll(steps, segmentOutputs(segment));
    }
    const source = input.stops[i];
    const named = source?.query?.trim();
    const stop: RouteStop = {
      query: named !== undefined && named.length > 0 ? named : id,
      steps,
    };
    applyLeg(stop, arrivingLeg(input.legs, i, ids.length, looping));
    stops.push(stop);
  }
  appendRouteWait(stops, input.wait);
  return { ok: true, spec: { stops, loop: looping } };
}

export function buildRouteSpec(
  input: RouteBuildInput,
): { ok: true; spec: RouteSpec } | { ok: false; error: string } {
  if ((input.segments?.length ?? 0) > 1) {
    return buildSegmentedRouteSpec(input);
  }
  const looping = input.loop !== false;
  const ids = transitStopIds(input.stops, false);
  if (ids.length < 2) {
    return { ok: false, error: 'Need at least 2 stops' };
  }
  const departure = departureAmounts(input.bills, input.sourced, input.departureExtra);
  const materials = routeMaterials(input);
  const outputs = routeMaterials({ ...input, bills: [] });
  const last = ids.length - 1;
  const stops: RouteStop[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i] ?? '';
    const steps: RouteStep[] = [];
    const first = i === 0;
    const finalStop = i === last;
    if (first) {
      for (const ticker of materials) {
        steps.push({ kind: 'unload', ticker, min: carried, max: carried });
      }
      steps.push(refuel('STL'), refuel('FTL'));
      for (const ticker of positiveTickers(departure)) {
        const amount = departure[ticker] ?? 0;
        steps.push({ kind: 'load', ticker, min: units(amount), max: units(amount) });
      }
    } else if (kindOf(input.stops, id) === 'base') {
      pushBaseSteps(
        steps,
        billFor(input, id),
        input.loadedByStop.get(id),
        input.ownUseByStop?.get(id),
      );
    }
    if (!first && input.refuelStl[i] === true) {
      steps.push(refuel('STL'));
    }
    if (!first && input.refuelFtl[i] === true) {
      steps.push(refuel('FTL'));
    }
    // The looping return is the first stop's unload-all, not another copy of the origin.
    if (finalStop && !looping) {
      for (const ticker of outputs) {
        steps.push({ kind: 'unload', ticker, min: carried, max: carried });
      }
    }
    const stop: RouteStop = { query: searchQuery(input.stops, id), steps };
    applyLeg(stop, arrivingLeg(input.legs, i, ids.length, looping));
    stops.push(stop);
  }
  appendRouteWait(stops, input.wait);
  return { ok: true, spec: { stops, loop: looping } };
}
