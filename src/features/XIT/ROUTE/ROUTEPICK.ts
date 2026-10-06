import RoutePickWindow from '@src/features/XIT/ROUTE/RoutePickWindow.vue';

xit.add({
  command: 'ROUTEPICK',
  name: 'PICK SHIP',
  description: 'Picks a free ship for a non-looping route.',
  component: () => RoutePickWindow,
  bufferSize: [360, 280],
});
