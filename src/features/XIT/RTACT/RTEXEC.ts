import '@src/features/XIT/RTACT/rt-action';

import RtExecWindow from '@src/features/XIT/RTACT/RtExecWindow.vue';

xit.add({
  command: 'RTEXEC',
  name: 'RT EXECUTE',
  description: 'Runs the staged RT route.',
  component: () => RtExecWindow,
});
