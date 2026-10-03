<script setup lang="ts">
import { previewedRtRoute } from '@src/features/XIT/RTACT/staged';
</script>

<template>
  <div v-if="!previewedRtRoute" :class="$style.note">
    Nothing to preview. Press PREVIEW in XIT ROUTECONFIG.
  </div>
  <div v-else :class="$style.preview">
    <div :class="$style.title">{{ previewedRtRoute.name }}</div>
    <div v-for="(line, index) in previewedRtRoute.lines" :key="index" :class="$style.line">
      {{ line }}
    </div>
  </div>
</template>

<style module>
.preview {
  padding: 5px;
  font-size: 11px;
  user-select: text;
}

.title {
  font-weight: bold;
  margin-bottom: 4px;
}

.line {
  white-space: pre-wrap;
  line-height: 16px;
}

.note {
  padding: 5px;
}
</style>
