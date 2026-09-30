<script setup lang="ts">
import Active from '@src/components/forms/Active.vue';
import TextInput from '@src/components/forms/TextInput.vue';

const { action } = defineProps<{
  action: UserData.ActionData;
  pkg: UserData.ActionPackageData;
}>();

const routeId = ref(action.routeId ?? '');
const routeSpec = ref(action.routeSpec ?? '');
const error = ref(false);

function validate() {
  error.value = routeSpec.value.trim().length === 0;
  return !error.value;
}

function save() {
  action.routeId = routeId.value.trim();
  action.routeSpec = routeSpec.value;
}

defineExpose({ validate, save });
</script>

<template>
  <Active label="Route id">
    <TextInput v-model="routeId" />
  </Active>
  <Active label="Stops" :error="error">
    <textarea v-model="routeSpec" :class="$style.spec" />
  </Active>
</template>

<style module>
.spec {
  width: 100%;
  min-height: 120px;
  box-sizing: border-box;
}
</style>
