import ActionConfirmationOverlay from '@src/components/ActionConfirmationOverlay.vue';
import { act } from '@src/features/XIT/ACT/act-registry';
import { ActionStepExecuteContext } from '@src/features/XIT/ACT/shared-types';
import { saveRouteRtId } from '@src/features/XIT/ROUTE/routes';
import {
  addWaypointArmed,
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
  revealAssignments,
  revealHover,
  pressLoopSwitch,
  routeLoopOn,
  routeLoopToggle,
  snapshotRouteIds,
  stationName,
  stepEdits,
  tryAssignShip,
  waitForEditor,
  waitForNewRouteId,
  WAYPOINT_EDITOR_TITLE,
  waypointBlock,
} from '@src/features/XIT/RTACT/route-dom';
import {
  editorTitle,
  isShipmentStep,
  isUnloadAllStep,
  routeSummaryLines,
  shipmentRowText,
  stepSummary,
  UNLOAD_ALL_ROW_TEXT,
  type RouteStep,
  type RouteStop,
} from '@src/features/XIT/RTACT/route-spec';
import { shouldClickAddWaypoint, waypointNeedles } from '@src/features/XIT/RTACT/route-controls';
import { rtRunBlock } from '@src/features/XIT/RTACT/rt-host';
import { rtStageWindowSize } from '@src/features/XIT/RTACT/rt-stage-layout';
import { PhaseResult, phaseFailed, phaseOk, retryPhase } from '@src/features/XIT/RTACT/route-retry';
import { resizeSplitWindow, splitOwnerId } from '@src/infrastructure/prun-ui/companion-buffer';
import { showTileOverlay } from '@src/infrastructure/prun-ui/tile-overlay';
import { clickElement } from '@src/util';
import { waitFor } from '@src/utils/wait-for';

interface Data {
  routeId?: string;
  shipId?: string;
  stops: RouteStop[];
  loop?: boolean;
  configRouteId?: string;
}

type BuildCtx = Pick<ActionStepExecuteContext<Data>, 'log' | 'waitAct' | 'waitActionFeedback'>;

// Every game action is its own phase: one click, or one wait for the game to show its result.
// A phase that fails pauses the build on that phase only. ACT retries it, and the phases
// before it stay done, so a retry never re-creates the route or re-adds a waypoint.
export const RT_BUILD = act.addActionStep<Data>({
  type: 'RT_BUILD',
  description: data => `Build route (${data.stops.length} stops)`,
  previewLines: data =>
    routeSummaryLines({ stops: data.stops, loop: data.loop }, data.shipId?.trim()),
  execute: async ctx => {
    const { data, log, requestTile, waitAct, waitActionFeedback, fail, complete } = ctx;
    const blocked = rtRunBlock(location.hostname);
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
      // The RT list can render its buttons after the tile opens. The snapshot is taken on
      // every attempt, so a retry after a rejected click compares against the list as it is.
      let before: string[] = [];
      await retryOn(ctx, list, async () => {
        await waitFor(() => hasControl(list.anchor, 'CREATE ROUTE'), 8000);
        before = snapshotRouteIds(list.anchor);
        try {
          await clickControl(list.anchor, 'CREATE ROUTE');
        } catch (err) {
          return phaseFailed(err instanceof Error ? err.message : 'Could not click CREATE ROUTE');
        }
        const error = await waitActionFeedback(list, { recoverable: true });
        return error === undefined ? phaseOk(undefined) : phaseFailed(error);
      });
      // Separate phase: once the click has created the route, a retry only looks for its id.
      const created = await retryOn(ctx, list, async () => {
        const id = await waitForNewRouteId(list.anchor, before);
        return id === undefined ? phaseFailed('Could not see the new route id') : phaseOk(id);
      });
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
    const rt = await retryOn(ctx, tile, async () => {
      await waitFor(() => findRouteEditor(command) !== undefined, 8000);
      const found = findRouteEditor(command);
      return found === undefined
        ? phaseFailed(`Could not find the ${command} editor`)
        : phaseOk(found);
    });
    await applyRtStageLayout(rt);
    saveRouteRtId(data.configRouteId, routeId);

    for (const stop of data.stops) {
      await addStop(ctx, rt, stop);
    }
    if (data.loop !== undefined) {
      await setRouteLoop(ctx, rt, data.loop);
    }
    log.success('Route stops are in.');
    const ship = data.shipId?.trim() ?? '';
    if (ship.length > 0 && !(await confirmAssign(ctx.actTile, ship, routeId))) {
      log.info(
        `${routeId} is built without a ship. Assign ${ship} when you want the route to start.`,
      );
      complete();
      return;
    }
    if (ship.length > 0) {
      await assignShip(ctx, rt, ship, routeId);
    }
    complete();
  },
});

