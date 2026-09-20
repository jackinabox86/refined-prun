import { describe, expect, it } from 'vitest';
import { raceSkipOrReady } from './skip-or-ready';

describe('raceSkipOrReady', () => {
  it('resolves ready when the flight event wins', async () => {
    const outcome = await raceSkipOrReady(Promise.resolve(), () => undefined);
    expect(outcome).toBe('ready');
  });

  it('resolves skip when skip wins and ignores a later event', async () => {
    let skip!: () => void;
    const outcome = raceSkipOrReady(new Promise(() => undefined), bind => {
      skip = bind;
    });
    skip();
    expect(await outcome).toBe('skip');
  });
});
