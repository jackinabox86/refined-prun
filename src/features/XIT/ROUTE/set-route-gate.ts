// Why SET ROUTE stays disabled. Undefined means the button is armed.

export interface SetRouteGateInput {
  staging: boolean;
  shipChosen: boolean;
  stopCount: number;
  billReady: boolean;
  legs: readonly { ok: boolean }[] | undefined;
  supplyDays: number;
  hasOverflow: boolean;
  inputOverloaded: boolean;
}

export function transitsReady(legs: readonly { ok: boolean }[] | undefined) {
  return legs !== undefined && legs.length > 0 && legs.every(x => x.ok);
}

export function supplyDaysReady(days: number) {
  return Number.isFinite(days) && days > 0;
}

export function setRouteBlock(input: SetRouteGateInput) {
  if (!input.staging) {
    return 'RT build runs on the staging host.';
  }
  if (!input.shipChosen) {
    return 'Set a ship above to build the route.';
  }
  if (input.stopCount < 2) {
    return 'Add at least two stops.';
  }
  if (!input.billReady) {
    return 'The bill is not ready.';
  }
  if (!transitsReady(input.legs)) {
    return 'Run TRANSITS first.';
  }
  if (!supplyDaysReady(input.supplyDays)) {
    return 'Set supply days.';
  }
  if (input.hasOverflow || input.inputOverloaded) {
    return 'Fix the overloaded stops.';
  }
  return undefined;
}
