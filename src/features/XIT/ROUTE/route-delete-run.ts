import type { ActionStep } from '@src/features/XIT/ACT/shared-types';
import { RT_DELETE } from '@src/features/XIT/ROUTE/RT_DELETE';
import { deleteConfirmMessage, linkedRtId } from '@src/features/XIT/ROUTE/route-delete';
import { findRoute, removeRoute } from '@src/features/XIT/ROUTE/routes';
import { shipRoutesStore } from '@src/infrastructure/prun-api/data/ship-routes';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { showBuffer } from '@src/infrastructure/prun-ui/buffers';
import { showConfirmationOverlay } from '@src/infrastructure/prun-ui/tile-overlay';

export interface StagedRouteDelete {
  pkg: UserData.ActionPackageData;
  steps: ActionStep[];
}

export const stagedRouteDelete = ref<StagedRouteDelete | undefined>(undefined);

export const ROUTE_DELETE_PACKAGE = 'Route Delete';

function shipsOn(rtId: string) {
  const wanted = rtId.toUpperCase();
  return shipRoutesStore.all.value
    .filter(execution => execution.route.naturalId.toUpperCase() === wanted)
    .map(execution => {
      const ship = shipsStore.getById(execution.shipId);
      const name = ship?.name?.trim() ?? '';
      return name.length > 0 ? name : (ship?.registration ?? execution.shipId);
    });
}

// ROUTECONFIG DELETE and ROUTEBURN REMOVE both land here: one confirmation, then an
// unlinked route goes at once and a linked one goes through XIT ROUTEDEL.
export function requestRouteDelete(event: Event, id: string, onDeleted?: () => void) {
  const route = findRoute(id);
  if (route === undefined) {
    return;
  }
  const rtId = linkedRtId(route);
  const message = deleteConfirmMessage({
    name: route.name,
    rtId,
    ships: rtId === undefined ? [] : shipsOn(rtId),
  });
  showConfirmationOverlay(
    event,
    () => {
      if (rtId === undefined) {
        removeRoute(id);
        onDeleted?.();
        return;
      }
      stagedRouteDelete.value = {
        pkg: { global: { name: ROUTE_DELETE_PACKAGE }, groups: [], actions: [] },
        steps: [RT_DELETE({ configRouteId: id, name: route.name, rtId })],
      };
      showBuffer('XIT ROUTEDEL');
    },
    { message, confirmLabel: rtId === undefined ? 'DELETE' : 'DELETE BOTH' },
  );
}
