# Data Catalog and Explorer

The data catalog provides one explicit, typed index of serializable data already held in Refined PrUn
memory. `XIT DATA`, Alt-click tile export, and the optional local agent connection all use the same
query engine and result envelopes.

## Passive-read guarantee

Listing sources, reading a snapshot, running a query, previewing results, downloading JSON, exporting
a tile, and answering an agent query are passive operations. They must not:

- open a buffer;
- dispatch a PrUn request;
- call a request-on-miss getter;
- load an unloaded source;
- mutate extension or game state; or
- expose DOM nodes, Vue/React objects, callbacks, credentials, or arbitrary settings.

Request-wrapped stores expose a separate `peek()` path for the catalog. CX and FX order stores expose
their passive entity-store view separately from their request-on-read `all` computed. Tests cover these
boundaries.

The only catalog operation allowed to request data is an explicit human click on **LOAD FROM PRUN** in
`XIT DATA`. The selected descriptor must declare a loader. Production and workforce loaders also
require a valid site ID already present in the sites store.

## Provenance

Each source declares one provenance value:

- `prun-live`: values observed from the active PrUn connection.
- `prun-live-with-defaults`: bundled defaults patched when matching live PrUn values arrive. Exchanges
  and stations use this value.
- `fio-reference-with-prun-overrides`: stale FIO fallback/reference values with selected live PrUn
  fields overlaid. Planets use this value and always display a warning.

FIO provenance never implies that a value is current empire state.

## Completeness

- `not-loaded`: no in-memory snapshot has been observed.
- `partial`: the store contains observations for only some entities, sites, tickers, or views.
- `complete`: the corresponding full-store message has been observed, or the source is complete by
  definition for its declared scope.

Broker views, local ads, experts, flight plans, users, workforces, and site-scoped production are
partial. Production becomes complete only after the global production-lines response is observed.
Completeness returns to the store's correct reset state on reconnect.

`generatedAt` in a query result is when the catalog took the snapshot and executed the query. It is not
the age of the underlying PrUn or FIO data.

## Query contract

The public internal contract is defined in `src/core/data-query/types.ts`.

```ts
interface DataQuery {
  sourceId: string;
  search?: string;
  filters?: Array<{
    path: string;
    operator:
      | 'eq'
      | 'neq'
      | 'contains'
      | 'startsWith'
      | 'gt'
      | 'gte'
      | 'lt'
      | 'lte'
      | 'exists';
    value?: unknown;
  }>;
  sort?: { path: string; direction: 'asc' | 'desc' };
  limit?: number;
}
```

Rules:

- Dot-separated paths traverse own properties only. Empty paths and the prototype-related segments
  `__proto__`, `prototype`, and `constructor` are rejected.
- Filters are AND-combined.
- Missing paths fail normal comparisons. `exists` matches present paths by default; `value: false`
  matches missing paths.
- Equality is strict and supports structural comparison of JSON arrays and objects. No loose equality
  or arbitrary evaluation is used.
- String `contains` and `startsWith` comparisons are case-insensitive. Array `contains` uses strict
  structural element equality.
- Ordered comparisons require two numbers or two strings.
- Text search is a case-insensitive substring search over the serialized row.
- Sorting keeps missing and null values last in both directions. Unlike types fall back to string
  comparison.
- The default limit is 250. Limits above 5,000 are capped at 5,000; invalid non-positive or
  non-integer limits are rejected.

Every query and JSON download returns a `DataQueryResult` envelope with source provenance and
completeness, the normalized query, counts, truncation metadata, timestamp, and rows.

## XIT DATA

Open `XIT DATA` to use the human explorer. Pass an optional catalog source ID to select it immediately,
for example `XIT DATA ships`; plain `XIT DATA` opens the default source. An optional loopback endpoint
can also prefill the agent connection field: `XIT DATA ships ws://127.0.0.1:47800` or, without a source,
`XIT DATA ws://127.0.0.1:47800`. Add the optional `JSON` parameter to omit the agent connection feature
for an explorer instance, for example `XIT DATA ships JSON` or
`XIT DATA ships ws://127.0.0.1:47800 JSON`. Parameters never connect automatically. Selecting datasets,
editing search/filter/sort inputs, previewing, and downloading are passive.

