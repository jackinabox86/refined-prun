import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { registerNotificationClickCommand } from '@src/infrastructure/prun-ui/notification-click-commands';
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
    // Shift-click companions the registered command, and ctrl-click marks the
    // alert read without opening it. Both must reach the game.
    if (e.shiftKey || e.ctrlKey) {
      return;
    }
    showBuffer(command);
    e.preventDefault();
    e.stopPropagation();
  });
}

function init() {
  registerNotificationClickCommand(cogcRepeatVoteCommand);
  tiles.observe('NOTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTS: Opens the COGCPD repeat-program vote buffer on a COGC program-changed notification click.',
);
