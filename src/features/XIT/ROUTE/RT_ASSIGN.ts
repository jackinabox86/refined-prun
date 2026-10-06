import { act } from '@src/features/XIT/ACT/act-registry';
import { cargoFits } from '@src/features/XIT/ROUTE/route-assign';
import { beginShipPick } from '@src/features/XIT/ROUTE/route-ship-pick';
import { freeShipLabels } from '@src/features/XIT/RTACT/route-controls';
import {
  readAssignmentRows,
  revealAssignments,
  shipNames,
  tryAssignShip,
} from '@src/features/XIT/RTACT/route-dom';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { waitFor } from '@src/utils/wait-for';

interface Data {
  routeId: string;
  ship: string;
  need: Record<string, number>;
}

function shipForLabel(label: string) {
  const names = new Set(shipNames(label).map(x => x.toLowerCase()));
  return (shipsStore.all.value ?? []).find(ship => {
    if (names.has(ship.registration.toLowerCase())) {
      return true;
    }
    return ship.name.length > 0 && names.has(ship.name.toLowerCase());
  });
}

function labelFits(label: string, need: Record<string, number>) {
  const ship = shipForLabel(label);
  const hold = ship === undefined ? undefined : storagesStore.getById(ship.idShipStore);
  if (hold === undefined) {
    return false;
  }
  const specs: Record<string, { weight: number; volume: number } | undefined> = {};
  for (const ticker of Object.keys(need)) {
    const mat = materialsStore.getByTicker(ticker);
    specs[ticker] = mat === undefined ? undefined : { weight: mat.weight, volume: mat.volume };
  }
  return cargoFits(need, specs, hold);
}

export const RT_ASSIGN = act.addActionStep<Data>({
  type: 'RT_ASSIGN',
  description: data => {
    const ship = data.ship.trim();
    return ship.length > 0
      ? `Assign ${ship} to ${data.routeId}`
      : `Assign a ship to ${data.routeId}`;
  },
  execute: async ctx => {
    const { data, log, waitAct, fail, complete } = ctx;
    const tile = await ctx.requestTile(`RT ${data.routeId}`);
    if (tile === undefined) {
      return;
    }
    await waitFor(() => readAssignmentRows(tile.anchor).length > 0, 5000);
    const preferred = data.ship.trim();
    if (preferred.length > 0) {
      const attempt = await tryAssignShip({
        anchor: tile.anchor,
        frame: tile.frame,
        ship: preferred,
        routeId: data.routeId,
        waitAct,
      });
      if (attempt.ok) {
        log.success(
          attempt.already
            ? `${preferred} is already assigned to ${data.routeId}`
            : `Assigned ${preferred} to ${data.routeId}`,
        );
        complete();
        return;
      }
      if (attempt.kind === 'click' || attempt.kind === 'unconfirmed') {
        revealAssignments(tile.anchor);
        fail(attempt.reason);
        return;
      }
      log.warning(`${attempt.reason}. Pick another ship.`);
    }
    const free = freeShipLabels(readAssignmentRows(tile.anchor)).filter(label =>
      labelFits(label, data.need),
    );
    if (free.length === 0) {
      revealAssignments(tile.anchor);
      fail('No free ship fits this route.');
      return;
    }
    const picked = await beginShipPick(free.map(label => ({ label })));
    if (picked === undefined) {
      fail('No ship picked.');
      return;
    }
    const second = await tryAssignShip({
      anchor: tile.anchor,
      frame: tile.frame,
      ship: picked,
      routeId: data.routeId,
      waitAct,
    });
    if (!second.ok) {
      revealAssignments(tile.anchor);
      fail(second.reason);
      return;
    }
    log.success(`Assigned ${picked} to ${data.routeId}`);
    complete();
  },
});
