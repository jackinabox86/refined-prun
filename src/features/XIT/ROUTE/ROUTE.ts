import '@src/features/XIT/ROUTE/route-test';

import RouteWindow from '@src/features/XIT/ROUTE/ROUTE.vue';

xit.add({
  command: 'ROUTE',
  name: 'ROUTE FLIGHT TEST',
  description:
    'Flight time and fuel for each leg of a planet or CX route, via blueprint test flight.',
  component: () => RouteWindow,
  bufferSize: [520, 480],
});
