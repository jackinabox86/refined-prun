import '@src/features/XIT/TRANSITS/route-test';

import TransitsActWindow from '@src/features/XIT/TRANSITS/TransitsActWindow.vue';

xit.add({
  command: 'TRANSITSACT',
  name: 'TRANSITS RUN',
  description: 'Runs the staged route through the ship blueprint test flight, one leg at a time.',
  component: () => TransitsActWindow,
});
