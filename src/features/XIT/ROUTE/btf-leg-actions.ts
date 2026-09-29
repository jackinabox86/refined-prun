// Everything a route leg does to a blueprint test flight. BLU's delete control
// is absent on purpose: this tool must not remove a blueprint.
export const btfLegActions = ['select-origin', 'select-destination', 'read-summary'] as const;

export type BtfLegAction = (typeof btfLegActions)[number];
