import '@src/features/XIT/TRANSITS/route-test';

import TransitsWindow from '@src/features/XIT/TRANSITS/TRANSITS.vue';

xit.add({
  command: 'TRANSITS',
  name: 'TRANSITS',
  description:
    'Flight time and fuel for each leg of a planet or CX route, via blueprint test flight.',
  component: () => TransitsWindow,
  bufferSize: [520, 480],
});
