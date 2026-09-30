import { shipsStore } from '@src/infrastructure/prun-api/data/ships';

export function shipOptions(ships?: PrunApi.Ship[]) {
  const all = ships ?? shipsStore.all.value ?? [];
  const options: { value: string; label: string }[] = [];
  for (const ship of all) {
    const registration = ship.registration.trim();
    if (registration.length === 0) {
      continue;
    }
    const name = ship.name.trim();
    const label =
      name.length > 0 && name !== registration ? `${name} (${registration})` : registration;
    options.push({ value: registration, label });
  }
  options.sort((a, b) => a.label.localeCompare(b.label));
  return options;
}
