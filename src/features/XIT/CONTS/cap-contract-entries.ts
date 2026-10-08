/** Entries kept in one CONTS cell before the rest collapse. */
export const visibleContractEntries = 3;

/** Fourth slot when a cell has more entries than `visibleContractEntries`. */
export const hiddenContractEntriesMarker = '(…)';

/**
 * On after `xit-conts-collapse-long-cells` initializes.
 * Stays off when that XIT SET FEAT row is disabled.
 */
export const collapseLongContractCells = ref(false);

export function setCollapseLongContractCells(enabled: boolean) {
  collapseLongContractCells.value = enabled;
}

export function capContractEntries<T>(entries: readonly T[]) {
  if (entries.length <= visibleContractEntries) {
    return { entries, hidden: false };
  }
  return { entries: entries.slice(0, visibleContractEntries), hidden: true };
}

/** Caps only while the XIT SET FEAT row is on. Off renders every entry. */
export function applyContractEntryCap<T>(entries: readonly T[]) {
  if (!collapseLongContractCells.value) {
    return { entries, hidden: false };
  }
  return capContractEntries(entries);
}
