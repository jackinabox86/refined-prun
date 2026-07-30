// Entry point for the 3D Game Mode visual-iteration sandbox (`pnpm run dev:3d-sandbox`).
// Boots a real Game3D scene without the live extension/login/WebSocket loop — see
// docs/browser-testing-3d.md ("Visual-iteration sandbox") for what this is and isn't for.
import '@src/refined-prun.css';
// Same dayjs plugin setup refined-prun.ts does before importing features — several XIT
// buffers call dayjs.duration()/etc. at module scope (e.g. ELEC.vue), which throws
// immediately on import without these .extend() calls having run first.
import '@src/utils/dayjs';
import '@src/utils/chartjs-dayjs';
// Must come after the dayjs setup imports above — see xit-bootstrap.ts's own comment.
import './xit-bootstrap';
import * as THREE from 'three';
import { Game3D } from '@src/game-3d/Game3D';
import { EYE_HEIGHT } from '@src/game-3d/room';
import { HOLOGRAM_POSITION } from '@src/game-3d/hologram';
import { dispatchFixtureApiData } from './fixtures';

interface CameraPreset {
  label: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

// Coordinates are approximate (hand-picked against room.ts/hologram.ts/console-roster.ts's
// current layout, not derived from their private constants) — good enough for a quick
// visual check, re-eyeball if the room/console layout changes materially.
const PRESETS: Record<string, CameraPreset> = {
  overview: {
    label: 'Room overview',
    // Opposite corner from HOLOGRAM_POSITION (~5.6, 1.4, 5.6) on purpose — the original
    // (5.5, 2.8, 5.5) sat almost exactly inside the hologram's own effect volume, so this
    // "room" shot was actually a hologram close-up in disguise (its glow spheres/motes
    // read as unexplained floating orbs, misattributed to room-shell lighting bugs across
    // several review rounds before the coordinate overlap was caught by inspection).
    position: new THREE.Vector3(-5.5, 2.8, -5.5),
    lookAt: new THREE.Vector3(0, 1.2, 0),
  },
  console: {
    label: 'Console close-up (companyops)',
    // Was baseplanning, but that console moved into the center pit (room-fixes round) —
    // retargeted at companyops (+Z wall, position unchanged) so this preset still shows
    // a wall-mounted console close-up.
    position: new THREE.Vector3(0, EYE_HEIGHT, 5.5),
    lookAt: new THREE.Vector3(0, 1.2, 7.2),
  },
  hologram: {
    label: 'Hologram detail',
    // Wave-2 route-map pivot flattened the display onto a HOLOGRAM_SPAN=5.2-wide
    // (~2.6 half-extent) horizontal plane. Two failed attempts before this one:
    // pulling back far but staying near eye level (dx/dz=-4.5, dy=+1.4) put the map
    // almost edge-on — a flat plane viewed at a shallow angle reads as a near-straight
    // line, not a map; going very high (dy=+5) instead cleared ROOM_HEIGHT (3.5) and
    // clipped through the ceiling. The fix is proximity + steep pitch, not distance:
    // staying close horizontally but rising most of the remaining headroom under the
    // ceiling gives a real look-down angle (~38° below horizontal here) without
    // leaving the room.
    // HOLOGRAM_POSITION.y is 0 (floor-mounted base, room-fixes round) — the map/tank
    // content itself sits above that at roughly y=0.6 (plinth + tank center), so this
    // preset targets that offset instead of HOLOGRAM_POSITION directly, or the camera
    // ends up pitched down at the floor/base instead of the star content.
    position: new THREE.Vector3(
      HOLOGRAM_POSITION.x - 1.8,
      HOLOGRAM_POSITION.y + 2.6,
      HOLOGRAM_POSITION.z - 1.8,
    ),
    lookAt: HOLOGRAM_POSITION.clone().add(new THREE.Vector3(0, 0.6, 0)),
  },
  pit: {
    label: 'Center pit + ramp detail',
    // Ad-hoc preset for reviewing the wave-2 room-shape pass (pit/ramp/railings around
    // origin). Offset well away from x=0 (the companyops console sits centered on the
    // +Z wall there and its control-surface panels fill the frame if the camera sits
    // too close to it) and pulled back from the wall, angled down toward the ramp
    // (offset to x=3 on the +Z pit edge, see room.ts) so the ramp, tread bars, cheek
    // walls, and pit retaining walls/railings are all in frame.
    // y dropped from 3.4 — the room-variety pass added ceiling beams/a bulkhead band
    // occupying roughly y=3.16-3.50, and 3.4 sat inside that band, producing a
    // near-clip-plane artifact (a huge dark grazing-angle slab filling most of frame).
    // 2.4 sits well clear of it while keeping a similar look-down angle.
    position: new THREE.Vector3(-6, 2.4, 6.5),
    lookAt: new THREE.Vector3(2, -0.6, 1.5),
  },
  ramp: {
    label: 'Ramp side profile',
    // Close side-on view of just the ramp (x=[1.75,4.25], z=[1,4]) to check tread-bar/
    // cheek-wall flushness against the slope, which is hard to judge from the wider
    // `pit` preset's angle.
    position: new THREE.Vector3(7, 1.3, 3),
    lookAt: new THREE.Vector3(3, -0.5, 2.5),
  },
  rampUnder: {
    label: 'Ramp underside check',
    // Inside the pit (y=-PIT_DEPTH-ish), looking up at the ramp's sloped underside —
    // no floor plate exists in that exact footprint (only the ramp mesh itself), so
    // this is the angle that previously exposed the skybox through a single-sided
    // ramp material.
    position: new THREE.Vector3(3, -0.7, 0.3),
    lookAt: new THREE.Vector3(3, -0.2, 2.5),
  },
  underside: {
    label: 'Console panel underside check',
    // Low, looking up at the baseplanning console's control-surface panels (see the
    // `console` preset's target ~(-3, 1.2, -6.7)) to verify the CSS3D backface-
    // visibility fix — panel content should not be visible from below.
    position: new THREE.Vector3(-2.5, 0.15, -5.5),
    lookAt: new THREE.Vector3(-3, 1.1, -6.6),
  },
};
const DEFAULT_PRESET = 'overview';

function currentPresetName(): string {
  const requested = new URLSearchParams(location.search).get('cam');
  return requested !== null && requested in PRESETS ? requested : DEFAULT_PRESET;
}

function buildPresetBar(active: string) {
  const bar = document.createElement('div');
  // Screenshot tooling (pw-sandbox-screenshot.mjs) removes this element by id before
  // capturing — it's dev-only navigation chrome, not part of any reviewed 3D-mode piece.
  // Without this it bled into a HUD-overlay critic round, which misjudged the sandbox's
  // plain <button> bar as part of overlay.ts's actual diegetic HUD.
  bar.id = 'sandbox-preset-bar';
  Object.assign(bar.style, {
    position: 'fixed',
    left: '8px',
    top: '8px',
    zIndex: '2147483647',
    display: 'flex',
    gap: '6px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '12px',
  });
  for (const [name, preset] of Object.entries(PRESETS)) {
    const button = document.createElement('button');
    button.textContent = preset.label;
    button.title = name;
    Object.assign(button.style, {
      padding: '4px 8px',
      background: name === active ? '#ffc856' : 'rgba(20, 28, 40, 0.85)',
      color: name === active ? '#1a1a1a' : '#e2e8f0',
      border: '1px solid #63b3ed',
      borderRadius: '4px',
      cursor: 'pointer',
    });
    button.addEventListener('click', () => {
      location.search = `?cam=${name}`;
    });
    bar.append(button);
  }
  document.body.append(bar);
}

dispatchFixtureApiData();

const presetName = currentPresetName();
const preset = PRESETS[presetName]!;
buildPresetBar(presetName);

const game = new Game3D(() => location.reload(), { cameraPose: preset });
game.start();

// Game3D.start() renders the first frame synchronously (tick() calls render() before
// its first requestAnimationFrame), so the canvas already has pixels by this point —
// the sandbox screenshot script polls this flag instead of guessing a sleep duration.
declare global {
  interface Window {
    __rpSandboxReady?: boolean;
  }
}
window.__rpSandboxReady = true;
