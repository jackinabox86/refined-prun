import ROUTEBURN from '@src/features/XIT/ROUTE/ROUTEBURN.vue';

xit.add({
  command: 'ROUTEBURN',
  name: 'ROUTE BURN',
  description: 'One row per shipping route, with the lowest burn, production, and repair.',
  component: () => ROUTEBURN,
  bufferSize: [504, 360],
});
