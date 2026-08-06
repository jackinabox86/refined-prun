import DATA from '@src/features/XIT/DATA/DATA.vue';

xit.add({
  command: 'DATA',
  name: 'DATA EXPLORER',
  description: 'Passively explores in-memory Refined PrUn game and tile data.',
  optionalParameters: 'Source ID, Loopback Endpoint, JSON',
  component: () => DATA,
  bufferSize: [1080, 720],
});
