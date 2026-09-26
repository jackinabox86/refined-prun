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
  userData.settings.sfcShortcuts.push('');
}

function reset() {
  userData.settings.sfcShortcuts = structuredClone(initialUserData.settings.sfcShortcuts);
}
</script>

<template>
  <SectionHeader>
    SFC Shortcuts
    <Tooltip
      tooltip="Destinations for the shortcut buttons next to the SFC destination field.
         Enter an exchange station (ANT) or a planet (OT-580b or Montem).
         Leave a slot empty to hide its button." />
  </SectionHeader>
  <form>
    <Active v-for="i in slotCount" :key="i" :label="`Shortcut ${i}`">
      <TextInput v-model="userData.settings.sfcShortcuts[i - 1]" />
    </Active>
    <Commands>
      <PrunButton primary @click="reset">RESET</PrunButton>
    </Commands>
  </form>
</template>