// Runs one phase, pausing on each failure. ACT retries the phase. A rejected game action
// leaves its error overlay on the tile, so the overlay is cleared before the retry.
function retryOn<T>(ctx: BuildCtx, tile: PrunTile, run: () => Promise<PhaseResult<T>>): Promise<T> {
  return retryPhase(run, async error => {
    ctx.log.error(error);
    await ctx.waitAct(`${error}. Press ACT to retry this step`);
    await clearFeedbackError(tile);
  });
}

async function clearFeedbackError(tile: PrunTile) {
  const error = _$(tile.frame, C.ActionFeedback.error) as HTMLElement | undefined;
  if (error !== undefined) {
    await clickElement(error);
  }
}

function findRouteEditor(command: string): PrunTile | undefined {
  return tiles
    .find(command, true)
    .find(x => x.anchor.isConnected && hasControl(x.anchor, 'ADD WAYPOINT'));
}

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

async function addStop(ctx: BuildCtx, tile: PrunTile, stop: RouteStop) {
  const { waitAct, log, waitActionFeedback } = ctx;
  await waitAct(`Add waypoint ${stop.query}?`);
  await retryOn(ctx, tile, async () => {
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
        return phaseFailed(
          `ADD WAYPOINT is not armed for ${stop.query}. Raw text does not count until a suggestion is picked.`,
        );
      }
      if (!named) {
        return phaseFailed(`Enter location reads "${raw}", not ${stop.query}.`);
      }
    }
    try {
      await clickControl(tile.anchor, 'ADD WAYPOINT', { requireArmed: true });
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : 'Could not click ADD WAYPOINT');
    }
    const error = await waitActionFeedback(tile, { recoverable: true });
    return error === undefined ? phaseOk(undefined) : phaseFailed(error);
  });
  // Separate phase: once the waypoint exists, a retry only looks for it again.
  const { canonical, needles } = await retryOn(ctx, tile, async () => {
    const current = locationValue(tile.anchor);
    const found = waypointNeedles(stop.query, current, stationName(stop.query, current));
    const appeared = await waitFor(() => findWaypointScope(tile.anchor, found) !== undefined, 8000);
    return appeared
      ? phaseOk({ canonical: current, needles: found })
      : phaseFailed(`Could not find the new waypoint for ${stop.query}`);
  });
  log.info(`Waypoint ${canonical.length > 0 ? canonical : stop.query}`);

  for (const step of stop.steps) {
    await addStep(ctx, tile, needles, stop, step);
  }
  if (hasWaypointFlight(stop)) {
    await saveWaypointFlight(ctx, tile, needles, stop);
  }
}

function hasWaypointFlight(stop: RouteStop): boolean {
  return (
    stop.fuelUsage !== undefined || stop.reactorUsage !== undefined || stop.gateway !== undefined
  );
}

async function saveWaypointFlight(
  ctx: BuildCtx,
  tile: PrunTile,
  needles: string[],
  stop: RouteStop,
) {
  const { waitAct, log } = ctx;
  const title = WAYPOINT_EDITOR_TITLE;
  await retryOn(ctx, tile, async () => {
    const scope = findWaypointScope(tile.anchor, needles);
    if (scope === undefined) {
      return phaseFailed(`Could not find the waypoint for ${stop.query}`);
    }
    const block = waypointBlock(scope);
    revealHover(block);
    try {
      await clickControl(block, title);
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : 'Could not open Edit waypoint');
    }
    const opened = await waitFor(() => findEditor(tile.anchor, title) !== undefined, 8000);
    return opened ? phaseOk(undefined) : phaseFailed(`Could not find ${title}`);
  });

  await retryOn(ctx, tile, async () => {
    const editor = findEditor(tile.anchor, title);
    if (editor === undefined) {
      return phaseFailed(`${title} closed before it was filled`);
    }
    let filled: string;
    try {
      filled = await fillWaypointFlight(editor, stop, waitAct);
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : `Could not fill ${title}`);
    }
    log.info(`Filled ${title} for ${stop.query}: ${filled}`);
    return phaseOk(undefined);
  });
  await waitAct(`Save ${title}?`);
  await saveEditor(ctx, tile, title);
}

// SAVE is one phase: click SAVE, then wait for the editor to close. The game rejects a SAVE
// and keeps the editor open, so a retry clicks SAVE again; it edits the step that already
// exists, so it cannot add a duplicate. If the editor closes after a click, the player saved
// it in game, which counts as success.
async function saveEditor(ctx: BuildCtx, tile: PrunTile, title: string) {
  let clicked = false;
  await retryOn(ctx, tile, async () => {
    const current = findEditor(tile.anchor, title);
    if (current === undefined) {
      return clicked ? phaseOk(undefined) : phaseFailed(`${title} closed before SAVE`);
    }
    try {
      await clickEditorSave(current);
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : `Could not click SAVE on ${title}`);
    }
    clicked = true;
    const closed = await waitFor(() => findEditor(tile.anchor, title) === undefined, 8000);
    return closed ? phaseOk(undefined) : phaseFailed(`${title} is still open after SAVE`);
  });
  await dismissSaveFeedback(tile);
}

