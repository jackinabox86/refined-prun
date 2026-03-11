import LINKEDBUFFERS from '@src/features/XIT/LINKEDBUFFERS/LINKEDBUFFERS.vue';

xit.add({
  command: ['LINKEDBUFFERS', 'LB'],
  name: 'LINKED BUFFERS',
  description: 'Opens a dashboard with linked child buffers driven by a text input.',
  optionalParameters: 'Preset Name',
  component: () => LINKEDBUFFERS,
  bufferSize: [900, 500],
});
