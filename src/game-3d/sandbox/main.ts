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
    label: 'Console close-up (baseplanning)',
    position: new THREE.Vector3(-2.25, EYE_HEIGHT, -5.0),
    lookAt: new THREE.Vector3(-3, 1.2, -6.7),
  },
  hologram: {
    label: 'Hologram detail',
    // Level with the hologram (not eye height) and close, for an actual "detail" framing
    // now that fixtures.ts seeds it real star/site data to draw.
    position: new THREE.Vector3(
      HOLOGRAM_POSITION.x - 2.2,
      HOLOGRAM_POSITION.y + 0.5,
      HOLOGRAM_POSITION.z - 2.2,
    ),
    lookAt: HOLOGRAM_POSITION.clone(),
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
