export function matchShipBlueprint<T extends { naturalId: string }>(
  blueprints: T[] | undefined,
  naturalId: string,
): { blueprint: T } | { error: string } {
  if (blueprints === undefined) {
    return { error: 'blueprints are not loaded' };
  }
  const key = naturalId.toUpperCase();
  const matches = blueprints.filter(blueprint => blueprint.naturalId.toUpperCase() === key);
  const blueprint = matches[0];
  if (matches.length === 1 && blueprint !== undefined) {
    return { blueprint };
  }
  if (matches.length === 0) {
    return { error: `blueprint ${naturalId} has no matching blueprint` };
  }
  return { error: `blueprint ${naturalId} matches ${matches.length} blueprints` };
}
