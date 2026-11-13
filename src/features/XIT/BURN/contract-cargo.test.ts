import { describe, expect, it, vi } from 'vitest';

vi.mock('@src/infrastructure/prun-api/data/addresses', () => ({
  getEntityNaturalIdFromAddress: (address?: { naturalId?: string }) => address?.naturalId,
}));

import { adjustPlanetBurn, getContractCargo } from '@src/features/XIT/BURN/contract-cargo';
import { MaterialBurn, PlanetBurn } from '@src/core/burn';

function address(naturalId: string) {
  return { naturalId } as unknown as PrunApi.Address;
}

function quantity(ticker: string, amount: number) {
  return { material: { ticker } as PrunApi.Material, amount };
}

function condition(
  partial: Partial<PrunApi.ContractCondition> & Pick<PrunApi.ContractCondition, 'id' | 'type'>,
): PrunApi.ContractCondition {
  return {
    party: 'PROVIDER',
    index: 0,
    status: 'PENDING',
    dependencies: [],
    deadlineDuration: null,
    deadline: null,
    ...partial,
  };
}

function contract(conditions: PrunApi.ContractCondition[]): PrunApi.Contract {
  return {
    localId: 'C1',
    party: 'CUSTOMER',
    partner: { name: 'Friend' },
    status: 'CLOSED',
    conditions,
  } as unknown as PrunApi.Contract;
}

function shipment(provisionStatus: PrunApi.ContractConditionStatus, deliveryParty = 'PROVIDER') {
  return contract([
    condition({
      id: 'prov',
      type: 'PROVISION_SHIPMENT',
      party: 'CUSTOMER',
      status: provisionStatus,
      quantity: quantity('RAT', 100),
    }),
    condition({ id: 'pick', type: 'PICKUP_SHIPMENT', dependencies: ['prov'] }),
    condition({
      id: 'del',
      type: 'DELIVERY_SHIPMENT',
      party: deliveryParty as PrunApi.ContractParty,
      dependencies: ['pick'],
      destination: address('UV-351a'),
    }),
  ]);
}

describe('getContractCargo', () => {
  it('counts a provisioned shipment the partner delivers to the base', () => {
    const cargo = getContractCargo([shipment('FULFILLED')]);
    expect(cargo.get('UV-351a')).toEqual([
      {
        kind: 'SHIPMENT',
        contractLocalId: 'C1',
        partnerName: 'Friend',
        ticker: 'RAT',
        amount: 100,
      },
    ]);
  });

  it('skips a shipment that is not provisioned yet, so origin stock is not counted twice', () => {
    expect(getContractCargo([shipment('PENDING')]).size).toBe(0);
  });

  it('skips a shipment the player delivers with their own ship', () => {
    expect(getContractCargo([shipment('FULFILLED', 'CUSTOMER')]).size).toBe(0);
  });

  it('counts a purchase the partner still has to deliver', () => {
    const buy = contract([
      condition({
        id: 'del',
        type: 'DELIVERY',
        quantity: quantity('DW', 50),
        address: address('UV-351a'),
      }),
      condition({ id: 'pay', type: 'PAYMENT', party: 'CUSTOMER' }),
    ]);
    expect(getContractCargo([buy]).get('UV-351a')).toEqual([
      { kind: 'PURCHASE', contractLocalId: 'C1', partnerName: 'Friend', ticker: 'DW', amount: 50 },
    ]);
  });

  it('skips a delivered purchase and a sale the player delivers', () => {
    const delivered = contract([
      condition({
        id: 'del',
        type: 'DELIVERY',
        status: 'FULFILLED',
        quantity: quantity('DW', 50),
        address: address('UV-351a'),
      }),
    ]);
    const sale = contract([
      condition({
        id: 'del',
        type: 'DELIVERY',
        party: 'CUSTOMER',
        quantity: quantity('DW', 50),
        address: address('UV-351a'),
      }),
    ]);
    expect(getContractCargo([delivered, sale]).size).toBe(0);
  });
});

function material(partial: Partial<MaterialBurn>): MaterialBurn {
  return {
    input: 0,
    output: 0,
    workforce: 0,
    dailyAmount: 0,
    remainingAllocation: 0,
    inventory: 0,
    daysLeft: 0,
    type: 'output',
    ...partial,
  };
}

function planet(burn: Record<string, MaterialBurn>): PlanetBurn {
  return { storeId: 's', planetName: 'Promitor', naturalId: 'UV-351a', burn };
}

describe('adjustPlanetBurn', () => {
  it('adds contract cargo to the inventory and recomputes days', () => {
    const base = planet({
      RAT: material({ workforce: 10, dailyAmount: -10, inventory: 30, daysLeft: 3 }),
    });
    const result = adjustPlanetBurn(base, {
      cargo: [
        { kind: 'SHIPMENT', contractLocalId: 'C1', partnerName: 'F', ticker: 'RAT', amount: 180 },
        { kind: 'SHIPMENT', contractLocalId: 'C1', partnerName: 'F', ticker: 'H2O', amount: 50 },
      ],
    });
    expect(result.burn.RAT.inventory).toBe(210);
    expect(result.burn.RAT.contractInventory).toBe(180);
    expect(result.burn.RAT.daysLeft).toBe(21);
    expect(result.burn.H2O).toBeUndefined();
    // The shared burn object is not mutated.
    expect(base.burn.RAT.inventory).toBe(30);
  });

  it('counts only workforce consumption on a managed base', () => {
    const result = adjustPlanetBurn(
      planet({
        RAT: material({ workforce: 10, inventory: 210 }),
        FE: material({ input: 100, inventory: 300 }),
      }),
      { ignoreProductionInputs: true },
    );
    expect(result.burn.RAT.daysLeft).toBe(21);
    expect(result.burn.FE.dailyAmount).toBe(0);
    expect(result.burn.FE.daysLeft).toBe(Number.POSITIVE_INFINITY);
  });
});
