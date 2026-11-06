import '@src/features/XIT/ACT/actions/mtra/mtra';
import '@src/features/XIT/ACT/material-groups/manual/manual';

import LowstrifeActWindow from '@src/features/XIT/LOWSTRIFE/LowstrifeActWindow.vue';

xit.add({
  command: 'LOWSTRIFEACT',
  name: 'SHIP LOADING EXECUTE',
  description: 'Executes the ship loading action package staged by XIT LOWSTRIFE.',
  component: () => LowstrifeActWindow,
});
