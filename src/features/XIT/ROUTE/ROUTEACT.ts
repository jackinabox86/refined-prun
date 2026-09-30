import '@src/features/XIT/ROUTE/route-test';

import RouteActWindow from '@src/features/XIT/ROUTE/RouteActWindow.vue';

xit.add({
  command: 'ROUTEACT',
  name: 'ROUTE FLIGHT TEST RUN',
  description: 'Runs the staged route through the ship blueprint test flight, one leg at a time.',
  component: () => RouteActWindow,
});
