import { act } from '@src/features/XIT/ACT/act-registry';
import {
  addWaypointArmed,
  clickControl,
  commandLabel,
  fillStepEditor,
  findStepEdit,
  findWaypointScope,
  locationValue,
  pickLocation,
  revealHover,
  snapshotRouteIds,
  stationName,
  waitForEditor,
  waitForNewRouteId,
  waypointBlock,
} from '@src/features/XIT/RTACT/route-dom';
import { editorTitle, type RouteStep, type RouteStop } from '@src/features/XIT/RTACT/route-spec';
import { shouldClickAddWaypoint, waypointNeedles } from '@src/features/XIT/RTACT/route-controls';
import { stagingRunBlock } from '@src/features/XIT/RTACT/staging-host';
import { AssertFn } from '@src/features/XIT/ACT/shared-types';
import { clickElement } from '@src/util';
import { waitFor } from '@src/utils/wait-for';

interface Data {
  routeId?: string;
  stops: RouteStop[];
}

export const RT_BUILD = act.addActionStep<Data>({
  type: 'RT_BUILD',
  description: data => `Build staging route (${data.stops.length} stops)`,
  execute: async ctx => {
    const { data, log, requestTile, waitAct, waitActionFeedback, fail, complete } = ctx;
    const assert: AssertFn = ctx.assert;
    const blocked = stagingRunBlock(location.hostname);
    if (blocked !== undefined) {
      fail(blocked);
      return;
    }

    const routeId = data.routeId?.trim() ?? '';
    let tile: PrunTile | undefined;
    if (routeId.length > 0) {
      tile = await requestTile(`RT ${routeId}`);
    } else {
      const list = await requestTile('RT');
      if (list === undefined) {
        return;
      }
      await waitAct('Create route?');
      const before = snapshotRouteIds(list.anchor);
      try {
        await clickControl(list.anchor, 'CREATE ROUTE');
      } catch (err) {
        fail(err instanceof Error ? err.message : 'Could not click CREATE ROUTE');
        return;
      }
      await waitActionFeedback(list);
      const created = await waitForNewRouteId(list.anchor, before);
      assert(created !== undefined, 'Could not see the new route id');
      log.info(`Created ${created}`);
      tile = await requestTile(`RT ${created}`, { actGate: false });
    }
    if (tile === undefined) {
      return;
    }

    for (const stop of data.stops) {
      const ok = await addStop(ctx, tile, stop);
      if (!ok) {
        return;
      }
    }
    log.success('Route stops are in. Each step SAVE was left to you.');
    complete();
  },
});

async function addStop(
  ctx: {
    waitAct: (status?: string) => Promise<void>;
    waitSkipOr: (status: string, event: Promise<void>) => Promise<'skip' | 'ready'>;
    waitActionFeedback: (tile: PrunTile) => Promise<void>;
    fail: (message?: string) => void;
    assert: AssertFn;
    log: { info: (message: string) => void };
  },
  tile: PrunTile,
  stop: RouteStop,
): Promise<boolean> {
  const { waitAct, waitActionFeedback, fail, log } = ctx;
  const assert: AssertFn = ctx.assert;
  await waitAct(`Add waypoint ${stop.query}?`);
  const picked = await pickLocation(tile.anchor, stop.query);
  const armed = addWaypointArmed(tile.anchor);
  if (!shouldClickAddWaypoint({ suggestionPicked: picked, armed })) {
    fail(
      `ADD WAYPOINT is not armed for ${stop.query}. Raw text does not count until a suggestion is picked.`,
    );
    return false;
  }
  try {
    await clickControl(tile.anchor, 'ADD WAYPOINT', { requireArmed: true });
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not click ADD WAYPOINT');
    return false;
  }
  await waitActionFeedback(tile);
  const canonical = locationValue(tile.anchor);
  const needles = waypointNeedles(stop.query, canonical, stationName(stop.query, canonical));
  const appeared = await waitFor(() => findWaypointScope(tile.anchor, needles) !== undefined, 8000);
  assert(appeared, `Could not find the new waypoint for ${stop.query}`);
  log.info(`Waypoint ${canonical.length > 0 ? canonical : stop.query}`);

  for (const step of stop.steps) {
    const ok = await addStep(ctx, tile, needles, stop, step);
    if (!ok) {
      return false;
    }
  }
  return true;
}

async function addStep(
  ctx: {
    waitAct: (status?: string) => Promise<void>;
    waitSkipOr: (status: string, event: Promise<void>) => Promise<'skip' | 'ready'>;
    waitActionFeedback: (tile: PrunTile) => Promise<void>;
    fail: (message?: string) => void;
    log: { info: (message: string) => void };
  },
  tile: PrunTile,
  needles: string[],
  stop: RouteStop,
  step: RouteStep,
): Promise<boolean> {
  const { waitAct, waitSkipOr, waitActionFeedback, fail, log } = ctx;
  const command = commandLabel(step);
  await waitAct(`Add ${command} at ${stop.query}?`);
  const scope = findWaypointScope(tile.anchor, needles);
  if (scope === undefined) {
    fail(`Could not find the waypoint for ${stop.query}`);
    return false;
  }
  revealHover(scope);
  await waitFor(() => findLabeled(scope, command), 1500);
  try {
    await clickControl(scope, command);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not click ${command}`);
    return false;
  }
  await waitActionFeedback(tile);
  let edit: HTMLElement | undefined;
  await waitFor(() => {
    const fresh = findWaypointScope(tile.anchor, needles);
    const block = fresh === undefined ? undefined : waypointBlock(fresh);
    if (block !== undefined) {
      revealHover(block);
    }
    edit = block === undefined ? undefined : findStepEdit(block);
    return edit !== undefined;
  }, 5000);
  if (edit === undefined) {
    fail(`Could not find the Edit control for ${command} at ${stop.query}`);
    return false;
  }
  try {
    await clickEdit(edit);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not open ${command}`);
    return false;
  }
  const editor = await waitForEditor(tile.anchor, step);
  if (editor === undefined) {
    fail(`Could not find ${editorTitle(step)}`);
    return false;
  }
  try {
    await fillStepEditor(editor, step);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not fill ${editorTitle(step)}`);
    return false;
  }
  log.info(`Filled ${editorTitle(step)}. Click SAVE yourself.`);
  const watch = watchDisconnect(editor);
  try {
    const outcome = await waitSkipOr(`Click SAVE on ${editorTitle(step)}`, watch.done);
    if (outcome === 'skip' && editor.isConnected) {
      fail('Step editor is still open');
      return false;
    }
  } finally {
    watch.cancel();
  }
  return true;
}

function findLabeled(root: Element, label: string): boolean {
  const wanted = label.toLowerCase();
  return Array.from(root.querySelectorAll('button, a, [role="button"]')).some(
    el => (el.textContent ?? '').trim().toLowerCase() === wanted,
  );
}

async function clickEdit(el: HTMLElement): Promise<void> {
  const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim();
  if (/delete/i.test(label)) {
    throw new Error(`Refusing to activate a delete control (${label})`);
  }
  await clickElement(el);
}

function watchDisconnect(el: Element): { done: Promise<void>; cancel: () => void } {
  let timer = 0;
  const done = new Promise<void>(resolve => {
    if (!el.isConnected) {
      resolve();
      return;
    }
    timer = window.setInterval(() => {
      if (!el.isConnected) {
        window.clearInterval(timer);
        timer = 0;
        resolve();
      }
    }, 200);
  });
  return {
    done,
    cancel: () => {
      if (timer !== 0) {
        window.clearInterval(timer);
        timer = 0;
      }
    },
  };
}
