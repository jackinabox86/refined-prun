import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { registerNotificationClickCommand } from '@src/infrastructure/prun-ui/notification-click-commands';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AlertListItem.container), processNotification);
}

function shipInventoryCommand(alert?: PrunApi.Alert) {
  if (alert?.type !== 'SHIP_FLIGHT_ENDED') {
    return undefined;
  }

  const registration = alert.data.find(x => x.key === 'registration')?.value as string;
  if (!registration) {
    return undefined;
  }
  return `SHPI ${registration}`;
}

async function processNotification(container: HTMLElement) {
  const command = shipInventoryCommand(alertsStore.getById(getPrunId(container)));
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
  registerNotificationClickCommand(shipInventoryCommand);
  tiles.observe('NOTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTS: Opens ship inventory on "ship arrived" notification click.',
);
