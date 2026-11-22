import { describe, expect, it } from 'vitest';
import {
  FLT_ROUTE_ACTIVE_COLOR,
  FLT_ROUTE_BLOCKED_COLOR,
  FLT_ROUTE_FAILED_COLOR,
  getFltRouteIndicatorColor,
  getFltRouteLabel,
  getFltRouteProblemColor,
  getFltRouteProblemTooltip,
  isFltRouteProblem,
} from './route-indicator';

describe('XIT FLT route indicator', () => {
  it('uses the base game colors: red for BLOCKED, orange for a blocked step, green otherwise', () => {
    expect(FLT_ROUTE_FAILED_COLOR).toBe('#d9534f');
    expect(FLT_ROUTE_BLOCKED_COLOR).toBe('#f0ad4e');
    expect(FLT_ROUTE_ACTIVE_COLOR).toBe('#5cb85c');
    expect(getFltRouteIndicatorColor('BLOCKED')).toBe(FLT_ROUTE_FAILED_COLOR);
    expect(getFltRouteIndicatorColor('STEP_BLOCKED')).toBe(FLT_ROUTE_BLOCKED_COLOR);
    expect(getFltRouteIndicatorColor('FLYING')).toBe(FLT_ROUTE_ACTIVE_COLOR);
    expect(getFltRouteIndicatorColor('RUNNING_STEPS')).toBe(FLT_ROUTE_ACTIVE_COLOR);
  });

  it('shows no dot for a ship without a route execution', () => {
    expect(getFltRouteIndicatorColor(undefined)).toBeUndefined();
  });

  it('treats only BLOCKED and STEP_BLOCKED as PROBLEMS-column route problems', () => {
    expect(isFltRouteProblem('BLOCKED')).toBe(true);
    expect(isFltRouteProblem('STEP_BLOCKED')).toBe(true);
    expect(isFltRouteProblem('FLYING')).toBe(false);
    expect(isFltRouteProblem('RUNNING_STEPS')).toBe(false);
    expect(isFltRouteProblem('WAITING')).toBe(false);
    expect(isFltRouteProblem(undefined)).toBe(false);
    expect(getFltRouteProblemColor('BLOCKED')).toBe(FLT_ROUTE_FAILED_COLOR);
    expect(getFltRouteProblemColor('STEP_BLOCKED')).toBe(FLT_ROUTE_BLOCKED_COLOR);
    expect(getFltRouteProblemColor('FLYING')).toBeUndefined();
    expect(getFltRouteProblemColor('RUNNING_STEPS')).toBeUndefined();
    expect(getFltRouteProblemColor(undefined)).toBeUndefined();
  });

  it('says what the route problem is in the PROBLEMS tooltip', () => {
    const route = { naturalId: 'RT-KSRV-5070', name: 'Aceland run' } as PrunApi.ShipRoute;
    expect(getFltRouteProblemTooltip('BLOCKED', route)).toBe(
      'Route blocked: RT-KSRV-5070 Aceland run',
    );
    expect(getFltRouteProblemTooltip('STEP_BLOCKED', route)).toBe(
      'Route step blocked: RT-KSRV-5070 Aceland run',
    );
    expect(getFltRouteProblemTooltip('STEP_BLOCKED', undefined)).toBe('Route step blocked');
    expect(getFltRouteProblemTooltip('FLYING', route)).toBeUndefined();
  });

  it('labels the route the way ROUTETRACK does', () => {
    const route = { naturalId: 'RT-KSRV-5070', name: 'Aceland run' } as PrunApi.ShipRoute;
    expect(getFltRouteLabel(route)).toBe('RT-KSRV-5070 Aceland run');
    expect(getFltRouteLabel({ naturalId: 'RT-KSRV-5070', name: null } as PrunApi.ShipRoute)).toBe(
      'RT-KSRV-5070',
    );
    expect(getFltRouteLabel(undefined)).toBeUndefined();
  });
});
