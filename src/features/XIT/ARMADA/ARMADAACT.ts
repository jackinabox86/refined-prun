import '@src/features/XIT/ACT/actions/cx-buy/cx-buy';
import '@src/features/XIT/ACT/actions/mtra/mtra';
import '@src/features/XIT/ACT/actions/refuel/refuel';
import '@src/features/XIT/ACT/material-groups/resupply/resupply';
import '@src/features/XIT/ACT/material-groups/repair/repair';

import ArmadaActWindow from '@src/features/XIT/ARMADA/ArmadaActWindow.vue';

xit.add({
  command: 'ARMADAACT',
  name: 'ARMADA EXECUTE',
  description: 'Executes the staged armada resupply/repair action package.',
  component: () => ArmadaActWindow,
});
