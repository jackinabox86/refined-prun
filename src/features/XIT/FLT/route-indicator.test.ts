import { describe, expect, it } from 'vitest';
import {
  FLT_ROUTE_ACTIVE_COLOR,
  FLT_ROUTE_BLOCKED_COLOR,
  getFltRouteIndicatorColor,
} from './route-indicator';

describe('XIT FLT route indicator', () => {
  it('uses the base game colors: orange for a blocked step, green otherwise', () => {
    expect(FLT_ROUTE_BLOCKED_COLOR).toBe('#f0ad4e');
    expect(FLT_ROUTE_ACTIVE_COLOR).toBe('#5cb85c');
    expect(getFltRouteIndicatorColor('STEP_BLOCKED')).toBe(FLT_ROUTE_BLOCKED_COLOR);
    expect(getFltRouteIndicatorColor('FLYING')).toBe(FLT_ROUTE_ACTIVE_COLOR);
    expect(getFltRouteIndicatorColor('RUNNING_STEPS')).toBe(FLT_ROUTE_ACTIVE_COLOR);
  });

  it('shows no dot for a ship without a route execution', () => {
    expect(getFltRouteIndicatorColor(undefined)).toBeUndefined();
  });
});
