import { act } from '@src/features/XIT/ACT/act-registry';
import {
  deleteOutcome,
  rowDeleteIndex,
  rtListRowIndex,
  type GameDeleteResult,
} from '@src/features/XIT/ROUTE/route-delete';
import { removeRoute } from '@src/features/XIT/ROUTE/routes';
import { rtRunBlock } from '@src/features/XIT/RTACT/rt-host';
import { clickElement } from '@src/util';
import { waitFor } from '@src/utils/wait-for';

interface Data {
  configRouteId: string;
  name: string;
  rtId: string;
}

function listRows(anchor: Element): HTMLTableRowElement[] {
  return Array.from(anchor.querySelectorAll('tbody tr'));
}

function rowCells(rows: HTMLTableRowElement[]): string[][] {
  return rows.map(row =>
    Array.from(row.querySelectorAll('td'), td => (td.textContent ?? '').trim()),
  );
}

// The list header proves the RT list has rendered, so a missing id means the route is gone.
function listShown(anchor: Element): boolean {
  const heads = Array.from(anchor.querySelectorAll('th'), th => (th.textContent ?? '').trim());
  return heads.includes('Waypoints') && heads.includes('Created');
}

function routeRow(anchor: Element, rtId: string): HTMLTableRowElement | undefined {
  const rows = listRows(anchor);
  const index = rtListRowIndex(rowCells(rows), rtId);
  return index === undefined ? undefined : rows[index];
}

function rowDeleteButton(row: HTMLTableRowElement): HTMLElement | undefined {
  const buttons = Array.from(row.querySelectorAll('button'));
  const index = rowDeleteIndex(buttons.map(button => button.textContent ?? ''));
  return index === undefined ? undefined : buttons[index];
}

function feedbackError(frame: Element): string | undefined {
  const error = _$(frame, C.ActionFeedback.error);
  if (error === undefined) {
    return undefined;
  }
  const message = _$(error, C.ActionFeedback.message)?.textContent ?? '';
  const dismiss = _$(error, C.ActionFeedback.dismiss)?.textContent ?? '';
  const text = (dismiss.length > 0 ? message.replace(dismiss, '') : message).trim();
  return text.length > 0 ? text : 'the game reported an error';
}

// RTACT never clicks a delete control. This step is the one exception: it presses the
// delete on exactly one RT list row, only after the player confirmed in ROUTECONFIG or
// ROUTEBURN and then pressed ACT for it.
export const RT_DELETE = act.addActionStep<Data>({
  type: 'RT_DELETE',
  description: data => `Delete game route ${data.rtId} and ${data.name}`,
  execute: async ctx => {
    const { data, log, requestTile, waitAct, fail, complete } = ctx;
    const blocked = rtRunBlock(location.hostname);
    if (blocked !== undefined) {
      fail(`${blocked}. Nothing was deleted; ${data.name} is kept.`);
      return;
    }
    const list = await requestTile('RT');
    if (list === undefined) {
      return;
    }
    await waitFor(() => listShown(list.anchor), 8000);
    if (!listShown(list.anchor)) {
      fail(`The RT list did not load. Nothing was deleted; ${data.name} is kept.`);
      return;
    }
    await waitFor(() => routeRow(list.anchor, data.rtId) !== undefined, 8000);

    const finish = (result: GameDeleteResult) => {
      const outcome = deleteOutcome(result, data.name, data.rtId);
      if (!outcome.removeConfig) {
        fail(outcome.message);
        return;
      }
      removeRoute(data.configRouteId);
      if (outcome.level === 'warning') {
        log.warning(outcome.message);
      } else {
        log.success(outcome.message);
      }
      complete();
    };

    if (routeRow(list.anchor, data.rtId) === undefined) {
      finish({ kind: 'absent' });
      return;
    }
    await waitAct(`Delete ${data.rtId} in the game?`);
    const row = routeRow(list.anchor, data.rtId);
    const button = row === undefined ? undefined : rowDeleteButton(row);
    if (button === undefined) {
      finish({ kind: 'kept', reason: `no delete button on the ${data.rtId} row` });
      return;
    }
    await clickElement(button);

    const confirmation = () =>
      _$(list.frame, C.ActionConfirmationOverlay.container) as HTMLElement | undefined;
    await waitFor(
      () => confirmation() !== undefined || routeRow(list.anchor, data.rtId) === undefined,
      2000,
    );
    const overlay = confirmation();
    if (overlay !== undefined) {
      await waitAct(`Confirm the game's delete of ${data.rtId}`);
      const confirm = _$$(overlay, C.Button.btn)[1];
      if (confirm === undefined) {
        finish({ kind: 'kept', reason: "the game's confirmation has no confirm button" });
        return;
      }
      await clickElement(confirm);
    }

    await waitFor(
      () =>
        routeRow(list.anchor, data.rtId) === undefined || feedbackError(list.frame) !== undefined,
      8000,
    );
    const error = feedbackError(list.frame);
    if (error !== undefined) {
      finish({ kind: 'kept', reason: error });
      return;
    }
    if (routeRow(list.anchor, data.rtId) !== undefined) {
      finish({ kind: 'kept', reason: 'it is still in the RT list' });
      return;
    }
    const success = _$(list.frame, C.ActionFeedback.success) as HTMLElement | undefined;
    if (success !== undefined) {
      await clickElement(success);
    }
    finish({ kind: 'deleted' });
  },
});
