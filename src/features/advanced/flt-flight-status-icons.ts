import { stationaryShipStatusIcon, shipStatusIconBySegmentType } from '@src/core/ship-status-icons';
import $style from './flt-flight-status-icons.module.css';

function init() {
  applyLocalizationPatch(L.ships.status.stationary, () => stationaryShipStatusIcon);
  applyLocalizationPatch(L.ShipStatus.takeoff, () => shipStatusIconBySegmentType.TAKE_OFF);
  applyLocalizationPatch(L.ShipStatus.departure, () => shipStatusIconBySegmentType.DEPARTURE);
  applyLocalizationPatch(L.ShipStatus.transit, () => shipStatusIconBySegmentType.TRANSIT);
  applyLocalizationPatch(L.ShipStatus.charge, () => shipStatusIconBySegmentType.CHARGE);
  applyLocalizationPatch(L.ShipStatus.jump, () => shipStatusIconBySegmentType.JUMP);
  applyLocalizationPatch(L.ShipStatus._float, () => shipStatusIconBySegmentType.FLOAT);
  applyLocalizationPatch(L.ShipStatus.approach, () => shipStatusIconBySegmentType.APPROACH);
  applyLocalizationPatch(L.ShipStatus.landing, () => shipStatusIconBySegmentType.LANDING);
  applyLocalizationPatch(L.ShipStatus.lock, () => shipStatusIconBySegmentType.LOCK);
  applyLocalizationPatch(L.ShipStatus.decay, () => shipStatusIconBySegmentType.DECAY);
  applyLocalizationPatch(L.ShipStatus.jumpgateway, () => shipStatusIconBySegmentType.JUMP_GATEWAY);
  applyCssRule(['FLT', 'FLTS', 'FLTP'], `td:nth-child(4)`, $style.status);
}

features.add(import.meta.url, init, 'FLT: Replaces the flight status text with arrow icons.');
