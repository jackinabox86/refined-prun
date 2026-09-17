import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { cogcRepeatVoteCommand } from './repeat-vote-command';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AlertListItem.container), processNotification);
}

function processNotification(container: HTMLElement) {
  const command = cogcRepeatVoteCommand(alertsStore.getById(getPrunId(container)));
  if (command === undefined) {
    return;
  }

  container.addEventListener('click', e => {
    // Shift-click must reach the game so the alert is marked read.
    if (e.shiftKey) {
      return;
    }
    showBuffer(command);
    e.preventDefault();
    e.stopPropagation();
  });
}

function init() {
  tiles.observe('NOTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTS: Opens the COGCPD repeat-program vote buffer on a COGC program-changed notification click.',
);
