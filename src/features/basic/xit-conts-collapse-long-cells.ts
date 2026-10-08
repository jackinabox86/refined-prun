import { setCollapseLongContractCells } from '@src/features/XIT/CONTS/cap-contract-entries';

function init() {
  setCollapseLongContractCells(true);
}

features.add(
  import.meta.url,
  init,
  'XIT CONTS: shows 3 entries then (…) in long Item, Partner and Self cells.',
);
