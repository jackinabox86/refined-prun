import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ROUTE/Edit.vue';
import { BTF_LEG } from '@src/features/XIT/ROUTE/BTF_LEG';
import { planRouteLegs, stopLines } from '@src/features/XIT/ROUTE/plan-route';
import { resolveRouteStop } from '@src/features/XIT/ROUTE/resolve-route-stop';

act.addAction({
  type: 'Route Test',
  shortDescription: 'Flight time and fuel for each leg of a route, via blueprint test flight',
  description: action => {
    const count = stopLines(action.routeStops ?? '').length;
    return count > 0 ? `Test ${count} stops` : '--';
  },
  editComponent: Edit,
  generateSteps: async ctx => {
    const { data, log, fail, emitStep } = ctx;
    const blueprintNaturalId = data.blueprintNaturalId?.trim() ?? '';
    if (blueprintNaturalId.length === 0) {
      log.error('Blueprint not set');
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
          blueprintNaturalId,
          isLast: i === planned.legs.length - 1,
        }),
      );
    }
  },
});
