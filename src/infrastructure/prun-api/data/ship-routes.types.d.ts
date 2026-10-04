declare namespace PrunApi {
  // Shapes recorded on apex staging, 2026-10-04: SHIP_ROUTES_EXECUTION(S).
  interface ShipRouteExecution {
    shipId: string;
    route: ShipRoute;
    state: ShipRouteExecutionState;
    // The waypoint the ship is flying to or working at.
    waypointIndex: number;
    // The step at that waypoint.
    stepIndex: number;
    flightId: string | null;
    // Set only for a timed step (WAITING).
    stepStartedAt: DateTime | null;
    stepEndsAt: DateTime | null;
  }

  type ShipRouteExecutionState =
    | 'PLANNING'
    | 'AWAITING_MISSION'
    | 'FLYING'
    | 'RUNNING_STEPS'
    | 'WAITING'
    | 'STEP_BLOCKED';

  interface ShipRoute {
    id: string;
    naturalId: string;
    name: string | null;
    created: DateTime;
    repeats: boolean;
    waypoints: ShipRouteWaypoint[];
  }

  interface ShipRouteWaypoint {
    id: string;
    destination: Address;
    landing: boolean;
    fuelUsageFactor: number;
    reactorUsageFactor: number;
    steps: ShipRouteStep[];
  }

  interface ShipRouteStep {
    id: string;
    // LOAD, UNLOAD, REFUEL and WAIT seen so far.
    type: string;
    // WAIT steps only. Only MINUTES has been seen.
    amount?: number;
    unit?: string;
  }
}
