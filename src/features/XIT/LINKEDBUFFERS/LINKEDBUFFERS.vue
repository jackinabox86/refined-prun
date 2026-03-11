<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import PresetList from './PresetList.vue';
import ControlPanel from './ControlPanel.vue';
import { useXitParameters } from '@src/hooks/use-xit-parameters';
import { useTile } from '@src/hooks/use-tile';
import { userData } from '@src/store/user-data';
import { createId } from '@src/store/create-id';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { setBufferSize } from '@src/infrastructure/prun-ui/buffers';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { clickElement, changeInputValue } from '@src/util';
import { sleep } from '@src/utils/sleep';
import { isEmpty } from 'ts-extras';

const tile = useTile();
const parameters = useXitParameters();

const preset = computed(() => {
  if (isEmpty(parameters)) {
    return undefined;
  }
  const byId = userData.linkedBuffersPresets.find(x => x.id.startsWith(parameters[0]));
  if (byId) {
    return byId;
  }
  const name = parameters.join(' ');
  return userData.linkedBuffersPresets.find(x => x.name === name);
});

const inputText = ref('');
const isProcessing = ref(false);
const childTiles = ref<HTMLElement[]>([]);
const gridReady = ref(false);
const panelMounted = ref(false);

// On first open (solo buffer), resize the window and convert the XIT tile
// into the first child tile by changing its command.
const isSoloBuffer = tile.container.classList.contains(C.Window.body);
const goingToSetup = ref(false);

if (isSoloBuffer && preset.value && preset.value.commands.length > 0) {
  goingToSetup.value = true;
  const saved = preset.value.lastBufferSize;
  if (saved) {
    setBufferSize(tile.id, saved[0], saved[1]);
  } else {
    const width = parseInt(tile.container.style.width.replace('px', ''), 10);
    const height = parseInt(tile.container.style.height.replace('px', ''), 10);
    setBufferSize(tile.id, Math.max(width, 900), Math.max(height, 500));
  }
}

onMounted(async () => {
  if (!preset.value || preset.value.commands.length === 0) {
    return;
  }

  if (goingToSetup.value) {
    // First mount: split this tile to create the child grid, then mount
    // the control panel as an overlay on the window.
    await setupChildGrid();
    return;
  }

  // If we're re-mounted after a split, just find child tiles.
  // This handles the case where the XIT tile persists after splits.
  await findAndTrackChildTiles();
});

onBeforeUnmount(() => {
  saveBufferSize();
});

async function setupChildGrid() {
  const commandCount = preset.value!.commands.length;

  if (commandCount === 1) {
    // Single command: just change this tile's command after mounting the panel.
    await mountOverlayPanel();
    gridReady.value = true;
    return;
  }

  // For multiple commands, split this tile to create the grid.
  // First split creates two tiles from the current one.
  await splitTileElement(tile.frame.parentElement as HTMLElement, '\u2013');

  // The XIT tile may have been destroyed by the split. Find all tiles in the window.
  const windowBody = getWindowBody();
  if (!windowBody) {
    return;
  }

  // Continue splitting to create the full grid.
  await buildGridInWindow(windowBody, commandCount);

  // Mount the overlay panel on the window.
  await mountOverlayPanel();

  // Find all child tiles.
  childTiles.value = _$$(windowBody, C.Tile.tile) as HTMLElement[];
  gridReady.value = true;
}

async function findAndTrackChildTiles() {
  const windowBody = getWindowBody();
  if (!windowBody) {
    gridReady.value = true;
    return;
  }

  childTiles.value = _$$(windowBody, C.Tile.tile) as HTMLElement[];
  gridReady.value = true;

  // Mount overlay if not already.
  if (!panelMounted.value) {
    await mountOverlayPanel();
  }
}

function getWindowBody(): HTMLElement | null {
  const win = tile.frame.closest(`.${C.Window.window}`);
  if (!win) {
    return null;
  }
  return _$(win as HTMLElement, C.Window.body) as HTMLElement | null;
}

function getWindowElement(): HTMLElement | null {
  return tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;
}

async function mountOverlayPanel() {
  const win = getWindowElement();
  if (!win || panelMounted.value) {
    return;
  }

  // Make the window a positioning context for the overlay.
  const body = _$(win, C.Window.body) as HTMLElement;
  if (!body) {
    return;
  }
  body.style.position = 'relative';

  createFragmentApp(
    ControlPanel,
    reactive({
      preset: preset.value!,
      inputText,
      onCommandClick: handleCommandClick,
    }),
  ).appendTo(body);

  panelMounted.value = true;
}

