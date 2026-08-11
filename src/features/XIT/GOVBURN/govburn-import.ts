import { popiBuildings } from '@src/features/XIT/GOVBURN/buildings';

export interface GovBurnImportBuilding {
  ticker: string;
  materials: string[];
}

export interface GovBurnImportInput {
  planet: string;
  buildings: GovBurnImportBuilding[];
}

export interface GovBurnImportRow {
  ticker: string;
  // Count to write: materials.length for listed buildings (clamped to the
  // building's upkeep count when data is captured), 0 for omitted ones.
  count: number;
  materials: string[];
  currentCount: number;
  currentMaterials: string[];
  conflict: boolean;
  // Zeroed because the JSON does not list it.
  omitted: boolean;
  // The JSON listed more materials than the building has upkeeps.
  clamped: boolean;
  // Listed tickers that are not among the building's captured upkeeps.
  unknownMaterials: string[];
}

export interface GovBurnImportPlan {
  rows: GovBurnImportRow[];
  // Tickers in the JSON that are not POPI buildings.
  ignored: string[];
  // False when the planet has no captured GOVBURNDATA: no clamping and no
  // material validation are possible.
  hasData: boolean;
  hasConflicts: boolean;
}

const popiTickers = new Set(popiBuildings.map(x => x.ticker));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseGovBurnImport(json: unknown): GovBurnImportInput | undefined {
  if (!isRecord(json)) {
    return undefined;
  }
  if (typeof json.planet !== 'string' || json.planet.trim() === '') {
    return undefined;
  }
  if (!Array.isArray(json.buildings)) {
    return undefined;
  }

  // Last entry wins for duplicate building tickers.
  const byTicker = new Map<string, string[]>();
  for (const entry of json.buildings) {
    if (!isRecord(entry)) {
      return undefined;
    }
    if (typeof entry.building !== 'string' || entry.building.trim() === '') {
      return undefined;
    }
    if (!Array.isArray(entry.materials)) {
      return undefined;
    }
    const materials: string[] = [];
    for (const material of entry.materials) {
      if (typeof material !== 'string') {
        return undefined;
      }
      materials.push(material.trim().toUpperCase());
    }
    byTicker.set(entry.building.trim().toUpperCase(), materials);
  }

  return {
    planet: json.planet.trim(),
    buildings: [...byTicker.entries()].map(([ticker, materials]) => ({ ticker, materials })),
  };
}

function dedupePreserveOrder(tickers: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ticker of tickers) {
    if (seen.has(ticker)) {
      continue;
    }
    seen.add(ticker);
    result.push(ticker);
  }
  return result;
}

function materialsEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export function buildImportPlan(
  input: GovBurnImportInput,
  captured: UserData.GovBurnPlanet | undefined,
  currentConfig: UserData.GovBurnPlanetConfig | undefined,
  currentSlots: UserData.GovBurnPlanetSlots | undefined,
): GovBurnImportPlan {
  const listed = new Map(input.buildings.map(x => [x.ticker, x.materials]));
  const ignored = input.buildings.map(x => x.ticker).filter(x => !popiTickers.has(x));

  const capturedByTicker = new Map((captured?.buildings ?? []).map(x => [x.ticker, x] as const));

  // Every POPI building gets a row: omission from the JSON means "deliberately
  // unsupplied" (0), so unlisted buildings must be written too, not skipped.
  const rows: GovBurnImportRow[] = [];
  for (const { ticker } of popiBuildings) {
    const jsonMaterials = listed.get(ticker);
    const currentCount = currentConfig?.[ticker] ?? -1;
    const currentMaterials = currentSlots?.[ticker] ?? [];

    if (jsonMaterials === undefined) {
      const conflict =
        (currentCount !== -1 || currentMaterials.length > 0) &&
        (currentCount !== 0 || currentMaterials.length > 0);
      rows.push({
        ticker,
        count: 0,
        materials: [],
        currentCount,
        currentMaterials,
        conflict,
        omitted: true,
        clamped: false,
        unknownMaterials: [],
      });
      continue;
    }

    const materials = dedupePreserveOrder(jsonMaterials);
    const building = capturedByTicker.get(ticker);
    const upkeeps = building?.upkeeps;
    let count = materials.length;
    let clamped = false;
    if (upkeeps !== undefined && count > upkeeps.length) {
      count = upkeeps.length;
      clamped = true;
    }
    const upkeepTickers = new Set((upkeeps ?? []).map(x => x.ticker));
    const unknownMaterials =
      upkeeps === undefined ? [] : materials.filter(x => !upkeepTickers.has(x));

    const conflict =
      (currentCount !== -1 || currentMaterials.length > 0) &&
      (count !== currentCount || !materialsEqual(materials, currentMaterials));

    rows.push({
      ticker,
      count,
      materials,
      currentCount,
      currentMaterials,
      conflict,
      omitted: false,
      clamped,
      unknownMaterials,
    });
  }

  return {
    rows,
    ignored,
    hasData: captured !== undefined,
    hasConflicts: rows.some(x => x.conflict),
  };
}
