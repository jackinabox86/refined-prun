import PlanetSpecificToggle from './PlanetSpecificToggle.vue';

const PLANET_FILTERABLE_TYPES = new Set<PrunApi.AlertType>([
  'PRODUCTION_ORDER_FINISHED',
  'WORKFORCE_LOW_SUPPLIES',
  'WORKFORCE_OUT_OF_SUPPLIES',
  'WORKFORCE_UNSATISFIED',
  'SITE_EXPERT_DROPPED',
  'WAREHOUSE_STORE_LOCKED_INSUFFICIENT_FUNDS',
  'WAREHOUSE_STORE_UNLOCKED',
  'COGC_PROGRAM_CHANGED',
  'COGC_STATUS_CHANGED',
  'COGC_UPKEEP_STARTED',
  'ADMIN_CENTER_ELECTION_STARTED',
  'ADMIN_CENTER_GOVERNOR_ELECTED',
  'ADMIN_CENTER_MOTION_ENDED',
  'ADMIN_CENTER_MOTION_PASSED',
  'ADMIN_CENTER_MOTION_VOTING_STARTED',
  'ADMIN_CENTER_NO_GOVERNOR_ELECTED',
  'ADMIN_CENTER_RUN_SUCCEEDED',
  'POPULATION_PROJECT_UPGRADED',
  'POPULATION_REPORT_AVAILABLE',
  'PLANETARY_PROJECT_FINISHED',
  'INFRASTRUCTURE_OPERATIONAL_STATE_CHANGED',
  'INFRASTRUCTURE_PROJECT_COMPLETED',
  'INFRASTRUCTURE_UPGRADE_COMPLETED',
  'INFRASTRUCTURE_UPKEEP_PHASE_STARTED',
  'GATEWAY_JUMP_ABORTED_LINK_CHANGED',
  'GATEWAY_JUMP_ABORTED_LINK_NOT_ESTABLISHED',
  'GATEWAY_JUMP_ABORTED_MISSING_FUNDS',
  'GATEWAY_JUMP_ABORTED_NO_CAPACITY',
  'GATEWAY_JUMP_ABORTED_NO_FUEL',
  'GATEWAY_JUMP_ABORTED_NOT_OPERATIONAL',
  'GATEWAY_LINK_ESTABLISHED',
  'GATEWAY_LINK_REQUEST_RECEIVED',
  'GATEWAY_LINK_UNLINKED',
  'LOCAL_MARKET_AD_ACCEPTED',
  'LOCAL_MARKET_AD_EXPIRED',
  'SHIP_FLIGHT_ENDED',
]);

function onTileReady(tile: PrunTile) {
  let headerAugmented = false;

  subscribe($$(tile.anchor, 'tr'), row => {
    // Augment the header row once
    if (_$(row, 'th')) {
      if (!headerAugmented) {
        headerAugmented = true;
        const th = document.createElement('th');
        th.textContent = 'Planet';
        row.appendChild(th);
      }
      return;
    }

    const cells = _$$(row, 'td');
    if (cells.length < 2) return;

    const spanText = _$(cells[0], 'span')?.textContent;
    if (!spanText) return;

    const alertType = spanText.trim().toUpperCase().replace(/\s+/g, '_') as PrunApi.AlertType;
    if (!PLANET_FILTERABLE_TYPES.has(alertType)) return;

    const td = document.createElement('td');
    row.appendChild(td);
    createFragmentApp(PlanetSpecificToggle, reactive({ alertType })).appendTo(td);
  });
}

function init() {
  tiles.observe('NOTIG', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTIG: Adds a "planet" toggle per notification type to filter NOTS by planet.',
);
