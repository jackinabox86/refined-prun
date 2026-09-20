import { describe, expect, it } from 'vitest';
import { hasShipStartedFlight, SFC_SUBMIT_STATUS, shouldWaitForSfcSubmit } from './sfc-submit-gate';

describe('SFC_SUBMIT_STATUS', () => {
  it('uses DISPATCHACT sentence-case status wording', () => {
    expect(SFC_SUBMIT_STATUS).toBe('Submit flight on the right or skip');
  });
});

describe('shouldWaitForSfcSubmit', () => {
  it('waits only on DISPATCH finishOnly MTRA actions', () => {
    expect(shouldWaitForSfcSubmit({ finishOnly: true })).toBe(true);
  });

  it('does not wait when finishOnly is unset or false', () => {
    expect(shouldWaitForSfcSubmit({})).toBe(false);
    expect(shouldWaitForSfcSubmit({ finishOnly: false })).toBe(false);
  });
});

describe('hasShipStartedFlight', () => {
  it('is true once fleet status has a flight id', () => {
    expect(hasShipStartedFlight({ flightId: 'flight-1' })).toBe(true);
  });

  it('does not treat a landed or missing ship as started', () => {
    expect(hasShipStartedFlight({ flightId: null })).toBe(false);
    expect(hasShipStartedFlight(undefined)).toBe(false);
  });
});
