import { userData } from '@src/store/user-data';

/** True only for the load that found no stored feature mode. */
let freshInstall = false;

export function isFreshInstall() {
  return freshInstall;
}

/**
 * A missing mode becomes FULL before features init.
 * A stored BASIC or FULL value is left as it is.
 * Returns whether this load is a fresh install.
 */
export function defaultFreshInstallToFullMode() {
  freshInstall = userData.settings.mode === undefined;
  if (!freshInstall) {
    return false;
  }
  userData.settings.mode = 'FULL';
  return true;
}
