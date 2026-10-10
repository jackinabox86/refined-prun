import { describe, expect, it } from 'vitest';
import { fitLimitText } from '@src/features/XIT/ROUTE/route-fit-limit';

const fixed = (amount: number) => amount.toFixed(0);

const overflow = {
  weightLoad: 0,
  volumeLoad: 0,
  weightOver: 0,
  volumeOver: 0,
  outputWeight: 0,
  outputVolume: 0,
};

describe('fitLimitText', () => {
  it('names the inputs leaving the origin', () => {
    const text = fitLimitText(
      4.2,
      { ...overflow, weightLoad: 510, weightOver: 10 },
      'NC1',
      'X',
      fixed,
    );
    expect(text).toBe('Fits 4.2d. More overfills the weight leaving NC1: inputs for the bases.');
  });

  it('splits a base pick-up into output and inputs still aboard', () => {
    const text = fitLimitText(
      7,
      { ...overflow, stopId: 'KW-688c', volumeLoad: 505, volumeOver: 5, outputVolume: 400 },
      'NC1',
      'Etherwind',
      fixed,
    );
    expect(text).toBe(
      'Fits 7.0d. More overfills the volume after pick-up at Etherwind: 400m³ picked up, 105m³ inputs.',
    );
  });
});
