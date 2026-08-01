import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { DualRenderer } from '@src/game-3d/Renderer';
import { buildRoom, clampToRoom, EYE_HEIGHT, ROOM_HALF } from '@src/game-3d/room';
import { buildGreebles } from '@src/game-3d/greebles';
import { createMovement } from '@src/game-3d/movement';
import { buildConsoles } from '@src/game-3d/console-roster';
import { createControlSurfaceRouter } from '@src/game-3d/control-surface-router';
import { createBufferWindowGuard } from '@src/game-3d/buffer-window-guard';
import { buildHologram, HOLOGRAM_POSITION } from '@src/game-3d/hologram';
import { createInteraction } from '@src/game-3d/interaction';
import { createModeOverlay } from '@src/game-3d/overlay';
import { createPanelRaycaster } from '@src/game-3d/panel-hit-test';
import { createTestControls } from '@src/game-3d/test-controls';
import { buildViewscreen } from '@src/game-3d/viewscreen';

export interface Game3DOptions {
  /** Overrides the default spawn pose — used by the visual-iteration sandbox's camera presets. */
  cameraPose?: { position: THREE.Vector3; lookAt: THREE.Vector3 };
}

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
  private readonly controlSurfaceRouter: ReturnType<typeof createControlSurfaceRouter>;
  private readonly consoles: ReturnType<typeof buildConsoles>['consoles'];
  private readonly panelHitTest: ReturnType<typeof createPanelRaycaster>;
  private readonly hologram: ReturnType<typeof buildHologram>;
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
    const target = this.panelHitTest.findClickTarget(e.clientX, e.clientY);
    if (target !== undefined) {
      e.preventDefault();
      if (target instanceof HTMLElement) {
        target.click();
      }
      return;
    }
    // Clicks that land on empty canvas (no panel underneath) re-lock into walk mode.
    e.preventDefault();
    this.controls.lock();
  };

  constructor(
    private readonly onClose: () => void,
    options: Game3DOptions = {},
  ) {
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 300);
    if (options.cameraPose) {
      this.camera.position.copy(options.cameraPose.position);
      this.camera.lookAt(options.cameraPose.lookAt);
    } else {
      this.camera.position.set(0, EYE_HEIGHT, 6);
    }

    this.scene.fog = new THREE.FogExp2(0x071017, 0.018);

    this.scene.add(buildRoom());
    this.scene.add(buildGreebles());
    this.hologram = buildHologram();
    this.hologram.group.position.copy(HOLOGRAM_POSITION);
    this.scene.add(this.hologram.group);
    const viewscreen = buildViewscreen();
    viewscreen.position.set(0, 1.2, -(ROOM_HALF + 45));
    this.scene.add(viewscreen);

    const { consoles, controlSurfacePanels, panelHitTargets } = buildConsoles();
    this.consoles = consoles;
    this.panelHitTest = createPanelRaycaster(this.camera, panelHitTargets);
    for (const c of this.consoles) {
      this.scene.add(c.group);
    }

    this.controls = new PointerLockControls(this.camera, this.renderer.canvas);
    this.testControls = createTestControls(this.camera, this.controls);

    this.overlay = createModeOverlay(() => {
      this.onClose();
    });
    this.interaction = createInteraction(this.camera, this.controls, this.consoles, this.overlay);
    this.controlSurfaceRouter = createControlSurfaceRouter(controlSurfacePanels, () =>
      this.interaction.getFocusedConsoleId(),
    );
    this.renderer.container.append(this.overlay.root);
  }

  start() {
    document.body.append(this.renderer.container);
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.renderer.canvas.addEventListener('click', this.onCanvasClick);
    this.movement.attach();
    this.bufferWindowGuard.attach();
    this.controlSurfaceRouter.attach();
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
    this.controlSurfaceRouter.dispose();
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
    // Gated the same way movement.ts gates its own WASD handling: only clamp while a
    // real pointer-locked walk is happening. Previously unconditional, which silently
    // overwrote every sandbox cameraPose's y (and x/z) on the very first tick — no
    // debug camera preset could ever sit above EYE_HEIGHT or outside the margin-clamped
    // bounds, since this ran regardless of whether the player had ever clicked to lock.
    if (this.controls.isLocked) {
      clampToRoom(this.camera.position);
    }
    this.interaction.update();
    this.hologram.update(this.clock.elapsedTime);
    this.renderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };
}
