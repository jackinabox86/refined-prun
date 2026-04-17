import NOTSPLANETS from '@src/features/XIT/NOTSPLANETS/NOTSPLANETS.vue';

xit.add({
  command: 'NOTSPLANETS',
  name: 'NOTIFICATION PLANET FILTER',
  description: 'Configure which planets to show notifications for.',
  component: () => NOTSPLANETS,
  bufferSize: [400, 400],
});