function saveBufferSize() {
  if (!preset.value) {
    return;
  }
  const win = getWindowElement();
  if (!win) {
    return;
  }
  const width = win.offsetWidth;
  const height = win.offsetHeight;
  if (width > 0 && height > 0) {
    preset.value.lastBufferSize = [width, height];
  }
}

async function splitTileElement(tileEl: HTMLElement, direction: '|' | '\u2013') {
  const button = _$$(tileEl, C.TileControls.control).find(x => x.textContent === direction);
  if (!button) {
    return;
  }
  await clickElement(button);
  await sleep(200);
}

async function buildGridInWindow(windowBody: HTMLElement, count: number) {
  if (count <= 1) {
    return;
  }

  const rows = Math.ceil(count / 2);

  // Create rows by splitting the last tile vertically.
  // Start from the current number of tiles (may already be 2 from the initial split).
  let currentTileCount = (_$$(windowBody, C.Tile.tile) as HTMLElement[]).length;
  while (currentTileCount < rows) {
    const tiles = _$$(windowBody, C.Tile.tile) as HTMLElement[];
    const lastTile = tiles[tiles.length - 1];
    await splitTileElement(lastTile, '\u2013');
    currentTileCount = (_$$(windowBody, C.Tile.tile) as HTMLElement[]).length;
  }

  if (count <= rows) {
    return;
  }

  // Split rows that need 2 columns, from the last row upward.
  const currentTiles = _$$(windowBody, C.Tile.tile) as HTMLElement[];
  let splitsNeeded = count - currentTiles.length;
  for (let i = currentTiles.length - 1; i >= 0 && splitsNeeded > 0; i--) {
    await splitTileElement(currentTiles[i], '|');
    splitsNeeded--;
  }
}

async function changeTileCommand(tileEl: HTMLElement, command: string) {
  const id = getPrunId(tileEl)!;
  let message = UI_TILES_CHANGE_COMMAND(id, null);
  if (!dispatchClientPrunMessage(message)) {
    const changeButton = _$$(tileEl, C.TileControls.control).find(x => x.textContent === ':');
    await clickElement(changeButton);
  } else {
    await sleep(0);
  }
  message = UI_TILES_CHANGE_COMMAND(id, command);
  if (!dispatchClientPrunMessage(message)) {
    const input = (await $(tileEl, C.PanelSelector.input)) as HTMLInputElement;
    changeInputValue(input, command);
    input.form!.requestSubmit();
  }
  await $(tileEl, C.TileFrame.frame);
}

async function handleCommandClick(cmd: UserData.LinkedBuffersCommand, index: number) {
  if (!inputText.value.trim() || isProcessing.value) {
    return;
  }

  const resolved = cmd.template.replace(/\{input\}/g, inputText.value.trim()).toUpperCase();
  isProcessing.value = true;

  try {
    // Re-find child tiles in case DOM changed.
    const windowBody = getWindowBody();
    if (windowBody) {
      childTiles.value = _$$(windowBody, C.Tile.tile) as HTMLElement[];
    }

    const child = childTiles.value[index];
    if (child?.isConnected) {
      await changeTileCommand(child, resolved);
    }
  } finally {
    isProcessing.value = false;
  }
}

function onCreateClick() {
  if (isEmpty(parameters)) {
    return;
  }
  const name = parameters.join(' ');
  userData.linkedBuffersPresets.push({
    id: createId(),
    name,
    commands: [],
  });
}
</script>

<template>
  <div v-if="goingToSetup" />
  <PresetList v-else-if="isEmpty(parameters)" />
  <div v-else-if="!preset" :class="$style.create">
    <span>Preset "{{ parameters.join(' ') }}" not found.</span>
    <PrunButton primary :class="$style.createButton" @click="onCreateClick">CREATE</PrunButton>
  </div>
  <div v-else :class="$style.root">
    <div v-if="!gridReady" :class="$style.status">Setting up...</div>
  </div>
</template>

<style module>
.root {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status {
  opacity: 0.7;
}

.create {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.createButton {
  margin-top: 5px;
}
</style>
