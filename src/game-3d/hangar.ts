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

const HULL_COLOR = 0x718096;
const BRIDGE_COLOR = 0x4a5568;

/**
 * One-shot snapshot of the player's ships as stylized placeholder meshes.
 * Not reactive — ship roster does not need live updates for this spike.
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

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: HULL_COLOR,
    roughness: 0.75,
    metalness: 0.15,
  });
  const bridgeMaterial = new THREE.MeshStandardMaterial({
    color: BRIDGE_COLOR,
    roughness: 0.8,
    metalness: 0.1,
  });

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

    const shipGroup = new THREE.Group();

    const hull = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), hullMaterial);
    shipGroup.add(hull);

    const bridgeH = height * 0.6;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.5, bridgeH, length * 0.25),
      bridgeMaterial,
    );
    bridge.position.set(0, height * 0.5 + bridgeH / 2, length * 0.25);
    shipGroup.add(bridge);

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
      layout.mesh.position.set(x + layout.width / 2, layout.height / 2, -rowIndex * ROW_DEPTH);
      group.add(layout.mesh);
      x += layout.width + SHIP_GAP;
    }
  }

  return group;
}
