// One RTEXEC build phase: either its value, or the failure to show the player.
export type PhaseResult<T> = { value: T } | { error: string };

// Plain return types keep TypeScript from widening a phase's value with `undefined` the way it
// does for an object literal returned in one branch and not the other.
export function phaseOk<T>(value: T): { value: T } {
  return { value };
}

export function phaseFailed(error: string): { error: string } {
  return { error };
}

// Runs a phase until it succeeds. Each failure is handed to onFailed, which pauses the build
// (the player fixes the game and presses ACT), and then the same phase runs again. Phases
// that already succeeded are not run again.
export async function retryPhase<T>(
  run: () => Promise<PhaseResult<T>>,
  onFailed: (error: string) => Promise<void>,
): Promise<T> {
  for (;;) {
    const result = await run();
    if ('value' in result) {
      return result.value;
    }
    await onFailed(result.error);
  }
}
