export type SortKey =
  | 'name'
  | 'cargo'
  | 'status'
  | 'eta'
  | 'fuel'
  | 'none'
  | 'repair'
  | 'size'
  | 'shipClass';
export type SortDirection = 'asc' | 'desc' | 'none';
export type LayoutMode = 'compact' | 'whitespace' | 'cargo' | 'legacy';
export type FuelAlertThreshold = '75' | '50' | '35' | '25' | '10';
export type FuelAlertFilter = 'any' | FuelAlertThreshold;

export const FLT_LAYOUT_MODES: LayoutMode[] = ['compact', 'whitespace', 'cargo', 'legacy'];

export const FLT_FUEL_HEADER_LABEL = 'fuel';
export const FLT_REFUEL_BUFFER_COMMAND = 'XIT REFUELACT';

export const DEFAULT_SORT_DIRECTION_BY_KEY: Record<SortKey, SortDirection> = {
  name: 'none',
  cargo: 'none',
  status: 'desc',
  eta: 'asc',
  fuel: 'none',
  none: 'none',
  repair: 'none',
  size: 'none',
  shipClass: 'asc',
};

export const DEFAULTS = {
  primarySortKey: 'status' as SortKey,
  secondarySortKey: 'eta' as SortKey,
  showStlShips: true,
  showFtlShips: true,
  showInFlightShips: true,
  showNotInFlightShips: true,
  hideReturningToCx: false,
  fuelAlertFilter: 'any' as FuelAlertFilter,
  layoutMode: 'cargo' as LayoutMode,
  showColName: true,
  showColShipClass: false,
  showColSize: false,
  showColCargo: true,
  showColCargoSize: false,
  showColTime: true,
  showColRepair: false,
  showColFuel: true,
  showColProblems: false,
  problemFuelThreshold: '50' as FuelAlertFilter,
};

const OPTIONAL_COLUMN_FLAGS = [
  ['name', 'showColName'],
  ['shipClass', 'showColShipClass'],
  ['size', 'showColSize'],
  ['cargo', 'showColCargo'],
  ['cargoSize', 'showColCargoSize'],
  ['eta', 'showColTime'],
  ['repair', 'showColRepair'],
  ['fuel', 'showColFuel'],
  ['problems', 'showColProblems'],
] as const;

export function unconfiguredOptionalColumns(defaults: typeof DEFAULTS = DEFAULTS): string[] {
  return OPTIONAL_COLUMN_FLAGS.filter(([, flag]) => defaults[flag]).map(([name]) => name);
}

export function fuelHeaderAction(_layout: LayoutMode) {
  return {
    label: FLT_FUEL_HEADER_LABEL,
    command: FLT_REFUEL_BUFFER_COMMAND,
    showStandaloneRefuel: false,
  };
}
