// Minimal fixture data for the prun-api entity stores the console roster's XIT panels
// read (INV/BS/PROD/CONTS/FIN/FLT). The real app never mounts any UI until
// initializeApi() awaits every startup store's `fetched` flag (see src/main.ts) — this
// sandbox skips that wait entirely (no socket), so without this, a store's `entities`/
// `all` computed stays `undefined` forever and several panels crash outright (not just
// render empty) the first time they read it, e.g. CONTS.vue calling .filter() on
// undefined. Dispatched the same way real API messages are (see
// prun-api-listener.ts's dispatch()). Most of these are deliberately empty payloads —
// "loading/empty" panels are fine, data accuracy isn't the goal — except the one site/
// star system below, which some real content (BS/PROD's row, the hologram) needs to
// draw anything at all.
import { dispatch } from '@src/infrastructure/prun-api/data/api-messages';
import { implementRequestHooks } from '@src/infrastructure/prun-api/data/request-hooks';

// One system with a site (feeds BS/PROD a real row) plus two neighboring systems purely
// so hologram.ts has a non-trivial region to draw (star spheres + connection lines) —
// see its own module comment for why an empty sitesStore/starsStore renders nothing.
// Coordinates/names are arbitrary; only the naturalId relationship matters:
// starsStore.getByPlanetNaturalId() strips the site's planet naturalId's last character
// and looks up a star by that as its *system* naturalId.
const fixtureStars = [
  {
    systemId: 'star-a',
    address: {
      lines: [{ type: 'SYSTEM', entity: { id: 'star-a', naturalId: 'ABC-123', name: 'ABC 123' } }],
    },
    name: 'ABC 123',
    type: 'G',
    position: { x: 0, y: 0, z: 0 },
    sectorId: 'sector-1',
    subSectorId: 'subsector-1',
    connections: ['star-b'],
  },
  {
    systemId: 'star-b',
    address: {
      lines: [{ type: 'SYSTEM', entity: { id: 'star-b', naturalId: 'DEF-456', name: 'DEF 456' } }],
    },
    name: 'DEF 456',
    type: 'K',
    position: { x: 3, y: 0.4, z: 1 },
    sectorId: 'sector-1',
    subSectorId: 'subsector-1',
    connections: ['star-a', 'star-c'],
  },
  {
    systemId: 'star-c',
    address: {
      lines: [{ type: 'SYSTEM', entity: { id: 'star-c', naturalId: 'GHI-789', name: 'GHI 789' } }],
    },
    name: 'GHI 789',
    type: 'M',
    position: { x: -2, y: 1, z: 3 },
    sectorId: 'sector-1',
    subSectorId: 'subsector-1',
    connections: ['star-b'],
  },
];

const fixtureSite = {
  siteId: 'site-1',
  address: {
    lines: [
      { type: 'SYSTEM', entity: { id: 'star-a', naturalId: 'ABC-123', name: 'ABC 123' } },
      { type: 'PLANET', entity: { id: 'planet-a', naturalId: 'ABC-123a', name: 'ABC 123 a' } },
    ],
  },
  founded: { timestamp: Date.now() },
  platforms: [],
  buildOptions: { options: [] },
  area: 0,
  investedPermits: 0,
  maximumPermits: 0,
};

export function dispatchFixtureApiData() {
  // Normally wired by @src/infrastructure/shell/request-hooks.ts, which this sandbox
  // deliberately doesn't import (it also opens real floating buffers via showBuffer()).
  // Without this, request.cxos()/etc. (called by computeds like FIN's cxosStore) throw
  // "Not implemented" the instant a panel first reads them.
  implementRequestHooks({
    production() {},
    workforce() {},
    cxos() {},
    fxos() {},
    blueprints() {},
    shipyards() {},
    shipyardProjects() {},
  });

  dispatch({ type: 'CONTRACTS_CONTRACTS', data: { contracts: [] } });
  dispatch({ type: 'SHIP_SHIPS', data: { ships: [] } });
  dispatch({ type: 'SITE_SITES', data: { sites: [fixtureSite] } });
  dispatch({ type: 'WORLD_MATERIAL_CATEGORIES', data: { categories: [] } });
  dispatch({ type: 'ALERTS_ALERTS', data: { alerts: [] } });
  dispatch({
    type: 'ACCOUNTING_CASH_BALANCES',
    data: { ownCurrency: { code: 'AIC' }, currencyAccounts: [] },
  });
  dispatch({ type: 'SHIP_FLIGHT_FLIGHTS', data: { flights: [] } });
  dispatch({ type: 'SYSTEM_STARS_DATA', data: { stars: fixtureStars } });
  dispatch({ type: 'STORAGE_STORAGES', data: { stores: [] } });
  dispatch({ type: 'WAREHOUSE_STORAGES', data: { storages: [] } });
  dispatch({
    type: 'COMPANY_DATA',
    // FIN's balance-sheet computeds (src/core/balance/*) read fairly deep into
    // headquarters — this is the minimum that stopped them throwing, not a claim of a
    // realistic company.
    data: {
      id: 'sandbox-company',
      name: 'Sandbox Co',
      headquarters: { level: 0, inventory: { items: [] } },
      representation: {
        currentLevel: 0,
        contributedTotal: { amount: 0, currency: 'AIC' },
      },
    },
  });
  dispatch({
    type: 'UI_DATA',
    // Screens/removedScreens/tiles read by screens.ts and tiles.ts's own UI_DATA
    // handlers (multiple modules subscribe to the same message type).
    data: { screens: [], removedScreens: [], tiles: [], tileStates: [] },
  });
}
