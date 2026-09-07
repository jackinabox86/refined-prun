import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { UI_WINDOWS_REQUEST_FOCUS } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { closePrunWindow } from '@src/infrastructure/prun-ui/utils/close-prun-window';
import { onNodeTreeMutation } from '@src/utils/on-node-tree-mutation';
import { clickElement } from '@src/util';
import css from '@src/utils/css-utils.module.css';
import {
  closeOrUnhide,
  isNotificationMarkReadClick,
  newlyOpenedWindows,
  shouldRestorePriorWindow,
  snapshotWindows,
  topmostWindow,
  windowContainingClick,
} from './mark-read-click';

const SETTLE_MS = 400;

function onTileReady(tile: PrunTile) {
  subscribe($$(tile.anchor, C.AlertListItem.container), container => {
    container.addEventListener('click', onNotificationClick, true);
  });
}

function onNotificationClick(event: MouseEvent) {
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
  'NOTS: Shift-click marks a notification read without opening its target buffer.',
);
