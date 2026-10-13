import { showBuffer } from '@src/infrastructure/prun-ui/buffers';

export interface ShipChoice {
  label: string;
}

const SAVED_SHIP_BUSY = 'The saved ship is not free. Pick one that fits this route.';

const pending = ref<ShipChoice[] | undefined>(undefined);
const prompt = ref(SAVED_SHIP_BUSY);
let settle: ((label: string | undefined) => void) | undefined;

export function shipPickPending() {
  return pending;
}

export function shipPickPrompt() {
  return prompt;
}

export function beginShipPick(ships: readonly ShipChoice[], text = SAVED_SHIP_BUSY) {
  if (settle !== undefined) {
    settle(undefined);
    settle = undefined;
  }
  pending.value = ships.map(x => ({ label: x.label }));
  prompt.value = text;
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
