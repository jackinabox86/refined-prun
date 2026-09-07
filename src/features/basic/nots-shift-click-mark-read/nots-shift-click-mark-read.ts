import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { UI_WINDOWS_REQUEST_FOCUS } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { closePrunWindow } from '@src/infrastructure/prun-ui/utils/close-prun-window';
import { onNodeTreeMutation } from '@src/utils/on-node-tree-mutation';
import { clickElement } from '@src/util';
import css from '@src/utils/css-utils.module.css';
import {
  isNotificationMarkReadClick,
  newlyOpenedWindows,
  shouldRestorePriorWindow,
  snapshotWindows,
  topmostWindow,
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
  const before = snapshotWindows(windows);
  const prior = topmostWindow(Array.from(windows));
  let settled = false;

  const restorePriorIfNeeded = () => {
    if (settled) {
      return;
    }
    if (newlyOpenedWindows(before, windows).length > 0) {
      return;
    }
    const current = topmostWindow(Array.from(windows));
    if (shouldRestorePriorWindow(0, prior, current) && prior) {
      restoreWindow(prior);
    }
  };

  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    const after = Array.from(windows);
    const opened = newlyOpenedWindows(before, after);
    for (const windowEl of opened) {
      hideNotificationTarget(windowEl);
      closePrunWindow(windowEl);
    }
    const current = topmostWindow(after);
    if (shouldRestorePriorWindow(opened.length, prior, current) && prior) {
      restoreWindow(prior);
    }
  };

  onNodeTreeMutation(document, () => {
    if (settled) {
      return true;
    }
    const opened = newlyOpenedWindows(before, windows);
    for (const windowEl of opened) {
      hideNotificationTarget(windowEl);
    }
    if (opened.length > 0) {
      setTimeout(finish, 0);
      return true;
    }
    restorePriorIfNeeded();
    return false;
  });

  setTimeout(restorePriorIfNeeded, 0);
  setTimeout(finish, SETTLE_MS);
}

function hideNotificationTarget(windowEl: Element) {
  if (!(windowEl instanceof HTMLElement)) {
    return;
  }
  windowEl.classList.add(css.hidden);
  const tile = _$(windowEl, C.Tile.tile) as HTMLElement | undefined;
  const id = tile ? getPrunId(tile) : null;
  const dockLabel = id?.padStart(2, '0');
  if (!dockLabel) {
    return;
  }
  const dockTab = _$$(document, C.Dock.buffer).find(
    x => _$(x, C.Dock.title)?.textContent === dockLabel,
  );
  dockTab?.classList.add(css.hidden);
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
