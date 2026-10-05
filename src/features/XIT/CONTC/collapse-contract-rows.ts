/** Rows kept for one contract before the rest collapse to a single marker. */
export const maxContractConditionRows = 3;

/** Centered stand-in for the 4th and later rows of one contract. */
export const collapsedContractMarker = '(…)';

export interface ContractRowRef {
  contract: { id: string };
}

export type CollapsedContractEntry<T extends ContractRowRef> =
  | { kind: 'condition'; row: T }
  | { kind: 'collapsed'; contractId: string };

/**
 * Keeps the first three rows of each contract, in the list's existing order.
 * The fourth row of that contract becomes one collapsed marker; later rows
 * of the same contract are omitted. Other contracts continue after it.
 */
export function collapseLongContractRows<T extends ContractRowRef>(rows: readonly T[]) {
  const shown = new Map<string, number>();
  const entries: CollapsedContractEntry<T>[] = [];
  for (const row of rows) {
    const id = row.contract.id;
    const count = shown.get(id) ?? 0;
    if (count < maxContractConditionRows) {
      entries.push({ kind: 'condition', row });
      shown.set(id, count + 1);
      continue;
    }
    if (count === maxContractConditionRows) {
      entries.push({ kind: 'collapsed', contractId: id });
      shown.set(id, count + 1);
    }
  }
  return entries;
}
