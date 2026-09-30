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
