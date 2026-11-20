import { describe, expect, it, vi } from 'vitest';
import { retryPhase } from './route-retry';

describe('retryPhase', () => {
  it('returns the value without pausing when the phase succeeds first time', async () => {
    const onFailed = vi.fn(async () => undefined);
    const value = await retryPhase(async () => ({ value: 'ROUTE-1' }), onFailed);
    expect(value).toBe('ROUTE-1');
    expect(onFailed).not.toHaveBeenCalled();
  });

  it('pauses on each failure and re-runs only that phase until it succeeds', async () => {
    const outcomes = [{ error: 'Not enough fuel' }, { error: 'Still short' }, { value: 42 }];
    const run = vi.fn(async () => outcomes.shift()!);
    const onFailed = vi.fn(async () => undefined);
    const value = await retryPhase(run, onFailed);
    expect(value).toBe(42);
    expect(run).toHaveBeenCalledTimes(3);
    expect(onFailed.mock.calls).toEqual([['Not enough fuel'], ['Still short']]);
  });

  it('waits for the pause to finish before running the phase again', async () => {
    const order: string[] = [];
    let attempts = 0;
    const value = await retryPhase(
      async () => {
        order.push(`run ${attempts}`);
        attempts++;
        return attempts === 1 ? { error: 'boom' } : { value: 'ok' };
      },
      async error => {
        order.push(`pause ${error}`);
      },
    );
    expect(value).toBe('ok');
    expect(order).toEqual(['run 0', 'pause boom', 'run 1']);
  });
});