async function setRouteLoop(ctx: BuildCtx, tile: PrunTile, on: boolean) {
  const { waitAct, log } = ctx;
  await retryOn(ctx, tile, async () => {
    const current = routeLoopToggle(tile.frame);
    if (current === undefined) {
      return phaseFailed('Could not find the Loop toggle');
    }
    if (routeLoopOn(current) === on) {
      log.info(on ? 'Loop is already on' : 'Loop is already off');
      return phaseOk(undefined);
    }
    await waitAct(on ? 'Turn route loop on?' : 'Turn route loop off?');
    const toggle = routeLoopToggle(tile.frame);
    if (toggle === undefined) {
      return phaseFailed('Could not find the Loop toggle');
    }
    if (routeLoopOn(toggle) === on) {
      return phaseOk(undefined);
    }
    try {
      await pressLoopSwitch(toggle);
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : 'Could not click the Loop toggle');
    }
    const flipped = await waitFor(() => loopIs(tile.frame, on), 1500);
    if (!flipped) {
      await waitAct(on ? 'Turn Loop on, then press ACT' : 'Turn Loop off, then press ACT');
    }
    const done = await waitFor(() => loopIs(tile.frame, on), 1500);
    if (!done) {
      return phaseFailed(on ? 'Loop stayed off' : 'Loop stayed on');
    }
    await dismissSaveFeedback(tile);
    log.info(on ? 'Loop is on' : 'Loop is off');
    return phaseOk(undefined);
  });
}

function loopIs(root: Element, on: boolean): boolean {
  const next = routeLoopToggle(root);
  return next !== undefined && routeLoopOn(next) === on;
}

async function addStep(
  ctx: BuildCtx,
  tile: PrunTile,
  needles: string[],
  stop: RouteStop,
  step: RouteStep,
) {
  const { waitAct, log } = ctx;
  const command = commandLabel(step);
  const summary = stepSummary(step);
  await waitAct(`Add ${summary} at ${stop.query}?`);
  if (isUnloadAllStep(step)) {
    // One click adds the row with no pencil and no editor. Its description is the only
    // signal, and the row can sit outside the waypoint's block, so count it over the route.
    let rowsBefore = 0;
    await retryOn(ctx, tile, async () => {
      const scope = findWaypointScope(tile.anchor, needles);
      if (scope === undefined) {
        return phaseFailed(`Could not find the waypoint for ${stop.query}`);
      }
      revealHover(scope);
      await waitFor(() => findLabeled(scope, command), 1500);
      rowsBefore = textCount(tile.anchor, UNLOAD_ALL_ROW_TEXT);
      try {
        await clickControl(scope, command);
      } catch (err) {
        return phaseFailed(err instanceof Error ? err.message : `Could not click ${command}`);
      }
      return phaseOk(undefined);
    });
    await retryOn(ctx, tile, async () => {
      const added = await waitFor(
        () => textCount(tile.anchor, UNLOAD_ALL_ROW_TEXT) > rowsBefore,
        8000,
      );
      return added
        ? phaseOk(undefined)
        : phaseFailed(`Could not find the new ${command} step at ${stop.query}`);
    });
    log.info(`Added ${summary} at ${stop.query}`);
    return;
  }
  if (isShipmentStep(step)) {
    // A shipment step has no editor and no SAVE: the click adds it filled in, so the new
    // row's text is the only signal.
    const rowText = shipmentRowText(step);
    let rowsBefore = 0;
    await retryOn(ctx, tile, async () => {
      const scope = findWaypointScope(tile.anchor, needles);
      if (scope === undefined) {
        return phaseFailed(`Could not find the waypoint for ${stop.query}`);
      }
      revealHover(scope);
      await waitFor(() => findLabeled(scope, command), 1500);
      rowsBefore = textCount(tile.anchor, rowText);
      try {
        await clickControl(scope, command);
      } catch (err) {
        return phaseFailed(err instanceof Error ? err.message : `Could not click ${command}`);
      }
      return phaseOk(undefined);
    });
    await retryOn(ctx, tile, async () => {
      const added = await waitFor(() => {
        const fresh = findWaypointScope(tile.anchor, needles);
        const block = fresh === undefined ? undefined : waypointBlock(fresh);
        return (
          block !== undefined &&
          textCount(block, rowText) > 0 &&
          textCount(tile.anchor, rowText) > rowsBefore
        );
      }, 8000);
      return added
        ? phaseOk(undefined)
        : phaseFailed(`Could not find the new ${command} step at ${stop.query}`);
    });
    log.info(`Added ${summary} at ${stop.query}`);
    return;
  }

  // Count the whole route: an empty waypoint's block resolves to the full list, so a
  // per-block count would include the earlier waypoints' pencils.
  let editsBefore = 0;
  await retryOn(ctx, tile, async () => {
    const scope = findWaypointScope(tile.anchor, needles);
    if (scope === undefined) {
      return phaseFailed(`Could not find the waypoint for ${stop.query}`);
    }
    revealHover(scope);
    await waitFor(() => findLabeled(scope, command), 1500);
    editsBefore = stepEdits(tile.anchor).length;
    try {
      await clickControl(scope, command);
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : `Could not click ${command}`);
    }
    return phaseOk(undefined);
  });

  // Adding a step shows no action feedback overlay; the new step row is the signal.
  // Opening its editor is one phase: a retry finds the new row again and clicks its Edit.
  await retryOn(ctx, tile, async () => {
    await waitFor(() => findNewStepEdit(tile, needles, editsBefore) !== undefined, 8000);
    const edit = findNewStepEdit(tile, needles, editsBefore);
    if (edit === undefined) {
      return phaseFailed(`Could not find the Edit control for ${command} at ${stop.query}`);
    }
    try {
      await clickEdit(edit);
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : `Could not open ${command}`);
    }
    const editor = await waitForEditor(tile.anchor, step);
    return editor === undefined
      ? phaseFailed(`Could not find ${editorTitle(step)}`)
      : phaseOk(undefined);
  });

  const title = editorTitle(step);
  await retryOn(ctx, tile, async () => {
    const editor = findEditor(tile.anchor, title);
    if (editor === undefined) {
      return phaseFailed(`${title} closed before it was filled`);
    }
    try {
      await fillStepEditor(editor, step);
    } catch (err) {
      return phaseFailed(err instanceof Error ? err.message : `Could not fill ${title}`);
    }
    return phaseOk(undefined);
  });
  log.info(`Filled ${title} at ${stop.query}: ${summary}`);
  await waitAct(`Save ${title}?`);
  await saveEditor(ctx, tile, title);
}

