import * as THREE from 'three';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { buildShipMesh } from '@src/game-3d/hangar';

const ARM_COUNT = 5;
const ARM_LENGTH = 18;
const ARM_THICKNESS = 0.35;
const HUB_RADIUS = 2.2;
const HUB_HEIGHT = 3.5;
const SHIP_LENGTH_MIN = 4;
const SHIP_LENGTH_MAX = 8;
const STAR_COUNT = 1200;

const HULL_COLOR = 0x718096;
const BRIDGE_COLOR = 0x4a5568;

/** Soft radial glow for the distant sun sprite. */
function createSunTexture(): THREE.CanvasTexture {
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255, 250, 230, 1)');
  gradient.addColorStop(0.15, 'rgba(255, 230, 160, 0.95)');
  gradient.addColorStop(0.4, 'rgba(255, 180, 60, 0.45)');
  gradient.addColorStop(0.7, 'rgba(255, 120, 20, 0.12)');
  gradient.addColorStop(1, 'rgba(255, 80, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildStarfield(): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform-ish direction on a sphere, radius jittered.
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const radius = 120 + Math.random() * 60;
    const sinPhi = Math.sin(phi);
    positions[i * 3] = radius * sinPhi * Math.cos(theta);
    positions[i * 3 + 1] = radius * sinPhi * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.6,
      sizeAttenuation: true,
    }),
  );
}

function buildSun(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: createSunTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(44, 12, -380);
  sprite.scale.set(18, 18, 1);
  return sprite;
}

function buildStation(): THREE.Group {
  const station = new THREE.Group();

  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x3a424c,
    roughness: 0.45,
    metalness: 0.65,
  });
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x4a5560,
    roughness: 0.5,
    metalness: 0.55,
  });
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

  // Stacked industrial hub.
  const hubCore = new THREE.Mesh(
    new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS * 1.15, HUB_HEIGHT, 18),
    hubMat,
  );
  station.add(hubCore);

  const hubRing = new THREE.Mesh(
    new THREE.CylinderGeometry(HUB_RADIUS * 1.4, HUB_RADIUS * 1.4, HUB_HEIGHT * 0.25, 24),
    hubMat,
  );
  hubRing.position.y = 0;
  station.add(hubRing);

  const ships = shipsStore.all.value;
  const shipCount =
    ships === undefined || ships.length === 0 ? 0 : Math.min(ships.length, ARM_COUNT);

  for (let i = 0; i < ARM_COUNT; i++) {
    const angle = THREE.MathUtils.degToRad((360 / ARM_COUNT) * i);
    const armGroup = new THREE.Group();
    armGroup.rotation.y = angle;

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICKNESS, ARM_THICKNESS * 0.7, ARM_LENGTH),
      armMat,
    );
    // Arm extends outward along local +Z from the hub rim.
    arm.position.z = HUB_RADIUS + ARM_LENGTH / 2;
    armGroup.add(arm);

    if (i < shipCount) {
      // Vary length across arms so the fleet doesn't look cloned.
      const t = i / (ARM_COUNT - 1);
      const length = SHIP_LENGTH_MIN + t * (SHIP_LENGTH_MAX - SHIP_LENGTH_MIN);
      const ship = buildShipMesh(length, hullMaterial, bridgeMaterial);
      // Point hull roughly along the arm (length axis is local Z of the ship mesh).
      ship.position.set(0, 0, HUB_RADIUS + ARM_LENGTH + length * 0.35);
      armGroup.add(ship);
    }

    station.add(armGroup);
  }

  return station;
}

/**
 * Distant docking-arm diorama seen through the room's -Z wall opening.
 * Station sits at local origin; caller positions the whole group outside the room.
 */
export function buildViewscreen(): THREE.Group {
  const group = new THREE.Group();
  group.add(buildStarfield());
  group.add(buildSun());
  group.add(buildStation());
  return group;
}
