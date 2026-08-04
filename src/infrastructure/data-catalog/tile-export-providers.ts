import { DataCatalog } from '@src/core/data-query/catalog';
import { DataQuery, DataQueryResult } from '@src/core/data-query/types';
import type { RenderedTileMetadata } from '@src/infrastructure/data-catalog/tile-sources';

export interface TileExportContext {
  id: string;
  fullCommand: string;
  command: string;
  parameter?: string;
}

export interface TileDataProvider {
  id: string;
  matches(context: TileExportContext): boolean;
  queries(context: TileExportContext): DataQuery[];
}

export interface TileDataExportResult {
  generatedAt: string;
  tile: RenderedTileMetadata | TileExportContext;
  providerId?: string;
  datasets: DataQueryResult[];
}

const providers: TileDataProvider[] = [
  provider('buildings', ['BBL'], context =>
    context.parameter
      ? [query('sites', filter('siteId', 'startsWith', context.parameter))]
      : [query('sites')],
  ),
  provider('blueprints', ['BLU'], context =>
    context.parameter
      ? [query('blueprints', filter('naturalId', 'eq', context.parameter))]
      : [query('blueprints')],
  ),
  provider('base', ['BS'], context => {
    if (!context.parameter) {
      return [query('sites'), query('workforces'), query('production')];
    }
    return [
      query('sites', undefined, context.parameter),
      query('workforces', undefined, context.parameter),
      query('production', undefined, context.parameter),
    ];
  }),
  provider('contract-drafts', ['CONTD'], context =>
    context.parameter
      ? [query('contract-drafts', filter('naturalId', 'eq', context.parameter))]
      : [query('contract-drafts')],
  ),
  provider('contracts', ['CONTS'], () => [query('contracts')]),
  provider('contract', ['CONT'], context => [
    query('contracts', filter('localId', 'eq', context.parameter)),
  ]),
  provider('cx-order-book', ['CXOB', 'CXPO'], context => [
    query('cx-order-books', filter('ticker', 'eq', context.parameter)),
  ]),
  provider('cx-orders', ['CXOS'], () => [query('cx-orders')]),
  provider('fx-orders', ['FXOS'], () => [query('fx-orders')]),
  provider('fleet', ['FLT'], () => [query('ships'), query('flights')]),
  provider('inventory', ['INV'], context =>
    context.parameter
      ? [query('storages', filter('id', 'startsWith', context.parameter))]
      : [query('storages')],
  ),
  provider('alerts', ['NOTS'], () => [query('alerts')]),
  provider('production', ['PROD'], context =>
    context.parameter
      ? [query('production', filter('siteId', 'startsWith', context.parameter))]
      : [query('production')],
  ),
  provider('ship', ['SHP'], context => [
    query('ships', filter('registration', 'eq', context.parameter)),
  ]),
  provider('shipyard-project', ['SHYP'], context =>
    context.parameter
      ? [query('shipyard-projects', filter('id', 'startsWith', context.parameter))]
      : [query('shipyard-projects')],
  ),
  provider('workforce', ['WF'], context => [
    query('workforces', filter('siteId', 'startsWith', context.parameter)),
  ]),
  {
    id: 'xit-contracts',
    matches: context => context.fullCommand.toUpperCase().startsWith('XIT CONTS'),
    queries: () => [query('contracts')],
  },
  {
    id: 'xit-cx-orders',
    matches: context => context.fullCommand.toUpperCase().startsWith('XIT CXTS'),
    queries: () => [query('cx-orders')],
  },
  {
    id: 'xit-fx-orders',
    matches: context => context.fullCommand.toUpperCase().startsWith('XIT FXTS'),
    queries: () => [query('fx-orders')],
  },
];

export function registerTileDataProvider(provider: TileDataProvider) {
  if (providers.some(x => x.id === provider.id)) {
    throw Error(`Duplicate tile data provider ID "${provider.id}".`);
  }
  providers.push(provider);
}

export function listTileDataProviders() {
  return [...providers];
}

export function exportTileDataFromCatalog(
  catalog: DataCatalog,
  context: TileExportContext,
  generatedAt = new Date(),
  resolveTileMetadata: (id: string) => RenderedTileMetadata | undefined = () => undefined,
): TileDataExportResult {
  const provider = providers.find(x => x.matches(context));
  const datasets =
    provider?.queries(context).map(query => catalog.export(query, generatedAt)) ?? [];
  return {
    generatedAt: generatedAt.toISOString(),
    tile: resolveTileMetadata(context.id) ?? context,
    ...(provider ? { providerId: provider.id } : {}),
    datasets,
  };
}

function provider(
  id: string,
  commands: string[],
  queries: (context: TileExportContext) => DataQuery[],
): TileDataProvider {
  const commandSet = new Set(commands);
  return {
    id,
    matches: context => commandSet.has(context.command),
    queries,
  };
}

function query(sourceId: string, dataFilter?: DataQuery['filters'], search?: string): DataQuery {
  return {
    sourceId,
    ...(search ? { search } : {}),
    ...(dataFilter ? { filters: dataFilter } : {}),
    limit: 5000,
  };
}

function filter(
  path: string,
  operator: NonNullable<DataQuery['filters']>[number]['operator'],
  value: unknown,
): DataQuery['filters'] {
  if (value === undefined) {
    return [];
  }
  return [{ path, operator, value }];
}
