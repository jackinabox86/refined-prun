<script setup lang="ts">
import PrunButton from '@src/components/PrunButton.vue';
import SectionHeader from '@src/components/SectionHeader.vue';
import Active from '@src/components/forms/Active.vue';
import Commands from '@src/components/forms/Commands.vue';
import TextInput from '@src/components/forms/TextInput.vue';
import Tooltip from '@src/components/Tooltip.vue';
import { initialUserData, userData } from '@src/store/user-data';

const slotCount = 4;

// Older data or a manual edit can leave fewer slots; pad so every input binds.
while (userData.settings.sfcShortcuts.length < slotCount) {
  userData.settings.sfcShortcuts.push({ label: '', destination: '' });
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
         The first value is the button label, the second is the destination:
         an exchange station (ANT) or a planet (OT-580b or Montem).
         Leave the destination empty to hide the button." />
  </SectionHeader>
  <form>
    <Active
      v-for="(shortcut, i) in userData.settings.sfcShortcuts.slice(0, slotCount)"
      :key="i"
      :label="`Shortcut ${i + 1}`">
      <div :class="$style.inputPair">
        <TextInput v-model="shortcut.label" :class="[$style.input, $style.label]" />
        <TextInput v-model="shortcut.destination" :class="$style.input" />
      </div>
    </Active>
    <Commands>
      <PrunButton primary @click="reset">RESET</PrunButton>
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

.label input {
  text-transform: uppercase;
}
</style>
