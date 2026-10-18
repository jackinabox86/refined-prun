import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { UI_WINDOWS_REQUEST_FOCUS } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { alertsStore } from '@src/infrastructure/prun-api/data/alerts';
import {
  canOpenCompanion,
  openCompanionBuffer,
} from '@src/infrastructure/prun-ui/companion-buffer';
import { notificationClickCommand } from '@src/infrastructure/prun-ui/notification-click-commands';
import { closePrunWindow } from '@src/infrastructure/prun-ui/utils/close-prun-window';
import { onNodeTreeMutation } from '@src/utils/on-node-tree-mutation';
import { sleep } from '@src/utils/sleep';
import { clickElement } from '@src/util';
import css from '@src/utils/css-utils.module.css';
import {
  closeOrUnhide,
  companionTarget,
  isCompanionHost,
  isNotificationCompanionClick,
  isNotificationMarkReadClick,
  newlyOpenedWindows,
  openedWindowCommand,
  shouldRestorePriorWindow,
  snapshotWindows,
  topmostWindow,
  windowContainingClick,
} from './mark-read-click';

const SETTLE_MS = 400;
const COMMAND_WAIT_MS = 1000;
const COMMAND_POLL_MS = 50;

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AlertListItem.container), container => {
    container.addEventListener('mousedown', onNotificationMouseDown, true);
    container.addEventListener('click', event => onNotificationClick(event, tile, container), true);
  });
}

// Shift-mousedown extends the document text selection from wherever the caret
// last sat to the notification row, painting most of the page blue. Suppressing
// the mousedown default cancels only that selection: the click still reaches
// the game, so the alert is still marked read, and listeners such as
// focus-buffers-on-click still run. Ctrl-click does not extend the selection.
function onNotificationMouseDown(event: MouseEvent) {
  if (!isNotificationCompanionClick(event)) {
    return;
  }
  event.preventDefault();
}

function onNotificationClick(event: MouseEvent, tile: PrunTile, container: HTMLElement) {
  if (isNotificationCompanionClick(event)) {
    // A docked NOTS lets the game handle shift-click as a plain click.
    if (!isCompanionHost(tile.window)) {
      return;
    }
    const alert = alertsStore.getById(getPrunId(container));
    watchCompanionTarget(tile, notificationClickCommand(alert));
    return;
  }
  if (!isNotificationMarkReadClick(event)) {
    return;
  }

  const windows = document.getElementsByClassName(C.Window.window);
  const windowList = Array.from(windows);
  const before = snapshotWindows(windows);
  // Prefer the window that received the click. Mousedown focus from
  // focus-buffers-on-click can land before or after this capture handler
  // samples z-index.
  const prior = windowContainingClick(event.target, windowList) ?? topmostWindow(windowList);
  let settled = false;
  let stopWatching = () => {};

  const finish = (opened: Element[]) => {
    if (settled) {
      return;
    }
    settled = true;
    stopWatching();
    for (const windowEl of opened) {
      suppressOpenedWindow(windowEl);
    }
    const current = topmostWindow(Array.from(windows));
    if (shouldRestorePriorWindow(opened.length, prior, current) && prior) {
      restoreWindow(prior);
    }
  };

  stopWatching = onNodeTreeMutation(document, () => {
    if (settled) {
      return true;
    }
    const opened = newlyOpenedWindows(before, windows);
    if (opened.length === 0) {
      return false;
    }
    for (const windowEl of opened) {
      hideNotificationTarget(windowEl);
    }
    setTimeout(() => finish(opened), 0);
    return true;
  });

  setTimeout(() => finish(newlyOpenedWindows(before, windows)), SETTLE_MS);
}

function watchCompanionTarget(tile: PrunTile, clickCommand: string | undefined) {
  const windows = document.getElementsByClassName(C.Window.window);
  const before = snapshotWindows(windows);
  let settled = false;
  let stopWatching = () => {};

  const finish = (opened: Element[]) => {
    if (settled) {
      return;
    }
    settled = true;
    stopWatching();
    void adoptOpenedTarget(tile, opened, clickCommand);
  };

  stopWatching = onNodeTreeMutation(document, () => {
    if (settled) {
      return true;
    }
    const opened = newlyOpenedWindows(before, windows);
    if (opened.length === 0) {
      return false;
    }
    for (const windowEl of opened) {
      hideNotificationTarget(windowEl);
    }
    setTimeout(() => finish(opened), 0);
    return true;
  });

  setTimeout(() => finish(newlyOpenedWindows(before, windows)), SETTLE_MS);
}

