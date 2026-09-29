import { act } from '@src/features/XIT/ACT/act-registry';
import { btfLegActions } from '@src/features/XIT/ROUTE/btf-leg-actions';
import { RouteLeg } from '@src/features/XIT/ROUTE/plan-route';
import { readBtfSummary } from '@src/features/XIT/ROUTE/read-btf-summary';
import {
  formatLegLine,
  formatRouteTotal,
  routeResults,
} from '@src/features/XIT/ROUTE/route-results';
import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';
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

    const previous = summarySignature(tile.anchor);
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
        const labels = btfLabels();
        let matched = readChangedSummary(tile.anchor, previous, labels);
        const changed = await waitFor(() => {
          matched = readChangedSummary(tile.anchor, previous, labels);
          return matched !== undefined;
        }, 8000);
        if (changed && matched !== undefined) {
          finish(formatLegLine(label, matched), true, matched);
          return;
        }
        // An unchanged summary is the previous leg's plan. Do not report it.
        const current = readCurrentSummary(tile.anchor, labels);
        const reason =
          current !== undefined && current.ok === false ? current.reason : 'no flight plan';
        finish(`${label}: ${reason}`, false);
      }
    }
  },
});

function btfLabels() {
  return {
    duration: L.MissionPlan.duration() ?? 'Duration',
    consumption: L.MissionPlan.consumption() ?? 'Consumption',
  };
}

function summaryRow(anchor: Element) {
  const table = _$(anchor, C.MissionPlan.table);
  if (table === undefined) {
    return undefined;
  }
  const stats = _$(table, C.MissionPlan.stats);
  if (stats === undefined) {
    return undefined;
  }
  return _$(stats, 'tr');
}

function summarySignature(anchor: Element) {
  return summaryRow(anchor)?.textContent?.trim() ?? '';
}

function headerTexts(anchor: Element) {
  const table = _$(anchor, C.MissionPlan.table);
  const header = table === undefined ? undefined : _$(table, 'thead tr');
  if (header === undefined) {
    return [];
  }
  return Array.from(header.children).map(x => x.textContent?.trim() ?? '');
}

function cellTexts(row: Element) {
  return Array.from(row.children).map(x => x.textContent?.trim() ?? '');
}

function readCurrentSummary(anchor: Element, labels: { duration: string; consumption: string }) {
  const row = summaryRow(anchor);
  if (row === undefined) {
    return undefined;
  }
  return readBtfSummary(headerTexts(anchor), cellTexts(row), labels);
}

function readChangedSummary(
  anchor: Element,
  previous: string,
  labels: { duration: string; consumption: string },
) {
  const row = summaryRow(anchor);
  if (row === undefined) {
    return undefined;
  }
  const signature = row.textContent?.trim() ?? '';
  if (signature.length === 0 || signature === previous) {
    return undefined;
  }
  const summary = readBtfSummary(headerTexts(anchor), cellTexts(row), labels);
  return summary.ok ? summary : undefined;
}
