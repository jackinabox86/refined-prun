import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ROUTE/Edit.vue';
import { BTF_LEG } from '@src/features/XIT/ROUTE/BTF_LEG';
import { planRouteLegs, stopLines } from '@src/features/XIT/ROUTE/plan-route';
import { resolveRouteStop } from '@src/features/XIT/ROUTE/resolve-route-stop';
import { blueprintTestFlightBlock } from '@src/features/XIT/ROUTE/tank-level';
import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';

act.addAction({
  type: 'Route Test',
  shortDescription:
    'Flight time and fuel for each leg of a route, via a ship blueprint test flight',
  description: action => {
    const count = stopLines(action.routeStops ?? '').length;
    const ship = action.shipRegistration?.trim() ?? '';
    if (count === 0 || ship.length === 0) {
      return '--';
    }
    return `${ship}: ${count} stops`;
  },
  editComponent: Edit,
  generateSteps: async ctx => {
    const { data, log, fail, emitStep } = ctx;
    const registration = data.shipRegistration?.trim() ?? '';
    if (registration.length === 0) {
      log.error('Ship not set');
      fail();
      return;
    }
    const ship = shipsStore.getByRegistration(registration);
    if (ship === undefined) {
      log.error(`Ship ${registration} is not loaded`);
      fail();
      return;
    }
    const blueprint = blueprintsStore.getByNaturalId(ship.blueprintNaturalId);
    const block = blueprintTestFlightBlock(blueprint, ship.blueprintNaturalId);
    if (block !== undefined) {
      log.error(`${registration}: ${block}`);
      fail();
      return;
    }
    const planned = planRouteLegs(stopLines(data.routeStops ?? '').map(x => resolveRouteStop(x)));
    if (planned.error !== undefined) {
      log.error(planned.error);
      fail();
      return;
    }
    for (let i = 0; i < planned.legs.length; i++) {
      const leg = planned.legs[i];
      if (leg === undefined) {
        continue;
      }
      emitStep(
        BTF_LEG({
          ...leg,
          blueprintNaturalId: ship.blueprintNaturalId,
          isLast: i === planned.legs.length - 1,
        }),
      );
    }
  },
});
