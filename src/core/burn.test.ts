import { describe, expect, it } from 'vitest';
import { clampNearZeroDailyAmount } from '@src/core/burn';

// Reproduces the daysLeft formula both calculatePlanetBurn and the XIT BURN "Overall"
// row use, so the assertions below are about the number a player actually sees.
function daysLeft(dailyAmount: number, remaining: number) {
  return dailyAmount >= 0 ? Number.POSITIVE_INFINITY : remaining / -dailyAmount;
}

describe('clampNearZeroDailyAmount', () => {
  it('snaps the residue left by exactly cancelling production and consumption', () => {
    // 0.1 + 0.2 does not equal 0.3 in binary floating point.
    const residue = 0.3 - (0.1 + 0.2);
    expect(residue).toBe(-5.551115123125783e-17);
    expect(clampNearZeroDailyAmount(residue)).toBe(0);
  });

  it('turns a residue-sized net rate with no stock into infinite days, not zero', () => {
    const residue = 0.3 - (0.1 + 0.2);
    expect(daysLeft(residue, 0)).toBe(0);
    expect(daysLeft(clampNearZeroDailyAmount(residue), 0)).toBe(Number.POSITIVE_INFINITY);
  });

  it('clamps a residue that survives summing components across planets', () => {
    // What the Overall row builds: one planet producing, another consuming.
    const output = 0.3;
    const workforce = 0.1 + 0.2;
    expect(clampNearZeroDailyAmount(output - 0 - workforce)).toBe(0);
  });

  it('leaves a real burn rate untouched', () => {
    expect(clampNearZeroDailyAmount(-12.5)).toBe(-12.5);
    expect(clampNearZeroDailyAmount(4)).toBe(4);
    expect(daysLeft(clampNearZeroDailyAmount(-12.5), 250)).toBe(20);
  });

  it('does not clamp rates at or beyond the threshold', () => {
    expect(clampNearZeroDailyAmount(-0.01)).toBe(-0.01);
    expect(clampNearZeroDailyAmount(0.01)).toBe(0.01);
    expect(clampNearZeroDailyAmount(-0.011)).toBe(-0.011);
  });

  it('passes zero and infinity through unchanged', () => {
    expect(clampNearZeroDailyAmount(0)).toBe(0);
    expect(clampNearZeroDailyAmount(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(clampNearZeroDailyAmount(Number.NEGATIVE_INFINITY)).toBe(Number.NEGATIVE_INFINITY);
  });
});
