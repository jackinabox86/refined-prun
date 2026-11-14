import '@src/features/XIT/ROUTE/RT_DELETE';

import RouteDeleteWindow from '@src/features/XIT/ROUTE/RouteDeleteWindow.vue';

xit.add({
  command: 'ROUTEDEL',
  name: 'ROUTE DELETE',
  description: 'Deletes a ROUTECONFIG route and its linked game route.',
  component: () => RouteDeleteWindow,
  bufferSize: [640, 480],
});
