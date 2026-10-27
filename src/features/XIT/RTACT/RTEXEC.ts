import '@src/features/XIT/RTACT/rt-action';

import RtExecWindow from '@src/features/XIT/RTACT/RtExecWindow.vue';

xit.add({
  command: 'RTEXEC',
  name: 'STAGING RT EXECUTE',
  description: 'Runs the staged staging RT route. Inert off the staging host.',
  component: () => RtExecWindow,
});
