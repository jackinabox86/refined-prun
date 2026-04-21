import { setInboundShipInventoryEnabled } from '@src/core/burn';

function init() {
  setInboundShipInventoryEnabled(true);
}

features.add(
  import.meta.url,
  init,
  'BURN: Counts in-flight ship inventory in the days-left calculation.',
);
