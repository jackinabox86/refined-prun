<script setup lang="ts">
import { sitesStore } from '@src/infrastructure/prun-api/data/sites';
import {
  getEntityNameFromAddress,
  getEntityNaturalIdFromAddress,
} from '@src/infrastructure/prun-api/data/addresses';
import { comparePlanets } from '@src/util';

// Planet natural id of the selected base.
const model = defineModel<string>();

const bases = computed(() =>
  (sitesStore.all.value ?? [])
    .map(x => ({
      naturalId: getEntityNaturalIdFromAddress(x.address) ?? '',
      name: getEntityNameFromAddress(x.address) ?? '',
    }))
    .filter(x => x.naturalId !== '')
    .sort((a, b) => comparePlanets(a.naturalId, b.naturalId)),
);

const label = (base: { naturalId: string; name: string }) =>
  base.name && base.name !== base.naturalId ? `${base.name} (${base.naturalId})` : base.naturalId;

const selected = computed(() => bases.value.find(x => x.naturalId === model.value));

const input = useTemplateRef<HTMLInputElement>('input');
const text = ref('');
const open = ref(false);
const highlight = ref(0);

watch(
  selected,
  base => {
    if (!open.value) {
      text.value = base ? label(base) : '';
    }
  },
  { immediate: true },
);

// Typing filters by name or natural id. An unedited field lists every base.
const filtered = computed(() => {
  const query = text.value.trim().toLowerCase();
  if (!query || (selected.value && text.value === label(selected.value))) {
    return bases.value;
  }
  return bases.value.filter(
    x => x.name.toLowerCase().includes(query) || x.naturalId.toLowerCase().includes(query),
  );
});

watch(filtered, () => (highlight.value = 0));

function onFocus(e: FocusEvent) {
  open.value = true;
  highlight.value = Math.max(0, filtered.value.indexOf(selected.value!));
  (e.target as HTMLInputElement).select();
}

function close() {
  open.value = false;
  text.value = selected.value ? label(selected.value) : '';
}

function pick(base: { naturalId: string; name: string } | undefined) {
  if (base) {
    model.value = base.naturalId;
  }
  close();
  input.value?.blur();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    open.value = true;
    highlight.value = Math.min(highlight.value + 1, filtered.value.length - 1);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    highlight.value = Math.max(highlight.value - 1, 0);
    e.preventDefault();
  } else if (e.key === 'Enter') {
    pick(filtered.value[highlight.value]);
    e.preventDefault();
  } else if (e.key === 'Escape') {
    close();
    input.value?.blur();
  }
}
</script>

<template>
  <div :class="$style.container">
    <input
      ref="input"
      v-model="text"
      :class="$style.input"
      type="text"
      autocomplete="off"
      data-1p-ignore="true"
      data-lpignore="true"
      placeholder="Type to search bases"
      @focus="onFocus"
      @blur="close"
      @input="open = true"
      @keydown="onKeydown" />
    <div v-if="open" :class="$style.list">
      <div v-if="filtered.length === 0" :class="$style.empty">No matching base</div>
      <div
        v-for="(base, i) in filtered"
        :key="base.naturalId"
        :class="[$style.item, { [$style.highlight]: i === highlight }]"
        @mouseenter="highlight = i"
        @mousedown.prevent="pick(base)">
        {{ label(base) }}
      </div>
    </div>
  </div>
</template>

<style module>
.container {
  position: relative;
  width: 158px;
  margin-right: 0;
  margin-left: auto;
}

.input {
  width: 100%;
  box-sizing: border-box;
}

.list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
  background: #252525;
  border: 1px solid #3a3a3a;
}

.item {
  padding: 2px 6px;
  text-align: left;
  cursor: pointer;
  color: var(--rp-color-text-component);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.highlight {
  background: #3a3a3a;
  color: var(--rp-color-accent-primary);
}

.empty {
  padding: 2px 6px;
  text-align: left;
  color: var(--rp-color-text);
}
</style>
