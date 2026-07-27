import * as THREE from 'three';
import { createConsole, type Console, type ConsoleDefinition } from '@src/game-3d/console';
import type { ControlSurfacePanels } from '@src/game-3d/control-surface';
import type { PanelHitTarget } from '@src/game-3d/panel-hit-test';
import { ROOM_HALF, ROOM_HEIGHT } from '@src/game-3d/room';

/** Distance from the wall to a console's position along the wall's inward normal. */
const WALL_INSET = 1.3;
/** 30% shorter than the original 0.55 factor (2026-07-26 playtest feedback). */
const CONSOLE_Y = ROOM_HEIGHT * 0.55 * 0.7;

/**
 * Places a console at world (x, CONSOLE_Y, z) and rotates it to face the room
 * center (0, y, 0) — the "crew station facing the plot table" look, but spread
 * across all four walls instead of one narrow arc (2026-07-26 playtest feedback:
 * the arc read as confusing/limiting).
 */
function wallPose(x: number, z: number): Pick<ConsoleDefinition, 'position' | 'rotationY'> {
  return {
    position: new THREE.Vector3(x, CONSOLE_Y, z),
    rotationY: Math.atan2(-x, -z),
  };
}

interface RosterEntry {
  id: string;
  purpose: string;
  themeColor: number;
  screens: ConsoleDefinition['screens'];
  /** World X/Z position — see wallPose. */
  wallPosition: { x: number; z: number };
}

const WALL = ROOM_HALF - WALL_INSET;

const ROSTER: RosterEntry[] = [
  {
    id: 'inv',
    purpose: 'Inventory',
    themeColor: 0x63b3ed,
    screens: [{ command: 'INV', widthPx: 700 }],
    // -X wall.
    wallPosition: { x: -WALL, z: 0 },
  },
  {
    id: 'baseplanning',
    purpose: 'Base Planning',
    themeColor: 0x68d391,
    screens: [
      { command: 'BS', widthPx: 480 },
      { command: 'PROD', widthPx: 480 },
    ],
    // -Z wall, offset off-center so the housing clears the viewscreen window.
    wallPosition: { x: -3, z: -WALL },
  },
  {
    id: 'companyops',
    purpose: 'Company Ops',
    themeColor: 0xb794f4,
    screens: [
      { command: 'CONTS', widthPx: 480 },
      { command: 'FIN', widthPx: 420 },
    ],
    // +Z wall.
    wallPosition: { x: 0, z: WALL },
  },
  {
    id: 'flt',
    purpose: 'Fleet Ops',
    themeColor: 0xf6ad55,
    screens: [{ command: 'FLT', widthPx: 750 }],
    // +X wall.
    wallPosition: { x: WALL, z: 0 },
  },
];

export function buildConsoles(): {
  consoles: Console[];
  controlSurfacePanels: Map<string, ControlSurfacePanels>;
  panelHitTargets: PanelHitTarget[];
} {
  const controlSurfacePanels = new Map<string, ControlSurfacePanels>();
  const consoles = ROSTER.map(entry => {
    const pose = wallPose(entry.wallPosition.x, entry.wallPosition.z);
    const console = createConsole({
      id: entry.id,
      purpose: entry.purpose,
      themeColor: entry.themeColor,
      screens: entry.screens,
      ...pose,
    });
    controlSurfacePanels.set(entry.id, console.controlSurfacePanels);
    return console;
  });
  return {
    consoles,
    controlSurfacePanels,
    panelHitTargets: consoles.flatMap(c => c.panelHitTargets),
  };
}
