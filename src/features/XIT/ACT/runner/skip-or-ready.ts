export type SkipOrReady = 'skip' | 'ready';

export async function raceSkipOrReady(
  event: Promise<void>,
  bindSkip: (skip: () => void) => void,
): Promise<SkipOrReady> {
  let settleSkip!: () => void;
  const skipped = new Promise<'skip'>(resolve => {
    settleSkip = () => resolve('skip');
  });
  bindSkip(settleSkip);
  const ready = (async (): Promise<'ready'> => {
    await event;
    return 'ready';
  })();
  return await Promise.race([ready, skipped]);
}
