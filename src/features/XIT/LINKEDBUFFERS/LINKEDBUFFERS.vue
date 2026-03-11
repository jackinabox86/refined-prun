<script setup lang="ts">
import TextInput from '@src/components/forms/TextInput.vue';
import Header from '@src/components/Header.vue';
import { useTile } from '@src/hooks/use-tile';
import { getPrunId } from '@src/infrastructure/prun-ui/attributes';
import { setBufferSize } from '@src/infrastructure/prun-ui/buffers';
import { UI_TILES_CHANGE_COMMAND } from '@src/infrastructure/prun-api/client-messages';
import { dispatchClientPrunMessage } from '@src/infrastructure/prun-api/prun-api-listener';
import { clickElement, changeInputValue } from '@src/util';
import { sleep } from '@src/utils/sleep';

const tile = useTile();
const inputText = ref('');
const activeCommand = ref<string | undefined>();
const isProcessing = ref(false);

// Check if we're already in a split window (has a companion tile).
const isSoloBuffer = tile.container.classList.contains(C.Window.body);
const goingToSplit = ref(false);

interface CommandEntry {
  label: string;
  template: string;
}

const commands: CommandEntry[] = [
  { label: 'MAT', template: 'MAT {input}' },
  { label: 'CXM', template: 'CXM AI1.{input}' },
  { label: 'CXOB', template: 'CXOB AI1.{input}' },
];

function resolveCommand(template: string) {
  return template.replace(/\{input\}/g, inputText.value.trim());
}

// Split immediately if this is a solo buffer (like ACT does).
if (isSoloBuffer) {
  goingToSplit.value = true;
  const width = parseInt(tile.container.style.width.replace('px', ''), 10);
  const height = parseInt(tile.container.style.height.replace('px', ''), 10);
  setBufferSize(tile.id, width + 500, height);
  const splitButton = _$$(tile.frame, C.TileControls.control).find(x => x.textContent === '|');
  void clickElement(splitButton);
}

function getCompanionTile(): HTMLElement | undefined {
  const isInNodeChild = tile.container.classList.contains(C.Node.child);
  const isInNode = tile.container.parentElement?.classList.contains(C.Node.node);
  const isInWindow = tile.container.parentElement?.parentElement?.classList.contains(C.Window.body);
  if (!isInNodeChild || !isInNode || !isInWindow) {
    return undefined;
  }

  const node = tile.container.parentElement!;
  const sibling = _$$(node, C.Node.child).find(x => x !== tile.container);
  if (!sibling) {
    return undefined;
  }
  return _$(sibling, C.Tile.tile) as HTMLElement | undefined;
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

async function onCommandClick(entry: CommandEntry) {
  if (!inputText.value.trim() || isProcessing.value) {
    return;
  }

  const resolved = resolveCommand(entry.template);
  activeCommand.value = entry.template;
  isProcessing.value = true;

  try {
    const companion = getCompanionTile();
    if (companion) {
      await changeTileCommand(companion, resolved);
    }
  } finally {
    isProcessing.value = false;
  }
}
</script>

<template>
  <div v-if="goingToSplit" />
  <div v-else :class="$style.root">
    <Header>LINKED BUFFERS</Header>
    <div :class="$style.inputSection">
      <label :class="$style.label">Input</label>
      <div :class="[C.forms.input, $style.inputWrapper]">
        <TextInput v-model="inputText" />
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Commands</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="cmd in commands"
          :key="cmd.template"
          :class="{ [$style.activeRow]: activeCommand === cmd.template }"
          @click="onCommandClick(cmd)">
          <td :class="$style.commandCell">
            <span :class="[C.Link.link, $style.commandLink]">
              {{ cmd.label }}: {{ resolveCommand(cmd.template) || cmd.template }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
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
}

.label {
  white-space: nowrap;
}

.inputWrapper {
  flex: 1;
}

.commandCell {
  cursor: pointer;
  padding: 2px 4px;
}

.commandLink {
  cursor: pointer;
}

.activeRow {
  background-color: rgba(75, 150, 200, 0.2);
}
</style>
