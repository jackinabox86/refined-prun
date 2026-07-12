import '@src/features/XIT/ACT/actions/cx-buy/cx-buy';
import '@src/features/XIT/ACT/actions/mtra/mtra';
import '@src/features/XIT/ACT/material-groups/resupply/resupply';
import '@src/features/XIT/ACT/material-groups/repair/repair';

import ARMADA from '@src/features/XIT/ARMADA/ARMADA.vue';

xit.add({
  command: 'ARMADA',
  name: 'ARMADA',
  description: 'Fleet-wide resupply and repair planner.',
  component: () => ARMADA,
  bufferSize: [1000, 500],
});
