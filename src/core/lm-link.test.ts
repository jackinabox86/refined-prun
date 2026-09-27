import { describe, expect, it } from 'vitest';
import { lmBufferCommand, lmLinkNaturalId, PlanetLocalMarket } from './lm-link';

describe('lmBufferCommand', () => {
  it('opens LM with the location natural id', () => {
    expect(lmBufferCommand('OT-580b')).toBe('LM OT-580b');
    expect(lmBufferCommand('HRT')).toBe('LM HRT');
  });
});

describe('lmLinkNaturalId', () => {
  const planet = (planetLocalMarket: PlanetLocalMarket) =>
    lmLinkNaturalId({
      inFlight: false,
      kind: 'planet',
      naturalId: 'OT-580b',
      planetLocalMarket,
    });

  it('links a station without waiting for any lookup', () => {
    expect(
      lmLinkNaturalId({
        inFlight: false,
        kind: 'station',
        naturalId: 'HRT',
        planetLocalMarket: 'loading',
      }),
    ).toBe('HRT');
  });

  it('links a planet that has a local market', () => {
    expect(planet(true)).toBe('OT-580b');
  });

  it('hides a planet that has no local market', () => {
    expect(planet(false)).toBeUndefined();
  });

  it('hides a planet while the lookup is still in flight', () => {
    expect(planet('loading')).toBeUndefined();
  });

  // Regression: a FIO outage used to hide the link on every planet. LM shows its
  // own "no local market" message, so an unanswerable lookup must fail open.
  it('links a planet when the lookup could not answer', () => {
    expect(planet('unavailable')).toBe('OT-580b');
  });

  it('hides the link in flight and with no resolved location', () => {
    expect(
      lmLinkNaturalId({
        inFlight: true,
        kind: 'station',
        naturalId: 'HRT',
        planetLocalMarket: true,
      }),
    ).toBeUndefined();
    expect(
      lmLinkNaturalId({
        inFlight: false,
        kind: undefined,
        naturalId: undefined,
        planetLocalMarket: true,
      }),
    ).toBeUndefined();
  });
});
