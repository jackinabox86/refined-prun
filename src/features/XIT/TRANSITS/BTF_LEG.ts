import { act } from '@src/features/XIT/ACT/act-registry';
import { btfLegActions } from '@src/features/XIT/TRANSITS/btf-leg-actions';
import {
  applyConfirmedLoadout,
  captureLoadout,
  confirmedLoadout,
  readGateway,
  setInventoryFull,
  tankLevelsAtTarget,
} from '@src/features/XIT/TRANSITS/btf-loadout';
import { RouteLeg } from '@src/features/XIT/TRANSITS/plan-route';
import { flightPlanFailure, summarizeFreshPlan } from '@src/features/XIT/TRANSITS/read-btf-summary';
import {
  formatLegLine,
  formatRouteTotal,
  routeResults,
} from '@src/features/XIT/TRANSITS/route-results';
import { saveRouteLegs } from '@src/features/XIT/ROUTE/routes';
import { blueprintTestFlightBlock } from '@src/features/XIT/TRANSITS/tank-level';
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
      confirmedLoadout.reset();
    }
    const label = `${data.originLabel} → ${data.destinationLabel}`;
    const flight = { anchor: undefined as Element | undefined };
    const finish = (
      line: string,
      ok: boolean,
      recorded?: { seconds: number; stl: number; ftl: number },
    ) => {
      const live = flight.anchor === undefined ? undefined : readGateway(flight.anchor);
      const gateway = live ?? confirmedLoadout.current?.gatewayOn;
      routeResults.legs.push(
        ok && recorded !== undefined
          ? {
              ok: true,
              seconds: recorded.seconds,
              stl: recorded.stl,
              ftl: recorded.ftl,
              ...(gateway === undefined ? {} : { gateway }),
            }
          : { ok: false },
      );
      saveRouteLegs(routeResults.routeId, routeResults.legs);
      const text = data.isLast ? `${line} | ${formatRouteTotal(routeResults.legs)}` : line;
      if (ok && recorded !== undefined) {
        const saved = confirmedLoadout.current;
        if (saved !== undefined) {
          saved.priorStl.push(recorded.stl);
          saved.priorFtl.push(recorded.ftl);
        }
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

    const blueprint = blueprintsStore.peek().getByNaturalId(data.blueprintNaturalId);
    const block = blueprintTestFlightBlock(blueprint, data.blueprintNaturalId);
    if (block !== undefined) {
      finish(`${label}: ${block}`, false);
      return;
    }

    const tile = await requestTile(`BTF ${data.blueprintNaturalId}`, { actGate: false });
    if (tile === undefined) {
      return;
    }
    flight.anchor = tile.anchor;

    const containers = _$$(tile.anchor, C.AddressSelector.container);
    const originField = containers[0];
    const destinationField = containers[1];
    if (originField === undefined || destinationField === undefined) {
      finish(`${label}: blueprint test flight is missing origin or destination`, false);
      return;
    }

    const previousPlan = currentPlan(tile.anchor);
    const originQuery = data.originQuery;
    const destinationQuery = data.destinationQuery;
    for (const action of btfLegActions) {
      if (action === 'apply-loadout' && !isFirstOfType) {
        const saved = confirmedLoadout.current;
        if (saved === undefined) {
          finish(`${label}: fuel loadout was not confirmed`, false);
          return;
        }
        const error = await applyConfirmedLoadout(tile.anchor, saved);
        if (error !== undefined) {
          finish(`${label}: ${error}`, false);
          return;
        }
      }
      if (action === 'select-origin') {
        const selected = await selectAddress(originField, originQuery);
        if (!selected) {
          finish(`${label}: could not set origin ${data.originLabel}`, false);
          return;
        }
      }
      if (action === 'select-destination') {
        const selected = await selectAddress(destinationField, destinationQuery);
        if (!selected) {
          finish(`${label}: could not set destination ${data.destinationLabel}`, false);
          return;
        }
      }
      if (action === 'confirm-loadout' && isFirstOfType) {
        const full = await setInventoryFull(tile.anchor);
        if (full !== undefined) {
          finish(`${label}: ${full}`, false);
          return;
        }
        const shown = await waitForLegPlan(
          tile.anchor,
          previousPlan,
          originQuery,
          destinationQuery,
          300,
        );
        if (shown === undefined) {
          finish(
            `${label}: ${flightPlanFailure(currentPlan(tile.anchor), originQuery, destinationQuery)}`,
            false,
          );
          return;
        }
        await waitAct(`Set the fuel loadout for ${label}, then ACT`);
        const captured = captureLoadout(tile.anchor);
        if (!captured.ok) {
          finish(`${label}: ${captured.error}`, false);
          return;
        }
        confirmedLoadout.current = captured.loadout;
      }
      if (action === 'read-summary') {
        const settle = isFirstOfType ? 1000 : 300;
        const shown = await waitForLegPlan(
          tile.anchor,
          previousPlan,
          originQuery,
          destinationQuery,
          settle,
        );
        if (shown === undefined) {
          finish(
            `${label}: ${flightPlanFailure(currentPlan(tile.anchor), originQuery, destinationQuery)}`,
            false,
          );
          return;
        }
        // The last leg stays on screen until the player confirms the fuel.
        // Middle legs do not wait. A one-leg route already waited above.
        const confirmLast = data.isLast && !isFirstOfType;
        if (confirmLast) {
          await waitAct(`Check the fuel loadout for ${label}, then ACT`);
        }
        const matched = confirmLast
          ? await waitForLegPlan(tile.anchor, previousPlan, originQuery, destinationQuery, settle)
          : shown;
        if (matched === undefined) {
          finish(
            `${label}: ${flightPlanFailure(currentPlan(tile.anchor), originQuery, destinationQuery)}`,
            false,
          );
          return;
        }
        const saved = confirmedLoadout.current;
        if (saved === undefined) {
          finish(`${label}: fuel loadout was not confirmed`, false);
          return;
        }
        const tanks = tankLevelsAtTarget(tile.anchor, saved);
        if (tanks !== undefined) {
          finish(`${label}: ${tanks}`, false);
          return;
        }
        finish(formatLegLine(label, matched), true, matched);
        return;
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

// The mission id stays put and the plan object is replaced. Wait until the
// matching plan has sat still, so a slider change that is still in flight is
// not recorded as the leg.
async function waitForLegPlan(
  anchor: Element,
  previous: PrunApi.FlightPlan | undefined,
  originQuery: string,
  destinationQuery: string,
  settleMs: number,
) {
  let matched: { duration: string; seconds: number; stl: number; ftl: number } | undefined;
  let seen: PrunApi.FlightPlan | undefined;
  let since = 0;
  const ready = await waitFor(() => {
    const plan = currentPlan(anchor);
    if (plan !== seen) {
      seen = plan;
      since = Date.now();
      matched = undefined;
      return false;
    }
    const summary = summarizeFreshPlan(plan, previous, originQuery, destinationQuery);
    if (summary === undefined) {
      return false;
    }
    if (Date.now() - since < settleMs) {
      return false;
    }
    matched = summary;
    return true;
  }, 8000);
  return ready ? matched : undefined;
}
