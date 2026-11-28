// The two-phase MTRA protocol used by DISPATCH: a load action (noSfc - transfer
// only) per ship, then a finish action (finishOnly - offload JSONs, agent posts,
// SFC) after all ships' transfers. Kept next to mtra.ts, which interprets these
// flags in generateSteps.
export interface TwoPhaseMtraOptions {
  loadName: string;
  finishName: string;
  group: string;
  origin: string;
  dest: string;
  sfcDestination: string;
  offloadGroups: string[];
  agentGroups: string[];
  repairGroups: string[];
  pickupGroups: string[];
}

export function buildTwoPhaseMtraActions(opts: TwoPhaseMtraOptions): {
  load: UserData.ActionData;
  finish: UserData.ActionData;
} {
  const finish: UserData.ActionData = {
    type: 'MTRA',
    name: opts.finishName,
    group: opts.group,
    origin: opts.origin,
    dest: opts.dest,
    finishOnly: true,
    sfcDestination: opts.sfcDestination,
    ...(opts.offloadGroups.length > 0 ? { offloadGroups: opts.offloadGroups } : {}),
    ...(opts.agentGroups.length > 0 ? { agentGroups: opts.agentGroups } : {}),
    ...(opts.repairGroups.length > 0 ? { repairGroups: opts.repairGroups } : {}),
  };
  // Extra field, not on ActionData: avoided a persisted-contract edit.
  // generateSteps reads it to hang pickups on the matching offload package.
  if (opts.pickupGroups.length > 0) {
    Object.assign(finish, { pickupGroups: opts.pickupGroups });
  }
  return {
    load: {
      type: 'MTRA',
      name: opts.loadName,
      group: opts.group,
      origin: opts.origin,
      dest: opts.dest,
      noSfc: true,
    },
    finish,
  };
}

export interface DispatchShipPackageOptions {
  loadName: string;
  shipName: string;
  origin: string;
  dest: string;
  sfcDestination: string;
  materials: Record<string, number>;
  offloadGroups: string[];
  agentGroups: string[];
  repairGroups: string[];
  pickupGroups: string[];
}

export interface DispatchShipPackage {
  // Absent when the CX load is empty. An empty Manual group fails the package.
  loadGroup: UserData.MaterialGroupData | undefined;
  // Transfer action. Absent when there is nothing to load.
  load: UserData.ActionData | undefined;
  // SFC, plus offload/agent/repair when this ship carries any.
  finish: UserData.ActionData;
}

// A ship with nothing to load still has to be sent. That action must not name a
// material group: manual.ts rejects an empty bill, and the MTRA step then fails
// the whole package.
export function buildDispatchShipPackage(opts: DispatchShipPackageOptions): DispatchShipPackage {
  const loadEmpty = Object.keys(opts.materials).length === 0;
  const hasFinishWork =
    opts.offloadGroups.length > 0 ||
    opts.agentGroups.length > 0 ||
    opts.repairGroups.length > 0 ||
    opts.pickupGroups.length > 0;
  if (loadEmpty && !hasFinishWork) {
    return {
      loadGroup: undefined,
      load: undefined,
      finish: {
        type: 'MTRA',
        name: `Send ${opts.shipName}`,
        origin: opts.origin,
        dest: opts.dest,
        sfcOnly: true,
        sfcDestination: opts.sfcDestination,
      },
    };
  }

  const built = buildTwoPhaseMtraActions({
    loadName: opts.loadName,
    finishName: `Offload ${opts.shipName}`,
    group: opts.loadName,
    origin: opts.origin,
    dest: opts.dest,
    sfcDestination: opts.sfcDestination,
    offloadGroups: opts.offloadGroups,
    agentGroups: opts.agentGroups,
    repairGroups: opts.repairGroups,
    pickupGroups: opts.pickupGroups,
  });
  return {
    loadGroup: loadEmpty
      ? undefined
      : {
          type: 'Manual',
          name: opts.loadName,
          materials: opts.materials,
        },
    load: loadEmpty ? undefined : built.load,
    finish: built.finish,
  };
}
