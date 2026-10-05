// One Manual group and one CX Buy per exchange origin. The group holds every
// lap's departure load within the resupply days, and CX Buy takes out what the
// CX warehouse already holds, so the warehouse ends up stocked for those laps.
export function restockPackage(
  origins: readonly { exchange: string; materials: Record<string, number> }[],
): UserData.ActionPackageData {
  const groups: UserData.MaterialGroupData[] = [];
  const actions: UserData.ActionData[] = [];
  for (const origin of origins) {
    if (Object.keys(origin.materials).length === 0) {
      continue;
    }
    const name = `Restock ${origin.exchange}`;
    groups.push({ type: 'Manual', name, materials: origin.materials });
    actions.push({
      type: 'CX Buy',
      name: `CX Buy ${origin.exchange}`,
      group: name,
      exchange: origin.exchange,
      useCXInv: true,
    });
  }
  return { global: { name: 'Route Restock' }, groups, actions };
}
