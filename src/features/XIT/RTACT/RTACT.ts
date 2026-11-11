import RtActWindow from '@src/features/XIT/RTACT/RtActWindow.vue';

xit.add({
  command: 'RTACT',
  name: 'RT ROUTE',
  description: 'Builds an RT route from an ordered list of stops.',
  bufferSize: [640, 560],
  component: () => RtActWindow,
});
