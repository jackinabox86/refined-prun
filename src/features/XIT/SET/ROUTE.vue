<script setup lang="ts">
import SectionHeader from '@src/components/SectionHeader.vue';
import Active from '@src/components/forms/Active.vue';
import NumberInput from '@src/components/forms/NumberInput.vue';
import { userData } from '@src/store/user-data';
</script>

<template>
  <SectionHeader>Route Supply</SectionHeader>
  <form>
    <Active
      label="Resupply"
      tooltip="Days of route laps the XIT ROUTEBURN RESTOCK button buys for at each exchange origin.">
      <NumberInput v-model="userData.settings.routeSupply.days" float />
    </Active>
    <Active
      label="Red"
      tooltip="Origin countdown in XIT ROUTEBURN turns red at or below this many days.">
      <NumberInput v-model="userData.settings.routeSupply.red" float />
    </Active>
    <Active
      label="Yellow"
      tooltip="Origin countdown in XIT ROUTEBURN turns yellow at or below this many days.">
      <NumberInput v-model="userData.settings.routeSupply.yellow" float />
    </Active>
  </form>
</template>
