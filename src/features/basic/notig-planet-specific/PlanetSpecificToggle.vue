<script setup lang="ts">
import { userData } from '@src/store/user-data';

const { alertType } = defineProps<{ alertType: PrunApi.AlertType }>();

const isActive = computed(() =>
  userData.settings.notifications.planetSpecificTypes.includes(alertType),
);

function onClick() {
  const types = userData.settings.notifications.planetSpecificTypes;
  const idx = types.indexOf(alertType);
  if (idx === -1) {
    types.push(alertType);
  } else {
    types.splice(idx, 1);
  }
}
</script>

<template>
  <span :class="[C.RadioItem.container, C.RadioItem.containerHorizontal]" @click="onClick">
    <div
      :class="[
        C.RadioItem.indicator,
        C.RadioItem.indicatorHorizontal,
        isActive ? [C.RadioItem.active, C.effects.shadowPrimary] : '',
      ]" />
    <div
      :class="[
        C.RadioItem.value,
        C.fonts.fontRegular,
        C.type.typeSmall,
        C.RadioItem.valueHorizontal,
      ]">
      planet
    </div>
  </span>
</template>
