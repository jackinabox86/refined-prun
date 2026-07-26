import * as THREE from 'three';
import { h, Teleport } from 'vue';
import {
  attachIframeRepaintWorkaround,
  createPanelShell,
  SCREEN_SCALE,
} from '@src/game-3d/buffer-panel';
import {
  CONTROL_SURFACE_HEIGHT_PX,
  CONTROL_SURFACE_WIDTH_PX,
  createControlSurfaceSlot,
  type ControlSurfaceSlot,
} from '@src/game-3d/control-surface';
import { createPanelHitPlane, type PanelHitTarget } from '@src/game-3d/panel-hit-test';
import { ROOM_HEIGHT } from '@src/game-3d/room';
import { tileStatePlugin } from '@src/store/user-data-tiles';

export interface ConsoleScreenDefinition {
  command: string;
  widthPx: number;
  heightPx?: number;
}

export interface ConsoleDefinition {
  id: string;
  purpose: string;
  position: THREE.Vector3;
  rotationY: number;
  themeColor: number;
  screens: ConsoleScreenDefinition[];
}

/** World-unit gap between adjacent screens so panel borders don't touch. */
const SCREEN_GAP = 0.2;

/** Screens must not visually extend below the desk (top ≈ y=-0.4); small clearance kept. */
export const SCREEN_MAX_HEIGHT_WORLD = 0.7;

type ScreenSlot =
  | { kind: 'xit'; screen: ConsoleScreenDefinition }
  | { kind: 'control'; widthPx: number; heightPx: number };

