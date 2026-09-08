import { act } from '@src/features/XIT/ACT/act-registry';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { getPlanetName } from '@src/core/planet-name';
import { convertToPlanetNaturalId } from '@src/core/planet-natural-id';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';

interface Data {
  shipId: string;
  destination?: string;
}

// Spacing between consecutive SFC opens. One ACT click opens the buffer and fills the
// destination; the player submits that flight themselves while the next ship's SFC keeps
// ACT grayed for this long. The run's first SFC has no preceding flight to wait on, and
// nothing pauses after the last one.
const flightSubmitGapMs = 2000;

export const OPEN_SFC = act.addActionStep<Data>({
  type: 'OPEN_SFC',
  description: data => {
    const ship = shipsStore.getById(data.shipId);
    const shipLabel = ship?.name ?? ship?.registration ?? 'unknown ship';
    return data.destination
      ? `Open SFC for ${shipLabel}, set destination to ${getPlanetName(data.destination)}`
      : `Open SFC for ${shipLabel}`;
  },
  execute: async ctx => {
    const { data, log, isFirstOfType, waitAct, requestTile, complete } = ctx;
    const assert: AssertFn = ctx.assert;

    const ship = shipsStore.getById(data.shipId);
    assert(ship, 'Ship not found');

    // One click for the whole step — it opens SFC and fills the destination. requestTile's
    // own per-open gate is suppressed so the open doesn't cost a second click, and gating
    // here rather than there also keeps selectAddress's server lookup behind a player click
    // when the ship's SFC tile happens to be open already.
    await waitAct(undefined, { actDelayMs: isFirstOfType ? 0 : flightSubmitGapMs });

    const tile = await requestTile(`SFC ${ship.registration}`, { actGate: false });
    if (!tile) {
      return;
    }

    const destinationName = data.destination ? getPlanetName(data.destination) : undefined;

    if (data.destination) {
      const container = await $(tile.anchor, C.AddressSelector.container);
      const naturalId = convertToPlanetNaturalId(data.destination) ?? data.destination;
      if (await selectAddress(container, naturalId)) {
        log.info(`Destination set: ${destinationName} — submit the flight in SFC`);
      } else {
        log.warning(
          `Could not set destination to ${destinationName} — select it manually, then submit the flight`,
        );
      }
    }

    complete();
  },
});
