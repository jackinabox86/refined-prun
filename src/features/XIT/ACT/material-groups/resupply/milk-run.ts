// Milk-run sourcing and route peak-load for a single ship's stop list.
// Plain data in, plain data out — DISPATCH.vue only wires the result.

export interface MilkRunStop {
  id: string;
  days: number;
  bill: Record<string, number>;
  storeQty: Record<string, number>;
  dailyAmount: Record<string, number>;
}

export interface MilkRunCargo {
  weightLoad: number;
  volumeLoad: number;
  weightCapacity: number;
  volumeCapacity: number;
}

export interface MaterialSize {
  weight: number;
  volume: number;
}

export interface MilkRunTransfer {
  fromId: string;
  toId: string;
  ticker: string;
  amount: number;
}

export interface PeakOverflow {
  // Undefined means the overflow is the load leaving the CX.
  stopId?: string;
  weightLoad: number;
  volumeLoad: number;
  weightOver: number;
  volumeOver: number;
}

export interface MilkRunInput {
  stops: MilkRunStop[];
  cargo: MilkRunCargo;
  sizeOf: (ticker: string) => MaterialSize | undefined;
}

export interface MilkRunResult {
  transfers: MilkRunTransfer[];
  // CX-leg reduction, summed across every transfer.
  sourced: Record<string, number>;
  sourcedByConsumer: Map<string, Record<string, number>>;
  pickupsByStop: Map<string, Record<string, number>>;
  firstOverflow?: PeakOverflow;
  overflows: PeakOverflow[];
  fits: boolean;
}

export function pickupGroupName(planetName: string) {
  return `Pickup ${planetName}`;
}

// Adequacy: never take so much that the source runs short over its own horizon.
// A ticker already on the source's bill is never takeable.
export function takeableAmount(stop: MilkRunStop, ticker: string) {
  if ((stop.bill[ticker] ?? 0) > 0) {
    return 0;
  }
  const daily = stop.dailyAmount[ticker] ?? 0;
  const ownNeed = stop.days * Math.max(0, -daily) + 1;
  return Math.max(0, Math.floor((stop.storeQty[ticker] ?? 0) - ownNeed));
}

export function subtractMaterials(
  bill: Record<string, number>,
  minus: Record<string, number>,
): Record<string, number> {
  const result = { ...bill };
  for (const [ticker, amount] of Object.entries(minus)) {
    const next = (result[ticker] ?? 0) - amount;
    if (next > 0) {
      result[ticker] = next;
    } else {
      delete result[ticker];
    }
  }
  return result;
}

export function addMaterials(
  bill: Record<string, number> | undefined,
  plus: Record<string, number> | undefined,
): Record<string, number> {
  const result: Record<string, number> = { ...(bill ?? {}) };
  if (plus) {
    for (const [ticker, amount] of Object.entries(plus)) {
      result[ticker] = (result[ticker] ?? 0) + amount;
    }
  }
  return result;
}

function addToRecord(target: Record<string, number>, ticker: string, amount: number) {
  target[ticker] = (target[ticker] ?? 0) + amount;
}

function outputByStop(stops: MilkRunStop[]) {
  const map = new Map<string, Record<string, number>>();
  for (const stop of stops) {
    const output: Record<string, number> = {};
    for (const ticker of Object.keys(stop.storeQty)) {
      const takeable = takeableAmount(stop, ticker);
      if (takeable > 0) {
        output[ticker] = takeable;
      }
    }
    map.set(stop.id, output);
  }
  return map;
}

function totalsOf(
  bill: Record<string, number>,
  sizeOf: (ticker: string) => MaterialSize | undefined,
) {
  let weight = 0;
  let volume = 0;
  for (const [ticker, amount] of Object.entries(bill)) {
    const size = sizeOf(ticker);
    if (size) {
      weight += size.weight * amount;
      volume += size.volume * amount;
    }
  }
  return { weight, volume };
}

