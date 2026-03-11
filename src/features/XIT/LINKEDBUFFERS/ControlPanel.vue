<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import ActionBar from '@src/components/ActionBar.vue';
import { vDraggable } from 'vue-draggable-plus';
import { grip } from '@src/components/grip';
import GripCell from '@src/components/grip/GripCell.vue';
import GripHeaderCell from '@src/components/grip/GripHeaderCell.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import { createId } from '@src/store/create-id';

const { preset, onCommandClick } = defineProps<{
  preset: UserData.LinkedBuffersPreset;
  onCommandClick: (cmd: UserData.LinkedBuffersCommand, index: number) => void;
}>();

const inputText = defineModel<string>('inputText', { required: true });
const edit = ref(false);
const collapsed = ref(false);

function resolveCommand(template: string) {
  return template.replace(/\{input\}/g, inputText.value.trim()).toUpperCase();
}

function addCommand() {
  preset.commands.push({
    id: createId(),
    label: 'CMD',
    template: 'CMD {input}',
  });
}

function deleteCommand(cmd: UserData.LinkedBuffersCommand) {
  preset.commands = preset.commands.filter(x => x !== cmd);
}
</script>

<template>
  <div :class="$style.panel">
    <div :class="$style.collapseBar" @click="collapsed = !collapsed">
      {{ collapsed ? '\u25b6' : '\u25c0' }}
    </div>
    <div v-if="!collapsed" :class="$style.content">
      <div :class="$style.inputSection">
        <input
          v-model="inputText"
          type="text"
          :class="$style.input"
          placeholder="..."
          autocomplete="off"
          data-1p-ignore="true"
          data-lpignore="true" />
      </div>
      <template v-if="!edit">
        <div :class="$style.commands">
          <div
            v-for="(cmd, index) in preset.commands"
            :key="cmd.id"
            :class="$style.commandRow"
            @click="onCommandClick(cmd, index)">
            <span :class="[C.Link.link, $style.commandLink]">
              {{ resolveCommand(cmd.template) || cmd.template }}
            </span>
          </div>
        </div>
        <div :class="$style.editBar">
          <PrunButton primary @click="edit = true">EDIT</PrunButton>
        </div>
      </template>
      <template v-else>
        <div :class="$style.editList">
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
                    <PrunButton danger @click="deleteCommand(cmd)">DEL</PrunButton>
                  </td>
                </tr>
              </tbody>
            </template>
          </table>
        </div>
        <ActionBar>
          <PrunButton primary @click="addCommand">ADD</PrunButton>
          <PrunButton primary @click="edit = false">DONE</PrunButton>
        </ActionBar>
        <div :class="$style.hint">Reopen buffer to apply layout changes.</div>
      </template>
    </div>
  </div>
</template>

<style module>
.panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  display: flex;
  z-index: 10;
  pointer-events: auto;
}

.collapseBar {
  width: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 31, 34, 0.9);
  border-right: 1px solid #2b485a;
  cursor: pointer;
  font-size: 8px;
  color: #6b8fa3;
  user-select: none;

  &:hover {
    background: rgba(43, 72, 90, 0.6);
  }
}

.content {
  width: 140px;
  background: rgba(26, 31, 34, 0.95);
  border-right: 1px solid #2b485a;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 4px;
}

.inputSection {
  margin-bottom: 4px;
}

.input {
  width: 100%;
  box-sizing: border-box;
  text-transform: uppercase;
  text-align: left;
  background: #1a1f22;
  border: 1px solid #2b485a;
  color: #bfbfbf;
  padding: 3px 4px;
  font-family: inherit;
  font-size: 12px;
}

.commands {
  flex: 1;
}

.commandRow {
  padding: 2px 2px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 11px;

  &:hover {
    background: rgba(75, 150, 200, 0.15);
  }
}

.commandLink {
  cursor: pointer;
}

.editBar {
  margin-top: 4px;
}

.editList {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none;
  font-size: 11px;
}

.inline {
  display: inline-block;
}

.hint {
  padding: 2px;
  opacity: 0.5;
  font-size: 10px;
}
</style>
