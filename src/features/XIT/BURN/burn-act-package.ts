import { allExchangesValue } from '@src/features/XIT/ACT/actions/refuel/utils';
import { configurableValue } from '@src/features/XIT/ACT/shared-types';

// Same Refuel action DISPATCH prepends. Origin is every exchange, not the
// planet being resupplied, so the toggle is one preference for every base.
export function burnActRefuelAction(): UserData.ActionData {
  return {
    type: 'Refuel',
    name: 'Refuel',
    origin: allExchangesValue,
    buyMissingFuel: true,
  };
}

export function burnActPackage(args: {
  planetName: string | undefined;
  naturalId: string;
  refuel: boolean;
  agent: boolean;
}): UserData.ActionPackageData {
  return {
    global: { name: `Burn Resupply: ${args.planetName ?? args.naturalId}` },
    groups: [
      {
        type: 'Resupply',
        name: 'Resupply',
        planet: args.planetName,
        days: configurableValue,
        useBaseInv: true,
      },
    ],
    actions: [
      ...(args.refuel ? [burnActRefuelAction()] : []),
      {
        type: 'CX Buy',
        name: 'CX Buy',
        group: 'Resupply',
        exchange: configurableValue,
        useCXInv: true,
        skippable: true,
      },
      {
        type: 'MTRA',
        name: 'MTRA',
        group: 'Resupply',
        origin: configurableValue,
        dest: configurableValue,
        postToAgent: args.agent,
      },
    ],
  };
}
