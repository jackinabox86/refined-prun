<script setup lang="ts">
import { userData } from '@src/store/user-data';
import SectionHeader from '@src/components/SectionHeader.vue';
import { releasedChangelog, markChangelogSeen } from './changelog-data';

// Snapshot before markChangelogSeen overwrites it, so this open can still tell which
// releases are new relative to the last time the user looked.
const previouslySeenIndex = releasedChangelog.findIndex(
  release => release.version === userData.lastSeenChangelogVersion,
);

function isNew(index: number) {
  return previouslySeenIndex !== -1 && index < previouslySeenIndex;
}

void markChangelogSeen();
</script>

<template>
  <div :class="$style.container">
    <div
      v-for="(release, index) in releasedChangelog"
      :key="release.version"
      :class="$style.release">
      <SectionHeader>
        {{ release.version }}
        <span v-if="isNew(index)" :class="$style.newTag">NEW</span>
      </SectionHeader>
      <div v-for="section in release.sections" :key="section.category" :class="$style.section">
        <div :class="$style.category">{{ section.category }}</div>
        <div v-for="item in section.items" :key="item" :class="$style.item">{{ item }}</div>
      </div>
    </div>
  </div>
</template>

<style module>
.container {
  padding: 4px;
}

.release {
  margin-bottom: 12px;
}

.newTag {
  margin-left: 6px;
  color: rgb(140, 210, 140);
  font-size: 10px;
}

.section {
  margin-top: 4px;
  margin-left: 4px;
}

.category {
  font-weight: bold;
  opacity: 0.8;
}

.item {
  margin-left: 8px;

  &::before {
    content: '- ';
  }
}
</style>
