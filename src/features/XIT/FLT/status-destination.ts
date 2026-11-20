import {
  getEntityNameFromAddress,
  getLocationLineFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';

export interface FltStatusDestination {
  name: string;
  command: string;
  // Undefined when the destination has no inventory page to open (gateways).
  inventoryCommand?: string;
}

// Gateways carry a GATEWAY address line instead of a PLANET or STATION line, the same
// shape INV's destination link recognises. Gateway storage (VTX, UPK) is reached through it.
export function getFltStatusDestination(address?: PrunApi.Address): FltStatusDestination {
  const gateway = address?.lines.find(x => x.type === 'GATEWAY')?.entity;
  if (gateway) {
    return {
      name: gateway.name || gateway.naturalId,
      command: `GTW ${gateway.naturalId}`,
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
