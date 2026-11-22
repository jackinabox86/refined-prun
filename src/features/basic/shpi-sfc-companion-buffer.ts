import {
  canOpenCompanion,
  openCompanionBuffer,
} from '@src/infrastructure/prun-ui/companion-buffer';
import { sfcCompanionCommand } from '@src/features/basic/shpi-sfc-companion-command';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.frame, C.ContextControls.item), item => {
    item.addEventListener(
      'click',
      (e: MouseEvent) => {
        const cmd = _$(item, C.ContextControls.cmd)?.textContent;
        const command = sfcCompanionCommand(e, cmd, tile.parameter);
        if (command === undefined || !canOpenCompanion(tile)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        // SFC lists many flights; give it 1.8x the SHPI window height (1.5x, then another 20%) and a
        // 25% wider pane. The SHPI pane keeps its width.
        void openCompanionBuffer(tile, command, { heightScale: 1.8, companionWidthScale: 1.25 });
      },
      true,
    );
  });
}

function init() {
  tiles.observe('SHPI', onTileReady);
}

features.add(import.meta.url, init, 'SHPI: Shift-click SFC to open it in a companion buffer.');
