// Everything a route leg does to a blueprint test flight. BLU's delete control
// is absent on purpose: this tool must not remove a blueprint.
// Addresses first. Changing them rewrites the fuel sliders, so the loadout is
// applied after the destination and checked again at read-summary.
export const btfLegActions = [
  'select-origin',
  'select-destination',
  'apply-loadout',
  'confirm-loadout',
  'read-summary',
] as const;

export type BtfLegAction = (typeof btfLegActions)[number];
