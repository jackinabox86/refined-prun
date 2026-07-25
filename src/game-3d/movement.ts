import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const MOVE_SPEED = 4.5;
// Ramp up deliberately; stop snappier so release feels responsive.
const ACCEL = 18;
const DECEL = 24;

type KeyState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
};

function approach(current: number, target: number, dt: number) {
  const rate = target === 0 ? DECEL : ACCEL;
  const maxDelta = rate * dt;
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) {
    return target;
  }
  return current + Math.sign(delta) * maxDelta;
}

function axisFromKeys(positive: boolean, negative: boolean) {
  if (positive === negative) {
    return 0;
  }
  return positive ? 1 : -1;
}

export function createMovement() {
  const keys: KeyState = {
    forward: false,
    back: false,
    left: false,
    right: false,
  };

  let velocityForward = 0;
  let velocityRight = 0;

  const setKey = (code: string, pressed: boolean) => {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        keys.forward = pressed;
        break;
      case 'KeyS':
      case 'ArrowDown':
        keys.back = pressed;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        keys.left = pressed;
        break;
      case 'KeyD':
      case 'ArrowRight':
        keys.right = pressed;
        break;
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    setKey(e.code, true);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    setKey(e.code, false);
  };

  const attach = () => {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
  };

  const detach = () => {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    keys.forward = false;
    keys.back = false;
    keys.left = false;
    keys.right = false;
    velocityForward = 0;
    velocityRight = 0;
  };

  const update = (controls: PointerLockControls, dt: number) => {
    if (!controls.isLocked) {
      velocityForward = approach(velocityForward, 0, dt);
      velocityRight = approach(velocityRight, 0, dt);
      return;
    }

    const targetForward = axisFromKeys(keys.forward, keys.back) * MOVE_SPEED;
    const targetRight = axisFromKeys(keys.right, keys.left) * MOVE_SPEED;
    velocityForward = approach(velocityForward, targetForward, dt);
    velocityRight = approach(velocityRight, targetRight, dt);

    controls.moveForward(velocityForward * dt);
    controls.moveRight(velocityRight * dt);
  };

  return { attach, detach, update };
}
