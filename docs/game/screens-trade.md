# Commodity Exchange Screens (CXL, CX, CXP, CXPC, CXOB, CXPO, CXOS)

## CXL — Exchange List

All commodity exchanges. Columns: Name, MIC (market identifier code, e.g. `AI1`), Operator, Location. Exchange name → `CX <MIC>`; operator and station are links. Context bar: `CXOS`.

## CX `<MIC>` — Exchange Detail

Commodity list grouped by material category, with a search box. Row data: material icon + ticker, Price + Change, Ask Amount, Bid Amount, Supply, Demand. Per-row buttons:

| Button | Opens | Screen |
|---|---|---|
| Info | `CXP <TICKER.MIC>` | price info |
| Chart | `CXPC <TICKER.MIC>` | price chart |
| Orders | `CXOB <TICKER.MIC>` | order book |
| Trade | `CXPO <TICKER.MIC>` | place order form |

Links to the station, its Local Market (`LM`) and Warehouse (`WAR`). Context bar: `CXL`, `CXOS`.

Every CXP/CXPC/CXOB/CXPO buffer cross-links all the others plus `CX <MIC>`, `MAT <ticker>`, `CXL`, `CXOS` in its context bar — the whole family is one hop apart.

## CXP — Price Info

Current price, change, averages for one ticker on one exchange.

## CXPC — Price Chart

Candlestick/line chart. Range buttons: intra-day, 24h, 7d, 30d, 90d, 180d, 1y. Interval buttons: 3d, 1d, 12h, 6h, 4h, 2h, 1h, 30m…

## CXOB — Order Book

Two tables (Offers, Requests): Trader (company link), Amount, Price.

## CXPO — Place Order

Order form. Fields: Exchange, Material, Price average (+ `set` button copies it into the limit), Bid / Ask, Price Band ⓘ, Storage Location (select over ship cargo holds and Warehouse at the exchange), Inventory, Quantity, Price Limit, Effective price ⓘ, Volume, Shipment size; a small preview table (Amt., Price). `buy` / `sell` buttons are server actions — safe to open and fill, never submit in tests.

## CXOS — Own Orders

Manage your open exchange orders (optional Pagesize parameter).