// The Edit control of the step just added at a waypoint. Undefined until the route gains a step.
function findNewStepEdit(
  tile: PrunTile,
  needles: string[],
  editsBefore: number,
): HTMLElement | undefined {
  const fresh = findWaypointScope(tile.anchor, needles);
  const block = fresh === undefined ? undefined : waypointBlock(fresh);
  if (block !== undefined) {
    revealHover(block);
  }
  return block === undefined || stepEdits(tile.anchor).length <= editsBefore
    ? undefined
    : findStepEdit(block);
}

// Assigning the ship starts the route, so the player chooses now or later.
// Only the overlay's own buttons answer: it covers ACT, which may be mid-spam.
function confirmAssign(actTile: PrunTile, ship: string, routeId: string) {
  return new Promise<boolean>(resolve => {
    let assign = false;
    const close = showTileOverlay(
      actTile.anchor,
      ActionConfirmationOverlay,
      {
        message: `Assign ${ship} to ${routeId} now? Assigning starts the route. Cancel leaves the route built, so you can assign the ship later when you want it to start.`,
        confirmLabel: 'ASSIGN NOW',
        onConfirm: () => {
          assign = true;
          close?.();
        },
      },
      { onClosed: () => resolve(assign), dismissOnBackdrop: false },
    );
  });
}

async function assignShip(ctx: BuildCtx, tile: PrunTile, ship: string, routeId: string) {
  // The route itself is built by now. A failed assign stops on the RT view's Assignments
  // list so the player can assign another ship there, then ACT retries the assign.
  const result = await retryOn(ctx, tile, async () => {
    const attempt = await tryAssignShip({
      anchor: tile.anchor,
      frame: tile.frame,
      ship,
      routeId,
      waitAct: ctx.waitAct,
    });
    if (attempt.ok) {
      return phaseOk(attempt);
    }
    revealAssignments(tile.anchor);
    return {
      error: `${attempt.reason}. ${routeId} is built without ${ship}. Assign a ship in the Assignments list on the right`,
    };
  });
  ctx.log.success(
    result.already ? `${ship} is already assigned to ${routeId}` : `Assigned ${ship} to ${routeId}`,
  );
}

// SAVE leaves a success overlay on the route tile; clear it before the next click.
async function dismissSaveFeedback(tile: PrunTile): Promise<void> {
  const find = () => _$(tile.frame, C.ActionFeedback.success) as HTMLElement | undefined;
  await waitFor(() => find() !== undefined, 2000);
  const success = find();
  if (success !== undefined) {
    await clickElement(success);
  }
}

function textCount(root: Element, text: string): number {
  return (root.textContent ?? '').split(text).length - 1;
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
