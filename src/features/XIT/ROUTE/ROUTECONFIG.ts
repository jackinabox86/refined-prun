import ROUTECONFIG from '@src/features/XIT/ROUTE/ROUTECONFIG.vue';

xit.add({
  command: 'ROUTECONFIG',
  name: 'ROUTE CONFIG',
  description: 'Order commodity exchanges and bases into a shipping route.',
  optionalParameters: 'Route Id',
  component: () => ROUTECONFIG,
  bufferSize: [980, 520],
});
