import {
  getEntityNameFromAddress,
  getLocationLineFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';

export interface FltStatusDestination {
  name: string;
  command: string;
  inventoryCommand: string;
}

// Gateways carry a GATEWAY address line instead of a PLANET or STATION line, the same
// shape INV's destination link recognises. Gateway storage (VTX, UPK) opens with INV <gateway id>,
// which resolves the warehouse at that gateway the same way INV <planet id> does.
export function getFltStatusDestination(address?: PrunApi.Address): FltStatusDestination {
  const gateway = address?.lines.find(x => x.type === 'GATEWAY')?.entity;
  if (gateway) {
    return {
      name: gateway.name || gateway.naturalId,
      command: `GTW ${gateway.naturalId}`,
      inventoryCommand: `INV ${gateway.naturalId}`,
    };
  }

  const location = getLocationLineFromAddress(address);
  const prefix = location?.type === 'STATION' ? 'STNS' : 'PLI';
  return {
    name: getEntityNameFromAddress(address) ?? address?.lines[0]?.entity?.naturalId ?? '',
    command: `${prefix} ${location?.entity.naturalId}`,
    inventoryCommand: `INV ${location?.entity.naturalId}`,
  };
}
