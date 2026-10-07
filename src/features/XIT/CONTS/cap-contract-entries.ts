/** Entries kept in one CONTS cell before the rest collapse. */
export const visibleContractEntries = 3;

/** Fourth slot when a cell has more entries than `visibleContractEntries`. */
export const hiddenContractEntriesMarker = '…';

export function capContractEntries<T>(entries: readonly T[]) {
  if (entries.length <= visibleContractEntries) {
    return { entries, hidden: false };
  }
  return { entries: entries.slice(0, visibleContractEntries), hidden: true };
}
