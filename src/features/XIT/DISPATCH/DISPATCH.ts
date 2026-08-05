import '@src/features/XIT/ACT/actions/cx-buy/cx-buy';
import '@src/features/XIT/ACT/actions/mtra/mtra';
import '@src/features/XIT/ACT/material-groups/resupply/resupply';
import '@src/features/XIT/ACT/material-groups/repair/repair';

import DISPATCH from '@src/features/XIT/DISPATCH/DISPATCH.vue';

xit.add({
  command: 'DISPATCH',
  name: 'DISPATCH',
  description: 'Fleet-wide resupply and repair planner.',
  component: () => DISPATCH,
  bufferSize: [800, 500],
});
