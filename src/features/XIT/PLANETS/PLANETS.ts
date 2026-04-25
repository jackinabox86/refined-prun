import PLANETS from '@src/features/XIT/PLANETS/PLANETS.vue';

xit.add({
  command: ['PLANETS', 'PLNT'],
  name: 'BASE PLANETS',
  description: 'Per-planet resupply day overrides for bases you own.',
  component: () => PLANETS,
  bufferSize: [500, 400],
});
