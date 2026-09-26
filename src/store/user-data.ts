import { deepFreeze } from '@src/utils/deep-freeze';

export const initialUserData = deepFreeze({
  firstLoad: Date.now(),
  lastSeenChangelogVersion: undefined as string | undefined,
  tileState: {} as Record<string, UserData.TileState | undefined>,
  settings: {
    mode: undefined as 'BASIC' | 'FULL' | undefined,
    disabled: ['oog-burn-inflight-inventory', 'oog-cxpo-quick-price', 'act-auto-close'] as string[],
    time: 'DEFAULT' as UserData.TimeFormat,
    defaultChartType: 'SMOOTH' as UserData.ExchangeChartType,
    currency: {
      preset: 'DEFAULT' as UserData.CurrencyPreset,
      custom: '$',
      position: 'BEFORE' as UserData.CurrencyPosition,
      spacing: 'NO_SPACE' as UserData.CurrencySpacing,
    },
    financial: {
      mmMaterials: 'IDC,EDC',
      ignoredMaterials: 'HEX,JUI',
    },
    pricing: {
      exchange: 'UNIVERSE',
      method: 'DEFAULT' as UserData.PricingMethod,
    },
    burn: {
      red: 3,
      yellow: 7,
      resupply: 16,
      planetResupply: {} as Record<string, number>,
      // Planet natural id -> ship-size label from core/ship-sizes.
      planetPickup: {} as Record<string, string>,
      // Planet natural id -> last CX buy exchange chosen in BURNACT.
      planetCxExchange: {} as Record<string, UserData.Exchange>,
    },
    flow: {
      overrides: {} as Record<string, UserData.PriceOverride>,
    },
    repair: {
      threshold: 60,
      offset: 10,
      planetOverrides: {} as Record<string, { threshold?: number; offset?: number }>,
    },
    noBuy: [] as string[],
    noBuyAll: false,
    noBuyThresholds: {
      yellow: 10,
      red: 20,
    },
    cxPricesPreview: false,
    // Planet natural id -> explicit auto-SFC off for BURNACT/REPAIRACT/GOVBURNEXEC.
    planetAutoSfc: {} as Record<string, boolean>,
    // XIT FLT unload-button colors for base/CX × empty/cargo.
    fltButtonColors: {
      baseEmpty: '#b48ad8',
      baseCargo: '#e8676b',
      cxEmpty: '#43a4df',
      cxCargo: '#f7a600',
    } as {
      baseEmpty: string;
      baseCargo: string;
      cxEmpty: string;
      cxCargo: string;
    },
    sidebar: [
      ['BS', 'BS'],
      ['CONT', 'XIT CONTS'],
      ['COM', 'COM'],
      ['CORP', 'CORP'],
      ['CXL', 'CXL'],
      ['FIN', 'XIT FIN'],
      ['FLT', 'FLT'],
      ['INV', 'INV'],
      ['MAP', 'MU'],
      ['PROD', 'PROD'],
      ['LEAD', 'LEAD'],
      ['CMDS', 'CMDS'],
      ['ACT', 'XIT ACT'],
      ['BURN', 'XIT BURN'],
      ['REP', 'XIT REP'],
      ['SET', 'XIT SET'],
      ['HELP', 'XIT HELP'],
    ] as [string, string][],
    buffers: [] as [string, number, number][],
    contextMenuExchange: 'AI1' as UserData.Exchange,
    cxmOrder: ['AI1', 'CI1', 'CI2', 'IC1', 'NC1', 'NC2'] as UserData.Exchange[],
    audioVolume: 0.4,
  },
  sorting: {} as Record<string, UserData.StoreSortingData>,
  balanceHistory: {
    v1: [],
    v2: [],
  } as UserData.BalanceHistory,
  fullEquityMode: true,
  notes: [] as UserData.Note[],
  actionPackages: [] as UserData.ActionPackageData[],
  systemMessages: [] as UserData.SystemMessages[],
  todo: [] as UserData.TaskList[],
  tabs: {
    order: [] as string[],
    hidden: [] as string[],
    locked: [] as string[],
    folders: [] as UserData.TabFolder[],
  },
  commandLists: [] as UserData.CommandList[],
  linkedBuffersPresets: [] as UserData.LinkedBuffersPreset[],
  govburn: {
    planets: {} as Record<string, UserData.GovBurnPlanet>,
    config: {
      planets: {} as Record<string, UserData.GovBurnPlanetConfig>,
      slots: {} as Record<string, UserData.GovBurnPlanetSlots>,
      resupplyDays: 30,
      red: 3,
      yellow: 7,
    },
  },

  // Used in user-data-migrations.ts
  migrations: undefined,
});

export const userData = reactive({} as typeof initialUserData);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyUserData(newData: any) {
  newData.balanceHistory.v1 = shallowReactive(newData.balanceHistory.v1);
  newData.balanceHistory.v2 = shallowReactive(newData.balanceHistory.v2);
  Object.assign(userData, newData);
}

export function applyInitialUserData() {
  applyUserData(structuredClone(initialUserData));
}

applyInitialUserData();

export function clearBalanceHistory() {
  userData.balanceHistory.v1.length = 0;
  userData.balanceHistory.v2.length = 0;
}
