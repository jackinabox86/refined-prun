<script setup lang="ts">
const { props = {}, dismissOnBackdrop = true } = defineProps<{
  child: Component;
  onClose: () => void;
  props?: object | null;
  // Off for warnings the player must acknowledge: a backdrop click is
  // indistinguishable from spam-clicking the button the overlay covers.
  dismissOnBackdrop?: boolean;
}>();

function onBackdropClick() {
  if (dismissOnBackdrop) {
    onClose();
  }
}
</script>

<template>
  <div :class="C.Overlay.overlay">
    <div :class="C.Overlay.close" @click="onBackdropClick" />
    <div :class="C.Overlay.children">
      <Component :is="child" v-bind="props" @close="onClose" />
    </div>
    <div :class="C.Overlay.close" @click="onBackdropClick" />
  </div>
</template>