Filter values are parsed as JSON when valid. For example, `true`, `42`, `null`, `["RAT"]`, and
`{"mode":"safe"}` retain their JSON types. Other input is treated as a string.

Lazy sources show **LOAD FROM PRUN** only when they declare a loader. The button is disabled if the
request transport is unavailable or a required site ID is empty. Loader failures are shown in the
tile.

## Tile catalog and Alt-click export

The catalog includes:

- `stored-layout-tiles`: serializable stored tile nodes, screen identity where resolvable, tile-local
  game state, and tile-local Refined PrUn state;
- `active-rendered-tiles`: IDs, commands, parameters, docked/buffer state, and narrowly scoped tile
  state for currently rendered tiles.

Neither source exports DOM nodes or framework objects.

Tile data providers map supported commands to one or more catalog queries. Hold `Alt` and click the
tile command as before. The downloaded envelope now contains:

- one serializable tile metadata object;
- the provider ID, when a provider matches; and
- one or more standard `DataQueryResult` datasets sharing the same `generatedAt` timestamp.

Unloaded lazy datasets remain unloaded and are exported with `not-loaded` completeness and zero rows.
New providers register explicitly through `registerTileDataProvider`.

## Local agent query connection

The agent connection is an optional WebSocket client configured in `XIT DATA`. It is disabled and
disconnected on every page load. Endpoint and token fields are held in memory only; they are not added
to user data, backups, catalog snapshots, logs, URLs, or exports.

Security requirements enforced by the client:

- Only literal `ws://` or `wss://` endpoints on `127.0.0.1` or `[::1]` are accepted. Hostnames such as
  `localhost`, private-network addresses, URL credentials, query parameters, and fragments are
  rejected.
- Tokens must be 32–256 characters and contain no control characters.
- The first client message authenticates protocol version 1. No query is accepted until the server
  returns `{"type":"authenticated"}`.
- Incoming messages are limited to 64 KiB. Outgoing responses are limited to 4 MiB.
- There is no automatic reconnect.
- The remote surface supports only `list-sources` and `query`. Loader, export, settings, DOM, request,
  and gameplay-action methods do not exist.

Chrome may show its Local Network Access permission prompt on the first loopback connection. The user
must grant that browser permission for the connection to proceed.

The PrUn API middleware proxies the page's `WebSocket` constructor to observe game traffic. The agent
client therefore captures the native constructor before that proxy is installed, and the middleware
forwards `addEventListener` through the saved native method. Calling the overridden listener method
recursively causes a stack overflow, while reading branded static properties such as `WebSocket.OPEN`
through the proxy can produce an `Illegal invocation` error. These failures are interception bugs and
do not require changing the authenticated loopback protocol.

### Protocol

Client authentication:

```json
{ "type": "authenticate", "version": 1, "token": "<shared session token>" }
```

Server acknowledgement:

```json
{ "type": "authenticated" }
```

List sources:

```json
{ "type": "list-sources", "id": "request-1" }
```

Query:

```json
{
  "type": "query",
  "id": "request-2",
  "query": {
    "sourceId": "ships",
    "filters": [{ "path": "registration", "operator": "startsWith", "value": "ABC" }],
    "limit": 100
  }
}
```

Responses use `sources`, `result`, or `error` as their `type` and echo the request `id`. Query results
are the same `DataQueryResult` envelopes used by `XIT DATA`.

## Tests

Run `pnpm test`. Focused tests cover query semantics and validation, passive catalog behavior,
request-wrapper peeking, tile provider envelopes, authentication, loopback validation, message limits,
and rejection of unauthorized transport methods.
