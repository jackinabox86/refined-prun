import { act } from '@src/features/XIT/ACT/act-registry';
import {
  addWaypointArmed,
  clickAssign,
  clickControl,
  clickEditorSave,
  commandLabel,
  fillStepEditor,
  fillWaypointFlight,
  findEditor,
  findStepEdit,
  findWaypointScope,
  locationValue,
  pickLocation,
  readShipAssignment,
  revealHover,
  routeLoopOn,
  routeLoopToggle,
  snapshotRouteIds,
  stationName,
  stepEdits,
  waitForEditor,
  waitForNewRouteId,
  WAYPOINT_EDITOR_TITLE,
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
  shipId?: string;
  stops: RouteStop[];
  loop?: boolean;
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

    let routeId = data.routeId?.trim() ?? '';
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
      routeId = created;
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
    if (data.loop !== undefined) {
      const looped = await setRouteLoop(ctx, tile, data.loop);
      if (!looped) {
        return;
      }
    }
    log.success('Route stops are in.');
    const ship = data.shipId?.trim() ?? '';
    if (ship.length > 0) {
      const ok = await assignShip(ctx, tile, ship, routeId);
      if (!ok) {
        return;
      }
    }
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
  if (!hasWaypointFlight(stop)) {
    return true;
  }
  return await saveWaypointFlight(ctx, tile, needles, stop);
}

function hasWaypointFlight(stop: RouteStop): boolean {
  return (
    stop.fuelUsage !== undefined || stop.reactorUsage !== undefined || stop.gateway !== undefined
  );
}

async function saveWaypointFlight(
  ctx: {
    waitAct: (status?: string) => Promise<void>;
    fail: (message?: string) => void;
    log: { info: (message: string) => void };
  },
  tile: PrunTile,
  needles: string[],
  stop: RouteStop,
): Promise<boolean> {
  const { waitAct, fail, log } = ctx;
  const scope = findWaypointScope(tile.anchor, needles);
  if (scope === undefined) {
    fail(`Could not find the waypoint for ${stop.query}`);
    return false;
  }
  const block = waypointBlock(scope);
  revealHover(block);
  try {
    await clickControl(block, WAYPOINT_EDITOR_TITLE);
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not open Edit waypoint');
    return false;
  }
  const title = WAYPOINT_EDITOR_TITLE;
  let editor: Element | undefined;
  await waitFor(() => {
    editor = findEditor(tile.anchor, title);
    return editor !== undefined;
  }, 8000);
  if (editor === undefined) {
    fail(`Could not find ${title}`);
    return false;
  }
  try {
    await fillWaypointFlight(editor, stop);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not fill ${title}`);
    return false;
  }
  log.info(`Filled ${title}`);
  await waitAct(`Save ${title}?`);
  const current = findEditor(tile.anchor, title);
  if (current === undefined) {
    fail(`${title} closed before SAVE`);
    return false;
  }
  try {
    await clickEditorSave(current);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not click SAVE on ${title}`);
    return false;
  }
  const closed = await waitFor(() => findEditor(tile.anchor, title) === undefined, 8000);
  if (!closed) {
    fail(`${title} is still open after SAVE`);
    return false;
  }
  await dismissSaveFeedback(tile);
  return true;
}

async function setRouteLoop(
  ctx: {
    waitAct: (status?: string) => Promise<void>;
    fail: (message?: string) => void;
    log: { info: (message: string) => void };
  },
  tile: PrunTile,
  on: boolean,
): Promise<boolean> {
  const { waitAct, fail, log } = ctx;
  const current = routeLoopToggle(tile.anchor);
  if (current === undefined) {
    fail('Could not find the Loop toggle');
    return false;
  }
  if (routeLoopOn(current) === on) {
    log.info(on ? 'Loop is already on' : 'Loop is already off');
    return true;
  }
  await waitAct(on ? 'Turn route loop on?' : 'Turn route loop off?');
  const toggle = routeLoopToggle(tile.anchor);
  if (toggle === undefined) {
    fail('Could not find the Loop toggle');
    return false;
  }
  if (routeLoopOn(toggle) === on) {
    return true;
  }
  try {
    await clickElement(toggle);
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not click the Loop toggle');
    return false;
  }
  const flipped = await waitFor(() => {
    const next = routeLoopToggle(tile.anchor);
    return next !== undefined && routeLoopOn(next) === on;
  }, 8000);
  if (!flipped) {
    fail(on ? 'Loop stayed off' : 'Loop stayed on');
    return false;
  }
  await dismissSaveFeedback(tile);
  log.info(on ? 'Loop is on' : 'Loop is off');
  return true;
}

