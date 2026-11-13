import { contractsStore } from '@src/infrastructure/prun-api/data/contracts';
import { getEntityNaturalIdFromAddress } from '@src/infrastructure/prun-api/data/addresses';
import { BurnValues, finalizeMaterialBurn, PlanetBurn } from '@src/core/burn';

export type ContractCargoKind = 'SHIPMENT' | 'PURCHASE';

export interface ContractCargo {
  kind: ContractCargoKind;
  contractLocalId: string;
  partnerName: string;
  ticker: string;
  amount: number;
}

// Cargo the partner still has to deliver to a base, keyed by planet natural id.
// SHIPMENT: a shipping contract whose goods are provisioned, delivered by the partner.
// PURCHASE: a DELIVERY condition the partner owes, i.e. goods bought from them.
export function getContractCargo(contracts: PrunApi.Contract[]) {
  const result = new Map<string, ContractCargo[]>();
  for (const contract of contracts) {
    for (const condition of contract.conditions) {
      if (condition.party === contract.party || condition.status === 'FULFILLED') {
        continue;
      }
      let kind: ContractCargoKind;
      let quantity: PrunApi.MaterialAmount | null | undefined;
      let destination: PrunApi.Address | undefined;
      if (condition.type === 'DELIVERY_SHIPMENT') {
        const provision = getShipmentProvision(contract, condition);
        // An unprovisioned shipment is still raw stock in the origin inventory.
        if (provision?.status !== 'FULFILLED') {
          continue;
        }
        kind = 'SHIPMENT';
        quantity = provision.quantity;
        destination = condition.destination;
      } else if (condition.type === 'DELIVERY') {
        kind = 'PURCHASE';
        quantity = condition.quantity;
        destination = condition.address;
      } else {
        continue;
      }
      const naturalId = getEntityNaturalIdFromAddress(destination);
      if (!naturalId || !quantity?.material || quantity.amount <= 0) {
        continue;
      }
      let cargo = result.get(naturalId);
      if (!cargo) {
        cargo = [];
        result.set(naturalId, cargo);
      }
      cargo.push({
        kind,
        contractLocalId: contract.localId,
        partnerName: contract.partner.name,
        ticker: quantity.material.ticker,
        amount: quantity.amount,
      });
    }
  }
  return result;
}

// DELIVERY_SHIPMENT depends on PICKUP_SHIPMENT, which depends on PROVISION_SHIPMENT.
function getShipmentProvision(contract: PrunApi.Contract, delivery: PrunApi.ContractCondition) {
  const pickup = contract.conditions.find(
    x => x.type === 'PICKUP_SHIPMENT' && delivery.dependencies.includes(x.id),
  );
  if (!pickup) {
    return undefined;
  }
  return contract.conditions.find(
    x => x.type === 'PROVISION_SHIPMENT' && pickup.dependencies.includes(x.id),
  );
}

export const contractCargoByPlanet = computed(() => {
  const active = contractsStore.active.value;
  return active ? getContractCargo(active) : undefined;
});

export interface BurnAdjustments {
  cargo?: ContractCargo[];
  // A managed base gets its production inputs from someone else.
  ignoreProductionInputs?: boolean;
}

// Returns a copy of the planet burn with contract cargo added to the inventory.
// Materials the base doesn't burn or produce are ignored, like inventory is.
export function adjustPlanetBurn(planet: PlanetBurn, adjustments: BurnAdjustments): PlanetBurn {
  const { cargo = [], ignoreProductionInputs = false } = adjustments;
  if (cargo.length === 0 && !ignoreProductionInputs) {
    return planet;
  }
  const burn: BurnValues = {};
  for (const ticker of Object.keys(planet.burn)) {
    const mat = { ...planet.burn[ticker] };
    if (ignoreProductionInputs) {
      mat.input = 0;
    }
    burn[ticker] = mat;
  }
  for (const item of cargo) {
    const mat = burn[item.ticker];
    if (mat === undefined) {
      continue;
    }
    mat.inventory += item.amount;
    mat.contractInventory = (mat.contractInventory ?? 0) + item.amount;
  }
  for (const ticker of Object.keys(burn)) {
    finalizeMaterialBurn(burn[ticker]);
  }
  return { ...planet, burn };
}
