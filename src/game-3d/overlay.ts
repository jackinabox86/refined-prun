export type ModeHint = 'walk' | 'interact' | 'focused';

const STYLE_ID = 'g3d-hud-style';
const FONT_STACK =
  "'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

// Corner-bracket "viewfinder" frame built from eight positioned gradients (no
// pseudo-elements needed, so a single rule can serve both the hint panel and
// the exit control). Color/size are driven by CSS custom properties so each
// mode + element can tune them independently.
const CORNER_FRAME = `
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) top left / var(--g3d-corner) var(--g3d-corner-w) no-repeat,
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) top left / var(--g3d-corner-w) var(--g3d-corner) no-repeat,
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) top right / var(--g3d-corner) var(--g3d-corner-w) no-repeat,
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) top right / var(--g3d-corner-w) var(--g3d-corner) no-repeat,
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) bottom left / var(--g3d-corner) var(--g3d-corner-w) no-repeat,
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) bottom left / var(--g3d-corner-w) var(--g3d-corner) no-repeat,
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) bottom right / var(--g3d-corner) var(--g3d-corner-w) no-repeat,
    linear-gradient(var(--g3d-accent), var(--g3d-accent)) bottom right / var(--g3d-corner-w) var(--g3d-corner) no-repeat
`;

function createHudFrame() {
  const frame = document.createElement('div');
  frame.className = 'g3d-hud-frame';

  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const node = document.createElement('div');
    node.className = `g3d-hud-corner g3d-hud-corner-${corner}`;
    frame.append(node);
  }

  for (const side of ['left', 'right']) {
    const rail = document.createElement('div');
    rail.className = `g3d-hud-rail g3d-hud-rail-${side}`;
    for (let i = 0; i < 18; i += 1) {
      const tick = document.createElement('i');
      rail.append(tick);
    }
    frame.append(rail);
  }

  const reticle = document.createElement('div');
  reticle.className = 'g3d-hud-reticle';

  const topReadout = document.createElement('div');
  topReadout.className = 'g3d-hud-readout g3d-hud-readout-top';
  topReadout.textContent = 'NAV // VECTOR GLASS';

  const bottomReadout = document.createElement('div');
  bottomReadout.className = 'g3d-hud-readout g3d-hud-readout-bottom';
  bottomReadout.textContent = 'SYS LINK 03 · OPTICS STABLE';

  frame.append(reticle, topReadout, bottomReadout);
  return frame;
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .g3d-hud-root {
      --g3d-accent: #5fd4f0;
      --g3d-glow: rgba(95, 212, 240, 0.45);
      --g3d-ghost: rgba(95, 212, 240, 0.16);
    }
    .g3d-hud-root.g3d-mode-interact {
      --g3d-accent: #5fd4f0;
      --g3d-glow: rgba(95, 212, 240, 0.4);
      --g3d-ghost: rgba(95, 212, 240, 0.16);
    }
    .g3d-hud-root.g3d-mode-walk {
      --g3d-accent: #7fe3c9;
      --g3d-glow: rgba(127, 227, 201, 0.35);
      --g3d-ghost: rgba(127, 227, 201, 0.14);
    }
    .g3d-hud-root.g3d-mode-focused {
      --g3d-accent: #ffb454;
      --g3d-glow: rgba(255, 180, 84, 0.55);
      --g3d-ghost: rgba(255, 180, 84, 0.18);
    }
    .g3d-hud-panel {
      --g3d-corner: 14px;
      --g3d-corner-w: 2px;
      position: relative;
      padding: 10px 14px 9px;
      min-width: 260px;
      max-width: 340px;
      background:
        ${CORNER_FRAME},
        linear-gradient(90deg, transparent 0, var(--g3d-ghost) 49%, transparent 50%) 0 0 / 38px 100% no-repeat,
        linear-gradient(135deg, rgba(8, 16, 24, 0.78), rgba(10, 20, 30, 0.62));
      box-shadow: inset 0 0 0 1px rgba(95, 212, 240, 0.12), 0 0 16px -6px var(--g3d-glow);
      backdrop-filter: blur(2px);
      transition: box-shadow 220ms ease, background-color 220ms ease;
    }
    .g3d-hud-panel.g3d-mode-interact {
      box-shadow: inset 0 0 0 1px rgba(95, 212, 240, 0.12), 0 0 16px -6px var(--g3d-glow);
    }
    .g3d-hud-panel.g3d-mode-walk {
      box-shadow: inset 0 0 0 1px rgba(127, 227, 201, 0.12), 0 0 16px -7px var(--g3d-glow);
    }
    .g3d-hud-panel.g3d-mode-focused {
      box-shadow: inset 0 0 0 1px rgba(255, 180, 84, 0.22), 0 0 22px -4px var(--g3d-glow);
      animation: g3d-engaged-pulse 2.6s ease-in-out infinite;
    }
    .g3d-hud-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: ${FONT_STACK};
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--g3d-accent);
      text-shadow: 0 0 8px var(--g3d-glow);
    }
    .g3d-hud-label::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      background: var(--g3d-accent);
      box-shadow: 0 0 6px 1px var(--g3d-glow);
      transform: rotate(45deg);
      flex: none;
    }
    .g3d-hud-divider {
      height: 1px;
      margin: 6px 0 7px;
      background: linear-gradient(to right, var(--g3d-glow), transparent 85%);
      opacity: 0.7;
    }
    .g3d-hud-panel-telemetry {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 12px;
      margin: -1px 0 6px;
      font-family: ${FONT_STACK};
      font-size: 8px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: rgba(207, 233, 242, 0.54);
    }
    .g3d-hud-panel-telemetry span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .g3d-hud-panel-telemetry span:first-child {
      color: var(--g3d-accent);
      text-shadow: 0 0 6px var(--g3d-glow);
    }
    .g3d-hud-body {
      font-family: ${FONT_STACK};
      font-size: 12.5px;
      line-height: 1.55;
      letter-spacing: 0.02em;
      color: #cfe9f2;
    }
    .g3d-hud-body .g3d-key {
      color: var(--g3d-accent);
      font-weight: 600;
    }
    .g3d-hud-panel.g3d-hud-flash {
      animation: g3d-hud-fade-in 260ms ease-out;
    }
    .g3d-hud-panel.g3d-mode-focused.g3d-hud-flash {
      animation: g3d-hud-fade-in 260ms ease-out, g3d-engaged-pulse 2.6s ease-in-out infinite;
    }
    @keyframes g3d-hud-fade-in {
      from { opacity: 0; transform: translateY(-3px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes g3d-engaged-pulse {
      0%, 100% { box-shadow: inset 0 0 0 1px rgba(255, 180, 84, 0.22), 0 0 18px -4px var(--g3d-glow); }
      50% { box-shadow: inset 0 0 0 1px rgba(255, 180, 84, 0.4), 0 0 26px -2px var(--g3d-glow); }
    }
    .g3d-hud-exit {
      --g3d-corner: 8px;
      --g3d-corner-w: 2px;
      position: relative;
      align-self: flex-start;
      pointer-events: auto;
      cursor: pointer;
      padding: 5px 12px 5px 10px;
      font-family: ${FONT_STACK};
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #d7f4ff;
      background: rgba(10, 18, 26, 0.7);
      background-image:
        ${CORNER_FRAME},
        linear-gradient(90deg, transparent 0, var(--g3d-ghost) 48%, transparent 50%);
      box-shadow: inset 0 0 0 1px var(--g3d-ghost);
      clip-path: polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px);
      border: none;
      transition: background-color 150ms ease, box-shadow 150ms ease, color 150ms ease;
    }
    .g3d-hud-exit::before {
      content: '\\2039\\2039';
      margin-right: 6px;
      color: var(--g3d-accent);
    }
    .g3d-hud-exit:hover, .g3d-hud-exit:focus-visible {
      color: #ffffff;
      background: rgba(16, 30, 42, 0.85);
      box-shadow: inset 0 0 0 1px rgba(95, 212, 240, 0.3), 0 0 12px -3px var(--g3d-glow);
      outline: none;
    }
    .g3d-hud-vignette {
      position: fixed;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(ellipse at center, transparent 56%, rgba(2, 8, 14, 0.2) 82%, rgba(2, 8, 14, 0.48) 100%),
        linear-gradient(115deg, transparent 0, rgba(255, 255, 255, 0.035) 47%, transparent 62%),
        repeating-linear-gradient(to bottom, rgba(150, 220, 240, 0.025) 0, rgba(150, 220, 240, 0.025) 1px, transparent 1px, transparent 3px);
      mix-blend-mode: normal;
    }
    .g3d-hud-frame {
      position: fixed;
      inset: 18px;
      pointer-events: none;
      color: var(--g3d-accent);
      opacity: 0.72;
      text-shadow: 0 0 8px var(--g3d-glow);
      transition: color 220ms ease, opacity 220ms ease;
    }
    .g3d-hud-frame::before,
    .g3d-hud-frame::after {
      content: '';
      position: absolute;
      left: clamp(280px, 28vw, 440px);
      right: clamp(80px, 10vw, 180px);
      height: 1px;
      background:
        linear-gradient(to right, transparent, var(--g3d-ghost) 7%, var(--g3d-accent) 19%, var(--g3d-ghost) 44%, transparent 100%);
      box-shadow: 0 0 14px -7px var(--g3d-glow);
    }
    .g3d-hud-frame::before {
      top: 0;
    }
    .g3d-hud-frame::after {
      bottom: 0;
      opacity: 0.58;
    }
    .g3d-hud-corner {
      --g3d-corner-span: clamp(84px, 12vw, 168px);
      position: absolute;
      width: var(--g3d-corner-span);
      height: var(--g3d-corner-span);
      opacity: 0.84;
      background:
        linear-gradient(currentColor, currentColor) top left / 100% 1px no-repeat,
        linear-gradient(currentColor, currentColor) top left / 1px 100% no-repeat,
        repeating-linear-gradient(to right, var(--g3d-ghost) 0 1px, transparent 1px 12px) top left / 70% 6px no-repeat,
        repeating-linear-gradient(to bottom, var(--g3d-ghost) 0 1px, transparent 1px 12px) top left / 6px 70% no-repeat;
      filter: drop-shadow(0 0 5px var(--g3d-glow));
    }
    .g3d-hud-corner::before,
    .g3d-hud-corner::after {
      content: '';
      position: absolute;
      background: currentColor;
      opacity: 0.66;
    }
    .g3d-hud-corner::before {
      top: 12px;
      left: 28px;
      width: 34px;
      height: 1px;
    }
    .g3d-hud-corner::after {
      top: 28px;
      left: 12px;
      width: 1px;
      height: 34px;
    }
    .g3d-hud-corner-tr,
    .g3d-hud-corner-br {
      right: 0;
      transform: scaleX(-1);
    }
    .g3d-hud-corner-bl,
    .g3d-hud-corner-br {
      bottom: 0;
      transform: scaleY(-1);
    }
    .g3d-hud-corner-br {
      transform: scale(-1);
    }
    .g3d-hud-corner-tl,
    .g3d-hud-corner-tr {
      top: 0;
    }
    .g3d-hud-corner-tl,
    .g3d-hud-corner-bl {
      left: 0;
    }
    .g3d-hud-rail {
      position: absolute;
      top: 22%;
      bottom: 18%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      opacity: 0.46;
    }
    .g3d-hud-rail-left {
      left: clamp(18px, 4vw, 58px);
    }
    .g3d-hud-rail-right {
      right: clamp(18px, 4vw, 58px);
      align-items: flex-end;
    }
    .g3d-hud-rail i {
      display: block;
      width: 18px;
      height: 1px;
      background: currentColor;
      box-shadow: 0 0 8px -3px var(--g3d-glow);
    }
    .g3d-hud-rail i:nth-child(4n) {
      width: 34px;
      opacity: 0.9;
    }
    .g3d-hud-rail i:nth-child(4n + 2) {
      width: 10px;
      opacity: 0.42;
    }
    .g3d-hud-reticle {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 74px;
      height: 74px;
      transform: translate(-50%, -50%);
      opacity: 0.18;
      background:
        linear-gradient(currentColor, currentColor) center / 1px 100% no-repeat,
        linear-gradient(currentColor, currentColor) center / 100% 1px no-repeat,
        radial-gradient(circle, transparent 0 4px, currentColor 4px 5px, transparent 5px 100%);
      filter: drop-shadow(0 0 8px var(--g3d-glow));
    }
    .g3d-hud-reticle::before,
    .g3d-hud-reticle::after {
      content: '';
      position: absolute;
      inset: 16px;
      border: 1px solid currentColor;
      opacity: 0.34;
      clip-path: polygon(0 0, 28% 0, 28% 8%, 8% 8%, 8% 28%, 0 28%, 0 72%, 8% 72%, 8% 92%, 28% 92%, 28% 100%, 0 100%, 0 0, 100% 0, 100% 28%, 92% 28%, 92% 8%, 72% 8%, 72% 0, 100% 0, 100% 100%, 72% 100%, 72% 92%, 92% 92%, 92% 72%, 100% 72%, 100% 100%, 0 100%);
    }
    .g3d-hud-reticle::after {
      inset: -11px;
      opacity: 0.12;
    }
    .g3d-hud-readout {
      position: absolute;
      font-family: ${FONT_STACK};
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(207, 233, 242, 0.48);
      white-space: nowrap;
    }
    .g3d-hud-readout-top {
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
    }
    .g3d-hud-readout-bottom {
      right: clamp(82px, 12vw, 190px);
      bottom: 10px;
    }
  `;
  document.head.appendChild(style);
}

export function createModeOverlay(onExit: () => void) {
  ensureStyle();

  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'absolute',
    left: '12px',
    top: '12px',
    zIndex: '2',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    pointerEvents: 'none',
    fontFamily: FONT_STACK,
    color: '#f7fafc',
  });
  root.className = 'g3d-hud-root g3d-mode-interact';

  const vignette = document.createElement('div');
  vignette.className = 'g3d-hud-vignette';

  const frame = createHudFrame();

  const panel = document.createElement('div');
  panel.className = 'g3d-hud-panel g3d-mode-interact';

  const label = document.createElement('div');
  label.className = 'g3d-hud-label';

  const divider = document.createElement('div');
  divider.className = 'g3d-hud-divider';

  const telemetry = document.createElement('div');
  telemetry.className = 'g3d-hud-panel-telemetry';
  for (const text of ['HUD LINK', 'FOV 086', 'CLK 01']) {
    const node = document.createElement('span');
    node.textContent = text;
    telemetry.append(node);
  }

  const body = document.createElement('div');
  body.className = 'g3d-hud-body';

  panel.append(label, divider, telemetry, body);

  const exit = document.createElement('button');
  exit.type = 'button';
  exit.className = 'g3d-hud-exit';
  exit.textContent = 'EXIT 3D';
  exit.addEventListener('click', e => {
    e.stopPropagation();
    onExit();
  });

  root.append(vignette, frame, panel, exit);

  let currentMode: ModeHint = 'interact';
  let facingPurpose: string | undefined;
  let focusedPurpose: string | undefined;

  const replayFlash = () => {
    panel.classList.remove('g3d-hud-flash');
    // Force reflow so the animation restarts even if the class name is unchanged.
    void panel.offsetWidth;
    panel.classList.add('g3d-hud-flash');
  };

  const render = () => {
    root.classList.remove('g3d-mode-walk', 'g3d-mode-interact', 'g3d-mode-focused');
    root.classList.add(`g3d-mode-${currentMode}`);

    panel.classList.remove('g3d-mode-walk', 'g3d-mode-interact', 'g3d-mode-focused');
    panel.classList.add(`g3d-mode-${currentMode}`);

    if (currentMode === 'walk') {
      if (facingPurpose === undefined) {
        label.textContent = 'Walk mode';
        body.innerHTML =
          '<span class="g3d-key">WASD</span> move · <span class="g3d-key">Esc</span> interact mode · <span class="g3d-key">Ctrl+Alt+3</span> or EXIT to leave';
      } else {
        label.textContent = `Walk mode · Facing ${facingPurpose}`;
        body.innerHTML =
          '<span class="g3d-key">E</span> interact · <span class="g3d-key">WASD</span> move · <span class="g3d-key">Ctrl+Alt+3</span> or EXIT to leave';
      }
    } else if (currentMode === 'interact') {
      label.textContent = 'Interact mode';
      body.innerHTML =
        'Click canvas to look around · <span class="g3d-key">Ctrl+Alt+3</span> or EXIT to leave';
    } else {
      label.textContent = `${focusedPurpose} console`;
      body.innerHTML =
        'Click screens to interact · <span class="g3d-key">E</span> return to walk mode · <span class="g3d-key">Ctrl+Alt+3</span> or EXIT to leave';
    }

    replayFlash();
  };

  const setMode = (mode: ModeHint, purpose?: string) => {
    currentMode = mode;
    if (mode === 'focused') {
      focusedPurpose = purpose;
    }
    render();
  };

  const setFacing = (purpose: string | undefined) => {
    if (currentMode !== 'walk') {
      return;
    }
    if (purpose === facingPurpose) {
      return;
    }
    facingPurpose = purpose;
    render();
  };

  setMode('interact');

  return { root, setMode, setFacing };
}
