import { setActAutoCloseEnabled } from '@src/features/XIT/ACT/auto-close';

function init() {
  setActAutoCloseEnabled(true);
}

features.add(
  import.meta.url,
  init,
  'Auto-closes an action-package buffer (XIT ACT, DISPATCHACT, BURNACT, REPAIRACT, ' +
    'GOVBURNEXEC and the rest) when its execution completes.',
);
