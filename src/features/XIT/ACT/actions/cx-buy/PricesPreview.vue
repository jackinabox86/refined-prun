<script setup lang="ts">
import SectionHeader from '@src/components/SectionHeader.vue';
import { LogPart } from '@src/features/XIT/ACT/runner/logger';

defineProps<{
  title: string;
  total: LogPart[];
  // Ranked most over the refined-PrUn price first, so the tickers the player has to
  // decide about are the ones already on screen.
  lines: LogPart[][];
}>();

const $style = useCssModule();

function partClass(part: LogPart) {
  return part.red ? $style.red : part.yellow ? $style.yellow : undefined;
}
</script>

<template>
  <div :class="[$style.root, C.fonts.fontRegular]">
    <SectionHeader>{{ title }}</SectionHeader>
    <!-- Outside the scrolling list: the total stays readable however far the player
         pages down. -->
    <div :class="$style.total">
      <span v-for="(part, i) in total" :key="i" :class="partClass(part)">{{ part.text }}</span>
    </div>
    <div :class="$style.list">
      <div v-for="(line, index) in lines" :key="index">
        <span v-for="(part, i) in line" :key="i" :class="partClass(part)">{{ part.text }}</span>
      </div>
    </div>
  </div>
</template>

<style module>
.root {
  display: flex;
  flex-direction: column;
  /* Shrink to the pane when the overlay bounds it; the list cap below covers the
     case where it does not. */
  max-height: 100%;
  padding: 4px;
  font-size: 11px;
  line-height: 1.5;
  color: #bbbbbb;
}

.total {
  margin: 4px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid #2b485a;
}

.list {
  flex: 1 1 auto;
  /* Without this a flex child refuses to shrink below its content height and the
     list takes the whole pane instead of scrolling. */
  min-height: 0;
  /* Cap so the list scrolls even when the overlay hands us an unbounded height. */
  max-height: 420px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.yellow {
  color: #f7a600;
}

.red {
  color: #d9534f;
}
</style>
