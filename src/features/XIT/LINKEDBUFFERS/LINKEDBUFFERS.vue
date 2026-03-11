<script setup lang="ts">
import TextInput from '@src/components/forms/TextInput.vue';
import Header from '@src/components/Header.vue';
import ActionBar from '@src/components/ActionBar.vue';
import PrunButton from '@src/components/PrunButton.vue';
import PresetList from './PresetList.vue';
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
import { vDraggable } from 'vue-draggable-plus';
import { grip } from '@src/components/grip';
import GripCell from '@src/components/grip/GripCell.vue';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';

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
const edit = ref(false);
const childTiles = ref<HTMLElement[]>([]);
const gridReady = ref(false);

// Split immediately if this is a solo buffer.
const isSoloBuffer = tile.container.classList.contains(C.Window.body);
const goingToSplit = ref(false);

if (isSoloBuffer && preset.value && preset.value.commands.length > 0) {
  goingToSplit.value = true;
  const saved = preset.value.lastBufferSize;
  if (saved) {
    setBufferSize(tile.id, saved[0], saved[1]);
  } else {
    const width = parseInt(tile.container.style.width.replace('px', ''), 10);
    const height = parseInt(tile.container.style.height.replace('px', ''), 10);
    setBufferSize(tile.id, width + 500, height);
  }
  const splitButton = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '|');
  void clickElement(splitButton);
}

// After re-mount (post-split), build the grid.
onMounted(async () => {
  if (goingToSplit.value || !preset.value) {
    return;
  }

  const rightSibling = getRightSibling();
  if (!rightSibling) {
    gridReady.value = true;
    return;
  }

  const commandCount = preset.value.commands.length;
  if (commandCount > 1) {
    await buildGrid(rightSibling, commandCount);
  }

  childTiles.value = _$$(rightSibling, C.Tile.tile) as HTMLElement[];
  gridReady.value = true;

  // Save the current window size so next open remembers it.
  saveBufferSize();
});

function getRightSibling(): HTMLElement | undefined {
  const isInNodeChild = tile.container.classList.contains(C.Node.child);
  const isInNode = tile.container.parentElement?.classList.contains(C.Node.node);
  const isInWindow = tile.container.parentElement?.parentElement?.classList.contains(C.Window.body);
  if (!isInNodeChild || !isInNode || !isInWindow) {
    return undefined;
  }

  const node = tile.container.parentElement!;
  return _$$(node, C.Node.child).find(x => x !== tile.container) as HTMLElement | undefined;
}

async function splitTileElement(tileEl: HTMLElement, direction: '|' | '\u2013') {
  const button = _$$(tileEl, C.TileControls.control).find(x => x.textContent === direction);
  if (!button) {
    return;
  }
  await clickElement(button);
  await sleep(200);
}

async function buildGrid(container: HTMLElement, count: number) {
  // For count tiles, create a grid layout:
  // 1: no splits needed
  // 2: vertical split (top/bottom)
  // 3: vertical split, then split bottom horizontally
  // 4: vertical split, then split both horizontally (2x2)
  // 5: vertical split, split top horizontally, split bottom vertically, split bottom-bottom horizontally
  // 6: vertical split, split both horizontally, split bottom-right vertically... etc.

  if (count <= 1) {
    return;
  }

  const rows = Math.ceil(count / 2);

  // Create rows by splitting the last tile vertically.
  for (let i = 1; i < rows; i++) {
    const tiles = _$$(container, C.Tile.tile) as HTMLElement[];
    const lastTile = tiles[tiles.length - 1];
    // En-dash for vertical split.
    await splitTileElement(lastTile, '\u2013');
  }

  // Now split rows into columns where needed.
  // For count=2 with rows=1: split the single row into 2 columns.
  // For count=3 with rows=2: top stays single, bottom splits into 2.
  // For count=4 with rows=2: both rows split into 2.
  // General: rows that need 2 columns = count - rows.

  if (count <= rows) {
    // Single column, no horizontal splits needed.
    return;
  }

  // Split rows that need 2 columns. Split from the last row upward.
  const currentTiles = _$$(container, C.Tile.tile) as HTMLElement[];
  let splitsNeeded = count - rows;
  for (let i = currentTiles.length - 1; i >= 0 && splitsNeeded > 0; i--) {
    await splitTileElement(currentTiles[i], '|');
    splitsNeeded--;
  }
}

function saveBufferSize() {
  if (!preset.value) {
    return;
  }
  const window = tile.frame.closest(`.${C.Window.window}`) as HTMLElement | null;
  if (!window) {
    return;
  }
  const width = window.offsetWidth;
  const height = window.offsetHeight;
  if (width > 0 && height > 0) {
    preset.value.lastBufferSize = [width, height];
  }
}

function resolveCommand(template: string) {
  return template.replace(/\{input\}/g, inputText.value.trim()).toUpperCase();
}

