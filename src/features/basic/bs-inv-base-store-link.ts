import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { getBaseStore } from '@src/core/store-id';

// The correct-commands transformer chain only runs on command-form submit, so
// the native INV <planet> context link on BS bypasses redirectInvToBaseStore.
// Intercept that click and open the base store directly instead.
function onTileReady(tile: PrunTile) {
  subscribe($$(tile.frame, C.ContextControls.item), item => {
    if (_$(item, C.ContextControls.cmd)?.textContent !== 'INV') {
      return;
    }
    item.addEventListener('click', e => {
      const store = getBaseStore(tile.parameter);
      if (store === undefined) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      void showBuffer(`INV ${store.id.substring(0, 8)}`);
    });
  });
}

function init() {
  tiles.observe('BS', onTileReady);
}

features.add(import.meta.url, init, 'BS: Opens the INV context link on the base store directly.');
