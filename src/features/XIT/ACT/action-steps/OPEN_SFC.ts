import { act } from '@src/features/XIT/ACT/act-registry';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { getPlanetName } from '@src/core/planet-name';
import { convertToPlanetNaturalId } from '@src/core/planet-natural-id';
import { selectAddress } from '@src/infrastructure/prun-ui/utils/select-address';
import { resizeSplitWindow, splitOwnerId } from '@src/infrastructure/prun-ui/companion-buffer';
import { sfcStageWindowSize } from '@src/features/XIT/ACT/action-steps/sfc-stage-layout';
import {
  hasShipStartedFlight,
  SFC_SUBMIT_STATUS,
} from '@src/features/XIT/ACT/action-steps/sfc-submit-gate';
import { watch } from 'vue';

interface Data {
  shipId: string;
  destination?: string;
  waitForSubmit?: boolean;
}

// Spacing between consecutive SFC opens. One ACT click opens the buffer and fills the
// destination; the player submits that flight themselves while the next ship's SFC keeps
// ACT grayed for this long. The run's first SFC has no preceding flight to wait on.
// DISPATCHACT finish steps then hold after the open until fleet status shows a flight
// (or skip); other hosts still complete immediately, so nothing pauses after their last.
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
    const { data, log, isFirstOfType, waitAct, waitSkipOr, requestTile, complete } = ctx;
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

    if (isFirstOfType) {
      await applySfcStageLayout(tile);
    }

    if (data.waitForSubmit && !hasShipStartedFlight(shipsStore.getById(data.shipId))) {
      let stopWatch: (() => void) | undefined;
      const flightStarted = new Promise<void>(resolve => {
        const stop = watch(
          () => hasShipStartedFlight(shipsStore.getById(data.shipId)),
          started => {
            if (started) {
              stop();
              resolve();
            }
          },
          { immediate: true },
        );
        stopWatch = stop;
      });
      try {
        const outcome = await waitSkipOr(SFC_SUBMIT_STATUS, flightStarted);
        if (outcome === 'skip') {
          return;
        }
      } finally {
        stopWatch?.();
      }
    }

    complete();
  },
});

async function applySfcStageLayout(tile: PrunTile) {
  const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;
  const ownerId = splitOwnerId(windowEl);
  if (ownerId === undefined) {
    return;
  }
  const bodyEl = _$(windowEl!, C.Window.body) as HTMLElement | null;
  const currentWidth = parseInt(bodyEl?.style.width ?? '', 10);
  const currentHeight = parseInt(bodyEl?.style.height ?? '', 10);
  const layout = sfcStageWindowSize(actPaneWidth(tile), currentWidth, currentHeight);
  await resizeSplitWindow(ownerId, layout.actWidth, layout.sfcWidth, layout.height);
}

// Measured width of the pane ACT itself sits in — the SFC tile's sibling. The panes
// carry their split as an inline percentage, so read laid-out pixels instead.
function actPaneWidth(sfcTile: PrunTile) {
  const node = sfcTile.container.parentElement;
  if (node === null) {
    return NaN;
  }
  const sibling = _$$(node, C.Node.child).find(x => x !== sfcTile.container);
  return sibling === undefined ? NaN : sibling.getBoundingClientRect().width;
}
