import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { DualRenderer } from '@src/game-3d/Renderer';
import { buildRoom, clampToRoom, EYE_HEIGHT, ROOM_HALF } from '@src/game-3d/room';
import { createMovement } from '@src/game-3d/movement';
import { createBufferWindowGuard } from '@src/game-3d/buffer-window-guard';
import { buildConsoles } from '@src/game-3d/console-roster';
import { buildHologram } from '@src/game-3d/hologram';
import { buildHangar } from '@src/game-3d/hangar';
import { createInteraction } from '@src/game-3d/interaction';
import { createModeOverlay } from '@src/game-3d/overlay';
import { createTestControls } from '@src/game-3d/test-controls';

export class Game3D {
  private readonly renderer = new DualRenderer();
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: PointerLockControls;
  private readonly movement = createMovement();
  private readonly bufferWindowGuard = createBufferWindowGuard();
  private readonly testControls: ReturnType<typeof createTestControls>;
  private readonly overlay: ReturnType<typeof createModeOverlay>;
  private readonly interaction: ReturnType<typeof createInteraction>;
  private readonly consoles = buildConsoles();
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

  constructor(private readonly onClose: () => void) {
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    this.camera.position.set(0, EYE_HEIGHT, 2);

    this.scene.add(buildRoom());
    const hologram = buildHologram();
    hologram.position.set(0, 1.4, 0);
    this.scene.add(hologram);
    const hangar = buildHangar();
    hangar.position.set(0, 0, ROOM_HALF - 0.05);
    this.scene.add(hangar);
    for (const c of this.consoles) {
      this.scene.add(c.group);
    }

    this.controls = new PointerLockControls(this.camera, this.renderer.canvas);
    this.testControls = createTestControls(this.camera, this.controls);

    this.overlay = createModeOverlay(() => {
      this.onClose();
    });
    this.interaction = createInteraction(this.camera, this.controls, this.consoles, this.overlay);
    this.renderer.container.append(this.overlay.root);
  }

  start() {
    document.body.append(this.renderer.container);
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.renderer.canvas.addEventListener('click', this.onCanvasClick);
    this.movement.attach();
    this.bufferWindowGuard.attach();
    this.testControls.attach();
    this.interaction.attach();
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
    this.bufferWindowGuard.detach();
    this.testControls.detach();
    this.interaction.detach();

    if (this.controls.isLocked) {
      this.controls.unlock();
    }
    this.controls.dispose();

    // Body-mounted bridges never auto-unmount; tear down store subscriptions.
    for (const c of this.consoles) {
      c.dispose();
    }
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
    this.interaction.update();
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
