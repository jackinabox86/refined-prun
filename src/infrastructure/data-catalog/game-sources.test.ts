import { describe, expect, it, vi } from 'vitest';
import { DataCatalog } from '@src/core/data-query/catalog';
import { gameDataSources } from '@src/infrastructure/data-catalog/game-sources';
import { request } from '@src/infrastructure/prun-api/data/request-hooks';

const expectedSourceIds = [
  'alerts',
  'balances',
  'blueprints',
  'company',
  'contract-drafts',
  'contracts',
  'corporation-holdings',
  'cx-order-books',
  'cx-orders',
  'cx-prices',
  'exchanges',
  'experts',
  'flight-plans',
  'flights',
  'fx-order-books',
  'fx-orders',
  'local-ads',
  'material-categories',
  'materials',
  'planets',
  'production',
  'sectors',
  'ships',
  'shipyard-projects',
  'shipyards',
  'sites',
  'stars',
  'stations',
  'storages',
  'users',
  'warehouses',
  'workforces',
];

describe('game data sources', () => {
  it('catalogs the explicit gameplay source set with declared provenance and loaders', () => {
    expect(gameDataSources.map(x => x.id)).toEqual(expectedSourceIds);

    const byId = new Map(gameDataSources.map(x => [x.id, x]));
    expect(byId.get('planets')).toMatchObject({
      provenance: 'fio-reference-with-prun-overrides',
      warning: expect.stringContaining('stale'),
    });
    expect(byId.get('exchanges')?.provenance).toBe('prun-live-with-defaults');
    expect(byId.get('stations')?.provenance).toBe('prun-live-with-defaults');
    expect(byId.get('production')?.load?.parameter).toBe('siteId');
    expect(byId.get('workforces')?.load?.parameter).toBe('siteId');
    for (const id of ['blueprints', 'cx-orders', 'fx-orders', 'shipyards', 'shipyard-projects']) {
      expect(byId.get(id)?.load).toBeDefined();
    }
  });

  it('lists, snapshots, queries, and exports every real source without requesting data', () => {
    const requestSpies = Object.keys(request).map(key =>
      vi.spyOn(request, key as keyof typeof request),
    );
    const catalog = new DataCatalog(gameDataSources);

    expect(catalog.list()).toHaveLength(expectedSourceIds.length);
    for (const sourceId of expectedSourceIds) {
      catalog.snapshot(sourceId);
      catalog.query({ sourceId });
      catalog.export({ sourceId });
    }
    for (const spy of requestSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
