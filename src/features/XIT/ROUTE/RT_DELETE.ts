import { act } from '@src/features/XIT/ACT/act-registry';
import {
  deleteOutcome,
  gameRouteMissing,
  routeNameFrom,
  routeRowIndices,
  routeRowRemoved,
  rowDeleteIndex,
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

type Target =
  | { kind: 'row'; index: number; name: string }
  | { kind: 'absent' }
  | { kind: 'kept'; reason: string };

function listRows(anchor: Element): HTMLTableRowElement[] {
  return Array.from(anchor.querySelectorAll('tbody tr'));
}

function rowCells(rows: HTMLTableRowElement[]): string[][] {
  return rows.map(row =>
    Array.from(row.querySelectorAll('td'), td => (td.textContent ?? '').trim()),
  );
}

// The list header proves the RT list has rendered, so an empty list is a real empty list.
function listShown(anchor: Element): boolean {
  const heads = Array.from(anchor.querySelectorAll('th'), th => (th.textContent ?? '').trim());
  return heads.includes('Waypoints') && heads.includes('Created');
}

// The texts beside the id in the route's own view, which hold its in-game name.
function headerTexts(view: Element, rtId: string): string[] | undefined {
  const id = rtId.trim().toUpperCase();
  const leaf = Array.from(view.querySelectorAll('*')).find(
    el => el.children.length === 0 && (el.textContent ?? '').trim().toUpperCase() === id,
  );
  if (leaf === undefined || leaf.parentElement === null) {
    return undefined;
  }
  return Array.from(leaf.parentElement.children, el => el.textContent ?? '');
}

// Finds the list row for this route by its in-game name, which the list shows for a renamed
// route, or by its id. Only the game's own view can say the route is gone. The list has
// already rendered (listShown), so an empty list means the player has no game routes.
function resolveTarget(list: PrunTile, view: PrunTile, data: Data): Target {
  const rows = rowCells(listRows(list.anchor));
  if (gameRouteMissing(view.frame.textContent ?? '')) {
    if (routeRowIndices(rows, data.rtId, data.rtId).length > 0) {
      return { kind: 'kept', reason: `${data.rtId} says no route, but the RT list still shows it` };
    }
    return { kind: 'absent' };
  }
  const name = routeNameFrom(headerTexts(view.anchor, data.rtId) ?? [], data.rtId);
  if (name === undefined) {
    return { kind: 'kept', reason: `could not read the in-game name of ${data.rtId}` };
  }
  if (rows.length === 0) {
    return { kind: 'kept', reason: 'the RT list has no routes loaded to find it in' };
  }
  const hits = routeRowIndices(rows, data.rtId, name);
  if (hits.length !== 1) {
    return {
      kind: 'kept',
      reason:
        hits.length === 0
          ? `${name} (${data.rtId}) is not in the RT list`
          : `${name} matches ${hits.length} RT list rows`,
    };
  }
  return { kind: 'row', index: hits[0], name };
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
    const view = await requestTile(`RT ${data.rtId}`);
    if (view === undefined) {
      return;
    }
    await waitFor(
      () =>
        gameRouteMissing(view.frame.textContent ?? '') ||
        headerTexts(view.anchor, data.rtId) !== undefined,
      8000,
    );

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

    const first = resolveTarget(list, view, data);
    if (first.kind === 'kept') {
      finish({ kind: 'kept', reason: first.reason });
      return;
    }
    if (first.kind === 'absent') {
      finish({ kind: 'absent' });
      return;
    }
    await waitAct(`Delete ${data.rtId} in the game?`);
    const target = resolveTarget(list, view, data);
    if (target.kind !== 'row') {
      finish({
        kind: 'kept',
        reason: target.kind === 'kept' ? target.reason : 'the RT list changed before ACT',
      });
      return;
    }
    const rowsBefore = rowCells(listRows(list.anchor));
    const row = listRows(list.anchor)[target.index];
    const button = row === undefined ? undefined : rowDeleteButton(row);
    if (button === undefined) {
      finish({ kind: 'kept', reason: `no delete button on the ${data.rtId} row` });
      return;
    }
    await clickElement(button);

    const confirmation = () =>
      _$(list.frame, C.ActionConfirmationOverlay.container) as HTMLElement | undefined;
    await waitFor(
      () =>
        confirmation() !== undefined ||
        routeRowRemoved(rowsBefore, rowCells(listRows(list.anchor)), data.rtId, target.name),
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
        routeRowRemoved(rowsBefore, rowCells(listRows(list.anchor)), data.rtId, target.name) ||
        feedbackError(list.frame) !== undefined,
      8000,
    );
    const error = feedbackError(list.frame);
    if (error !== undefined) {
      finish({ kind: 'kept', reason: error });
      return;
    }
    if (!routeRowRemoved(rowsBefore, rowCells(listRows(list.anchor)), data.rtId, target.name)) {
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
