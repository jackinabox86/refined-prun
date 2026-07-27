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
  createControlSurfacePanels,
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

/** World-unit gap between adjacent screens/panels so borders don't touch. */
const SCREEN_GAP = 0.2;

/** Screens must not visually extend below the desk (top ≈ y=-0.4); small clearance kept. */
export const SCREEN_MAX_HEIGHT_WORLD = 0.7;

/** Matches the desk mesh's own rotation.x below — the control panels tilt the same way. */
const DESK_TILT = 0.25;
const DESK_POSITION = new THREE.Vector3(0, -0.42, 0.12);
/**
 * Top edge of the control-panel row, local Y — just below SCREEN_MAX_HEIGHT_WORLD's
 * lowest possible screen bottom (-0.35) so a tall screen and a control panel never
 * overlap regardless of that screen's actual rendered height.
 */
const CONTROL_ROW_TOP = -0.45;
/** Local Z of the control-panel row — level with the desk, forward of the pedestal. */
const CONTROL_ROW_Z = 0.2;

export function createConsole(definition: ConsoleDefinition) {
  const group = new THREE.Group();
  group.position.copy(definition.position);
  group.rotation.y = definition.rotationY;

  const screenHandles: {
    app?: { unmount(): void };
    disposeIframe?: () => void;
    dispose?: () => void;
  }[] = [];
  const panelHitTargets: PanelHitTarget[] = [];

  // ---- Top row: this console's buffer screens, centered above the desk. ----
  const screenWidths = definition.screens.map(s => s.widthPx * SCREEN_SCALE);
  const topRowWidth =
    sumBy(screenWidths, x => x) + Math.max(0, definition.screens.length - 1) * SCREEN_GAP;

  let cursorX = -topRowWidth / 2;
  let maxHeightWorld = 0;

  for (let i = 0; i < definition.screens.length; i++) {
    const screen = definition.screens[i]!;
    const command = screen.command;
    const descriptor = xit.get(command);
    if (descriptor === undefined) {
      throw new Error(`Unknown XIT command in console roster: ${command}`);
    }

    const maxHeightPx = Math.round(SCREEN_MAX_HEIGHT_WORLD / SCREEN_SCALE);
    const { root, targetDiv, object } = createPanelShell(
      screen.widthPx,
      screen.heightPx,
      maxHeightPx,
    );
    const ScreenComponent = descriptor.component([]);
    const app = createFragmentApp(() => h(Teleport, { to: targetDiv }, [h(ScreenComponent)])).use(
      tileStatePlugin,
      { tile: `game-3d-${definition.id}-${command}` },
    );
    app.appendTo(document.body);
    const disposeIframe = attachIframeRepaintWorkaround(root, targetDiv);
    screenHandles.push({ app, disposeIframe });

    const widthWorld = screenWidths[i]!;
    object.position.set(cursorX + widthWorld / 2, 0, 0);
    cursorX += widthWorld + SCREEN_GAP;
    group.add(object);

    const heightPx = screen.heightPx ?? 400;
    const heightWorld = heightPx * SCREEN_SCALE;
    const hitPlane = createPanelHitPlane(root, screen.widthPx, heightPx, widthWorld, heightWorld);
    hitPlane.mesh.position.copy(object.position);
    group.add(hitPlane.mesh);
    panelHitTargets.push(hitPlane);

    if (heightWorld > maxHeightWorld) {
      maxHeightWorld = heightWorld;
    }
  }

  const controlSurfacePanels = createControlSurfacePanels(definition.themeColor);
  const controlPanelWidthWorld = CONTROL_SURFACE_WIDTH_PX * SCREEN_SCALE;
  const controlRowWidth = 2 * controlPanelWidthWorld + SCREEN_GAP;
  const housingWidth = Math.max(topRowWidth, controlRowWidth) + 0.3;
  const housingHeight = maxHeightWorld + 0.3;
  // Matches console-roster.ts; local so we don't create a circular import.
  const CONSOLE_Y = ROOM_HEIGHT * 0.55 * 0.7;

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
  desk.position.copy(DESK_POSITION);
  desk.rotation.x = DESK_TILT;
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

  // ---- Desk row: two control-surface panels for the split ExecuteActionPackage window
  // (Node.child primary + companion buffer) — tilted like the desk, positioned by their
  // own top edge (CONTROL_ROW_TOP) so resizing CONTROL_SURFACE_HEIGHT_PX can never push
  // them up into the screen row above, whatever a given screen's actual rendered height
  // turns out to be. Bottom edge (CONTROL_ROW_TOP - height) must clear the floor at
  // local y=-CONSOLE_Y; true for both today's CONSOLE_Y and CONTROL_SURFACE_HEIGHT_PX,
  // re-check by hand if either changes.
  const controlPanelHeightWorld = CONTROL_SURFACE_HEIGHT_PX * SCREEN_SCALE;
  const controlRowCenterY = CONTROL_ROW_TOP - (controlPanelHeightWorld / 2) * Math.cos(DESK_TILT);
  const controlOffsetX = controlPanelWidthWorld / 2 + SCREEN_GAP / 2;

  for (const { slot, position } of [
    {
      slot: controlSurfacePanels.primary,
      position: new THREE.Vector3(-controlOffsetX, controlRowCenterY, CONTROL_ROW_Z),
    },
    {
      slot: controlSurfacePanels.companion,
      position: new THREE.Vector3(controlOffsetX, controlRowCenterY, CONTROL_ROW_Z),
    },
  ]) {
    slot.object.position.copy(position);
    slot.object.rotation.x = DESK_TILT;
    group.add(slot.object);
    screenHandles.push({ dispose: slot.dispose });

    const hitPlane = createPanelHitPlane(
      slot.root,
      CONTROL_SURFACE_WIDTH_PX,
      CONTROL_SURFACE_HEIGHT_PX,
      controlPanelWidthWorld,
      controlPanelHeightWorld,
    );
    hitPlane.mesh.position.copy(position);
    hitPlane.mesh.rotation.x = DESK_TILT;
    group.add(hitPlane.mesh);
    panelHitTargets.push(hitPlane);
  }

  // Invisible hitbox for raycasting — separate from housing so visual redesigns never
  // touch interaction code.
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

  return { definition, group, hitbox, controlSurfacePanels, panelHitTargets, dispose };
}

export type Console = ReturnType<typeof createConsole>;
