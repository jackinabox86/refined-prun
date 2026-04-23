import { setRepairButtonEnabled } from '@src/features/XIT/REP/repair-button';

function init() {
  setRepairButtonEnabled(true);
}

features.add(
  import.meta.url,
  init,
  "REP: Shows a REP button in the CMD column to open XIT REPAIRACT for the row's planet.",
);
