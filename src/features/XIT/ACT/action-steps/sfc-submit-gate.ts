// DISPATCHACT auto-SFC submit gate. BURNACT / REPAIRACT / GOVBURNEXEC never set
// finishOnly, so they never wait here.

export const SFC_SUBMIT_STATUS = 'Submit flight on the right or skip';

export function shouldWaitForSfcSubmit(data: { finishOnly?: boolean }): boolean {
  return data.finishOnly === true;
}

export function hasShipStartedFlight(ship: { flightId: string | null } | undefined): boolean {
  return ship?.flightId != null;
}
