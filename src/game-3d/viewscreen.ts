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
const FAINT_STAR_COUNT = 2000;
const HERO_STAR_COUNT = 100;
const BACKDROP_DISTANCE = 190;
const BACKDROP_WIDTH = 360;
const BACKDROP_HEIGHT = 180;

const HULL_COLOR = 0x718096;
const BRIDGE_COLOR = 0x4a5568;
const ARM_STRIPE_COLOR = 0x56d7ff;

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

/** Dark backdrop gives the window depth without lighting the room. */
function createNebulaTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#02050b');
  gradient.addColorStop(0.32, '#040a16');
  gradient.addColorStop(0.5, '#090f25');
  gradient.addColorStop(0.68, '#040a16');
  gradient.addColorStop(1, '#010309');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const haze = ctx.createRadialGradient(
    width * 0.34,
    height * 0.5,
    0,
    width * 0.34,
    height * 0.5,
    width * 0.5,
  );
  haze.addColorStop(0, 'rgba(44, 62, 118, 0.11)');
  haze.addColorStop(0.38, 'rgba(31, 34, 84, 0.08)');
  haze.addColorStop(1, 'rgba(5, 8, 18, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPlanetTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const base = ctx.createRadialGradient(
    size * 0.34,
    size * 0.28,
    0,
    size * 0.5,
    size * 0.5,
    size * 0.72,
  );
  base.addColorStop(0, '#d8edf5');
  base.addColorStop(0.18, '#9fb8c6');
  base.addColorStop(0.42, '#5f829c');
  base.addColorStop(0.7, '#18304c');
  base.addColorStop(1, '#010612');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 12; i++) {
    const y = size * (0.2 + i * 0.075 + Math.random() * 0.03);
    const thickness = size * (0.018 + Math.random() * 0.035);
    const band = ctx.createLinearGradient(0, y - thickness, size, y + thickness);
    band.addColorStop(0, 'rgba(185, 206, 214, 0)');
    band.addColorStop(0.22, 'rgba(216, 236, 244, 0.28)');
    band.addColorStop(0.5, 'rgba(48, 86, 118, 0.58)');
    band.addColorStop(0.78, 'rgba(9, 24, 44, 0.35)');
    band.addColorStop(1, 'rgba(1, 8, 18, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y - thickness, size, thickness * 2);
  }

  const hotCrescent = ctx.createRadialGradient(
    size * 0.26,
    size * 0.24,
    0,
    size * 0.26,
    size * 0.24,
    size * 0.55,
  );
  hotCrescent.addColorStop(0, 'rgba(230, 248, 255, 0.18)');
  hotCrescent.addColorStop(0.38, 'rgba(130, 200, 236, 0.08)');
  hotCrescent.addColorStop(1, 'rgba(160, 224, 255, 0)');
  ctx.fillStyle = hotCrescent;
  ctx.fillRect(0, 0, size, size);

  const terminator = ctx.createLinearGradient(0, 0, size, size);
  terminator.addColorStop(0, 'rgba(220, 242, 250, 0.12)');
  terminator.addColorStop(0.38, 'rgba(255, 255, 255, 0)');
  terminator.addColorStop(0.64, 'rgba(0, 0, 0, 0.52)');
  terminator.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
  ctx.fillStyle = terminator;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildSpaceBackdrop(): THREE.Mesh {
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(BACKDROP_WIDTH, BACKDROP_HEIGHT),
    new THREE.MeshBasicMaterial({
      map: createNebulaTexture(),
      depthWrite: false,
    }),
  );
  backdrop.position.z = -BACKDROP_DISTANCE;
  return backdrop;
}

function buildPlanet(): THREE.Group {
  const planet = new THREE.Group();
  planet.position.set(-18, 4.5, -155);

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(40, 64, 32),
    new THREE.MeshBasicMaterial({
      map: createPlanetTexture(),
    }),
  );
  body.rotation.set(0.12, -0.35, -0.08);
  planet.add(body);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(41.5, 64, 32),
    new THREE.MeshBasicMaterial({
      color: 0x5edcff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  planet.add(atmosphere);

  return planet;
}

function createStarPositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
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
  return positions;
}

function buildFaintStarfield(): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(createStarPositions(FAINT_STAR_COUNT), 3),
  );
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xdde8ff,
      size: 0.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  );
}

function buildHeroStarfield(): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(createStarPositions(HERO_STAR_COUNT), 3),
  );

  const palette = [new THREE.Color(0xfff4dc), new THREE.Color(0xd8ecff), new THREE.Color(0xffdf9e)];
  const colors = new Float32Array(HERO_STAR_COUNT * 3);
  for (let i = 0; i < HERO_STAR_COUNT; i++) {
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
}

function buildStarfield(): THREE.Group {
  const group = new THREE.Group();
  group.add(buildFaintStarfield());
  group.add(buildHeroStarfield());
  return group;
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
  const greebleMat = new THREE.MeshStandardMaterial({
    color: 0x46515d,
    roughness: 0.5,
    metalness: 0.45,
    emissive: 0x1b3440,
    emissiveIntensity: 0.35,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: ARM_STRIPE_COLOR,
    roughness: 0.35,
    metalness: 0.2,
    emissive: ARM_STRIPE_COLOR,
    emissiveIntensity: 0.7,
  });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xbdf4ff,
    roughness: 0.25,
    metalness: 0,
    emissive: 0x56d7ff,
    emissiveIntensity: 1.8,
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

  const greeblePlacements = [
    { angle: 0.35, y: 1.2, size: [0.34, 0.2, 0.22] as const },
    { angle: 1.85, y: 0.35, size: [0.18, 0.38, 0.2] as const },
    { angle: 3.15, y: -0.65, size: [0.4, 0.18, 0.28] as const },
    { angle: 4.55, y: 0.95, size: [0.24, 0.28, 0.18] as const },
  ];
  for (const placement of greeblePlacements) {
    const greeble = new THREE.Mesh(new THREE.BoxGeometry(...placement.size), greebleMat);
    const radius = HUB_RADIUS * 1.18;
    greeble.position.set(
      Math.sin(placement.angle) * radius,
      placement.y,
      Math.cos(placement.angle) * radius,
    );
    greeble.rotation.y = placement.angle;
    station.add(greeble);
  }

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

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(ARM_THICKNESS * 0.22, ARM_THICKNESS * 0.06, ARM_LENGTH * 0.82),
      stripeMat,
    );
    stripe.position.set(0, ARM_THICKNESS * 0.38, HUB_RADIUS + ARM_LENGTH / 2);
    armGroup.add(stripe);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), beaconMat);
    beacon.position.set(0, ARM_THICKNESS * 0.24, HUB_RADIUS + ARM_LENGTH);
    armGroup.add(beacon);

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
  group.add(buildSpaceBackdrop());
  group.add(buildStarfield());
  group.add(buildPlanet());
  group.add(buildSun());
  group.add(buildStation());
  return group;
}
