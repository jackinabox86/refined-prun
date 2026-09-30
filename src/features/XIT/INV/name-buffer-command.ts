export type InvEntityType = 'BASE' | 'SHIP' | 'WAREHOUSE' | 'CX';

export interface InvNameBufferInput {
  type: InvEntityType;
  naturalId?: string;
  registration?: string;
  exchangeCode?: string;
  inventoryCommand: string;
}

// Name clicks open the entity buffer. The inventory bar keeps `inventoryCommand`.
// commands.csv: BS optional Base, SHP mandatory Ship Transponder, CX mandatory
// Market Identifier Code (the exchange MIC, not the station natural id).
export function invNameBufferCommand(input: InvNameBufferInput) {
  if (input.type === 'BASE' && input.naturalId !== undefined) {
    return `BS ${input.naturalId}`;
  }
  if (input.type === 'SHIP' && input.registration !== undefined) {
    return `SHP ${input.registration}`;
  }
  if (input.type === 'CX' && input.exchangeCode !== undefined) {
    return `CX ${input.exchangeCode}`;
  }
  return input.inventoryCommand;
}
