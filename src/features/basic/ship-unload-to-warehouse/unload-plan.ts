interface CargoMaterial {
  ticker: string;
  weight: number;
  volume: number;
}

interface CargoStore {
  items: {
    quantity?: {
      material: CargoMaterial;
      amount: number;
    } | null;
  }[];
}

interface StoreCapacity {
  weightCapacity: number;
  weightLoad: number;
  volumeCapacity: number;
  volumeLoad: number;
}

export interface CargoAmount extends CargoMaterial {
  amount: number;
}

interface Eligibility {
  shiftKey: boolean;
  landedAtPlanet: boolean;
  hasBaseStore: boolean;
  hasWarehouseStore: boolean;
  hasCargo: boolean;
  inProgress: boolean;
}

export function isUnloadTransferEligible(eligibility: Eligibility) {
  return (
    eligibility.shiftKey &&
    eligibility.landedAtPlanet &&
    eligibility.hasBaseStore &&
    eligibility.hasWarehouseStore &&
    eligibility.hasCargo &&
    !eligibility.inProgress
  );
}

export function getCargoSnapshot(store?: CargoStore) {
  const cargo = new Map<string, CargoAmount>();
  for (const item of store?.items ?? []) {
    const quantity = item.quantity;
    if (quantity === null || quantity === undefined || quantity.amount <= 0) {
      continue;
    }
    const current = cargo.get(quantity.material.ticker);
    cargo.set(quantity.material.ticker, {
      ticker: quantity.material.ticker,
      weight: quantity.material.weight,
      volume: quantity.material.volume,
      amount: (current?.amount ?? 0) + quantity.amount,
    });
  }
  return Array.from(cargo.values());
}

export function getUnloadedCargo(before: CargoAmount[], after: CargoAmount[]) {
  const afterAmounts = new Map(after.map(x => [x.ticker, x.amount]));
  return before
    .map(x => ({ ...x, amount: x.amount - (afterAmounts.get(x.ticker) ?? 0) }))
    .filter(x => x.amount > 0);
}

export function storeContainsCargo(store: CargoStore | undefined, cargo: CargoAmount[]) {
  const available = new Map(getCargoSnapshot(store).map(x => [x.ticker, x.amount]));
  return cargo.every(x => (available.get(x.ticker) ?? 0) >= x.amount);
}

export function cargoFitsStore(store: StoreCapacity, cargo: CargoAmount[]) {
  const epsilon = 0.000001;
  const weight = sumBy(cargo, x => x.amount * x.weight);
  const volume = sumBy(cargo, x => x.amount * x.volume);
  return (
    weight <= store.weightCapacity - store.weightLoad + epsilon &&
    volume <= store.volumeCapacity - store.volumeLoad + epsilon
  );
}
