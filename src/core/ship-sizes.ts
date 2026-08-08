export interface ShipSize {
  label: string;
  weight: number;
  volume: number;
}

// Cargo hold sizes of the common freighter configurations, smallest first.
// Labels double as the persisted key for per-planet pickup picks, so renaming
// one silently drops the planets that already point at it.
export const shipSizes: ShipSize[] = [
  { label: '500/500', weight: 500, volume: 500 },
  { label: '1k/3k', weight: 1000, volume: 3000 },
  { label: '2k/2k', weight: 2000, volume: 2000 },
  { label: '3k/1k', weight: 3000, volume: 1000 },
  { label: '5k/5k', weight: 5000, volume: 5000 },
];

export function getShipSize(label: string | undefined) {
  if (label === undefined) {
    return undefined;
  }
  return shipSizes.find(x => x.label === label);
}