async function adoptOpenedTarget(
  tile: PrunTile,
  opened: Element[],
  clickCommand: string | undefined,
) {
  // Without a click command, no new window means the game re-focused a buffer
  // that was already open. Leave that focus visible. Retargeting the companion
  // would hit buffer reuse and pull the existing window forward instead of
  // filling the split.
  const openedCommand =
    clickCommand === undefined && opened.length > 0
      ? await waitForOpenedCommand(opened)
      : undefined;
  const target = companionTarget(
    canOpenCompanion(tile),
    opened.length,
    openedCommand,
    clickCommand,
  );
  if (target.action === 'leave') {
    return;
  }
  if (target.action === 'unhide') {
    for (const windowEl of opened) {
      unhideNotificationTarget(windowEl);
    }
    return;
  }

  let closed = true;
  for (const windowEl of opened) {
    closeOrUnhide(
      () => closePrunWindow(windowEl),
      () => {
        closed = false;
        unhideNotificationTarget(windowEl);
      },
    );
  }
  if (!closed) {
    return;
  }

  if (opened.length > 0) {
    await waitUntilDetached(opened[0]);
  }
  await openCompanionBuffer(tile, target.command);
}

async function waitForOpenedCommand(opened: Element[]) {
  for (let elapsed = 0; elapsed < COMMAND_WAIT_MS; elapsed += COMMAND_POLL_MS) {
    for (const windowEl of opened) {
      const command = openedWindowCommand(_$(windowEl, C.TileFrame.cmd)?.textContent);
      if (command !== undefined) {
        return command;
      }
    }
    await sleep(COMMAND_POLL_MS);
  }
  return undefined;
}

async function waitUntilDetached(windowEl: Element) {
  for (let elapsed = 0; elapsed < SETTLE_MS; elapsed += COMMAND_POLL_MS) {
    if (!windowEl.isConnected) {
      return;
    }
    await sleep(COMMAND_POLL_MS);
  }
}

function notificationTargetChrome(windowEl: Element) {
  if (!(windowEl instanceof HTMLElement)) {
    return;
  }
  const tile = _$(windowEl, C.Tile.tile);
  const id = tile ? getPrunId(tile) : null;
  const dockLabel = id?.padStart(2, '0');
  const dockTab =
    dockLabel === undefined
      ? undefined
      : _$$(document, C.Dock.buffer).find(x => _$(x, C.Dock.title)?.textContent === dockLabel);
  return { windowEl, dockTab };
}

function hideNotificationTarget(windowEl: Element) {
  const chrome = notificationTargetChrome(windowEl);
  if (chrome === undefined) {
    return;
  }
  chrome.windowEl.classList.add(css.hidden);
  chrome.dockTab?.classList.add(css.hidden);
}

function unhideNotificationTarget(windowEl: Element) {
  const chrome = notificationTargetChrome(windowEl);
  if (chrome === undefined) {
    return;
  }
  chrome.windowEl.classList.remove(css.hidden);
  chrome.dockTab?.classList.remove(css.hidden);
}

function suppressOpenedWindow(windowEl: Element) {
  hideNotificationTarget(windowEl);
  closeOrUnhide(
    () => closePrunWindow(windowEl),
    () => unhideNotificationTarget(windowEl),
  );
}

function restoreWindow(windowEl: Element) {
  const tile = _$(windowEl, C.Tile.tile) as HTMLElement | undefined;
  const id = tile ? getPrunId(tile) : null;
  if (id && dispatchClientPrunMessage(UI_WINDOWS_REQUEST_FOCUS(id))) {
    return;
  }
  void clickElement(_$(windowEl, C.Window.header) as HTMLElement | null);
}

function init() {
  tiles.observe('NOTS', onTileReady);
}

features.add(
  import.meta.url,
  init,
  'NOTS: Shift-click opens a notification target in a companion buffer. Ctrl-click marks it read without opening that buffer.',
);
