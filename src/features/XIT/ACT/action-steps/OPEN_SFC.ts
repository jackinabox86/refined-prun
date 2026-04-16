import { act } from '@src/features/XIT/ACT/act-registry';
import { shipsStore } from '@src/infrastructure/prun-api/data/ships';
import { focusElement, changeInputValue, clickElement } from '@src/util';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';

interface Data {
  shipId: string;
  destination?: string;
}

export const OPEN_SFC = act.addActionStep<Data>({
  type: 'OPEN_SFC',
  description: data => {
    const ship = shipsStore.getById(data.shipId);
    const shipLabel = ship?.name ?? ship?.registration ?? 'unknown ship';
    return data.destination
      ? `Open SFC for ${shipLabel}, set destination to ${data.destination}`
      : `Open SFC for ${shipLabel}`;
  },
  execute: async ctx => {
    const { data, log, waitAct, requestTile, complete } = ctx;
    const assert: AssertFn = ctx.assert;

    const ship = shipsStore.getById(data.shipId);
    assert(ship, 'Ship not found');

    const tile = await requestTile(`SFC ${ship.registration}`);
    if (!tile) {
      return;
    }

    if (data.destination) {
      const input = _$$(document.documentElement, C.AddressSelector.input)[0] as
        | HTMLInputElement
        | undefined;
      if (!input) {
        log.warning('SFC address input not found — set destination manually');
        complete();
        return;
      }

      await waitAct(`Set destination to ${data.destination}?`);
      focusElement(input);
      changeInputValue(input, data.destination);

      await waitAct('Select destination?');
      const portal = document.getElementById('autosuggest-portal');
      const suggestion = _$$(portal!, C.AddressSelector.suggestionContent)[0] as
        | HTMLElement
        | undefined;
      if (suggestion) {
        await clickElement(suggestion);
        log.info(`Destination set: ${data.destination}`);
      } else {
        log.warning(`No suggestion found for ${data.destination} — select manually`);
      }
    }

    // Resize the companion window by directly setting Window.body dimensions.
    // UI_WINDOWS_UPDATE_SIZE doesn't work for docked tiles; direct style
    // manipulation on Window.body is the reliable approach for split windows.
    const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;
    const bodyEl = windowEl ? (_$(windowEl, C.Window.body) as HTMLElement | null) : null;
    if (bodyEl) {
      bodyEl.style.width = '975px';
      bodyEl.style.height = '750px';
    }
    complete();
  },
});