export function createConsole(definition: ConsoleDefinition) {
  const group = new THREE.Group();
  group.position.copy(definition.position);
  group.rotation.y = definition.rotationY;

  const screenHandles: {
    app?: { unmount(): void };
    disposeIframe?: () => void;
    dispose?: () => void;
  }[] = [];

  // Every console gets one dormant control-surface slot (same size); activated
  // dynamically by control-surface-router when an ACT window is opened while focused.
  const slots: ScreenSlot[] = [
    ...definition.screens.map(s => ({ kind: 'xit' as const, screen: s })),
    {
      kind: 'control' as const,
      widthPx: CONTROL_SURFACE_WIDTH_PX,
      heightPx: CONTROL_SURFACE_HEIGHT_PX,
    },
  ];

  const screenWidths = slots.map(x =>
    x.kind === 'control' ? x.widthPx * SCREEN_SCALE : x.screen.widthPx * SCREEN_SCALE,
  );
  const totalWidth = sumBy(screenWidths, x => x) + Math.max(0, slots.length - 1) * SCREEN_GAP;

  let cursorX = -totalWidth / 2;
  let maxHeightWorld = 0;
  let controlSurfaceSlot: ControlSurfaceSlot | undefined;
  const panelHitTargets: PanelHitTarget[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;

    let object: THREE.Object3D;
    let heightPx: number;
    let root: HTMLElement;
    let widthPx: number;

    if (slot.kind === 'control') {
      const panel = createControlSurfaceSlot(slot.widthPx, slot.heightPx);
      object = panel.object;
      root = panel.root;
      widthPx = slot.widthPx;
      controlSurfaceSlot = panel;
      screenHandles.push({ dispose: panel.dispose });
      heightPx = slot.heightPx;
    } else {
      const screen = slot.screen;
      const command = screen.command;
      const descriptor = xit.get(command);
      if (descriptor === undefined) {
        throw new Error(`Unknown XIT command in console roster: ${command}`);
      }

      const maxHeightPx = Math.round(SCREEN_MAX_HEIGHT_WORLD / SCREEN_SCALE);
      const {
        root: panelRoot,
        targetDiv,
        object: panelObject,
      } = createPanelShell(screen.widthPx, screen.heightPx, maxHeightPx);
      const ScreenComponent = descriptor.component([]);
      const app = createFragmentApp(() => h(Teleport, { to: targetDiv }, [h(ScreenComponent)])).use(
        tileStatePlugin,
        { tile: `game-3d-${definition.id}-${command}` },
      );
      app.appendTo(document.body);

      const disposeIframe = attachIframeRepaintWorkaround(panelRoot, targetDiv);
      object = panelObject;
      root = panelRoot;
      widthPx = screen.widthPx;
      screenHandles.push({ app, disposeIframe });
      heightPx = screen.heightPx ?? 400;
    }

    const widthWorld = screenWidths[i]!;
    object.position.set(cursorX + widthWorld / 2, 0, 0);
    cursorX += widthWorld + SCREEN_GAP;
    group.add(object);

    const heightWorld = heightPx * SCREEN_SCALE;
    const hitPlane = createPanelHitPlane(root, widthPx, heightPx, widthWorld, heightWorld);
    hitPlane.mesh.position.copy(object.position);
    group.add(hitPlane.mesh);
    panelHitTargets.push(hitPlane);

    if (heightWorld > maxHeightWorld) {
      maxHeightWorld = heightWorld;
    }
  }

  // Guaranteed by the unconditional control slot above.
  if (controlSurfaceSlot === undefined) {
    throw new Error(`createConsole(${definition.id}): missing control-surface slot`);
  }

  const housingWidth = totalWidth + 0.3;
  const housingHeight = maxHeightWorld + 0.3;
  // Matches console-roster.ts; local so we don't create a circular import.
  const CONSOLE_Y = ROOM_HEIGHT * 0.55;

  // Stops just below the screens (local Y ≈ -0.4).
  const pedestalHeight = CONSOLE_Y - 0.4;
  const pedestal = new THREE.Mesh(
    new THREE.BoxGeometry(housingWidth * 0.5, pedestalHeight, 0.3),
    new THREE.MeshStandardMaterial({
      color: 0x1a2332,
      emissive: definition.themeColor,
      emissiveIntensity: 0.12,
      metalness: 0.3,
      roughness: 0.75,
    }),
  );
  pedestal.position.set(0, -CONSOLE_Y + pedestalHeight / 2, -0.15);
  group.add(pedestal);

  const desk = new THREE.Mesh(
    new THREE.BoxGeometry(housingWidth * 0.85, 0.06, 0.45),
    new THREE.MeshStandardMaterial({
      color: 0x232f42,
      emissive: definition.themeColor,
      emissiveIntensity: 0.2,
      metalness: 0.25,
      roughness: 0.7,
    }),
  );
  desk.position.set(0, -0.42, 0.12);
  desk.rotation.x = 0.25;
  group.add(desk);

  // +0.02 avoids z-fighting with the room floor.
  const floorMarker = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 32),
    new THREE.MeshStandardMaterial({
      color: 0x111820,
      emissive: definition.themeColor,
      emissiveIntensity: 0.3,
      roughness: 0.7,
      metalness: 0.1,
    }),
  );
  floorMarker.rotation.x = -Math.PI / 2;
  floorMarker.position.set(0, -CONSOLE_Y + 0.02, 0.3);
  group.add(floorMarker);

  const accentLight = new THREE.PointLight(definition.themeColor, 0.6, 2.5);
  accentLight.position.set(0, 0.3, 0.4);
  group.add(accentLight);

  // Invisible hitbox for raycasting — separate from housing so Phase 5 can redesign visuals.
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(housingWidth, housingHeight, 0.6));
  hitbox.visible = false;
  hitbox.position.set(0, 0, -0.05);
  hitbox.userData.consoleId = definition.id;
  group.add(hitbox);

  const dispose = () => {
    for (const handle of screenHandles) {
      handle.disposeIframe?.();
      handle.app?.unmount();
      handle.dispose?.();
    }
  };

  return { definition, group, hitbox, controlSurfaceSlot, panelHitTargets, dispose };
}

export type Console = ReturnType<typeof createConsole>;
