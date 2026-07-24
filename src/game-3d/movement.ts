import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const MOVE_SPEED = 4.5;

type KeyState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
};

export function createMovement() {
  const keys: KeyState = {
    forward: false,
    back: false,
    left: false,
    right: false,
  };

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
  };

  const update = (controls: PointerLockControls, dt: number) => {
    if (!controls.isLocked) {
      return;
    }

    const distance = MOVE_SPEED * dt;
    if (keys.forward) {
      controls.moveForward(distance);
    }
    if (keys.back) {
      controls.moveForward(-distance);
    }
    if (keys.left) {
      controls.moveRight(-distance);
    }
    if (keys.right) {
      controls.moveRight(distance);
    }
  };

  return { attach, detach, update };
}
