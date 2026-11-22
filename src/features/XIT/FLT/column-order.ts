export const FLT_COLUMN_IDS = [
  'name',
  'shipClass',
  'size',
  'cargo',
  'cargoSize',
  'status',
  'time',
  'repair',
  'fuel',
  'problems',
] as const;

export type FltColumnId = (typeof FLT_COLUMN_IDS)[number];

export const DEFAULT_COLUMN_ORDER: readonly FltColumnId[] = FLT_COLUMN_IDS;

export const FLT_PICKER_COLUMN_IDS: readonly FltColumnId[] = FLT_COLUMN_IDS.filter(
  x => x !== 'status',
);

export const FLT_COLUMN_PICKER_LABELS: Record<Exclude<FltColumnId, 'status'>, string> = {
  name: 'NAME',
  shipClass: 'CLASS',
  size: 'SIZE',
  cargo: 'CARGO',
  cargoSize: 'CARGO/SIZE',
  time: 'ETA',
  repair: 'REPAIR',
  fuel: 'FUEL',
  problems: 'PROBLEMS',
};

const columnIdSet = new Set<string>(FLT_COLUMN_IDS);

export function isFltColumnId(value: string): value is FltColumnId {
  return columnIdSet.has(value);
}

export function normalizeColumnOrder(order: readonly string[]): FltColumnId[] {
  const seen = new Set<FltColumnId>();
  const result: FltColumnId[] = [];

  for (const id of order) {
    if (!isFltColumnId(id) || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  for (const id of DEFAULT_COLUMN_ORDER) {
    if (!seen.has(id)) {
      result.push(id);
    }
  }

  return result;
}

export function pickerOrderFrom(fullOrder: readonly FltColumnId[]): FltColumnId[] {
  return fullOrder.filter(x => x !== 'status');
}

export function fullOrderFromPicker(
  pickerOrder: readonly FltColumnId[],
  previousFull: readonly FltColumnId[],
): FltColumnId[] {
  const withoutStatus: FltColumnId[] = pickerOrder.filter(x => x !== 'status');
  const statusIdx = previousFull.indexOf('status');
  const insertAt =
    statusIdx === -1
      ? DEFAULT_COLUMN_ORDER.indexOf('status')
      : Math.min(statusIdx, withoutStatus.length);
  const next: FltColumnId[] = [...withoutStatus];
  next.splice(insertAt, 0, 'status');
  return normalizeColumnOrder(next);
}

export function sameColumnOrder(a: readonly FltColumnId[], b: readonly FltColumnId[]) {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((id, i) => id === b[i]);
}

/** Click toggles only when a drag is not in progress (or just finished). */
export function shouldApplyColumnToggle(dragActive: boolean) {
  return !dragActive;
}
