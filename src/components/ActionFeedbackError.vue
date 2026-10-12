<script setup lang="ts">
const { message, onClose } = defineProps<{
  message: string;
  onClose: () => void;
}>();
</script>

<template>
  <div :class="[C.ActionFeedback.error, C.ActionFeedback.overlay]" @click="onClose">
    <span :class="[C.ActionFeedback.message, C.fonts.fontRegular, C.type.typeLarger]">
      <span>{{ message }}</span>
      <span :class="[C.ActionFeedback.dismiss, C.type.typeSmall]">
        {{ L.ActionFeedback.dismiss() }}
      </span>
    </span>
  </div>
</template>
