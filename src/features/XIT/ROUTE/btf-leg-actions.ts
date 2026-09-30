// Everything a route leg does to a blueprint test flight. BLU's delete control
// is absent on purpose: this tool must not remove a blueprint.
export const btfLegActions = [
  'apply-loadout',
  'select-origin',
  'select-destination',
  'confirm-loadout',
  'read-summary',
] as const;

export type BtfLegAction = (typeof btfLegActions)[number];
