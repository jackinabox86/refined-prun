// Per-base auto SFC for BURNACT, REPAIRACT, and GOVBURNEXEC.
// One shared map: these hosts did not already share a per-base settings record.
// Missing means on (current auto-SFC behavior). Only an explicit off is stored.

export const AUTO_SFC_TOGGLE_COMMANDS = new Set(['BURNACT', 'REPAIRACT', 'GOVBURNEXEC']);

const PRUNPLANNER_PACKAGES = [
  'PRUNplanner Supply Cart',
  'PRUNplanner Construct',
  'PRUNplanner Transfer',
  'PRUNplanner Burn Supply',
];

export function shouldShowAutoSfcToggle(command: string): boolean {
  return AUTO_SFC_TOGGLE_COMMANDS.has(command);
}

export function savedPlanetAutoSfc(
  map: Record<string, boolean> | undefined,
  planetId: string | undefined,
): boolean | undefined {
  if (planetId === undefined) {
    return undefined;
  }
  return map?.[planetId];
}

export function initialPlanetAutoSfc(
  map: Record<string, boolean> | undefined,
  planetId: string | undefined,
): boolean {
  return savedPlanetAutoSfc(map, planetId) ?? true;
}

export function rememberPlanetAutoSfc(
  map: Record<string, boolean>,
  planetId: string,
  enabled: boolean,
): void {
  if (enabled) {
    delete map[planetId];
    return;
  }
  map[planetId] = false;
}

export function shouldEmitAutoSfc(
  data: { noSfc?: boolean },
  mtraConfig: { autoSfc?: boolean } | undefined,
  packageName: string,
): boolean {
  if (data.noSfc) {
    return false;
  }
  if (PRUNPLANNER_PACKAGES.includes(packageName)) {
    return false;
  }
  return mtraConfig?.autoSfc !== false;
}

export function autoSfcPlanetRaw(
  command: string,
  sfcDestination: string | undefined,
  parameter: string,
): string | undefined {
  if (!shouldShowAutoSfcToggle(command)) {
    return undefined;
  }
  if (sfcDestination !== undefined && sfcDestination !== '') {
    return sfcDestination;
  }
  return parameter === '' ? undefined : parameter;
}
