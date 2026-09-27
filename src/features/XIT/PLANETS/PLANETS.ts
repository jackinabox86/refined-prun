import PLANETS from '@src/features/XIT/PLANETS/PLANETS.vue';

xit.add({
  command: ['PLANETS', 'PLNT', 'PLS'],
  name: 'BASE PLANETS',
  description:
    'Per-planet settings (resupply days, pickup ship size, repair target) for bases you own.',
  component: () => PLANETS,
  bufferSize: [700, 400],
});