async function changeTileCommand(tileEl: HTMLElement, command: string) {
  const id = getPrunId(tileEl)!;
  // Clear current command.
  let message = UI_TILES_CHANGE_COMMAND(id, null);
  if (!dispatchClientPrunMessage(message)) {
    const changeButton = _$$(tileEl, C.TileControls.control).find(x => x.textContent === ':');
    await clickElement(changeButton);
  } else {
    await sleep(0);
  }
  // Set new command.
  message = UI_TILES_CHANGE_COMMAND(id, command);
  if (!dispatchClientPrunMessage(message)) {
    const input = (await $(tileEl, C.PanelSelector.input)) as HTMLInputElement;
    changeInputValue(input, command);
    input.form!.requestSubmit();
  }
  await $(tileEl, C.TileFrame.frame);
}

async function onCommandClick(cmd: UserData.LinkedBuffersCommand, index: number) {
  if (!inputText.value.trim() || isProcessing.value || edit.value) {
    return;
  }

  const resolved = resolveCommand(cmd.template);
  isProcessing.value = true;

  try {
    const child = childTiles.value[index];
    if (child?.isConnected) {
      await changeTileCommand(child, resolved);
    }
  } finally {
    isProcessing.value = false;
  }
}

function addCommand() {
  if (!preset.value) {
    return;
  }
  preset.value.commands.push({
    id: createId(),
    label: 'CMD',
    template: 'CMD {input}',
  });
}

function deleteCommand(cmd: UserData.LinkedBuffersCommand) {
  if (!preset.value) {
    return;
  }
  preset.value.commands = preset.value.commands.filter(x => x !== cmd);
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
  <div v-if="goingToSplit" />
  <PresetList v-else-if="isEmpty(parameters)" />
  <div v-else-if="!preset" :class="$style.create">
    <span>Preset "{{ parameters.join(' ') }}" not found.</span>
    <PrunButton primary :class="$style.createButton" @click="onCreateClick">CREATE</PrunButton>
  </div>
  <div v-else :class="$style.root">
    <Header>{{ preset.name }}</Header>
    <div :class="$style.inputSection">
      <label :class="$style.label">Input</label>
      <div :class="[C.forms.input, $style.inputWrapper]">
        <TextInput v-model="inputText" />
      </div>
    </div>
    <div v-if="!gridReady" :class="$style.status">Setting up grid...</div>
    <template v-if="!edit">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Commands</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="preset.commands.length === 0">
            <td colspan="2">No commands. Click EDIT to add some.</td>
          </tr>
          <template v-else>
            <tr
              v-for="(cmd, index) in preset.commands"
              :key="cmd.id"
              @click="onCommandClick(cmd, index)">
              <td :class="$style.indexCell">{{ index + 1 }}</td>
              <td :class="$style.commandCell">
                <span :class="[C.Link.link, $style.commandLink]">
                  {{ resolveCommand(cmd.template) || cmd.template }}
                </span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <ActionBar>
        <PrunButton primary @click="edit = true">EDIT</PrunButton>
      </ActionBar>
    </template>
    <template v-else>
      <table>
        <thead>
          <tr>
            <GripHeaderCell />
            <th>Label</th>
            <th>Template</th>
            <th />
          </tr>
        </thead>
        <template v-if="preset.commands.length === 0">
          <tbody>
            <tr>
              <td>No commands.</td>
            </tr>
          </tbody>
        </template>
        <template v-else>
          <tbody v-draggable="[preset.commands, grip.draggable]">
            <tr v-for="cmd in preset.commands" :key="cmd.id">
              <GripCell />
              <td>
                <div :class="[C.forms.input, $style.inline]">
                  <TextInput v-model="cmd.label" />
                </div>
              </td>
              <td>
                <div :class="C.forms.input">
                  <TextInput v-model="cmd.template" />
                </div>
              </td>
              <td>
                <PrunButton danger @click="deleteCommand(cmd)">DELETE</PrunButton>
              </td>
            </tr>
          </tbody>
        </template>
      </table>
      <ActionBar>
        <PrunButton primary @click="addCommand">ADD COMMAND</PrunButton>
        <PrunButton primary @click="edit = false">DONE</PrunButton>
      </ActionBar>
      <div :class="$style.hint"> Close and reopen buffer to apply layout changes. </div>
    </template>
  </div>
</template>

<style module>
.root {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 4px;
}

.inputSection {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
  justify-content: flex-start;
}

.label {
  white-space: nowrap;
}

.inputWrapper {
  width: 100px;
  text-transform: uppercase;
}

.indexCell {
  width: 24px;
  text-align: center;
  opacity: 0.5;
}

.commandCell {
  cursor: pointer;
  padding: 2px 4px;
}

.commandLink {
  cursor: pointer;
}

.status {
  padding: 4px;
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

.inline {
  display: inline-block;
}

.hint {
  padding: 4px;
  opacity: 0.5;
  font-size: 0.9em;
}
</style>
