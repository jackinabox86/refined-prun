import { $ } from '@src/utils/select-dom';
import { setBufferSize } from '@src/infrastructure/prun-ui/buffers';
import { matchBufferSize } from '@src/infrastructure/prun-ui/buffer-sizes';
import { clickElement, changeInputValue } from '@src/util';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import {
  UI_TILES_CHANGE_COMMAND,
  UI_TILES_CHANGE_SIZE,
} from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { clamp } from '@src/utils/clamp';

// Size of a companion whose command has no registered default buffer size.
const fallbackSize: [number, number] = [450, 300];
// Size assumed for a floating window without inline dimensions.
const fallbackWindowSize: [number, number] = [600, 400];

// A solo floating buffer can be split into a pair; a tile that is already one
// half of a split can only retarget its sibling. Note that tile.docked is true
// for both docked tiles and split children, so it can't be used here.
export function canOpenCompanion(tile: PrunTile) {
  return (
    tile.container.classList.contains(C.Window.body) ||
    tile.container.classList.contains(C.Node.child)
  );
}

export async function openCompanionBuffer(tile: PrunTile, command: string) {
  if (tile.container.classList.contains(C.Node.child)) {
    await setSiblingCommand(tile, command);
    return;
  }

  if (!tile.container.classList.contains(C.Window.body)) {
    return;
  }

  const [companionWidth, companionHeight] = commandSize(command);
  const [width, height] = windowSize(tile);
  setBufferSize(tile.id, width + companionWidth, Math.max(height, companionHeight));

  const children = await splitTile(tile);
  if (children === undefined) {
    return;
  }

  // Window width is the sum of both panes, so a 50/50 split would starve the
  // companion (or the original) of the width it was sized for.
  setDividerPosition(tile.id, width, companionWidth);
  await setChildCommand(children[1], command);
}

// Opens both commands side by side, in the given order. The tile's own command
// is replaced when it doesn't already match the pane it ends up in.
export async function openCompanionPair(tile: PrunTile, leftCommand: string, rightCommand: string) {
  if (tile.container.classList.contains(C.Node.child)) {
    // The panes are already laid out, so only fill in the missing half.
    const isLeft = tile.fullCommand.toUpperCase() === leftCommand.toUpperCase();
    await setSiblingCommand(tile, isLeft ? rightCommand : leftCommand);
    return;
  }

  if (!tile.container.classList.contains(C.Window.body)) {
    return;
  }

  const [leftWidth, leftHeight] = commandSize(leftCommand);
  const [rightWidth, rightHeight] = commandSize(rightCommand);
  setBufferSize(tile.id, leftWidth + rightWidth, Math.max(leftHeight, rightHeight));

  const children = await splitTile(tile);
  if (children === undefined) {
    return;
  }

  // Window width is the sum of both panes, so a 50/50 split would starve one
  // command of the width it was sized for.
  setDividerPosition(tile.id, leftWidth, rightWidth);
  await setChildCommand(children[0], leftCommand);
  await setChildCommand(children[1], rightCommand);
}

async function splitTile(tile: PrunTile) {
  const windowEl = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;
  const splitButton = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '|');
  await clickElement(splitButton);

  if (windowEl === null) {
    return undefined;
  }

  const node = await $(windowEl, C.Node.node);
  const children = _$$(node, C.Node.child);
  return children.length < 2 ? undefined : children;
}

async function setSiblingCommand(tile: PrunTile, command: string) {
  const node = tile.container.parentElement!;
  const sibling = _$$(node, C.Node.child).find(x => x !== tile.container);
  if (sibling === undefined) {
    return;
  }

  await setChildCommand(sibling, command);
}

async function setChildCommand(child: Element, command: string) {
  const currentCommand = _$(child, C.TileFrame.cmd)?.textContent?.trim();
  if (currentCommand?.toUpperCase() === command.toUpperCase()) {
    return;
  }

  const tileEl = _$(child, C.Tile.tile);
  const id = tileEl === undefined ? null : getPrunId(tileEl);
  if (id !== null && dispatchClientPrunMessage(UI_TILES_CHANGE_COMMAND(id, command))) {
    return;
  }
  const input = (await $(child, C.PanelSelector.input)) as HTMLInputElement;
  changeInputValue(input, command);
  input.form!.requestSubmit();
}

// Sets the split ratio so each pane gets the width it was sized for. No DOM
// fallback: if the dispatch fails the game keeps its default 50/50 split.
function setDividerPosition(tileId: string, leftWidth: number, rightWidth: number) {
  const total = leftWidth + rightWidth;
  if (total === 0 || Number.isNaN(total)) {
    return;
  }

  const fraction = clamp(leftWidth / total, 0.15, 0.85);
  dispatchClientPrunMessage(UI_TILES_CHANGE_SIZE(tileId, fraction));
}

function commandSize(command: string) {
  return matchBufferSize(command) ?? fallbackSize;
}

function windowSize(tile: PrunTile) {
  const width = parseInt(tile.container.style.width, 10);
  const height = parseInt(tile.container.style.height, 10);
  return [
    Number.isNaN(width) ? fallbackWindowSize[0] : width,
    Number.isNaN(height) ? fallbackWindowSize[1] : height,
  ];
}