function allocateTransfers(stops: MilkRunStop[]): MilkRunTransfer[] {
  const ledger = new Map<string, number>();
  const transfers: MilkRunTransfer[] = [];

  const keyOf = (stopId: string, ticker: string) => `${stopId}\0${ticker}`;
  const remaining = (stop: MilkRunStop, ticker: string) => {
    const key = keyOf(stop.id, ticker);
    if (!ledger.has(key)) {
      ledger.set(key, takeableAmount(stop, ticker));
    }
    return ledger.get(key)!;
  };

  for (let i = 0; i < stops.length; i++) {
    const consumer = stops[i]!;
    for (const ticker of Object.keys(consumer.bill)) {
      let need = consumer.bill[ticker]!;
      for (let j = 0; j < i && need > 0; j++) {
        const source = stops[j]!;
        const avail = remaining(source, ticker);
        const take = Math.min(need, avail);
        if (take <= 0) {
          continue;
        }
        // Decrement by the amount actually taken — not pruncalc's
        // `inventory -= max(avail - need, 0)`, which strips leftover stock
        // after the need was already reduced.
        ledger.set(keyOf(source.id, ticker), avail - take);
        transfers.push({ fromId: source.id, toId: consumer.id, ticker, amount: take });
        need -= take;
      }
    }
  }
  return transfers;
}

function checkLoad(
  cargo: MilkRunCargo,
  weightLoad: number,
  volumeLoad: number,
  stopId: string | undefined,
): PeakOverflow | undefined {
  const weightOver = weightLoad - cargo.weightCapacity;
  const volumeOver = volumeLoad - cargo.volumeCapacity;
  if (weightOver <= 0 && volumeOver <= 0) {
    return undefined;
  }
  return {
    stopId,
    weightLoad,
    volumeLoad,
    weightOver: Math.max(0, weightOver),
    volumeOver: Math.max(0, volumeOver),
  };
}

export function planMilkRun(input: MilkRunInput): MilkRunResult {
  const transfers = allocateTransfers(input.stops);
  const sourced: Record<string, number> = {};
  const sourcedByConsumer = new Map<string, Record<string, number>>();
  const pickupsByStop = new Map<string, Record<string, number>>();

  for (const stop of input.stops) {
    pickupsByStop.set(stop.id, {});
    sourcedByConsumer.set(stop.id, {});
  }

  for (const transfer of transfers) {
    addToRecord(sourced, transfer.ticker, transfer.amount);
    addToRecord(sourcedByConsumer.get(transfer.toId)!, transfer.ticker, transfer.amount);
    addToRecord(pickupsByStop.get(transfer.fromId)!, transfer.ticker, transfer.amount);
  }

  let cxBill: Record<string, number> = {};
  for (const stop of input.stops) {
    cxBill = addMaterials(cxBill, stop.bill);
  }
  cxBill = subtractMaterials(cxBill, sourced);

  let weightLoad = input.cargo.weightLoad + totalsOf(cxBill, input.sizeOf).weight;
  let volumeLoad = input.cargo.volumeLoad + totalsOf(cxBill, input.sizeOf).volume;

  const overflows: PeakOverflow[] = [];
  const departure = checkLoad(input.cargo, weightLoad, volumeLoad, undefined);
  if (departure) {
    overflows.push(departure);
  }

  const outputs = outputByStop(input.stops);
  for (const stop of input.stops) {
    const unloaded = totalsOf(stop.bill, input.sizeOf);
    weightLoad -= unloaded.weight;
    volumeLoad -= unloaded.volume;
    // Full takeable surplus, not only sourcing transfers — output nothing
    // downstream bills for still occupies the hold for the rest of the route.
    const loaded = totalsOf(outputs.get(stop.id) ?? {}, input.sizeOf);
    weightLoad += loaded.weight;
    volumeLoad += loaded.volume;
    const peak = checkLoad(input.cargo, weightLoad, volumeLoad, stop.id);
    if (peak) {
      overflows.push(peak);
    }
  }

  return {
    transfers,
    sourced,
    sourcedByConsumer,
    pickupsByStop,
    firstOverflow: overflows[0],
    overflows,
    fits: overflows.length === 0,
  };
}
