import { setActDispatchAutoCloseEnabled } from '@src/features/XIT/ACT/auto-close';

function init() {
  setActDispatchAutoCloseEnabled(true);
}

features.add(
  import.meta.url,
  init,
  'Auto-closes XIT ACT and XIT DISPATCHACT when action-package execution completes.',
);
