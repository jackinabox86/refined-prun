import { ActionPackageConfig, configurableValue } from '@src/features/XIT/ACT/shared-types';
import { Config } from '@src/features/XIT/ACT/actions/mtra/config';

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

// Base the host loads from: the first MTRA's destination. A single-group post
// (BURNACT agent) leaves it configurable, so the base exists only in the run
// config; without it the host would depart with no loads at all.
export function agentBaseDest(
  pkg: UserData.ActionPackageData,
  runConfig: ActionPackageConfig | undefined,
): string | undefined {
  const mtra = pkg.actions.find(x => x.type === 'MTRA');
  if (mtra === undefined) {
    return undefined;
  }
  if (mtra.dest !== configurableValue) {
    return mtra.dest;
  }
  const actions = runConfig?.actions as unknown as Record<string, Config | undefined> | undefined;
  return actions?.[mtra.name!]?.destination;
}
