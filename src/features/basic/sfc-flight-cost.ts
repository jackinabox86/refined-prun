import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import { flightPlansStore } from '@src/infrastructure/prun-api/data/flight-plans';
import { getPrice } from '@src/infrastructure/fio/cx';
import { formatCurrency } from '@src/utils/format';
import { createReactiveDiv } from '@src/utils/reactive-element';
import { keepLast } from '@src/utils/keep-last';
import { refPrunId } from '@src/infrastructure/prun-ui/attributes';
import { refTextContent } from '@src/utils/reactive-dom';

function onTileReady(tile: PrunTile) {
  const ship = computed(() => shipsStore.getByRegistration(tile.parameter));
  subscribe($$(tile.anchor, C.MissionPlan.table), x => onTableReady(x, ship));
}

function onTableReady(table: HTMLElement, ship: Ref<PrunApi.Ship | undefined>) {
  const planId = refPrunId(table);
  subscribe($$(table, C.MissionPlan.stats), stats => {
    subscribe($$(stats, 'tr'), x => onSummaryRowReady(table, x, ship, planId));
  });
}

function onSummaryRowReady(
  table: HTMLElement,
  row: HTMLElement,
  ship: Ref<PrunApi.Ship | undefined>,
  planId: Ref<string | null>,
) {
  const thead = _$(table, 'thead');
  const headerRow = thead ? _$(thead, 'tr') : undefined;
  if (!headerRow) {
    return;
  }

  // Header labels can carry extra content (Damage has an info icon on fee-bearing flights),
  // so match by prefix instead of full text.
  const headerCells = Array.from(headerRow.children);
  const damageIndex = headerCells.findIndex(x => x.textContent?.trim().startsWith('Damage'));
  const feeIndex = headerCells.findIndex(x => x.textContent?.trim().startsWith('Fee'));
  if (damageIndex === -1) {
    return;
  }

  const feeText = feeIndex >= 0 ? refTextContent(row.children[feeIndex]) : ref(null);

  const cost = computed(() => {
    const fuelCost = getFuelCost(ship.value, planId.value);
    if (fuelCost === undefined) {
      return undefined;
    }
    return fuelCost + parseFee(feeText.value);
  });

  const text = computed(() =>
    cost.value !== undefined ? `Cost: ${formatCurrency(cost.value)}` : undefined,
  );
  const div = createReactiveDiv(row, text);
  keepLast(row, () => row.children[damageIndex], div);
}

function getFuelCost(ship: PrunApi.Ship | undefined, planId: string | null) {
  const segments = getSegments(ship, planId);
  if (!segments) {
    return undefined;
  }

  let sf = 0;
  let ff = 0;
  for (const segment of segments) {
    sf += segment.stlFuelConsumption ?? 0;
    ff += segment.ftlFuelConsumption ?? 0;
  }

  const sfCost = getFuelTypeCost('SF', sf);
  const ffCost = getFuelTypeCost('FF', ff);
  if (sfCost === undefined || ffCost === undefined) {
    return undefined;
  }

  return sfCost + ffCost;
}

function getFuelTypeCost(ticker: string, amount: number) {
  if (amount === 0) {
    return 0;
  }

  const price = getPrice(ticker);
  return price === undefined ? undefined : amount * price;
}

function getSegments(ship: PrunApi.Ship | undefined, planId: string | null) {
  if (!ship) {
    return undefined;
  }

  if (ship.flightId) {
    return flightsStore.getById(ship.flightId)?.segments;
  }

  if (!planId) {
    return undefined;
  }

  return flightPlansStore.getById(planId)?.segments;
}

function parseFee(text: string | null) {
  if (!text) {
    return 0;
  }

  // Amounts can be concatenated without spacing ("12,000 AIC4,000 CIS"), so a \b after
  // the currency code would fail — use a lookahead for "not another letter" instead.
  let fee = 0;
  for (const match of text.matchAll(/([\d.,]+)\s*[A-Z]{3}(?![A-Z])/g)) {
    const value = Number(match[1].replaceAll(',', ''));
    if (!isFinite(value)) {
      continue;
    }
    fee += value;
  }
  return fee;
}

function init() {
  tiles.observe('SFC', onTileReady);
}

features.add(import.meta.url, init, 'SFC: Shows the total flight cost including fees and fuel.');
