import { blueprintsStore } from '@src/infrastructure/prun-api/data/blueprints';

export function validBlueprintOptions() {
  const all = blueprintsStore.all.value ?? [];
  const options: { value: string; label: string }[] = [];
  for (const blueprint of all) {
    if (blueprint.status !== 'VALID') {
      continue;
    }
    const name = blueprint.name.trim();
    const label =
      name.length > 0 && name !== blueprint.naturalId
        ? `${name} (${blueprint.naturalId})`
        : blueprint.naturalId;
    options.push({ value: blueprint.naturalId, label });
  }
  return options;
}
