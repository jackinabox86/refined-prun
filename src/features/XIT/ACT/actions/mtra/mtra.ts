import { act } from '@src/features/XIT/ACT/act-registry';
import Edit from '@src/features/XIT/ACT/actions/mtra/Edit.vue';
import Configure from '@src/features/XIT/ACT/actions/mtra/Configure.vue';
import { MTRA_TRANSFER } from '@src/features/XIT/ACT/action-steps/MTRA_TRANSFER';
import { POST_AGENT } from '@src/features/XIT/ACT/action-steps/POST_AGENT';
import { OPEN_SFC } from '@src/features/XIT/ACT/action-steps/OPEN_SFC';
import { atSameLocation, deserializeStorage } from '@src/features/XIT/ACT/actions/utils';
import { Config, CX_BUY_ONLY_DEST } from '@src/features/XIT/ACT/actions/mtra/config';
import { AssertFn, configurableValue } from '@src/features/XIT/ACT/shared-types';

act.addAction<Config>({
  type: 'MTRA',
  shortDescription: 'Transfer materials between storages at the same location',
  description: (action, config) => {
    if (!action.group || !action.origin || !action.dest) {
      return '--';
    }

    const origin =
      action.origin == configurableValue
        ? (config?.origin ?? 'configured location')
        : action.origin;
    const dest =
      action.dest == configurableValue
        ? (config?.destination ?? 'configured location')
        : action.dest;
    if (dest === CX_BUY_ONLY_DEST) {
      return `CX Buy only [${action.group}] from ${origin} (no transfer)`;
    }
    return `Transfer group [${action.group}] from ${origin} to ${dest}`;
  },
  editComponent: Edit,
  configureComponent: Configure,
  needsConfigure: data => {
    return data.origin === configurableValue || data.dest === configurableValue;
  },
  isValidConfig: (data, config) => {
    return (
      (data.origin !== configurableValue || config.origin !== undefined) &&
      (data.dest !== configurableValue || config.destination !== undefined)
    );
  },
  generateSteps: async ctx => {
    const { data, config, packageName, getMaterialGroup, getMaterialGroupPlanet, emitStep } = ctx;
    const assert: AssertFn = ctx.assert;

    const PRUNPLANNER_PACKAGES = [
      'PRUNplanner Supply Cart',
      'PRUNplanner Construct',
      'PRUNplanner Transfer',
      'PRUNplanner Burn Supply',
    ];

    const materials = await getMaterialGroup(data.group);
    assert(materials, 'Invalid material group');

    const serializedOrigin = data.origin === configurableValue ? config?.origin : data.origin;
    const origin = deserializeStorage(serializedOrigin);
    assert(origin, 'Invalid origin');

    const serializedDest = data.dest === configurableValue ? config?.destination : data.dest;
    if (serializedDest === CX_BUY_ONLY_DEST) {
      return;
    }
    const dest = deserializeStorage(serializedDest);
    assert(dest, 'Invalid destination');

    const isSameLocation = atSameLocation(origin, dest);
    assert(isSameLocation, 'Origin and destination are not at the same location');

    for (const ticker of Object.keys(materials)) {
      emitStep(
        MTRA_TRANSFER({
          from: origin.id,
          to: dest.id,
          ticker,
          amount: materials[ticker],
        }),
      );
    }

    if (dest.type === 'SHIP_STORE' && data.postToAgent) {
      emitStep(
        POST_AGENT({
          pkg: {
            global: { name: 'Auto Offload' },
            groups: [
              {
                type: 'Manual' as UserData.MaterialGroupType,
                name: data.group,
                materials,
              },
            ],
            actions: [
              {
                type: 'MTRA' as UserData.ActionType,
                name: data.group,
                group: data.group,
                origin: serializedDest,
                dest: configurableValue,
              },
            ],
          } as UserData.ActionPackageData,
        }),
      );
    }

    if (dest.type === 'SHIP_STORE' && !PRUNPLANNER_PACKAGES.includes(packageName)) {
      const planet = getMaterialGroupPlanet(data.group);
      emitStep(OPEN_SFC({ shipId: dest.addressableId, destination: planet }));
    }
  },
});
