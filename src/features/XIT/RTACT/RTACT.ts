import RtActWindow from '@src/features/XIT/RTACT/RtActWindow.vue';

xit.add({
  command: 'RTACT',
  name: 'STAGING RT ROUTE',
  description:
    'Builds a staging RT route from an ordered list of stops. Inert off the staging host.',
  bufferSize: [640, 560],
  component: () => RtActWindow,
});
