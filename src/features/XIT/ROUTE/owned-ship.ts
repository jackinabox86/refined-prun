import { getShipSize } from '@src/core/ship-sizes';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { storagesStore } from '@src/infrastructure/prun-api/data/storage';

export function ownedShipOfSize(sizeId: string | undefined) {
  const size = getShipSize(sizeId);
  if (size === undefined) {
    return undefined;
  }
  const ships = shipsStore.all.value ?? [];
  return ships.find(ship => {
    const hold = storagesStore.getById(ship.idShipStore);
    return (
      hold !== undefined &&
      hold.weightCapacity === size.weight &&
      hold.volumeCapacity === size.volume
    );
  });
}

export function fuelCapacities(ship: PrunApi.Ship | undefined) {
  if (ship === undefined) {
    return { stl: 0, ftl: 0 };
  }
  return {
    stl: storagesStore.getById(ship.idStlFuelStore)?.weightCapacity ?? 0,
    ftl: storagesStore.getById(ship.idFtlFuelStore)?.weightCapacity ?? 0,
  };
}

export function cargoForRoute(sizeId: string | undefined): PrunApi.Store | undefined {
  const ship = ownedShipOfSize(sizeId);
  const hold = ship === undefined ? undefined : storagesStore.getById(ship.idShipStore);
  if (hold !== undefined) {
    return hold;
  }
  const size = getShipSize(sizeId);
  if (size === undefined) {
    return undefined;
  }
  return {
    id: '',
    addressableId: '',
    name: null,
    weightLoad: 0,
    weightCapacity: size.weight,
    volumeLoad: 0,
    volumeCapacity: size.volume,
    items: [],
    fixed: true,
    tradeStore: false,
    rank: 0,
    locked: false,
    type: 'SHIP_STORE',
  };
}
