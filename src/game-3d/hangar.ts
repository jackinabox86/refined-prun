import * as THREE from 'three';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { ROOM_HALF } from '@src/game-3d/room';

// Ship has no type/class field; size placeholders off real cargo-hold capacity.
const DEFAULT_CAPACITY = 500;
const SHIP_MIN_LENGTH = 0.35;
const SHIP_MAX_LENGTH = 1.1;
const SHIP_GAP = 0.25;
const ROW_DEPTH = 0.9;
const WALL_MARGIN = 0.6;
// Half of eye height so ships sit in a natural glance-down band, not on the floor.
const HANGAR_DISPLAY_HEIGHT = 0.8;

const HULL_COLOR = 0x718096;
const BRIDGE_COLOR = 0x4a5568;

function spaceMaterial<T extends THREE.Material>(material: T): T {
  (material as T & { fog: boolean }).fog = false;
  return material;
}

/** Hull + bridge placeholder mesh; length drives overall scale. */
export function buildShipMesh(
  length: number,
  hullMaterial: THREE.Material,
  bridgeMaterial: THREE.Material,
): THREE.Group {
  const width = length * 0.32;
  const height = length * 0.22;

  const shipGroup = new THREE.Group();

  const hull = new THREE.Mesh(new THREE.BoxGeometry(width, height, length * 0.74), hullMaterial);
  hull.position.z = -length * 0.06;
  shipGroup.add(hull);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.52, length * 0.26, 4, 1),
    hullMaterial,
  );
  nose.rotation.y = Math.PI / 4;
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -length * 0.5;
  shipGroup.add(nose);

  const bridgeH = height * 0.6;
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.5, bridgeH, length * 0.25),
    bridgeMaterial,
  );
  bridge.position.set(0, height * 0.5 + bridgeH / 2, length * 0.25);
  shipGroup.add(bridge);

  const wingGeometry = new THREE.BoxGeometry(width * 1.45, height * 0.16, length * 0.24);
  const wingLeft = new THREE.Mesh(wingGeometry, hullMaterial);
  wingLeft.position.set(-width * 0.58, -height * 0.08, length * 0.04);
  wingLeft.rotation.z = -0.18;
  shipGroup.add(wingLeft);

  const wingRight = wingLeft.clone();
  wingRight.position.x *= -1;
  wingRight.rotation.z *= -1;
  shipGroup.add(wingRight);

  const engineMaterial = spaceMaterial(
    new THREE.MeshBasicMaterial({
      color: 0xb8fbff,
      transparent: true,
      opacity: 0.96,
    }),
  );
  const engineGeometry = new THREE.CylinderGeometry(width * 0.09, width * 0.12, length * 0.08, 10);
  for (const x of [-width * 0.24, width * 0.24]) {
    const engine = new THREE.Mesh(engineGeometry, engineMaterial);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(x, -height * 0.04, length * 0.37);
    shipGroup.add(engine);
  }

  const runningLightMaterial = spaceMaterial(
    new THREE.MeshBasicMaterial({
      color: 0x63e8ff,
      transparent: true,
      opacity: 0.9,
    }),
  );
  const runningLightGeometry = new THREE.BoxGeometry(width * 0.06, height * 0.08, length * 0.46);
  for (const x of [-width * 0.47, width * 0.47]) {
    const runningLight = new THREE.Mesh(runningLightGeometry, runningLightMaterial);
    runningLight.position.set(x, height * 0.16, -length * 0.08);
    shipGroup.add(runningLight);
  }

  const finGeometry = new THREE.BoxGeometry(width * 0.08, height * 0.7, length * 0.16);
  for (const x of [-width * 0.34, width * 0.34]) {
    const fin = new THREE.Mesh(finGeometry, bridgeMaterial);
    fin.position.set(x, height * 0.22, length * 0.36);
    fin.rotation.z = x < 0 ? -0.18 : 0.18;
    shipGroup.add(fin);
  }

  return shipGroup;
}

/**
 * One-shot snapshot of the player's ships as stylized placeholder meshes.
 * Not reactive — ship roster does not need live updates for this spike.
 * shipsStore is inherently scoped to the player's own company (same source the real
 * 2D FLT screen uses) — the API never sends other companies' ship data to this client,
 * so there's no "show fleet-mates' ships too" option to add.
 */
export function buildHangar(): THREE.Group {
  const group = new THREE.Group();

  const ships = shipsStore.all.value;
  if (ships === undefined || ships.length === 0) {
    return group;
  }

  const warehouses = warehousesStore.all.value;

  const capacities = ships.map(ship => {
    const warehouse =
      warehouses === undefined ? undefined : warehouses.find(x => x.storeId === ship.idShipStore);
    return warehouse === undefined ? DEFAULT_CAPACITY : warehouse.volumeCapacity;
  });

  let minCap = Infinity;
  let maxCap = -Infinity;
  for (const cap of capacities) {
    if (cap < minCap) {
      minCap = cap;
    }
    if (cap > maxCap) {
      maxCap = cap;
    }
  }
  const capRange = maxCap - minCap;

  const hullMaterial = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: HULL_COLOR,
      roughness: 0.75,
      metalness: 0.15,
    }),
  );
  const bridgeMaterial = spaceMaterial(
    new THREE.MeshStandardMaterial({
      color: BRIDGE_COLOR,
      roughness: 0.8,
      metalness: 0.1,
    }),
  );

  type ShipLayout = {
    mesh: THREE.Group;
    width: number;
    height: number;
  };

  const layouts: ShipLayout[] = [];
  for (let i = 0; i < ships.length; i++) {
    const capacity = capacities[i];
    // Flat mid-range length when all capacities match (avoids divide-by-zero).
    const t = capRange === 0 ? 0.5 : (capacity - minCap) / capRange;
    const length = SHIP_MIN_LENGTH + t * (SHIP_MAX_LENGTH - SHIP_MIN_LENGTH);
    const width = length * 0.32;
    const height = length * 0.22;
    const shipGroup = buildShipMesh(length, hullMaterial, bridgeMaterial);
    layouts.push({ mesh: shipGroup, width, height });
  }

  // Pack into rows so the line never overflows the +Z wall's usable width.
  const usableWidth = ROOM_HALF * 2 - WALL_MARGIN * 2;
  const rows: ShipLayout[][] = [];
  let currentRow: ShipLayout[] = [];
  let currentRowWidth = 0;

  for (const layout of layouts) {
    const nextWidth =
      currentRow.length === 0 ? layout.width : currentRowWidth + SHIP_GAP + layout.width;
    if (currentRow.length > 0 && nextWidth > usableWidth) {
      rows.push(currentRow);
      currentRow = [];
      currentRowWidth = 0;
    }
    currentRow.push(layout);
    currentRowWidth =
      currentRow.length === 1 ? layout.width : currentRowWidth + SHIP_GAP + layout.width;
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    let rowWidth = 0;
    for (let i = 0; i < row.length; i++) {
      rowWidth += row[i].width;
      if (i > 0) {
        rowWidth += SHIP_GAP;
      }
    }
    let x = -rowWidth / 2;
    for (const layout of row) {
      layout.mesh.position.set(
        x + layout.width / 2,
        HANGAR_DISPLAY_HEIGHT + layout.height / 2,
        -rowIndex * ROW_DEPTH,
      );
      group.add(layout.mesh);
      x += layout.width + SHIP_GAP;
    }
  }

  return group;
}
