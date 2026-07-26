import * as THREE from 'three';
import { createConsole, type Console, type ConsoleDefinition } from '@src/game-3d/console';
import { ROOM_HEIGHT } from '@src/game-3d/room';

/** Freestanding arc radius — clears hologram (~1.2) and hangar (+Z wall). */
const ARC_RADIUS = 3.0;
/** Total arc span in degrees, centered on the -Z (front-center) direction. */
const ARC_SPAN_DEG = 140;
const CONSOLE_Y = ROOM_HEIGHT * 0.55;

/**
 * Arc angle θ is measured clockwise from -Z.
 * position = (r·sin θ, y, −r·cos θ), rotationY = −θ.
 */
function arcPose(angleDeg: number): Pick<ConsoleDefinition, 'position' | 'rotationY'> {
  const theta = THREE.MathUtils.degToRad(angleDeg);
  return {
    position: new THREE.Vector3(
      ARC_RADIUS * Math.sin(theta),
      CONSOLE_Y,
      -ARC_RADIUS * Math.cos(theta),
    ),
    rotationY: -theta,
  };
}

/** Evenly space N consoles across the 140° arc, centered at 0°. */
function arcAngles(count: number): number[] {
  if (count <= 1) {
    return [0];
  }
  const half = ARC_SPAN_DEG / 2;
  const step = ARC_SPAN_DEG / (count - 1);
  return Array.from({ length: count }, (_, i) => -half + i * step);
}

interface RosterEntry {
  id: string;
  purpose: string;
  themeColor: number;
  screens: ConsoleDefinition['screens'];
  controlSurface?: ConsoleDefinition['controlSurface'];
}

const ROSTER: RosterEntry[] = [
  {
    id: 'inv',
    purpose: 'Inventory',
    themeColor: 0x63b3ed,
    screens: [{ command: 'INV', widthPx: 700 }],
  },
  {
    id: 'baseplanning',
    purpose: 'Base Planning',
    themeColor: 0x68d391,
    screens: [
      { command: 'BS', widthPx: 480 },
      { command: 'PROD', widthPx: 480 },
    ],
  },
  {
    id: 'companyops',
    purpose: 'Company Ops',
    themeColor: 0xb794f4,
    screens: [
      { command: 'CONTS', widthPx: 480 },
      { command: 'FIN', widthPx: 420 },
    ],
  },
  {
    id: 'flt',
    purpose: 'Fleet Ops',
    themeColor: 0xf6ad55,
    screens: [{ command: 'FLT', widthPx: 750 }],
    // Real fleet action, triggered for real from FLT.vue's Fuel-column header button —
    // no longer a semantic mismatch the way it was parked on baseplanning (Phase 7).
    // heightPx is required here (unlike the xit-registry screens above): the reparented
    // native window DOM relies on percentage-height ancestors that collapse to 0 against
    // createPanelShell's 'auto'-height targetDiv when heightPx is omitted.
    controlSurface: { command: 'XIT REFUELACT', widthPx: 900, heightPx: 420 },
  },
];

export function buildConsoles(): Console[] {
  const angles = arcAngles(ROSTER.length);
  return ROSTER.map((entry, i) => {
    const pose = arcPose(angles[i]!);
    return createConsole({
      id: entry.id,
      purpose: entry.purpose,
      themeColor: entry.themeColor,
      screens: entry.screens,
      controlSurface: entry.controlSurface,
      ...pose,
    });
  });
}
