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
  hasControl,
  locationValue,
  pickLocation,
  readShipAssignment,
  revealAssignments,
  revealHover,
  pressLoopSwitch,
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
import {
  editorTitle,
  routeSummaryLines,
  stepSummary,
  type RouteStep,
  type RouteStop,
} from '@src/features/XIT/RTACT/route-spec';
import { shouldClickAddWaypoint, waypointNeedles } from '@src/features/XIT/RTACT/route-controls';
import { stagingRunBlock } from '@src/features/XIT/RTACT/staging-host';
import { rtStageWindowSize } from '@src/features/XIT/RTACT/rt-stage-layout';
import { resizeSplitWindow, splitOwnerId } from '@src/infrastructure/prun-ui/companion-buffer';
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
  previewLines: data =>
    routeSummaryLines({ stops: data.stops, loop: data.loop }, data.shipId?.trim()),
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
      if (tile !== undefined) {
        await applyRtStageLayout(tile);
      }
    } else {
      const list = await requestTile('RT');
      if (list === undefined) {
        return;
      }
      // Size the panes as soon as RT opens, not after the route exists.
      await applyRtStageLayout(list);
      await waitAct('Create route?');
      // The RT list can render its buttons after the tile opens.
      await waitFor(() => hasControl(list.anchor, 'CREATE ROUTE'), 8000);
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
    // The RT list tile turns into the new route by itself, and its tile entry can
    // still hold the list's content for a while. Use the entry that shows the editor.
    const command = `RT ${routeId}`;
    let editor: PrunTile | undefined;
    await waitFor(() => {
      editor = tiles
        .find(command, true)
        .find(x => x.anchor.isConnected && hasControl(x.anchor, 'ADD WAYPOINT'));
      return editor !== undefined;
    }, 8000);
    if (editor === undefined) {
      fail(`Could not find the ${command} editor`);
      return;
    }
    tile = editor;
    await applyRtStageLayout(tile);

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

async function applyRtStageLayout(tile: PrunTile) {
  const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;
  const ownerId = splitOwnerId(windowEl);
  if (ownerId === undefined) {
    return;
  }
  const bodyEl = _$(windowEl!, C.Window.body) as HTMLElement | null;
  const layout = rtStageWindowSize(parseInt(bodyEl?.style.height ?? '', 10));
  await resizeSplitWindow(ownerId, layout.actWidth, layout.rtWidth, layout.height);
}

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
    // The field can keep stale text such as an earlier ZV-307. Let the player
    // pick the suggestion, then require that pick to name this stop.
    await waitAct(`Pick ${stop.query} in Enter location, then press ACT`);
    // A picked station reads as its system id, e.g. ZV-307 for Antares Station.
    const raw = locationValue(tile.anchor);
    const query = stop.query.toLowerCase();
    const named = [raw, stationName(raw, raw) ?? ''].some(x => x.toLowerCase().includes(query));
    if (!addWaypointArmed(tile.anchor)) {
      fail(
        `ADD WAYPOINT is not armed for ${stop.query}. Raw text does not count until a suggestion is picked.`,
      );
      return false;
    }
    if (!named) {
      fail(`Enter location reads "${raw}", not ${stop.query}.`);
      return false;
    }
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
  let filled: string;
  try {
    filled = await fillWaypointFlight(editor, stop, waitAct);
  } catch (err) {
    fail(err instanceof Error ? err.message : `Could not fill ${title}`);
    return false;
  }
  log.info(`Filled ${title} for ${stop.query}: ${filled}`);
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
  const current = routeLoopToggle(tile.frame);
  if (current === undefined) {
    fail('Could not find the Loop toggle');
    return false;
  }
  if (routeLoopOn(current) === on) {
    log.info(on ? 'Loop is already on' : 'Loop is already off');
    return true;
  }
  await waitAct(on ? 'Turn route loop on?' : 'Turn route loop off?');
  const toggle = routeLoopToggle(tile.frame);
  if (toggle === undefined) {
    fail('Could not find the Loop toggle');
    return false;
  }
  if (routeLoopOn(toggle) === on) {
    return true;
  }
  try {
    await pressLoopSwitch(toggle);
  } catch (err) {
    fail(err instanceof Error ? err.message : 'Could not click the Loop toggle');
    return false;
  }
  const flipped = await waitFor(() => loopIs(tile.frame, on), 1500);
  if (!flipped) {
    await waitAct(on ? 'Turn Loop on, then press ACT' : 'Turn Loop off, then press ACT');
  }
  const done = await waitFor(() => loopIs(tile.frame, on), 1500);
  if (!done) {
    fail(on ? 'Loop stayed off' : 'Loop stayed on');
    return false;
  }
  await dismissSaveFeedback(tile);
  log.info(on ? 'Loop is on' : 'Loop is off');
  return true;
}

function loopIs(root: Element, on: boolean): boolean {
  const next = routeLoopToggle(root);
  return next !== undefined && routeLoopOn(next) === on;
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
  const summary = stepSummary(step);
  await waitAct(`Add ${summary} at ${stop.query}?`);
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
  log.info(`Filled ${title} at ${stop.query}: ${summary}`);
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
    log: { success: (message: string) => void; warning: (message: string) => void };
  },
  tile: PrunTile,
  ship: string,
  routeId: string,
): Promise<boolean> {
  const { waitAct, log } = ctx;
  // The route itself is built by now. Stop on the RT view's Assignments list so the
  // player can assign another ship there.
  const fail = (reason: string) => {
    log.warning(
      `${reason}. ${routeId} is built without ${ship}. Assign a ship in the Assignments list on the right.`,
    );
    revealAssignments(tile.anchor);
    ctx.fail();
  };
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
