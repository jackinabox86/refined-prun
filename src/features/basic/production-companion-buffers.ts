import { canOpenCompanion, openCompanionPair } from '@src/infrastructure/prun-ui/companion-buffer';
import { onNodeTreeMutation } from '@src/utils/on-node-tree-mutation';
import { sleep } from '@src/utils/sleep';

type LineCommand = 'PRODCO' | 'PRODQ';

// Label of the in-tile button that opens each command.
const commandLabels: Record<LineCommand, string> = {
  PRODCO: 'new order',
  PRODQ: 'details',
};

// How long to wait for the game to open the buffer of a clicked PROD button.
const newWindowTimeout = 2000;
// How long to wait for the opened window to report its command.
const tileTimeout = 1000;
const tilePollInterval = 50;

function onProductionTileReady(tile: PrunTile) {
  tile.frame.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (!e.shiftKey) {
        return;
      }
      // The production line id can't be read from the panel, so the game is
      // left to open its own buffer and the id is taken from the tile it
      // creates. A click that opens anything else is ignored.
      void pairUpOpenedWindow();
    },
    true,
  );
}

async function pairUpOpenedWindow() {
  const windowEl = await waitNewWindow();
  if (windowEl === undefined) {
    return;
  }

  const tile = await waitWindowTile(windowEl);
  if (tile === undefined || tile.parameter === undefined) {
    return;
  }
  if (tile.command !== 'PRODCO' && tile.command !== 'PRODQ') {
    return;
  }

  await openCompanionPair(tile, ...pairCommands(tile.parameter));
}

function onProductionLineTileReady(tile: PrunTile) {
  const partner: LineCommand = tile.command === 'PRODQ' ? 'PRODCO' : 'PRODQ';
  tile.frame.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (!e.shiftKey || !canOpenCompanion(tile)) {
        return;
      }
      if (!isPartnerTrigger(e.target as HTMLElement, partner)) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      void openCompanionPair(tile, ...pairCommands(tile.parameter!));
    },
    true,
  );
}

function isPartnerTrigger(target: HTMLElement, partner: LineCommand) {
  // Context bar items spell out their command, so they match regardless of
  // how the in-tile buttons are labeled.
  const contextItem = target.closest(`.${C.ContextControls.item}`);
  if (contextItem !== null) {
    const command = _$(contextItem, C.ContextControls.cmd)?.textContent?.trim().toUpperCase();
    return command?.startsWith(partner) === true;
  }

  const button = target.closest(`.${C.Button.btn}`);
  return button !== null && button.textContent?.trim().toLowerCase() === commandLabels[partner];
}

function pairCommands(lineId: string) {
  return [`PRODCO ${lineId}`, `PRODQ ${lineId}`] as const;
}

async function waitNewWindow() {
  const windows = document.getElementsByClassName(C.Window.window);
  const seen = new Set(Array.from(windows));
  let expired = false;
  const newWindow = new Promise<HTMLElement | undefined>(resolve => {
    onNodeTreeMutation(document, () => {
      if (expired) {
        return true;
      }
      for (let i = 0; i < windows.length; i++) {
        if (!seen.has(windows[i])) {
          resolve(windows[i] as HTMLElement);
          return true;
        }
      }
      return false;
    });
  });
  const timeout = async () => {
    await sleep(newWindowTimeout);
    expired = true;
    return undefined;
  };
  return await Promise.race([newWindow, timeout()]);
}

async function waitWindowTile(windowEl: HTMLElement) {
  for (let elapsed = 0; elapsed < tileTimeout; elapsed += tilePollInterval) {
    const body = _$(windowEl, C.Window.body) as HTMLElement | undefined;
    const tile = tiles.findByContainer(body)[0];
    if (tile !== undefined && tile.parameter !== undefined) {
      return tile;
    }
    await sleep(tilePollInterval);
  }
  return undefined;
}

function init() {
  tiles.observe('PROD', onProductionTileReady);
  tiles.observe(['PRODQ', 'PRODCO'], onProductionLineTileReady);
}

features.add(
  import.meta.url,
  init,
  'Shift-click a production line button to open PRODCO and PRODQ as a companion pair.',
);
