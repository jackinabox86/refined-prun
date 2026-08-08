import PLANETS from '@src/features/XIT/PLANETS/PLANETS.vue';

xit.add({
  command: ['PLANETS', 'PLNT'],
  name: 'BASE PLANETS',
  description:
    'Per-planet settings (resupply days, pickup ship size, repair threshold, repair offset) for bases you own.',
  component: () => PLANETS,
  bufferSize: [700, 400],
});
