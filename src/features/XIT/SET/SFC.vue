<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import Active from '@src/components/forms/Active.vue';
import Commands from '@src/components/forms/Commands.vue';
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
      tooltip="Shortcut buttons next to the SFC destination field.
         Label is the button text; Destination is
         an exchange station (ANT) or a planet (OT-580b or Montem).
         Add up to four shortcuts; REMOVE deletes the last one." />
  </SectionHeader>
  <form>
    <Active v-if="shortcuts.length > 0">
      <div :class="$style.inputPair">
        <div :class="[$style.input, $style.header]">Label</div>
        <div :class="[$style.input, $style.header]">Destination</div>
      </div>
    </Active>
    <Active v-for="(shortcut, i) in shortcuts" :key="i" :label="`Shortcut ${i + 1}`">
      <div :class="$style.inputPair">
        <TextInput v-model="shortcut.label" :class="[$style.input, $style.label]" />
        <TextInput v-model="shortcut.destination" :class="$style.input" />
      </div>
    </Active>
    <Commands>
      <PrunButton primary @click="reset">RESET</PrunButton>
      <PrunButton primary :disabled="!canRemove" @click="remove">REMOVE</PrunButton>
      <PrunButton primary :disabled="!canAdd" @click="add">ADD NEW</PrunButton>
    </Commands>
  </form>
</template>

<style module>
.inputPair {
  display: flex;
  justify-content: flex-end;
  column-gap: 10px;
}

.input {
  width: 40%;
}

.input input {
  width: 100%;
}

.header {
  font-weight: bold;
}

.label input {
  text-transform: uppercase;
}
</style>
