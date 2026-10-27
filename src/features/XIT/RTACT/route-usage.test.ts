import { describe, expect, it } from 'vitest';
import { routeUsagePercent } from './route-usage';

const routeSlider = { min: 1, max: 100, step: 1 };

describe('routeUsagePercent', () => {
  it('maps the test-flight fuel fraction onto the route percent slider', () => {
    expect(routeUsagePercent(0.05, routeSlider)).toBe(5);
  });

  it('maps a reactor fraction and clamps to the route slider', () => {
    expect(routeUsagePercent(0.651, routeSlider)).toBe(65);
    expect(routeUsagePercent(0, routeSlider)).toBe(1);
    expect(routeUsagePercent(1.5, routeSlider)).toBe(100);
  });
});
