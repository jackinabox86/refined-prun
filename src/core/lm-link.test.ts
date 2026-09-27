import { describe, expect, it } from 'vitest';
import { lmBufferCommand, lmLinkNaturalId } from './lm-link';

describe('lmBufferCommand', () => {
  it('opens LM with the location natural id', () => {
    expect(lmBufferCommand('OT-580b')).toBe('LM OT-580b');
    expect(lmBufferCommand('HRT')).toBe('LM HRT');
  });
});

describe('lmLinkNaturalId', () => {
  it('links a station even before any planet lookup', () => {
    expect(
      lmLinkNaturalId({
        inFlight: false,
        kind: 'station',
        naturalId: 'HRT',
        planetHasLocalMarket: undefined,
      }),
    ).toBe('HRT');
  });

  it('links a planet that has a local market', () => {
    expect(
      lmLinkNaturalId({
        inFlight: false,
        kind: 'planet',
        naturalId: 'OT-580b',
        planetHasLocalMarket: true,
      }),
    ).toBe('OT-580b');
  });

  it('hides the link in flight, without a market, or before the lookup resolves', () => {
    expect(
      lmLinkNaturalId({
        inFlight: true,
        kind: 'station',
        naturalId: 'HRT',
        planetHasLocalMarket: true,
      }),
    ).toBeUndefined();
    expect(
      lmLinkNaturalId({
        inFlight: false,
        kind: 'planet',
        naturalId: 'OT-580b',
        planetHasLocalMarket: false,
      }),
    ).toBeUndefined();
    expect(
      lmLinkNaturalId({
        inFlight: false,
        kind: 'planet',
        naturalId: 'OT-580b',
        planetHasLocalMarket: undefined,
      }),
    ).toBeUndefined();
    expect(
      lmLinkNaturalId({
        inFlight: false,
        kind: undefined,
        naturalId: undefined,
        planetHasLocalMarket: true,
      }),
    ).toBeUndefined();
  });
});
