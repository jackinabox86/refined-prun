import DISTRUST from '@src/features/XIT/DISTRUST/DISTRUST.vue';

xit.add({
  command: 'DISTRUST',
  name: 'DISTRUSTED USERS',
  description: 'Maintains a list of distrusted usernames highlighted across the UI.',
  component: () => DISTRUST,
  bufferSize: [400, 500],
});
