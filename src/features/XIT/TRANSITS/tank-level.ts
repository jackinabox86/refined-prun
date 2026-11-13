export type TankKind = 'stl' | 'ftl';

export interface LoadoutSlider {
  label: string;
  value: number;
  tank: TankKind | undefined;
}

// The nearest ancestor that contains exactly one of the field labels owns that slider.
// A higher ancestor contains every field, so the first unique hit wins.
export function matchingFieldLabel(ancestorTexts: string[], labels: string[]) {
  for (const text of ancestorTexts) {
    const hits = labels.filter(label => label.length > 0 && text.includes(label));
    if (hits.length === 1) {
      return hits[0];
    }
  }
  return undefined;
}

export function tankKind(label: string, stlLabel: string, ftlLabel: string): TankKind | undefined {
  if (label.length > 0 && label === stlLabel) {
    return 'stl';
  }
  if (label.length > 0 && label === ftlLabel) {
    return 'ftl';
  }
  return undefined;
}

// Leg n starts from the tank the player confirmed, minus every preceding leg's burn.
// The slider step is 1 unit, so the result is a whole number and never goes below 0.
export function tankForLeg(confirmed: number, prior: number[]) {
  let remaining = confirmed;
  for (const used of prior) {
    remaining -= used;
  }
  const rounded = Math.round(remaining);
  if (rounded < 0) {
    return 0;
  }
  return rounded;
}

// A pointer lands on a pixel. One pixel of this track is `span / width` units,
// so the arrow walk has to cover that whole pixel plus a small margin.
export function sliderNudgeLimit(span: number, width: number) {
  if (!Number.isFinite(span) || span < 0 || !Number.isFinite(width) || width <= 0) {
    return undefined;
  }
  return Math.ceil(span / width) + 2;
}

// A handle's aria-valuenow. Number('') and Number(null) are both 0, so an empty or
// absent value would read as a setting of 0. It is no value instead.
export function sliderValue(raw: string | null) {
  if (raw === null || raw.trim().length === 0) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

// A setting carried from the last leg can sit outside this leg's range: Fuel usage
// starts at 0.282 on one route and at 0.01 on another. Every leg waits for the
// player's choice, so the setting starts at the nearest end instead of failing the leg.
export function settingTarget(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// STL is always checked. A blueprint without an FTL tank shows no FTL fuel slider,
// so FTL is checked only when the player confirmed one or the flight shows one.
export function tanksToCheck(confirmed: readonly LoadoutSlider[], onFlight: readonly TankKind[]) {
  const kinds: TankKind[] = ['stl'];
  if (confirmed.some(x => x.tank === 'ftl') || onFlight.includes('ftl')) {
    kinds.push('ftl');
  }
  return kinds;
}

export function sliderTarget(slider: LoadoutSlider, priorStl: number[], priorFtl: number[]) {
  if (slider.tank === 'stl') {
    return tankForLeg(slider.value, priorStl);
  }
  if (slider.tank === 'ftl') {
    return tankForLeg(slider.value, priorFtl);
  }
  return slider.value;
}

// A locked blueprint still computes a test flight. The plan's own status decides
// whether the numbers are usable; this must not reject on blueprint.status.
export function blueprintTestFlightBlock(
  blueprint: { status: string } | undefined,
  naturalId: string,
) {
  if (blueprint === undefined) {
    return `blueprint ${naturalId} is not loaded`;
  }
  return undefined;
}
