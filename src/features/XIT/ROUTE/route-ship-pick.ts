import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

export interface ShipChoice {
  label: string;
}

const pending = ref<ShipChoice[] | undefined>(undefined);
let settle: ((label: string | undefined) => void) | undefined;

export function shipPickPending() {
  return pending;
}

export function beginShipPick(ships: readonly ShipChoice[]) {
  if (settle !== undefined) {
    settle(undefined);
    settle = undefined;
  }
  pending.value = ships.map(x => ({ label: x.label }));
  void showBuffer('XIT ROUTEPICK');
  return new Promise<string | undefined>(resolve => {
    settle = resolve;
  });
}

export function finishShipPick(label: string | undefined) {
  const done = settle;
  settle = undefined;
  pending.value = undefined;
  done?.(label);
}
