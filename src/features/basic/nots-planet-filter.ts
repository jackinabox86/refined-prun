import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { userData } from '@src/store/user-data';
import { getAlertPlanetNaturalId } from '@src/core/alert-planet';
import { watchEffectWhileNodeAlive } from '@src/utils/watch';

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AlertListItem.container), container => {
    watchEffectWhileNodeAlive(container, () => {
      const id = getPrunId(container);
      const alert = alertsStore.getById(id);
      if (!alert) {
        container.style.display = '';
        return;
      }

      const { planetSpecificTypes, disabledPlanets } = userData.settings.notifications;
      if (!planetSpecificTypes.includes(alert.type)) {
        container.style.display = '';
        return;
      }

      const planetId = getAlertPlanetNaturalId(alert);
      const hidden = planetId !== undefined && disabledPlanets.includes(planetId);
      container.style.display = hidden ? 'none' : '';
    });
  });
}

function init() {
  tiles.observe('NOTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTS: Hides planet-specific notifications for planets excluded in XIT NOTSPLANETS.',
);
