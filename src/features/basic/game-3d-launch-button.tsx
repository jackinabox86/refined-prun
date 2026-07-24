import { toggleGame3D } from '@src/game-3d-launcher';

function onContainerReady(container: HTMLElement) {
  createFragmentApp(() => (
    <div
      class={[C.HeadItem.container, C.HeadItem.link, C.fonts.fontRegular, C.type.typeRegular]}
      onClick={() => void toggleGame3D()}>
      <span class={C.HeadItem.label}>3D</span>
    </div>
  )).appendTo(container);
}

function init() {
  subscribe($$(document, C.ScreenControls.container), onContainerReady);
}

features.add(import.meta.url, init, 'Adds a 3D-mode toggle button to the top bar, next to FULL.');
