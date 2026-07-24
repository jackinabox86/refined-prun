import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { DualRenderer } from '@src/game-3d/Renderer';
import { buildRoom, clampToRoom, EYE_HEIGHT } from '@src/game-3d/room';
import { createMovement } from '@src/game-3d/movement';
import { createBufferPanel } from '@src/game-3d/buffer-panel';
import { createModeOverlay } from '@src/game-3d/overlay';

export class Game3D {
  private readonly renderer = new DualRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: PointerLockControls;
  private readonly movement = createMovement();
  private readonly overlay: ReturnType<typeof createModeOverlay>;
  private readonly bufferPanel: ReturnType<typeof createBufferPanel>;
  private readonly clock = new THREE.Clock();
  private rafId = 0;
  private disposed = false;

  private readonly onResize = () => {
    this.resize();
  };

  private readonly onCanvasClick = (e: MouseEvent) => {
    if (this.controls.isLocked) {
      return;
    }
    // Clicks that land on the CSS3D panel never reach the canvas.
    e.preventDefault();
    this.controls.lock();
  };

  private readonly onLock = () => {
    this.overlay.setMode('walk');
  };

  private readonly onUnlock = () => {
    this.overlay.setMode('interact');
  };

  constructor(private readonly onClose: () => void) {
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    this.camera.position.set(0, EYE_HEIGHT, 2);

    this.scene.add(buildRoom());
    this.bufferPanel = createBufferPanel();
    this.scene.add(this.bufferPanel.object);

    this.controls = new PointerLockControls(this.camera, this.renderer.canvas);
    this.controls.addEventListener('lock', this.onLock);
    this.controls.addEventListener('unlock', this.onUnlock);

    this.overlay = createModeOverlay(() => {
      this.onClose();
    });
    this.renderer.container.append(this.overlay.root);
  }

  start() {
    document.body.append(this.renderer.container);
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.renderer.canvas.addEventListener('click', this.onCanvasClick);
    this.movement.attach();
    this.clock.start();
    this.tick();
  }

  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.canvas.removeEventListener('click', this.onCanvasClick);
    this.movement.detach();

    this.controls.removeEventListener('lock', this.onLock);
    this.controls.removeEventListener('unlock', this.onUnlock);
    if (this.controls.isLocked) {
      this.controls.unlock();
    }
    this.controls.dispose();

    // Body-mounted bridge never auto-unmounts; tear down store subscriptions.
    this.bufferPanel.app.unmount();
    this.renderer.dispose();
  }

  private resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private tick = () => {
    if (this.disposed) {
      return;
    }

    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.movement.update(this.controls, dt);
    clampToRoom(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
