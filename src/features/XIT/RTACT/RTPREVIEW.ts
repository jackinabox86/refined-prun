import RtPreviewWindow from '@src/features/XIT/RTACT/RtPreviewWindow.vue';

xit.add({
  command: 'RTPREVIEW',
  name: 'RT ROUTE PREVIEW',
  description: 'Lists the RT steps for the route last previewed in XIT ROUTECONFIG.',
  component: () => RtPreviewWindow,
});
