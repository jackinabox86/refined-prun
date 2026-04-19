import $style from './nots-distrusted-partner-indicator.module.css';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { waitNotificationLoaded } from '@src/infrastructure/prun-ui/notifications';
import { isDistrustedPartner } from '@src/store/distrust';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AlertListItem.container), processNotification);
}

async function processNotification(container: HTMLElement) {
  await waitNotificationLoaded(container);

  const id = getPrunId(container);
  const alert = alertsStore.getById(id);
  if (!alert) {
    return;
  }

  const partnerEntry = alert.data.find(x => x.key === 'partner');
  if (!partnerEntry) {
    return;
  }
  const partner = partnerEntry.value as PrunApi.ContractPartner;

  watchEffectWhileNodeAlive(container, () => {
    container.classList.toggle($style.distrustedAlert, isDistrustedPartner(partner));
  });
}

function init() {
  tiles.observe('NOTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTS: Marks notifications from distrusted partners with a red indicator.',
);
