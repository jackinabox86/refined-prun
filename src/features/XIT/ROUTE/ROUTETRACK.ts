import ROUTETRACK from '@src/features/XIT/ROUTE/ROUTETRACK.vue';

xit.add({
  command: 'ROUTETRACK',
  name: 'ROUTE TRACK',
  description: 'Ships on game routes, with the next arrival and when the route ends or loops.',
  component: () => ROUTETRACK,
  bufferSize: [760, 300],
});
