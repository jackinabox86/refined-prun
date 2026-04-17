import {
  getEntityNaturalIdFromAddress,
  getLocationLineFromAddress,
  isPlanetLine,
} from '@src/infrastructure/prun-api/data/addresses';

export function getAlertPlanetNaturalId(alert: PrunApi.Alert): string | undefined {
  for (const key of ['planet', 'address', 'destination'] as const) {
    const entry = alert.data.find(x => x.key === key) as
      | { key: string; value: { address: PrunApi.Address } }
      | undefined;
    if (!entry?.value?.address) continue;
    const location = getLocationLineFromAddress(entry.value.address);
    if (!isPlanetLine(location)) continue;
    const id = getEntityNaturalIdFromAddress(entry.value.address);
    if (id) return id;
  }
  return undefined;
}
