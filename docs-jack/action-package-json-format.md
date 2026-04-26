# Action Package JSON Format

Hurrah!

This document describes the JSON structure used by the XIT ACT feature for importing/exporting action packages. External tools can generate these JSONs for import into Refined PrUn.

## Top-Level Structure

```json
{
  "global": {
    "name": "My Package"
  },
  "groups": [ ... ],
  "actions": [ ... ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `global.name` | string | **Yes** | Package name. Must be non-empty (this is the only field validated on import). |
| `groups` | array | Yes | Material group definitions. Executed first to produce material bills. |
| `actions` | array | Yes | Action definitions. Reference groups by name to get their materials. |

## Import Methods

- **Paste JSON**: In `XIT ACT`, click Import, select "Paste JSON", paste the full JSON string.
- **Upload JSON**: In `XIT ACT`, click Import, select "Upload JSON", upload a `.json` file.

The only validation on import is that `global.name` exists and is truthy.

## Material Groups

Each entry in the `groups` array is an object with a `type` field and type-specific properties.

### Common Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | -- | **Required.** One of: `"Manual"`, `"Resupply"`, `"Repair"`, `"Paste"`. |
| `name` | string | `""` | Group name. Actions reference groups by this name. |

### Type: `"Manual"`

A fixed list of materials and quantities.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `materials` | object | Yes | Map of material ticker to integer amount. E.g. `{"DW": 100, "RAT": 50}`. |

```json
{
  "type": "Manual",
  "name": "weekly-supplies",
  "materials": {
    "DW": 200,
    "RAT": 100,
    "OVE": 50
  }
}
```

### Type: `"Resupply"`

Calculates consumables needed based on a planet's burn rate.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `planet` | string | -- | Planet natural ID or name. Use `"Configure on Execution"` to prompt at runtime. |
| `days` | number or string | -- | Number of days of supplies to buy. Use `"Configure on Execution"` to prompt at runtime (defaults to XIT SET burn resupply value). |
| `useBaseInv` | boolean | `true` | Subtract current base inventory from the bill. |
| `consumablesOnly` | boolean | `false` | If true, only include workforce consumables (exclude production inputs). |
| `exclusions` | string[] | `[]` | Material tickers to exclude from the bill. |

```json
{
  "type": "Resupply",
  "name": "montem-resupply",
  "planet": "Montem",
  "days": 14,
  "useBaseInv": true,
  "consumablesOnly": false,
  "exclusions": ["COF"]
}
```

### Type: `"Repair"`

Calculates repair materials for aging buildings on a planet.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `planet` | string | -- | Planet natural ID or name. Use `"Configure on Execution"` to prompt at runtime. |
| `days` | number or string | -- | Only include buildings older than this many days. |
| `advanceDays` | number or string | `0` | Calculate as if buildings were this many days older (plan ahead). |

```json
{
  "type": "Repair",
  "name": "montem-repair",
  "planet": "Montem",
  "days": 90,
  "advanceDays": 10
}
```

### Type: `"Paste"`

Prompts the user to paste materials at execution time. No additional fields needed in the JSON. The pasted format is lines of `TICKER<tab>AMOUNT` or `TICKER,AMOUNT`, optionally with a third price column (`TICKER<tab>AMOUNT<tab>PRICE`).

```json
{
  "type": "Paste",
  "name": "pasted-mats"
}
```

## Actions

Each entry in the `actions` array is an object with a `type` field and type-specific properties.

### Common Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | -- | **Required.** One of: `"CX Buy"`, `"MTRA"`, `"Refuel"`, `"CONT Ship"`, `"CONT Trade"`. |
| `name` | string | `""` | Display name for the action. |
| `group` | string | -- | Name of a material group (from `groups` array) to use as input. |

### Type: `"CX Buy"`

Buy materials from a commodity exchange. A single action package can contain multiple `"CX Buy"` actions, each targeting a different exchange — the `exchange` field is per-action, not global.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `group` | string | -- | Material group name to buy. |
| `exchange` | string | -- | Exchange code: `"AI1"`, `"CI1"`, `"CI2"`, `"IC1"`, `"NC1"`, `"NC2"`. Use `"Configure on Execution"` to prompt at runtime. |
| `allowUnfilled` | boolean | `false` | If true, don't fail when exchange has fewer units than needed. |
| `buyPartial` | boolean | `false` | If true, buy whatever is available even if less than needed. |
| `useCXInv` | boolean | `true` | Subtract materials already in CX warehouse from the buy list. |
| `priceLimits` | object | `{}` | Map of ticker to max price per unit. E.g. `{"DW": 55.00}`. Omitted tickers have no limit. |

```json
{
  "type": "CX Buy",
  "name": "buy-supplies",
  "group": "weekly-supplies",
  "exchange": "CI1",
  "allowUnfilled": false,
  "buyPartial": true,
  "useCXInv": true,
  "priceLimits": {
    "DW": 60.00,
    "RAT": 120.00
  }
}
```

### Type: `"MTRA"`

Transfer materials between storages at the same location.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `group` | string | -- | Material group name to transfer. |
| `origin` | string | -- | Serialized storage ID (source). Use `"Configure on Execution"` to prompt at runtime. |
| `dest` | string | -- | Serialized storage ID (destination). Use `"Configure on Execution"` to prompt at runtime. |

Storage IDs are internal identifiers assigned by the game. When using `"Configure on Execution"`, the user selects the storage at runtime.

```json
{
  "type": "MTRA",
  "name": "transfer-to-base",
  "group": "weekly-supplies",
  "origin": "Configure on Execution",
  "dest": "Configure on Execution"
}
```

### Type: `"Refuel"`

Refuel all ships docked near a storage location.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `origin` | string | -- | Serialized storage ID where fuel is stored. Use `"Configure on Execution"` to prompt at runtime. |
| `buyMissingFuel` | boolean | `false` | If docked at a CX, automatically buy missing SF/FF from the exchange. |

```json
{
  "type": "Refuel",
  "name": "refuel-ci1",
  "origin": "Configure on Execution",
  "buyMissingFuel": true
}
```

### Type: `"CONT Ship"`

Create a shipping contract draft for a material group.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `group` | string | -- | Material group name to ship. |
| `contOrigin` | string | -- | Pickup location. Planet name/ID, `"Configure on Execution"`, or `"group:<groupName>"` to use the group's planet. |
| `contDest` | string | -- | Delivery location. Same format as `contOrigin`. |
| `currency` | string | `"NCC"` | Payment currency code. |
| `paymentPerTon` | number | `0` | Payment per ton of cargo. Total payment = tonnage * this value. |
| `daysToFulfill` | number | `3` | Days allowed to fulfill the contract. |
| `contractNote` | string | -- | Optional note attached to the contract. |
| `autoProvision` | boolean | `false` | If true, auto-provision materials from a configured storage (selected at runtime). |

The `"group:<groupName>"` syntax resolves the location from the named material group's planet field.

```json
{
  "type": "CONT Ship",
  "name": "ship-to-montem",
  "group": "weekly-supplies",
  "contOrigin": "CI1",
  "contDest": "group:montem-resupply",
  "currency": "CIS",
  "paymentPerTon": 200,
  "daysToFulfill": 5,
  "contractNote": "Weekly resupply run",
  "autoProvision": false
}
```

### Type: `"CONT Trade"`

Create a buy/sell trade contract draft for a material group. Requires a material group with price data (use a `"Paste"` group with 3-column input: ticker, amount, price).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `group` | string | -- | Material group name (must have prices). |
| `contTradeType` | string | `"BUYING"` | Either `"BUYING"` or `"SELLING"`. |
| `contLocation` | string | -- | Trade location. Planet name/ID, `"Configure on Execution"`, or `"group:<groupName>"`. |
| `currency` | string | `"NCC"` | Payment currency code. |
| `daysToFulfill` | number | `3` | Days allowed to fulfill the contract. |

```json
{
  "type": "CONT Trade",
  "name": "sell-materials",
  "group": "pasted-mats",
  "contTradeType": "SELLING",
  "contLocation": "Montem",
  "currency": "CIS",
  "daysToFulfill": 3
}
```

## Complete Example

A full action package that resupplies a planet by buying consumables from CI1, repair materials from AI1, and shipping everything:

```json
{
  "global": {
    "name": "Montem Weekly Resupply"
  },
  "groups": [
    {
      "type": "Resupply",
      "name": "montem-burn",
      "planet": "Montem",
      "days": 14,
      "useBaseInv": true,
      "consumablesOnly": false,
      "exclusions": []
    },
    {
      "type": "Repair",
      "name": "montem-repair",
      "planet": "Montem",
      "days": 90,
      "advanceDays": 7
    }
  ],
  "actions": [
    {
      "type": "CX Buy",
      "name": "buy-consumables",
      "group": "montem-burn",
      "exchange": "CI1",
      "buyPartial": true,
      "useCXInv": true
    },
    {
      "type": "CX Buy",
      "name": "buy-repair-mats",
      "group": "montem-repair",
      "exchange": "AI1",
      "buyPartial": true,
      "useCXInv": true
    },
    {
      "type": "CONT Ship",
      "name": "ship-everything",
      "group": "montem-burn",
      "contOrigin": "CI1",
      "contDest": "group:montem-burn",
      "currency": "CIS",
      "paymentPerTon": 150,
      "daysToFulfill": 5
    }
  ]
}
```

## Execution Order

1. All **material groups** are resolved first (in array order). Each produces a `Record<string, number>` mapping tickers to amounts.
2. **Actions** execute in array order. Each action references a group by `name` to get its material bill.
3. Some actions/groups with `"Configure on Execution"` values will prompt the user for input before execution begins.

## Notes for External Tool Authors

- The only import validation is `global.name` being truthy. Invalid group/action types or fields will fail at execution time, not import time.
- Material tickers must be valid PrUn material tickers (e.g. `"DW"`, `"RAT"`, `"MCG"`, `"PE"`). Case matters -- use uppercase.
- Amounts must be positive integers.
- Price limits are per-unit and can have up to 2 decimal places.
- Storage IDs (for `origin`/`dest` in MTRA) are opaque internal game IDs. For portability, use `"Configure on Execution"` instead.
- The `"group:<name>"` syntax in CONT Ship/Trade location fields resolves to the planet of the named material group.
