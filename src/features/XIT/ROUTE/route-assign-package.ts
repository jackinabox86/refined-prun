import { ROUTE_RESTOCK_PACKAGE } from '@src/features/XIT/ROUTE/restock-package';

export const ROUTE_ASSIGN_PACKAGE = 'Route Assign';

// Buys only the shortfall above the loop reserve. useCXInv stays off because
// that shortfall is already net of free stock, and this package is not the
// Route Restock run, so the reserve stays out of other buys.
export function routeAssignPackage(
  exchange: string | undefined,
  shortfall: Readonly<Record<string, number>>,
): UserData.ActionPackageData {
  const materials: Record<string, number> = {};
  for (const [ticker, amount] of Object.entries(shortfall)) {
    if (amount > 0) {
      materials[ticker] = amount;
    }
  }
  const groups: UserData.MaterialGroupData[] = [];
  const actions: UserData.ActionData[] = [];
  if (exchange !== undefined && Object.keys(materials).length > 0) {
    const name = `Route buy ${exchange}`;
    groups.push({ type: 'Manual', name, materials });
    actions.push({
      type: 'CX Buy',
      name: `CX Buy ${exchange}`,
      group: name,
      exchange,
      useCXInv: false,
    });
  }
  return { global: { name: ROUTE_ASSIGN_PACKAGE }, groups, actions };
}

export function assignPackageIsRestock(pkg: UserData.ActionPackageData) {
  return pkg.global.name === ROUTE_RESTOCK_PACKAGE;
}
