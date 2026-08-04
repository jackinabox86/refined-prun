import { createCollectionSource, createRecordSource } from '@src/core/data-query/catalog';
import { DataCompleteness, DataSourceDescriptor, DataProvenance } from '@src/core/data-query/types';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import { balancesStore } from '@src/infrastructure/prun-api/data/balances';
import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';
import { companyStore } from '@src/infrastructure/prun-api/data/company';
import { contractDraftsStore } from '@src/infrastructure/prun-api/data/contract-drafts';
import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { corporationHoldingsStore } from '@src/infrastructure/prun-api/data/corporation-holdings';
import { cxobStore } from '@src/infrastructure/prun-api/data/cxob';
import { cxosStore } from '@src/infrastructure/prun-api/data/cxos';
import { cxpcStore } from '@src/infrastructure/prun-api/data/cxpc';
import { exchangesStore } from '@src/infrastructure/prun-api/data/exchanges';
import { expertsStore } from '@src/infrastructure/prun-api/data/experts';
import { flightPlansStore } from '@src/infrastructure/prun-api/data/flight-plans';
import { flightsStore } from '@src/infrastructure/prun-api/data/flights';
import { fxobStore } from '@src/infrastructure/prun-api/data/fxob';
import { fxosStore } from '@src/infrastructure/prun-api/data/fxos';
import { localAdsStore } from '@src/infrastructure/prun-api/data/local-ads';
import { materialCategoriesStore } from '@src/infrastructure/prun-api/data/material-categories';
import { materialsStore } from '@src/infrastructure/prun-api/data/materials';
import { planetsStore } from '@src/infrastructure/prun-api/data/planets';
import { productionStore } from '@src/infrastructure/prun-api/data/production';
import { request } from '@src/infrastructure/prun-api/data/request-hooks';
import { sectorsStore } from '@src/infrastructure/prun-api/data/sectors';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { shipyardProjectsStore } from '@src/infrastructure/prun-api/data/shipyard-projects';
import { shipyardsStore } from '@src/infrastructure/prun-api/data/shipyards';
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import { starsStore } from '@src/infrastructure/prun-api/data/stars';
import { stationsStore } from '@src/infrastructure/prun-api/data/stations';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';
import { usersStore } from '@src/infrastructure/prun-api/data/users';
import { warehousesStore } from '@src/infrastructure/prun-api/data/warehouses';
import { workforcesStore } from '@src/infrastructure/prun-api/data/workforces';

const fioWarning =
  'Reference only: planet data originates from FIO fallback data and may be stale. Live PrUn messages only patch selected fields.';

interface EntitySourceOptions {
  id: string;
  label: string;
  description: string;
  provenance?: DataProvenance;
  partial?: boolean;
  warning?: string;
  store: {
    all: Ref<unknown[] | undefined>;
    fetched: Ref<boolean>;
  };
  load?: DataSourceDescriptor['load'];
}

function entitySource(options: EntitySourceOptions) {
  const {
    description,
    id,
    label,
    load,
    partial = false,
    provenance = 'prun-live',
    store,
    warning,
  } = options;
  return createCollectionSource({
    id,
    label,
    description,
    provenance,
    completeness: fetchedCompleteness(store.fetched, partial),
    snapshot: () => store.all.value,
    ...(warning ? { warning } : {}),
    ...(load ? { load } : {}),
  });
}

function fetchedCompleteness(fetched: Ref<boolean>, partial = false) {
  return (): DataCompleteness => {
    if (!fetched.value) {
      return 'not-loaded';
    }
    return partial ? 'partial' : 'complete';
  };
}

const blueprintsState = blueprintsStore.peek();
const shipyardProjectsState = shipyardProjectsStore.peek();

