import * as THREE from 'three';
import { h, Teleport } from 'vue';
import {
  attachIframeRepaintWorkaround,
  createPanelShell,
  SCREEN_SCALE,
} from '@src/game-3d/buffer-panel';
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
  // Reserved for Expansion Phase 4 (action-runner log + Act/Skip). Not wired yet.
  controlSurface?: { widthPx: number; heightPx: number };
}

/** World-unit gap between adjacent screens so panel borders don't touch. */
const SCREEN_GAP = 0.2;

export function createConsole(definition: ConsoleDefinition) {
  const group = new THREE.Group();
  group.position.copy(definition.position);
  group.rotation.y = definition.rotationY;

  const screenHandles: { app: { unmount(): void }; disposeIframe: () => void }[] = [];

  const screenWidths = definition.screens.map(x => x.widthPx * SCREEN_SCALE);
  const totalWidth =
    sumBy(screenWidths, x => x) + Math.max(0, definition.screens.length - 1) * SCREEN_GAP;

  let cursorX = -totalWidth / 2;
  let maxHeightWorld = 0;

  for (let i = 0; i < definition.screens.length; i++) {
    const screen = definition.screens[i]!;
    const command = screen.command;
    const descriptor = xit.get(command);
    if (descriptor === undefined) {
      throw new Error(`Unknown XIT command in console roster: ${command}`);
    }

    const { root, targetDiv, object } = createPanelShell(screen.widthPx, screen.heightPx);
    const ScreenComponent = descriptor.component([]);
    const app = createFragmentApp(() => h(Teleport, { to: targetDiv }, [h(ScreenComponent)])).use(
      tileStatePlugin,
      { tile: `game-3d-${definition.id}-${command}` },
    );
    app.appendTo(document.body);

    const disposeIframe = attachIframeRepaintWorkaround(root, targetDiv);

    const widthWorld = screenWidths[i]!;
    object.position.set(cursorX + widthWorld / 2, 0, 0);
    cursorX += widthWorld + SCREEN_GAP;
    group.add(object);

    const heightWorld = (screen.heightPx ?? 400) * SCREEN_SCALE;
    if (heightWorld > maxHeightWorld) {
      maxHeightWorld = heightWorld;
    }

    screenHandles.push({ app, disposeIframe });
  }

  // Placeholder housing — plain panel behind the screens; real design is Expansion Phase 5.
  const housingWidth = totalWidth + 0.3;
  const housingHeight = maxHeightWorld + 0.3;
  const housing = new THREE.Mesh(
    new THREE.PlaneGeometry(housingWidth, housingHeight),
    new THREE.MeshStandardMaterial({
      color: 0x1a2332,
      emissive: definition.themeColor,
      emissiveIntensity: 0.15,
      metalness: 0.2,
      roughness: 0.8,
      side: THREE.DoubleSide,
    }),
  );
  housing.position.set(0, 0, -0.05);
  group.add(housing);

  // Invisible hitbox for raycasting — separate from housing so Phase 5 can redesign visuals.
  const hitbox = new THREE.Mesh(new THREE.BoxGeometry(housingWidth, housingHeight, 0.6));
  hitbox.visible = false;
  hitbox.position.set(0, 0, -0.05);
  hitbox.userData.consoleId = definition.id;
  group.add(hitbox);

  const dispose = () => {
    for (const handle of screenHandles) {
      handle.disposeIframe();
      handle.app.unmount();
    }
  };

  return { definition, group, hitbox, dispose };
}

export type Console = ReturnType<typeof createConsole>;
