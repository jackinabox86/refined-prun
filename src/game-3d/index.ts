import { Game3D } from '@src/game-3d/Game3D';

let instance: Game3D | undefined;

/**
 * Toggles the fullscreen three.js 3D spike. Idempotent: first call opens,
 * subsequent call (or in-scene EXIT) tears down cleanly.
 */
export function launchGame3D() {
  if (instance !== undefined) {
    instance.dispose();
    instance = undefined;
    return;
  }

  instance = new Game3D(() => {
    if (instance === undefined) {
      return;
    }
    instance.dispose();
    instance = undefined;
  });
  instance.start();
}
