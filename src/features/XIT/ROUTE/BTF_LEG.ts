import { act } from '@src/features/XIT/ACT/act-registry';
import { btfLegActions } from '@src/features/XIT/ROUTE/btf-leg-actions';
import { RouteLeg } from '@src/features/XIT/ROUTE/plan-route';
import { flightPlanFailure, summarizeFreshPlan } from '@src/features/XIT/ROUTE/read-btf-summary';
import {
  formatLegLine,
  formatRouteTotal,
  routeResults,
} from '@src/features/XIT/ROUTE/route-results';
import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';
import { flightPlansStore } from '@src/infrastructure/prun-api/data/flight-plans';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import { waitFor } from '@src/utils/wait-for';

export interface BtfLegData extends RouteLeg {
  blueprintNaturalId: string;
  isLast: boolean;
  result?: string;
}

export const BTF_LEG = act.addActionStep<BtfLegData>({
  type: 'BTF_LEG',
  description: data => data.result ?? `${data.originLabel} → ${data.destinationLabel}`,
  execute: async ctx => {
    const { data, log, isFirstOfType, waitAct, requestTile, skip } = ctx;
    if (isFirstOfType) {
      routeResults.reset();
      await waitAct();
    }
    const label = `${data.originLabel} → ${data.destinationLabel}`;
    const finish = (
      line: string,
      ok: boolean,
      recorded?: { seconds: number; stl: number; ftl: number },
    ) => {
      routeResults.legs.push(
        ok && recorded !== undefined
          ? { ok: true, seconds: recorded.seconds, stl: recorded.stl, ftl: recorded.ftl }
          : { ok: false },
      );
      const text = data.isLast ? `${line} | ${formatRouteTotal(routeResults.legs)}` : line;
      if (ok) {
        data.result = text;
        ctx.complete();
        return;
      }
      log.error(text);
      skip({ silent: true });
    };

    if (
      data.error !== undefined ||
      data.originQuery === undefined ||
      data.destinationQuery === undefined
    ) {
      finish(`${label}: ${data.error ?? 'stop did not resolve'}`, false);
      return;
    }

    const blueprint = blueprintsStore.getByNaturalId(data.blueprintNaturalId);
    if (blueprint === undefined) {
      finish(`${label}: blueprint ${data.blueprintNaturalId} is not loaded`, false);
      return;
    }
    if (blueprint.status !== 'VALID') {
      finish(`${label}: blueprint is ${blueprint.status}; test flight does not compute`, false);
      return;
    }

    const tile = await requestTile(`BTF ${data.blueprintNaturalId}`, { actGate: false });
    if (tile === undefined) {
      return;
    }

    const containers = _$$(tile.anchor, C.AddressSelector.container);
    const originField = containers[0];
    const destinationField = containers[1];
    if (originField === undefined || destinationField === undefined) {
      finish(`${label}: blueprint test flight is missing origin or destination`, false);
      return;
    }

    const previousPlan = currentPlan(tile.anchor);
    for (const action of btfLegActions) {
      if (action === 'select-origin') {
        const selected = await selectAddress(originField, data.originQuery);
        if (!selected) {
          finish(`${label}: could not set origin ${data.originLabel}`, false);
          return;
        }
      }
      if (action === 'select-destination') {
        const selected = await selectAddress(destinationField, data.destinationQuery);
        if (!selected) {
          finish(`${label}: could not set destination ${data.destinationLabel}`, false);
          return;
        }
      }
      if (action === 'read-summary') {
        let matched = summarizeFreshPlan(currentPlan(tile.anchor), previousPlan);
        const changed = await waitFor(() => {
          matched = summarizeFreshPlan(currentPlan(tile.anchor), previousPlan);
          return matched !== undefined;
        }, 8000);
        if (changed && matched !== undefined) {
          finish(formatLegLine(label, matched), true, matched);
          return;
        }
        // The plan already on screen belongs to the previous submit.
        finish(`${label}: ${flightPlanFailure(currentPlan(tile.anchor))}`, false);
      }
    }
  },
});

function currentPlan(anchor: Element) {
  const table = _$(anchor, C.MissionPlan.table) as HTMLElement | undefined;
  if (table === undefined) {
    return undefined;
  }
  return flightPlansStore.getById(getPrunId(table));
}
