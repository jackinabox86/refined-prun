<script setup lang="ts">
import ActionBar from '@src/components/ActionBar.vue';
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import Tooltip from '@src/components/Tooltip.vue';
import { initialUserData, userData } from '@src/store/user-data';

const maxShortcuts = 4;

const shortcuts = computed(() => userData.settings.sfcShortcuts);
const canAdd = computed(() => shortcuts.value.length < maxShortcuts);
const canRemove = computed(() => shortcuts.value.length > 0);

function add() {
  shortcuts.value.push({ label: '', destination: '' });
}

function remove() {
  shortcuts.value.pop();
}

function reset() {
  userData.settings.sfcShortcuts = structuredClone(initialUserData.settings.sfcShortcuts);
}
</script>

<template>
  <SectionHeader>
    SFC Shortcuts
    <Tooltip
      position="bottom"
      :class="$style.tooltip"
      tooltip="Shortcut buttons next to the SFC destination field.
         Label is the button text; Destination is
         an exchange station (ANT) or a planet (OT-580b or Montem).
         Add up to four shortcuts; REMOVE deletes the last one." />
  </SectionHeader>
  <ActionBar>
    <PrunButton primary :disabled="!canAdd" @click="add">ADD NEW</PrunButton>
    <PrunButton primary :disabled="!canRemove" @click="remove">REMOVE</PrunButton>
    <PrunButton primary @click="reset">RESET</PrunButton>
  </ActionBar>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Label</th>
        <th>Destination</th>
      </tr>
    </thead>
    <tbody v-if="shortcuts.length === 0">
      <tr>
        <td colspan="3">No shortcuts.</td>
      </tr>
    </tbody>
    <tbody v-else>
      <tr v-for="(shortcut, i) in shortcuts" :key="i">
        <td>{{ i + 1 }}</td>
        <td :class="[$style.inputCell, $style.labelCell]">
          <div :class="[C.forms.input, $style.inline]">
            <TextInput v-model="shortcut.label" />
          </div>
        </td>
        <td :class="$style.inputCell">
          <div :class="[C.forms.input, $style.inline]">
            <TextInput v-model="shortcut.destination" />
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style module>
.inline {
  display: inline-block;
}

.inputCell * {
  width: 100%;
}

.labelCell input {
  text-transform: uppercase;
}

.tooltip {
  float: revert;
  font-size: 12px;
  margin-top: -4px;
}
</style>
