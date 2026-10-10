import type { PeakOverflow } from '@src/features/XIT/ACT/material-groups/resupply/milk-run';

// Names the load that stops FIT one step short: the inputs leaving the origin,
// or the hold after a base's pick-up, split into what was picked up so far and
// the inputs still aboard.
export function fitLimitText(
  days: number,
  overflow: PeakOverflow,
  originLabel: string,
  stopLabel: string | undefined,
  format: (amount: number) => string,
) {
  const weight = overflow.weightOver > 0;
  const volume = overflow.volumeOver > 0;
  const measure = weight && volume ? 'weight and volume' : weight ? 'weight' : 'volume';
  const head = `Fits ${days.toFixed(1)}d. More overfills the ${measure}`;
  if (overflow.stopId === undefined) {
    return `${head} leaving ${originLabel}: inputs for the bases.`;
  }
  const amount = (load: number, output: number, unit: string) =>
    `${format(output)}${unit} picked up, ${format(Math.max(0, load - output))}${unit} inputs`;
  const parts: string[] = [];
  if (weight) {
    parts.push(amount(overflow.weightLoad, overflow.outputWeight, 't'));
  }
  if (volume) {
    parts.push(amount(overflow.volumeLoad, overflow.outputVolume, 'm³'));
  }
  return `${head} after pick-up at ${stopLabel ?? overflow.stopId}: ${parts.join('; ')}.`;
}
