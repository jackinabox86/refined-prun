// The agent host appends non-input base-to-ship loads, then one OPEN_SFC,
// after every step the posted package generates. A pickup MTRA into the ship
// auto-emits OPEN_SFC inside that package, so those loads run after departure
// and skip with "not present in origin". When the host will depart, strip
// package auto-SFC so the loads run while the ship is still docked.
export function packageForAgentRun(
  pkg: UserData.ActionPackageData,
  hostOwnsDeparture: boolean,
): UserData.ActionPackageData {
  if (!hostOwnsDeparture) {
    return pkg;
  }
  return {
    ...pkg,
    actions: pkg.actions.map(action =>
      action.type === 'MTRA' ? { ...action, noSfc: true } : action,
    ),
  };
}
