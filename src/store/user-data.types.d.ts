declare namespace UserData {
  type TimeFormat = 'DEFAULT' | '24H' | '12H';

  type CurrencyPreset = 'DEFAULT' | 'AIC' | 'CIS' | 'ICA' | 'NCC' | 'CUSTOM';
  type CurrencyPosition = 'BEFORE' | 'AFTER';
  type CurrencySpacing = 'HAS_SPACE' | 'NO_SPACE';

  type PricingMethod = 'ASK' | 'BID' | 'AVG' | 'VWAP7D' | 'VWAP30D' | 'DEFAULT' | string;

  export type Exchange = 'AI1' | 'CI1' | 'CI2' | 'IC1' | 'NC1' | 'NC2';

  interface SfcShortcut {
    // Button text; shown upper-cased. Blank falls back to the destination.
    label: string;
    // Exchange station or planet, as typed into the SFC destination field.
    destination: string;
  }

  interface PriceOverride {
    buy?: number;
    sell?: number;
  }

  interface StoreSortingData {
    modes: SortingMode[];
    active?: string;
    cat?: boolean;
    reverse?: boolean;
  }

  interface SortingMode {
    label: string;
    categories: SortingModeCategory[];
    burn: boolean;
    zero: boolean;
  }

  interface SortingModeCategory {
    name: string;
    materials: string[];
  }

  type TileState = Record<string, unknown>;

  interface Note {
    id: string;
    name: string;
    text: string;
  }

  interface SystemMessages {
    chat: string;
    hideJoined: boolean;
    hideDeleted: boolean;
  }

  interface ActionPackageData {
    groups: MaterialGroupData[];
    actions: ActionData[];
    global: {
      name: string;
    };
  }

  type MaterialGroupType = 'Manual' | 'Resupply' | 'Repair' | 'Paste';

  interface MaterialGroupData {
    type: MaterialGroupType;
    name?: string;
    days?: number | string;
    advanceDays?: number | string;
    planet?: string;
    useBaseInv?: boolean;
    materials?: Record<string, number>;
    exclusions?: string[];
    consumablesOnly?: boolean;
    materialFilter?: 'All' | 'Workforce' | 'Production';
  }

  type ActionType =
    | 'CX Buy'
    | 'MTRA'
    | 'Refuel'
    | 'CONT Ship'
    | 'CONT Trade'
    | 'GovBurn Data'
    | 'Staging RT'
    | 'Transits';

  interface ActionData {
    type: ActionType;

    name?: string;
    group?: string;
    skippable?: boolean;

    allowUnfilled?: boolean;
    buyPartial?: boolean;
    exchange?: string;
    useCXInv?: boolean;
    priceLimits?: Record<string, number>;

    buyMissingFuel?: boolean;

    // GovBurn Data: planet natural ID or name.
    planet?: string;

    // Staging RT: optional existing route id, the stop list the player typed, and an optional
    // ship to assign once the stops are in. routePayload is the ROUTECONFIG bridge's JSON
    // RouteSpec; the text runner leaves it empty.
    routeId?: string;
    routeSpec?: string;
    routePayload?: string;
    shipId?: string;
    // ROUTECONFIG route id, so a built game route can be assigned later.
    configRouteId?: string;

    origin?: string;
    dest?: string;

    // MTRA specific
    postToAgent?: boolean;
    noSfc?: boolean;
    sfcDestination?: string;
    printOffloadJson?: boolean;
    offloadGroups?: string[];
    agentGroups?: string[];
    finishOnly?: boolean;
    // Bases (group names) that had repair toggled on; stamps braPlanet on their offload packages.
    repairGroups?: string[];
    // When set, an OPEN_BRA step for this planet is emitted after the transfers.
    braPlanet?: string;

    // CONT Ship specific
    currency?: string;
    contractNote?: string;
    paymentPerTon?: number;
    daysToFulfill?: number;
    contOrigin?: string;
    contDest?: string;
    autoProvision?: boolean;

    // CONT Trade specific
    contTradeType?: 'BUYING' | 'SELLING';
    contLocation?: string;

    // Transits: ship registration, and one planet or CX stop per line.
    shipRegistration?: string;
    routeStops?: string;
  }

  interface TaskList {
    id: string;
    name: string;
    tasks: Task[];
  }

  interface Task {
    id: string;
    type: TaskType;
    completed?: boolean;
    text?: string;
    dueDate?: number;
    recurring?: number;
    planet?: string;
    days?: number;
    buildingAge?: number;
    subtasks?: Task[];
  }

  type TaskType = 'Text' | 'Resupply' | 'Repair';

  interface CommandList {
    id: string;
    name: string;
    commands: Command[];
  }

  interface Command {
    id: string;
    label: string;
    command: string;
  }

  type ExchangeChartType = 'SMOOTH' | 'ALIGNED' | 'RAW';

  interface LinkedBuffersPreset {
    id: string;
    name: string;
    commands: LinkedBuffersCommand[];
    lastBufferSize?: [number, number];
    controlPosition?: [number, number];
    childLayouts?: LinkedBuffersChildLayout[];
  }

  interface LinkedBuffersCommand {
    id: string;
    label: string;
    template: string;
  }

  interface LinkedBuffersChildLayout {
    commandId: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }

  interface TabFolder {
    id: string;
    name: string;
    screenIds: string[];
  }

  interface GovBurnPlanet {
    naturalId: string;
    name: string;
    capturedAt: number;
    buildings: GovBurnBuilding[];
    cogc?: GovBurnCogc;
  }

  interface GovBurnBuilding {
    ticker: string;
    type: string;
    projectId: string;
    level: number;
    upkeeps?: GovBurnUpkeep[];
    upkeepsCapturedAt?: number;
    // Upkeep ticker -> last contribution timestamps (ms epoch).
    contribHistory?: Record<string, GovBurnContrib>;
  }

  interface GovBurnContrib {
    // Last contribution by the player's own company.
    own?: number;
    // Last contribution by anyone (including own).
    any?: number;
  }

  interface GovBurnUpkeep {
    ticker: string;
    stored: number;
    amount: number;
    duration: number;
    nextTick: number;
  }

  interface GovBurnCogc {
    dueDate: number;
    // Current-cycle bill with contributed amounts; paid when every currentAmount >= amount.
    materials: GovBurnCogcMaterial[];
  }

  interface GovBurnCogcMaterial {
    ticker: string;
    amount: number;
    currentAmount: number;
  }

  // Building ticker -> required count of supplied upkeep materials.
  // -1 (or missing): unconfigured — treat as 0 days (red).
  // 0: deliberately unsupplied — infinity days (green).
  // 1..upkeepCount: number of upkeep materials the player keeps supplied.
  type GovBurnPlanetConfig = Record<string, number>;

  // Building ticker -> chosen upkeep material tickers, in slot order.
  // Persists GOVBURNACT's slot picks; may be shorter than the configured
  // count when some slots are still unresolved.
  type GovBurnPlanetSlots = Record<string, string[]>;

  interface ShippingRouteStop {
    kind: 'cx' | 'base';
    id: string;
    // Set only on a repeated origin, so two visits of the same stop stay distinct.
    key?: string;
  }

  interface ShippingRouteLeg {
    ok: boolean;
    seconds?: number;
    stl?: number;
    ftl?: number;
    // Whether that leg's test flight had the gateway toggle on. Not shown.
    gateway?: boolean;
    // Fuel usage and reactor usage slider values for that leg. Not shown.
    // Reactor usage is absent on a leg without an FTL jump.
    fuelUsage?: number;
    reactorUsage?: number;
  }

  interface ShippingRoute {
    id: string;
    name: string;
    stops: ShippingRouteStop[];
    // Ship registration, the same value XIT TRANSITS uses. Older routes
    // stored only shipSize.
    ship?: string;
    shipSize?: string;
    days?: number;
    // Absent means the route loops back to its first stop for flight time.
    loop?: boolean;
    legs?: ShippingRouteLeg[];
    // Game route id (RT-…) recorded when ROUTECONFIG builds the route.
    rtId?: string;
    // Optional pause after the last waypoint. Absent means the route does not wait.
    wait?: {
      amount: number;
      unit: 'seconds' | 'minutes' | 'hours' | 'days';
    };
  }
}