export const gameDataSources: DataSourceDescriptor[] = [
  entitySource({
    id: 'alerts',
    label: 'Alerts',
    description: 'Current company alerts observed from PrUn.',
    store: alertsStore,
  }),
  entitySource({
    id: 'balances',
    label: 'Balances',
    description: 'Current company currency balances observed from PrUn.',
    store: balancesStore,
  }),
  entitySource({
    id: 'blueprints',
    label: 'Blueprints',
    description: 'Ship blueprints loaded from PrUn.',
    store: blueprintsState,
    load: { execute: () => request.blueprints() },
  }),
  createRecordSource({
    id: 'company',
    label: 'Company',
    description: 'The current company record observed from PrUn.',
    provenance: 'prun-live',
    completeness: () => (companyStore.value === undefined ? 'not-loaded' : 'complete'),
    snapshotRecord: () => companyStore.value,
  }),
  entitySource({
    id: 'contract-drafts',
    label: 'Contract Drafts',
    description: 'Contract drafts observed from PrUn.',
    store: contractDraftsStore,
  }),
  entitySource({
    id: 'contracts',
    label: 'Contracts',
    description: 'Company contracts observed from PrUn.',
    store: contractsStore,
  }),
  entitySource({
    id: 'corporation-holdings',
    label: 'Corporation Holdings',
    description: 'Corporation shareholder holdings observed from PrUn.',
    store: corporationHoldingsStore,
  }),
  entitySource({
    id: 'cx-order-books',
    label: 'CX Order Books',
    description: 'Commodity Exchange broker views observed for individual market tickers.',
    store: cxobStore,
    partial: true,
  }),
  entitySource({
    id: 'cx-orders',
    label: 'CX Orders',
    description: 'The company’s Commodity Exchange orders.',
    store: { all: cxosStore.passiveAll, fetched: cxosStore.fetched },
    load: { execute: () => request.cxos() },
  }),
  entitySource({
    id: 'cx-prices',
    label: 'CX Prices',
    description: 'Commodity Exchange price histories observed for individual brokers.',
    store: cxpcStore,
    partial: true,
  }),
  entitySource({
    id: 'exchanges',
    label: 'Exchanges',
    description: 'Bundled Commodity Exchange defaults patched by live PrUn data.',
    provenance: 'prun-live-with-defaults',
    store: exchangesStore,
  }),
  entitySource({
    id: 'experts',
    label: 'Experts',
    description: 'Site expert records observed while visiting expert views.',
    store: expertsStore,
    partial: true,
  }),
  entitySource({
    id: 'flight-plans',
    label: 'Flight Plans',
    description: 'Ship flight plans observed while visiting flight controls.',
    store: flightPlansStore,
    partial: true,
  }),
  entitySource({
    id: 'flights',
    label: 'Flights',
    description: 'Current company flights observed from PrUn.',
    store: flightsStore,
  }),
  entitySource({
    id: 'fx-order-books',
    label: 'FX Order Books',
    description: 'Foreign Exchange broker views observed for individual currency pairs.',
    store: fxobStore,
    partial: true,
  }),
  entitySource({
    id: 'fx-orders',
    label: 'FX Orders',
    description: 'The company’s Foreign Exchange orders.',
    store: { all: fxosStore.passiveAll, fetched: fxosStore.fetched },
    load: { execute: () => request.fxos() },
  }),
  entitySource({
    id: 'local-ads',
    label: 'Local Ads',
    description: 'Local Market ads observed for individual locations.',
    store: localAdsStore,
    partial: true,
  }),
  entitySource({
    id: 'material-categories',
    label: 'Material Categories',
    description: 'PrUn material categories and their material definitions.',
    store: materialCategoriesStore,
  }),
  entitySource({
    id: 'materials',
    label: 'Materials',
    description: 'PrUn material definitions.',
    store: materialsStore,
  }),
  entitySource({
    id: 'planets',
    label: 'Planets',
    description: 'FIO fallback planet reference data patched with selected live PrUn fields.',
    provenance: 'fio-reference-with-prun-overrides',
    warning: fioWarning,
    store: planetsStore,
  }),
  createCollectionSource({
    id: 'production',
    label: 'Production',
    description: 'Production lines observed globally or for explicitly loaded sites.',
    provenance: 'prun-live',
    completeness: () => {
      if (!productionStore.fetched.value) {
        return 'not-loaded';
      }
      return productionStore.fetchedAll.value ? 'complete' : 'partial';
    },
    snapshot: () => productionStore.all.value,
    load: {
      parameter: 'siteId',
      execute: siteId => loadSiteData(siteId, request.production),
    },
  }),
  entitySource({
    id: 'sectors',
    label: 'Sectors',
    description: 'Universe sectors observed from PrUn.',
    store: sectorsStore,
  }),
  entitySource({
    id: 'ships',
    label: 'Ships',
    description: 'Current company ships observed from PrUn.',
    store: shipsStore,
  }),
  entitySource({
    id: 'shipyard-projects',
    label: 'Shipyard Projects',
    description: 'Shipyard projects loaded from PrUn.',
    store: shipyardProjectsState,
    load: { execute: () => request.shipyardProjects() },
  }),
  entitySource({
    id: 'shipyards',
    label: 'Shipyards',
    description: 'Shipyards loaded from PrUn.',
    store: shipyardsStore,
    load: { execute: () => request.shipyards() },
  }),
  entitySource({
    id: 'sites',
    label: 'Sites',
    description: 'The company’s sites, platforms, and base data observed from PrUn.',
    store: sitesStore,
  }),
  entitySource({
    id: 'stars',
    label: 'Stars',
    description: 'Universe star systems observed from PrUn.',
    store: starsStore,
  }),
  entitySource({
    id: 'stations',
    label: 'Stations',
    description: 'Bundled station defaults patched by live PrUn data.',
    provenance: 'prun-live-with-defaults',
    store: stationsStore,
  }),
  entitySource({
    id: 'storages',
    label: 'Storages',
    description: 'Company inventories and storage contents observed from PrUn.',
    store: storagesStore,
  }),
  entitySource({
    id: 'users',
    label: 'Users',
    description: 'User records observed while browsing PrUn.',
    store: usersStore,
    partial: true,
  }),
  entitySource({
    id: 'warehouses',
    label: 'Warehouses',
    description: 'The company’s warehouse records observed from PrUn.',
    store: warehousesStore,
  }),
  entitySource({
    id: 'workforces',
    label: 'Workforces',
    description: 'Workforce data observed for explicitly visited or loaded sites.',
    store: workforcesStore,
    partial: true,
    load: {
      parameter: 'siteId',
      execute: siteId => loadSiteData(siteId, request.workforce),
    },
  }),
];

function loadSiteData(siteId: string | undefined, load: (siteId: string) => void) {
  const site = sitesStore.getById(siteId);
  if (!site) {
    throw Error(`Unknown site ID "${siteId ?? ''}".`);
  }
  load(site.siteId);
}