async function addStep(
  ctx: {
    waitAct: (status?: string) => Promise<void>;
    fail: (message?: string) => void;
    log: { info: (message: string) => void };
  },
  tile: PrunTile,
  needles: string[],
  stop: RouteStop,
  step: RouteStep,
): Promise<boolean> {
  const { waitAct, fail, log } = ctx;
  const command = commandLabel(step);
  await waitAct(`Add ${command} at ${stop.query}?`);
  const scope = findWaypointScope(tile.anchor, needles);
  if (scope === undefined) {
    fail(`Could not find the waypoint for ${stop.query}`);
    return false;
  }
  revealHover(scope);
  await waitFor(() => findLabeled(scope, command), 1500);
  // Count the whole route: an empty waypoint's block resolves to the full list, so a
  // per-block count would include the earlier waypoints' pencils.
  const editsBefore = stepEdits(tile.anchor).length;
  try {
    await clickControl(scope, command);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not click ${command}`);
    return false;
  }
  // Adding a step shows no action feedback overlay; the new step row is the signal.
  let edit: HTMLElement | undefined;
  await waitFor(() => {
    const fresh = findWaypointScope(tile.anchor, needles);
    const block = fresh === undefined ? undefined : waypointBlock(fresh);
    if (block !== undefined) {
      revealHover(block);
    }
    edit =
      block === undefined || stepEdits(tile.anchor).length <= editsBefore
        ? undefined
        : findStepEdit(block);
    return edit !== undefined;
  }, 8000);
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
  const title = editorTitle(step);
  log.info(`Filled ${title}`);
  await waitAct(`Save ${title}?`);
  const current = findEditor(tile.anchor, title);
  if (current === undefined) {
    fail(`${title} closed before SAVE`);
    return false;
  }
  try {
    await clickEditorSave(current);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not click SAVE on ${title}`);
    return false;
  }
  // The editor's outer element survives SAVE (the tile swaps its contents), so poll for the
  // title instead of waiting for that element to disconnect.
  const closed = await waitFor(() => findEditor(tile.anchor, title) === undefined, 8000);
  if (!closed) {
    fail(`${title} is still open after SAVE`);
    return false;
  }
  await dismissSaveFeedback(tile);
  return true;
}

// The SAVE leaves a success overlay on the route tile; clear it before the next click.
async function dismissSaveFeedback(tile: PrunTile): Promise<void> {
  const find = () => _$(tile.frame, C.ActionFeedback.success) as HTMLElement | undefined;
  await waitFor(() => find() !== undefined, 2000);
  const success = find();
  if (success !== undefined) {
    await clickElement(success);
  }
}

async function assignShip(
  ctx: {
    waitAct: (status?: string) => Promise<void>;
    fail: (message?: string) => void;
    log: { success: (message: string) => void };
  },
  tile: PrunTile,
  ship: string,
  routeId: string,
): Promise<boolean> {
  const { waitAct, fail, log } = ctx;
  await waitFor(
    () => readShipAssignment(tile.anchor, ship, routeId).state.kind !== 'missing',
    5000,
  );
  const before = readShipAssignment(tile.anchor, ship, routeId);
  switch (before.state.kind) {
    case 'missing':
      fail(`${ship} is not in the route's Assignments list`);
      return false;
    case 'here':
      log.success(`${ship} is already assigned to ${routeId}`);
      return true;
    case 'busy':
      fail(`${ship} is on ${before.state.route} (${before.state.cmds}); not reassigning it`);
      return false;
  }
  await waitAct(`Assign ${ship} to ${routeId}?`);
  const current = readShipAssignment(tile.anchor, ship, routeId);
  if (current.state.kind !== 'free') {
    fail(`${ship} is no longer free to assign`);
    return false;
  }
  try {
    await clickAssign(current.rows[current.state.row]);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not click ASSIGN for ${ship}`);
    return false;
  }
  const assigned = await waitFor(
    () => readShipAssignment(tile.anchor, ship, routeId).state.kind === 'here',
    8000,
  );
  if (!assigned) {
    fail(`${ship} does not show ${routeId} after ASSIGN`);
    return false;
  }
  await dismissSaveFeedback(tile);
  log.success(`Assigned ${ship} to ${routeId}`);
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
